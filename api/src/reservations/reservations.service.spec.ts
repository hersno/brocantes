import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Role, StatutBrocante, StatutEmplacement, StatutReservation } from '../entities';
import { fauxQb } from '../test-utils';
import { ReservationsService } from './reservations.service';

const client = { sub: 'u1', email: 'client@test.fr', role: Role.CLIENT };
const brocante = { id: 'b1', nom: 'Brocante de Lyon', statut: StatutBrocante.PUBLIEE, date: '2027-05-01', heureDebut: '07:00:00', adresse: '1 rue A', codePostal: '69001', ville: 'Lyon' };
const emp = (id: string, numero: number, statut = StatutEmplacement.LIBRE) => ({ id, numero, statut, prix: 1500, brocanteId: 'b1' });

function monter(opts: { emps?: any[]; reservation?: any } = {}) {
  const qb = fauxQb({ many: opts.emps ?? [], one: opts.reservation });
  const manager: any = {
    findOne: jest.fn().mockResolvedValue(brocante),
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((_: unknown, data: any) => data),
    save: jest.fn(async (data: any) => ({ ...data, id: 'r1' })),
  };
  const repos: Record<string, any> = {
    User: { findOneByOrFail: jest.fn().mockResolvedValue({ email: 'client@test.fr', prenom: 'Léa' }) },
    Brocante: { findOneByOrFail: jest.fn().mockResolvedValue(brocante) },
  };
  const dataSource: any = {
    transaction: jest.fn((cb: any) => cb(manager)),
    getRepository: jest.fn((e: any) => repos[e.name]),
  };
  const reservations: any = {
    update: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const gateway: any = {
    creerSession: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://pay.test/cs_1' }),
    expirerSession: jest.fn().mockResolvedValue(undefined),
    lireEvenement: jest.fn(),
  };
  const mail: any = { envoyerConfirmation: jest.fn().mockResolvedValue(undefined) };
  const service = new ReservationsService(dataSource, reservations, gateway, mail);
  return { service, manager, qb, reservations, gateway, mail, dataSource };
}

describe('ReservationsService.reserver', () => {
  it('bloque les emplacements et renvoie le lien de paiement', async () => {
    const { service, manager, qb, gateway, reservations } = monter({ emps: [emp('e2', 2), emp('e1', 1)] });
    const res = await service.reserver(client, { brocanteId: 'b1', emplacementIds: ['e1', 'e2'] });

    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), { statut: StatutEmplacement.EN_COURS });
    expect(res).toMatchObject({ reservationId: 'r1', montant: 3000, numeros: [1, 2], paiementUrl: 'https://pay.test/cs_1' });
    expect(gateway.creerSession).toHaveBeenCalledWith(expect.objectContaining({ montant: 3000, email: 'client@test.fr' }));
    expect(reservations.update).toHaveBeenCalledWith('r1', { stripeSessionId: 'cs_1' });
  });

  it('refuse un emplacement déjà vendu sans ouvrir de paiement', async () => {
    const { service, gateway } = monter({ emps: [emp('e1', 1), emp('e3', 3, StatutEmplacement.VENDU)] });
    await expect(service.reserver(client, { brocanteId: 'b1', emplacementIds: ['e1', 'e3'] })).rejects.toThrow(
      new ConflictException('Emplacement n° 3 déjà réservé'),
    );
    expect(gateway.creerSession).not.toHaveBeenCalled();
  });

  it('refuse une brocante non publiée', async () => {
    const { service, manager } = monter();
    manager.findOne.mockResolvedValue(null);
    await expect(service.reserver(client, { brocanteId: 'b1', emplacementIds: ['e1'] })).rejects.toThrow(NotFoundException);
  });

  it('refuse un emplacement d\'une autre brocante', async () => {
    const { service } = monter({ emps: [] });
    await expect(service.reserver(client, { brocanteId: 'b1', emplacementIds: ['e1'] })).rejects.toThrow('Emplacement introuvable');
  });

  it('libère les emplacements si le paiement est indisponible', async () => {
    const { service, gateway } = monter({ emps: [emp('e1', 1)] });
    gateway.creerSession.mockRejectedValue(new Error('Stripe down'));
    const liberer = jest.spyOn(service, 'liberer').mockResolvedValue(true);
    await expect(service.reserver(client, { brocanteId: 'b1', emplacementIds: ['e1'] })).rejects.toThrow(ServiceUnavailableException);
    expect(liberer).toHaveBeenCalledWith('r1', StatutReservation.ANNULEE);
  });
});

