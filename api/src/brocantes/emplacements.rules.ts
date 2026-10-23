import { BadRequestException } from '@nestjs/common';

export interface EmplacementInput {
  numero: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  prix?: number;
  tailleMetres?: number;
}

/**
 * Valide le plan tracé par l'admin : numéros uniques et positifs,
 * rectangles contenus dans l'image (coordonnées en %).
 */
export function validerPlan(emplacements: EmplacementInput[]): void {
  const vus = new Set<number>();
  for (const e of emplacements) {
    if (!Number.isInteger(e.numero) || e.numero < 1) {
      throw new BadRequestException(`Numéro d'emplacement invalide : ${e.numero}`);
    }
    if (vus.has(e.numero)) {
      throw new BadRequestException(`Numéro d'emplacement en double : ${e.numero}`);
    }
    vus.add(e.numero);
    const dansImage =
      e.x >= 0 && e.y >= 0 && e.largeur > 0 && e.hauteur > 0 &&
      e.x + e.largeur <= 100.0001 && e.y + e.hauteur <= 100.0001;
    if (!dansImage) {
      throw new BadRequestException(`L'emplacement n° ${e.numero} sort de l'image`);
    }
    if (e.prix !== undefined && (!Number.isInteger(e.prix) || e.prix < 0)) {
      throw new BadRequestException(`Prix invalide pour l'emplacement n° ${e.numero}`);
    }
  }
}

/** Prochain numéro libre pour la numérotation automatique. */
export function prochainNumero(numeros: number[]): number {
  return numeros.length === 0 ? 1 : Math.max(...numeros) + 1;
}

/** Vérifie les règles de date/heure d'une brocante. */
export function validerHoraires(date: string, heureDebut: string, heureFin: string, maintenant = new Date()): void {
  const jour = new Date(`${date}T00:00:00`);
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (Number.isNaN(jour.getTime()) || jour < aujourdhui) {
    throw new BadRequestException('La date doit être aujourd\'hui ou dans le futur');
  }
  if (heureFin <= heureDebut) {
    throw new BadRequestException('L\'heure de fin doit être après l\'heure de début');
  }
}
