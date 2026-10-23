import { BadRequestException, ConflictException } from '@nestjs/common';
import { Emplacement, StatutEmplacement } from '../entities';

export const MAX_EMPLACEMENTS = 5;
export const DUREE_BLOCAGE_MS = 15 * 60 * 1000;

export function validerSelection(ids: string[]): string[] {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) throw new BadRequestException('Choisissez au moins un emplacement');
  if (uniques.length > MAX_EMPLACEMENTS) {
    throw new BadRequestException(`Maximum ${MAX_EMPLACEMENTS} emplacements par commande`);
  }
  return uniques;
}

export function verifierDisponibles(emplacements: Emplacement[]): void {
  const pris = emplacements
    .filter((e) => e.statut !== StatutEmplacement.LIBRE)
    .map((e) => e.numero)
    .sort((a, b) => a - b);
  if (pris.length === 1) throw new ConflictException(`Emplacement n° ${pris[0]} déjà réservé`);
  if (pris.length > 1) throw new ConflictException(`Emplacements n° ${pris.join(', ')} déjà réservés`);
}

export function montantTotal(emplacements: Pick<Emplacement, 'prix'>[]): number {
  return emplacements.reduce((s, e) => s + e.prix, 0);
}

export function dateExpiration(maintenant = new Date()): Date {
  return new Date(maintenant.getTime() + DUREE_BLOCAGE_MS);
}
