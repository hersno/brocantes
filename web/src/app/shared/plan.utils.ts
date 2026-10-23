import { Emplacement, StatutEmplacement } from '../core/models';

export const MAX_SELECTION = 5;
export const TAILLE_DEFAUT = 6; // % de l'image pour un clic simple

export function prochainNumero(emplacements: Pick<Emplacement, 'numero'>[]): number {
  return emplacements.length ? Math.max(...emplacements.map((e) => e.numero)) + 1 : 1;
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const arrondi = (v: number) => Math.round(v * 100) / 100;

/** Convertit un point écran en coordonnées % de l'image. */
export function versPourcentage(clientX: number, clientY: number, cadre: { left: number; top: number; width: number; height: number }) {
  return {
    x: arrondi(borner(((clientX - cadre.left) / cadre.width) * 100, 0, 100)),
    y: arrondi(borner(((clientY - cadre.top) / cadre.height) * 100, 0, 100)),
  };
}

/**
 * Rectangle à partir d'un glisser (départ → arrivée).
 * Un simple clic (déplacement < 1 %) pose un emplacement de taille par défaut centré sur le point.
 */
export function rectangleDepuisGlisser(
  depart: { x: number; y: number },
  arrivee: { x: number; y: number },
  taille = TAILLE_DEFAUT,
): Pick<Emplacement, 'x' | 'y' | 'largeur' | 'hauteur'> {
  const dx = Math.abs(arrivee.x - depart.x);
  const dy = Math.abs(arrivee.y - depart.y);
  if (dx < 1 && dy < 1) {
    return {
      x: arrondi(borner(depart.x - taille / 2, 0, 100 - taille)),
      y: arrondi(borner(depart.y - taille / 2, 0, 100 - taille)),
      largeur: taille,
      hauteur: taille,
    };
  }
  return {
    x: arrondi(Math.min(depart.x, arrivee.x)),
    y: arrondi(Math.min(depart.y, arrivee.y)),
    largeur: arrondi(Math.max(dx, 1)),
    hauteur: arrondi(Math.max(dy, 1)),
  };
}

/** Déplace un emplacement en le gardant dans l'image. */
export function deplacer<T extends Emplacement>(e: T, x: number, y: number): T {
  return { ...e, x: arrondi(borner(x, 0, 100 - e.largeur)), y: arrondi(borner(y, 0, 100 - e.hauteur)) };
}

/** Copie l'emplacement juste à droite (ou en dessous s'il n'y a plus de place). */
export function dupliquer<T extends Emplacement>(e: T, numero: number): Emplacement {
  const aDroite = e.x + 2 * e.largeur + 0.5 <= 100;
  return {
    numero,
    largeur: e.largeur,
    hauteur: e.hauteur,
    prix: e.prix,
    tailleMetres: e.tailleMetres,
    x: aDroite ? arrondi(e.x + e.largeur + 0.5) : e.x,
    y: aDroite ? e.y : arrondi(borner(e.y + e.hauteur + 0.5, 0, 100 - e.hauteur)),
  };
}

export function estSelectionnable(statut?: StatutEmplacement): boolean {
  return statut === undefined || statut === 'LIBRE';
}

/** Ajoute ou retire un emplacement de la sélection, en respectant le maximum. */
export function basculerSelection(selection: string[], e: Emplacement, max = MAX_SELECTION): string[] {
  if (!e.id || !estSelectionnable(e.statut)) return selection;
  if (selection.includes(e.id)) return selection.filter((id) => id !== e.id);
  if (selection.length >= max) return selection;
  return [...selection, e.id];
}

export function etatVisuel(e: Emplacement, selection: string[]): 'selectionne' | 'libre' | 'en-cours' | 'vendu' | 'bloque' {
  if (e.id && selection.includes(e.id)) return 'selectionne';
  switch (e.statut) {
    case 'EN_COURS': return 'en-cours';
    case 'VENDU': return 'vendu';
    case 'BLOQUE': return 'bloque';
    default: return 'libre';
  }
}

export function euros(centimes = 0): string {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function libelle(e: Emplacement, selection: string[] = []): string {
  const etats = { selectionne: 'sélectionné', libre: 'libre', 'en-cours': 'en cours de réservation', vendu: 'vendu', bloque: 'réservé organisateur' };
  return `Emplacement ${e.numero}, ${etats[etatVisuel(e, selection)]}, ${euros(e.prix)}`;
}
