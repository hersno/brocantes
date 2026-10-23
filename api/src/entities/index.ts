import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum Role {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}

export enum StatutBrocante {
  BROUILLON = 'BROUILLON',
  PUBLIEE = 'PUBLIEE',
  CLOTUREE = 'CLOTUREE',
}

export enum StatutEmplacement {
  LIBRE = 'LIBRE',
  EN_COURS = 'EN_COURS',
  VENDU = 'VENDU',
  BLOQUE = 'BLOQUE',
}

export enum StatutReservation {
  EN_ATTENTE = 'EN_ATTENTE',
  PAYEE = 'PAYEE',
  EXPIREE = 'EXPIREE',
  ANNULEE = 'ANNULEE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column({ select: false }) passwordHash: string;
  @Column() prenom: string;
  @Column() nom: string;
  @Column({ nullable: true }) telephone?: string;
  @Column({ type: 'enum', enum: Role, default: Role.CLIENT }) role: Role;
  @CreateDateColumn() creeLe: Date;
}

@Entity('brocantes')
export class Brocante {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() nom: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'time' }) heureDebut: string;
  @Column({ type: 'time' }) heureFin: string;
  @Column() adresse: string;
  @Column({ length: 5 }) codePostal: string;
  @Column() ville: string;
  @Column({ length: 3 }) departement: string;
  @Column({ type: 'double precision', nullable: true }) lat?: number;
  @Column({ type: 'double precision', nullable: true }) lng?: number;
  /** Prix par défaut d'un emplacement, en centimes. */
  @Column({ type: 'int', default: 1000 }) prixDefaut: number;
  @Column({ type: 'enum', enum: StatutBrocante, default: StatutBrocante.BROUILLON })
  statut: StatutBrocante;
  @Column({ type: 'bytea', nullable: true, select: false }) photo?: Buffer;
  @Column({ nullable: true }) photoMime?: string;
  @OneToMany(() => Emplacement, (e) => e.brocante, { cascade: true })
  emplacements: Emplacement[];
  @CreateDateColumn() creeLe: Date;
}

@Entity('emplacements')
@Unique(['brocanteId', 'numero'])
export class Emplacement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() brocanteId: string;
  @ManyToOne(() => Brocante, (b) => b.emplacements, { onDelete: 'CASCADE' })
  brocante: Brocante;
  @Column({ type: 'int' }) numero: number;
  /** Position et taille en pourcentage de l'image (0 à 100). */
  @Column({ type: 'double precision' }) x: number;
  @Column({ type: 'double precision' }) y: number;
  @Column({ type: 'double precision' }) largeur: number;
  @Column({ type: 'double precision' }) hauteur: number;
  /** Prix en centimes. */
  @Column({ type: 'int' }) prix: number;
  @Column({ type: 'double precision', default: 2 }) tailleMetres: number;
  @Column({ type: 'enum', enum: StatutEmplacement, default: StatutEmplacement.LIBRE })
  statut: StatutEmplacement;
}

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @ManyToOne(() => User) user: User;
  @Column() brocanteId: string;
  @ManyToOne(() => Brocante) brocante: Brocante;
  @ManyToMany(() => Emplacement)
  @JoinTable({ name: 'reservation_emplacements' })
  emplacements: Emplacement[];
  @Column({ type: 'int' }) montant: number;
  @Column({ type: 'enum', enum: StatutReservation, default: StatutReservation.EN_ATTENTE })
  statut: StatutReservation;
  @Column({ nullable: true }) stripeSessionId?: string;
  @Column({ type: 'timestamptz' }) expireLe: Date;
  @CreateDateColumn() creeLe: Date;
}

export const ENTITIES = [User, Brocante, Emplacement, Reservation];
