import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { Brocante, Emplacement, StatutBrocante, StatutEmplacement } from '../entities';
import { EmplacementInput, validerHoraires, validerPlan } from './emplacements.rules';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TAILLE_PAGE = 20;
export const MIMES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];

export class BrocanteDto {
  @IsString() @Length(3, 120) nom: string;
  @IsOptional() @IsString() description?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @Matches(HEURE) heureDebut: string;
  @Matches(HEURE) heureFin: string;
  @IsString() @Length(3, 200) adresse: string;
  @Matches(/^\d{5}$/, { message: 'Le code postal doit contenir 5 chiffres' }) codePostal: string;
  @IsString() @Length(1, 100) ville: string;
  @IsOptional() @IsInt() @Min(0) prixDefaut?: number;
}

export class EmplacementDto implements EmplacementInput {
  @IsInt() @Min(1) numero: number;
  @IsNumber() @Min(0) @Max(100) x: number;
  @IsNumber() @Min(0) @Max(100) y: number;
  @IsNumber() @Min(0.1) @Max(100) largeur: number;
  @IsNumber() @Min(0.1) @Max(100) hauteur: number;
  @IsOptional() @IsInt() @Min(0) prix?: number;
  @IsOptional() @IsNumber() @Min(0.5) tailleMetres?: number;
}

export class PlanDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => EmplacementDto)
  emplacements: EmplacementDto[];
}

export class RechercheDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() departement?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) du?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) au?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

/** Département déduit du code postal (gère la Corse et l'outre-mer). */
export function departementDepuisCodePostal(cp: string): string {
  if (cp.startsWith('97') || cp.startsWith('98')) return cp.slice(0, 3);
  if (cp.startsWith('20')) return Number(cp) < 20200 ? '2A' : '2B';
  return cp.slice(0, 2);
}

@Injectable()
export class GeocodageService {
  private readonly logger = new Logger(GeocodageService.name);

  /** Interroge la Base Adresse Nationale ; ne bloque jamais la création. */
  async geocoder(adresse: string, codePostal: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&postcode=${codePostal}&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const body: any = await res.json();
      const [lng, lat] = body?.features?.[0]?.geometry?.coordinates ?? [];
      return typeof lat === 'number' ? { lat, lng } : null;
    } catch (e) {
      this.logger.warn(`Géocodage impossible : ${(e as Error).message}`);
      return null;
    }
  }
}

@Injectable()
export class BrocantesService {
  constructor(
    @InjectRepository(Brocante) private readonly brocantes: Repository<Brocante>,
    @InjectRepository(Emplacement) private readonly emplacements: Repository<Emplacement>,
    private readonly dataSource: DataSource,
    private readonly geocodage: GeocodageService,
  ) {}

  async creer(dto: BrocanteDto): Promise<Brocante> {
    validerHoraires(dto.date, dto.heureDebut, dto.heureFin);
    const coords = await this.geocodage.geocoder(dto.adresse, dto.codePostal);
    return this.brocantes.save(
      this.brocantes.create({
        ...dto,
        departement: departementDepuisCodePostal(dto.codePostal),
        lat: coords?.lat,
        lng: coords?.lng,
        statut: StatutBrocante.BROUILLON,
      }),
    );
  }

  async modifier(id: string, dto: BrocanteDto): Promise<Brocante> {
    const b = await this.trouver(id);
    validerHoraires(dto.date, dto.heureDebut, dto.heureFin);
    Object.assign(b, dto, { departement: departementDepuisCodePostal(dto.codePostal) });
    return this.brocantes.save(b);
  }

  async trouver(id: string): Promise<Brocante> {
    const b = await this.brocantes.findOne({ where: { id }, relations: { emplacements: true } });
    if (!b) throw new NotFoundException('Brocante introuvable');
    b.emplacements?.sort((a, c) => a.numero - c.numero);
    return b;
  }

  async trouverPubliee(id: string): Promise<Brocante> {
    const b = await this.trouver(id);
    if (b.statut !== StatutBrocante.PUBLIEE) throw new NotFoundException('Brocante introuvable');
    return b;
  }

  listerAdmin(): Promise<Brocante[]> {
    return this.brocantes.find({ order: { date: 'ASC' } });
  }

  async enregistrerPhoto(id: string, fichier?: { buffer: Buffer; mimetype: string; size: number }) {
    if (!fichier) throw new BadRequestException('Photo manquante');
    if (!MIMES_PHOTO.includes(fichier.mimetype)) {
      throw new BadRequestException('Format accepté : JPEG, PNG ou WebP');
    }
    await this.trouver(id);
    const vendus = await this.emplacements.count({
      where: { brocanteId: id, statut: In([StatutEmplacement.VENDU, StatutEmplacement.EN_COURS]) },
    });
    if (vendus > 0) throw new ConflictException('Photo non modifiable : des emplacements sont réservés');
    await this.brocantes.update(id, { photo: fichier.buffer, photoMime: fichier.mimetype });
    return { ok: true };
  }

