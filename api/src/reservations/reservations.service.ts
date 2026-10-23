import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { DataSource, EntityManager, In, LessThan, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth';
import {
  Brocante,
  Emplacement,
  Reservation,
  Role,
  StatutBrocante,
  StatutEmplacement,
  StatutReservation,
  User,
} from '../entities';
import { MailService } from '../mail/mail.service';
import { PaymentGateway } from '../paiements/payment.gateway';
import {
  dateExpiration,
  MAX_EMPLACEMENTS,
  montantTotal,
  validerSelection,
  verifierDisponibles,
} from './reservations.rules';

export class ReserverDto {
  @IsUUID() brocanteId: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_EMPLACEMENTS) @IsUUID('all', { each: true })
  emplacementIds: string[];
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    private readonly gateway: PaymentGateway,
    private readonly mail: MailService,
  ) {}

  /**
   * Bloque les emplacements 15 minutes et ouvre une session de paiement.
   * Le verrou pessimiste (SELECT … FOR UPDATE) garantit qu'un emplacement
   * ne peut pas être pris par deux clients en même temps.
   */
  async reserver(user: JwtPayload, dto: ReserverDto) {
    const ids = validerSelection(dto.emplacementIds);

    const { reservation, brocante, numeros } = await this.dataSource.transaction(async (m) => {
      const brocante = await m.findOne(Brocante, {
        where: { id: dto.brocanteId, statut: StatutBrocante.PUBLIEE },
      });
      if (!brocante) throw new NotFoundException('Brocante introuvable');

      const emps = await this.verrouillerEmplacements(m, ids, dto.brocanteId);
      if (emps.length !== ids.length) throw new NotFoundException('Emplacement introuvable');
      verifierDisponibles(emps);

      await m.update(Emplacement, { id: In(ids) }, { statut: StatutEmplacement.EN_COURS });
      const reservation = await m.save(
        m.create(Reservation, {
          userId: user.sub,
          brocanteId: brocante.id,
          emplacements: emps,
          montant: montantTotal(emps),
          statut: StatutReservation.EN_ATTENTE,
          expireLe: dateExpiration(),
        }),
      );
      return { reservation, brocante, numeros: emps.map((e) => e.numero).sort((a, b) => a - b) };
    });

    try {
      const front = process.env.FRONT_URL ?? 'http://localhost:4200';
      const session = await this.gateway.creerSession({
        reservationId: reservation.id,
        montant: reservation.montant,
        description: `${brocante.nom} – emplacement(s) n° ${numeros.join(', ')}`,
        email: user.email,
        successUrl: `${front}/reservations/${reservation.id}?paiement=ok`,
        cancelUrl: `${front}/reservations/${reservation.id}?paiement=annule`,
      });
      await this.reservations.update(reservation.id, { stripeSessionId: session.id });
      return {
        reservationId: reservation.id,
        montant: reservation.montant,
        expireLe: reservation.expireLe,
        numeros,
        paiementUrl: session.url,
      };
    } catch (e) {
      this.logger.error(`Création de session impossible : ${(e as Error).message}`);
      await this.liberer(reservation.id, StatutReservation.ANNULEE);
      throw new ServiceUnavailableException('Le paiement est indisponible, réessayez dans un instant');
    }
  }

  /** Appelé par le webhook : idempotent, rejouable sans effet de bord. */
  async confirmerPaiement(sessionId: string): Promise<{ confirme: boolean }> {
    const resultat = await this.dataSource.transaction(async (m) => {
      const r = await m
        .createQueryBuilder(Reservation, 'r')
        .setLock('pessimistic_write')
        .where('r.stripeSessionId = :sessionId', { sessionId })
        .getOne();
      if (!r) {
        this.logger.warn(`Session de paiement inconnue : ${sessionId}`);
        return null;
      }
      if (r.statut === StatutReservation.PAYEE) return { r, dejaFait: true, emps: [] as Emplacement[] };

      const ids = await this.idsEmplacements(m, r.id);
      const emps = await this.verrouillerEmplacements(m, ids, r.brocanteId);
      const attendu =
        r.statut === StatutReservation.EN_ATTENTE ? StatutEmplacement.EN_COURS : StatutEmplacement.LIBRE;
      if (emps.some((e) => e.statut !== attendu)) {
        // Payé après expiration et emplacement revendu entre-temps : remboursement manuel.
        this.logger.error(`Réservation ${r.id} payée mais emplacements indisponibles : à rembourser`);
        return { r, dejaFait: true, emps: [] as Emplacement[], aRembourser: true };
      }
      await m.update(Emplacement, { id: In(ids) }, { statut: StatutEmplacement.VENDU });
      await m.update(Reservation, { id: r.id }, { statut: StatutReservation.PAYEE });
      return { r, dejaFait: false, emps };
    });

    if (!resultat) return { confirme: false };
    if (resultat.dejaFait) return { confirme: !('aRembourser' in resultat) };

    const { r, emps } = resultat;
    const [user, brocante] = await Promise.all([
      this.dataSource.getRepository(User).findOneByOrFail({ id: r.userId }),
      this.dataSource.getRepository(Brocante).findOneByOrFail({ id: r.brocanteId }),
    ]);
    await this.mail.envoyerConfirmation({
      to: user.email,
      prenom: user.prenom,
      brocante: brocante.nom,
      date: brocante.date,
      heureDebut: brocante.heureDebut,
      adresse: `${brocante.adresse}, ${brocante.codePostal} ${brocante.ville}`,
      numeros: emps.map((e) => e.numero).sort((a, b) => a - b),
      montant: r.montant,
      reference: r.id.slice(0, 8).toUpperCase(),
    });
    return { confirme: true };
  }

  /** Remet les emplacements en vente si la réservation est encore en attente. */
  async liberer(reservationId: string, statut: StatutReservation.EXPIREE | StatutReservation.ANNULEE) {
    return this.dataSource.transaction(async (m) => {
      const r = await m
        .createQueryBuilder(Reservation, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: reservationId })
        .getOne();
      if (!r || r.statut !== StatutReservation.EN_ATTENTE) return false;
      const ids = await this.idsEmplacements(m, r.id);
      if (ids.length) {
        await m.update(
          Emplacement,
          { id: In(ids), statut: StatutEmplacement.EN_COURS },
          { statut: StatutEmplacement.LIBRE },
        );
      }
      await m.update(Reservation, { id: r.id }, { statut });
      return true;
    });
  }

  async libererSession(sessionId: string) {
    const r = await this.reservations.findOne({ where: { stripeSessionId: sessionId } });
    if (r) await this.liberer(r.id, StatutReservation.EXPIREE);
  }

  /** Tâche planifiée : libère les réservations non payées après 15 minutes. */
  async libererExpirees(maintenant = new Date()): Promise<number> {
    const expirees = await this.reservations.find({
      where: { statut: StatutReservation.EN_ATTENTE, expireLe: LessThan(maintenant) },
    });
    let n = 0;
    for (const r of expirees) {
      if (await this.liberer(r.id, StatutReservation.EXPIREE)) {
        n++;
        if (r.stripeSessionId) await this.gateway.expirerSession(r.stripeSessionId);
      }
    }
    if (n) this.logger.log(`${n} réservation(s) expirée(s) libérée(s)`);
    return n;
  }

  async annuler(user: JwtPayload, id: string) {
    const r = await this.detail(user, id);
    await this.liberer(r.id, StatutReservation.ANNULEE);
    if (r.stripeSessionId) await this.gateway.expirerSession(r.stripeSessionId);
    return this.detail(user, id);
  }

  async detail(user: JwtPayload, id: string) {
    const r = await this.reservations.findOne({
      where: { id },
      relations: { emplacements: true, brocante: true },
    });
    if (!r) throw new NotFoundException('Réservation introuvable');
    if (r.userId !== user.sub && user.role !== Role.ADMIN) throw new ForbiddenException();
    return r;
  }

  mesReservations(userId: string) {
    return this.reservations.find({
      where: { userId },
      relations: { emplacements: true, brocante: true },
      order: { creeLe: 'DESC' },
    });
  }

  /** Vue admin : qui a payé quels emplacements. */
  pourBrocante(brocanteId: string) {
    return this.reservations.find({
      where: { brocanteId, statut: In([StatutReservation.PAYEE, StatutReservation.EN_ATTENTE]) },
      relations: { emplacements: true, user: true },
      order: { creeLe: 'ASC' },
    });
  }

  private verrouillerEmplacements(m: EntityManager, ids: string[], brocanteId: string) {
    if (!ids.length) return Promise.resolve([] as Emplacement[]);
    return m
      .createQueryBuilder(Emplacement, 'e')
      .setLock('pessimistic_write')
      .where('e.id IN (:...ids)', { ids })
      .andWhere('e.brocanteId = :brocanteId', { brocanteId })
      .orderBy('e.id')
      .getMany();
  }

  private async idsEmplacements(m: EntityManager, reservationId: string): Promise<string[]> {
    const emps = await m
      .createQueryBuilder()
      .relation(Reservation, 'emplacements')
      .of(reservationId)
      .loadMany<Emplacement>();
    return emps.map((e) => e.id);
  }
}
