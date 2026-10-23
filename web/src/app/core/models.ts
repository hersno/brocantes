export type Role = 'ADMIN' | 'CLIENT';
export type StatutEmplacement = 'LIBRE' | 'EN_COURS' | 'VENDU' | 'BLOQUE';
export type StatutBrocante = 'BROUILLON' | 'PUBLIEE' | 'CLOTUREE';
export type StatutReservation = 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE' | 'ANNULEE';

export interface Utilisateur {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  user: Utilisateur;
}

export interface Emplacement {
  id?: string;
  numero: number;
  /** Position et taille en % de la photo. */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Centimes. */
  prix?: number;
  tailleMetres?: number;
  statut?: StatutEmplacement;
}

export interface Brocante {
  id: string;
  nom: string;
  description?: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  prixDefaut: number;
  statut: StatutBrocante;
  photoMime?: string;
  emplacements?: Emplacement[];
  emplacementsLibres?: number;
  prixMin?: number | null;
}

export interface BrocanteSaisie {
  nom: string;
  description?: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  adresse: string;
  codePostal: string;
  ville: string;
  prixDefaut: number;
}

export interface Recherche {
  q?: string;
  ville?: string;
  departement?: string;
  du?: string;
  au?: string;
  page?: number;
}

export interface PageResultats<T> {
  page: number;
  total: number;
  items: T[];
}

export interface Reservation {
  id: string;
  statut: StatutReservation;
  montant: number;
  expireLe: string;
  brocante?: Brocante;
  emplacements: Emplacement[];
  user?: Utilisateur;
}

export interface ReservationCreee {
  reservationId: string;
  montant: number;
  expireLe: string;
  numeros: number[];
  paiementUrl: string;
}