  async photo(id: string): Promise<{ data: Buffer; mime: string }> {
    const b = await this.brocantes
      .createQueryBuilder('b')
      .addSelect('b.photo')
      .where('b.id = :id', { id })
      .getOne();
    if (!b?.photo || !b.photoMime) throw new NotFoundException('Pas de photo');
    return { data: b.photo, mime: b.photoMime };
  }

  /** Remplace le plan complet ; interdit dès qu'un emplacement est réservé. */
  async enregistrerPlan(id: string, dto: PlanDto): Promise<Emplacement[]> {
    const b = await this.trouver(id);
    validerPlan(dto.emplacements);
    const bloquants = b.emplacements.filter(
      (e) => e.statut === StatutEmplacement.VENDU || e.statut === StatutEmplacement.EN_COURS,
    );
    if (bloquants.length > 0) {
      throw new ConflictException('Plan non modifiable : des emplacements sont déjà réservés');
    }
    return this.dataSource.transaction(async (m) => {
      await m.delete(Emplacement, { brocanteId: id });
      const nouveaux = dto.emplacements.map((e) =>
        m.create(Emplacement, {
          ...e,
          brocanteId: id,
          prix: e.prix ?? b.prixDefaut,
          tailleMetres: e.tailleMetres ?? 2,
          statut: StatutEmplacement.LIBRE,
        }),
      );
      const saved = await m.save(nouveaux);
      return saved.sort((a, c) => a.numero - c.numero);
    });
  }

  async publier(id: string): Promise<Brocante> {
    const b = await this.trouver(id);
    const avecPhoto = await this.brocantes
      .createQueryBuilder('b')
      .where('b.id = :id AND b.photo IS NOT NULL', { id })
      .getCount();
    if (!avecPhoto) throw new BadRequestException('Ajoutez une photo avant de publier');
    if (!b.emplacements.length) throw new BadRequestException('Tracez au moins un emplacement');
    b.statut = StatutBrocante.PUBLIEE;
    await this.brocantes.update(id, { statut: StatutBrocante.PUBLIEE });
    return b;
  }

  async bloquer(brocanteId: string, emplacementId: string, bloque: boolean): Promise<Emplacement> {
    const e = await this.emplacements.findOne({ where: { id: emplacementId, brocanteId } });
    if (!e) throw new NotFoundException('Emplacement introuvable');
    const attendu = bloque ? StatutEmplacement.LIBRE : StatutEmplacement.BLOQUE;
    if (e.statut !== attendu) throw new ConflictException(`Emplacement n° ${e.numero} non modifiable`);
    e.statut = bloque ? StatutEmplacement.BLOQUE : StatutEmplacement.LIBRE;
    return this.emplacements.save(e);
  }

  async rechercher(q: RechercheDto) {
    const page = q.page ?? 1;
    const qb = this.brocantes
      .createQueryBuilder('b')
      .where('b.statut = :s', { s: StatutBrocante.PUBLIEE })
      .andWhere('b.date >= CURRENT_DATE');
    if (q.ville) {
      qb.andWhere('(b.ville ILIKE :ville OR b.codePostal = :cp)', { ville: `%${q.ville}%`, cp: q.ville });
    }
    if (q.departement) qb.andWhere('b.departement = :dep', { dep: q.departement.toUpperCase() });
    if (q.du) qb.andWhere('b.date >= :du', { du: q.du });
    if (q.au) qb.andWhere('b.date <= :au', { au: q.au });
    if (q.q) qb.andWhere('b.nom ILIKE :q', { q: `%${q.q}%` });
    qb.orderBy('b.date', 'ASC').skip((page - 1) * TAILLE_PAGE).take(TAILLE_PAGE);
    const [items, total] = await qb.getManyAndCount();
    const stats = items.length
      ? await this.emplacements
          .createQueryBuilder('e')
          .select('e.brocanteId', 'brocanteId')
          .addSelect(`COUNT(*) FILTER (WHERE e.statut = 'LIBRE')`, 'libres')
          .addSelect('MIN(e.prix)', 'prixMin')
          .where('e.brocanteId IN (:...ids)', { ids: items.map((b) => b.id) })
          .groupBy('e.brocanteId')
          .getRawMany<{ brocanteId: string; libres: string; prixMin: string }>()
      : [];
    const parId = new Map(stats.map((s) => [s.brocanteId, s]));
    return {
      page,
      total,
      items: items.map((b) => ({
        ...b,
        emplacementsLibres: Number(parId.get(b.id)?.libres ?? 0),
        prixMin: parId.get(b.id) ? Number(parId.get(b.id)!.prixMin) : null,
      })),
    };
  }
}