describe('ReservationsService.confirmerPaiement', () => {
  const enAttente = { id: 'r1-abcdef', userId: 'u1', brocanteId: 'b1', montant: 1500, statut: StatutReservation.EN_ATTENTE };

  it('passe les emplacements en VENDU et envoie l\'e-mail', async () => {
    const { service, manager, mail } = monter({ reservation: enAttente, emps: [emp('e1', 4, StatutEmplacement.EN_COURS)] });
    await expect(service.confirmerPaiement('cs_1')).resolves.toEqual({ confirme: true });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), { statut: StatutEmplacement.VENDU });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'r1-abcdef' }, { statut: StatutReservation.PAYEE });
    expect(mail.envoyerConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@test.fr', numeros: [4], montant: 1500, reference: 'R1-ABCDE' }),
    );
  });

  it('est idempotent quand le webhook est rejoué', async () => {
    const { service, mail, manager } = monter({ reservation: { ...enAttente, statut: StatutReservation.PAYEE } });
    await expect(service.confirmerPaiement('cs_1')).resolves.toEqual({ confirme: true });
    expect(manager.update).not.toHaveBeenCalled();
    expect(mail.envoyerConfirmation).not.toHaveBeenCalled();
  });

  it('reprend une réservation expirée si les emplacements sont encore libres', async () => {
    const { service, mail } = monter({ reservation: { ...enAttente, statut: StatutReservation.EXPIREE }, emps: [emp('e1', 1)] });
    await expect(service.confirmerPaiement('cs_1')).resolves.toEqual({ confirme: true });
    expect(mail.envoyerConfirmation).toHaveBeenCalled();
  });

  it('signale un remboursement si l\'emplacement a été revendu', async () => {
    const { service, mail } = monter({
      reservation: { ...enAttente, statut: StatutReservation.EXPIREE },
      emps: [emp('e1', 1, StatutEmplacement.EN_COURS)],
    });
    await expect(service.confirmerPaiement('cs_1')).resolves.toEqual({ confirme: false });
    expect(mail.envoyerConfirmation).not.toHaveBeenCalled();
  });

  it('ignore une session inconnue', async () => {
    const { service } = monter({ reservation: null });
    await expect(service.confirmerPaiement('cs_x')).resolves.toEqual({ confirme: false });
  });
});

describe('ReservationsService.liberer et expiration', () => {
  it('remet en vente les emplacements d\'une réservation en attente', async () => {
    const { service, manager } = monter({ reservation: { id: 'r1', statut: StatutReservation.EN_ATTENTE }, emps: [emp('e1', 1)] });
    await expect(service.liberer('r1', StatutReservation.EXPIREE)).resolves.toBe(true);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ statut: StatutEmplacement.EN_COURS }), { statut: StatutEmplacement.LIBRE });
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'r1' }, { statut: StatutReservation.EXPIREE });
  });

  it('ne touche pas une réservation payée', async () => {
    const { service, manager } = monter({ reservation: { id: 'r1', statut: StatutReservation.PAYEE } });
    await expect(service.liberer('r1', StatutReservation.EXPIREE)).resolves.toBe(false);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('libère les réservations expirées et ferme leur session Stripe', async () => {
    const { service, reservations, gateway } = monter();
    reservations.find.mockResolvedValue([{ id: 'r1', stripeSessionId: 'cs_1' }, { id: 'r2', stripeSessionId: 'cs_2' }]);
    jest.spyOn(service, 'liberer').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.libererExpirees()).resolves.toBe(1);
    expect(gateway.expirerSession).toHaveBeenCalledTimes(1);
    expect(gateway.expirerSession).toHaveBeenCalledWith('cs_1');
  });

  it('libère via l\'identifiant de session Stripe', async () => {
    const { service, reservations } = monter();
    reservations.findOne.mockResolvedValue({ id: 'r9' });
    const liberer = jest.spyOn(service, 'liberer').mockResolvedValue(true);
    await service.libererSession('cs_9');
    expect(liberer).toHaveBeenCalledWith('r9', StatutReservation.EXPIREE);
  });
});

describe('ReservationsService consultation', () => {
  it('interdit de voir la réservation d\'un autre client', async () => {
    const { service, reservations } = monter();
    reservations.findOne.mockResolvedValue({ id: 'r1', userId: 'autre' });
    await expect(service.detail(client, 'r1')).rejects.toThrow(ForbiddenException);
  });

  it('autorise l\'admin', async () => {
    const { service, reservations } = monter();
    reservations.findOne.mockResolvedValue({ id: 'r1', userId: 'autre' });
    await expect(service.detail({ ...client, role: Role.ADMIN }, 'r1')).resolves.toMatchObject({ id: 'r1' });
  });

  it('renvoie 404 si la réservation n\'existe pas', async () => {
    const { service } = monter();
    await expect(service.detail(client, 'rx')).rejects.toThrow(NotFoundException);
  });

  it('annule une réservation en attente', async () => {
    const { service, reservations, gateway } = monter();
    reservations.findOne.mockResolvedValue({ id: 'r1', userId: 'u1', stripeSessionId: 'cs_1' });
    const liberer = jest.spyOn(service, 'liberer').mockResolvedValue(true);
    await service.annuler(client, 'r1');
    expect(liberer).toHaveBeenCalledWith('r1', StatutReservation.ANNULEE);
    expect(gateway.expirerSession).toHaveBeenCalledWith('cs_1');
  });

  it('liste les réservations du client et de la brocante', async () => {
    const { service, reservations } = monter();
    await service.mesReservations('u1');
    await service.pourBrocante('b1');
    expect(reservations.find).toHaveBeenCalledTimes(2);
  });
});
