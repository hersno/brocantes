import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Brocante, Emplacement, Reservation } from '../core/models';
import { PlanCliquableComponent } from '../shared/plan-cliquable.component';
import { PlanEditeurComponent } from '../shared/plan-editeur.component';
import { euros } from '../shared/plan.utils';
import { redimensionner } from './photo.utils';

type Etape = 'infos' | 'photo' | 'plan' | 'publication';

@Component({
  selector: 'app-admin-brocante',
  imports: [ReactiveFormsModule, PlanEditeurComponent, PlanCliquableComponent],
  template: `
    <h1>{{ brocante()?.nom ?? 'Nouvelle brocante' }}</h1>
    <nav class="etapes" aria-label="Étapes">
      @for (e of etapes; track e.id; let i = $index) {
        <button type="button" [class.active]="etape() === e.id" [disabled]="i > 0 && !brocante()" (click)="etape.set(e.id)">
          {{ i + 1 }}. {{ e.libelle }}
        </button>
      }
    </nav>
    @if (message()) { <p class="succes" role="status">{{ message() }}</p> }
    @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }

    @switch (etape()) {
      @case ('infos') {
        <form class="carte formulaire" [formGroup]="form" (ngSubmit)="enregistrerInfos()">
          <label>Nom <input formControlName="nom" /></label>
          <div class="ligne">
            <label>Date <input type="date" formControlName="date" /></label>
            <label>Début <input type="time" formControlName="heureDebut" /></label>
            <label>Fin <input type="time" formControlName="heureFin" /></label>
          </div>
          <label>Adresse <input formControlName="adresse" autocomplete="street-address" /></label>
          <div class="ligne">
            <label>Code postal <input formControlName="codePostal" inputmode="numeric" maxlength="5" /></label>
            <label>Ville <input formControlName="ville" /></label>
            <label>Prix par défaut (€) <input type="number" min="0" step="0.5" formControlName="prixEuros" /></label>
          </div>
          <label>Description <textarea formControlName="description" rows="3"></textarea></label>
          <button class="principal" [disabled]="form.invalid || envoi()">Enregistrer et continuer</button>
        </form>
      }
      @case ('photo') {
        <section class="carte">
          <p>Prenez la place en photo depuis votre téléphone (vue large, de préférence en hauteur) ou importez une image.</p>
          <label class="bouton principal">
            Prendre / choisir une photo
            <input type="file" accept="image/*" capture="environment" hidden (change)="photoChoisie($event)" />
          </label>
          @if (photoUrl()) { <img class="apercu" [src]="photoUrl()" alt="Photo actuelle de la place" /> }
        </section>
      }
      @case ('plan') {
        <section class="carte">
          @if (photoUrl()) {
            <app-plan-editeur [photoUrl]="photoUrl()" [prixDefaut]="brocante()!.prixDefaut" [(emplacements)]="plan" />
            <button class="principal" (click)="enregistrerPlan()" [disabled]="envoi()">Enregistrer le plan</button>
          } @else {
            <p>Ajoutez d'abord une photo de la place.</p>
          }
        </section>
      }
      @case ('publication') {
        <section class="carte">
          <p>Statut : <strong>{{ brocante()?.statut }}</strong> · {{ plan().length }} emplacement(s)</p>
          @if (brocante()?.statut === 'BROUILLON') {
            <button class="principal" (click)="publier()" [disabled]="envoi()">Publier la brocante</button>
          }
          @if (photoUrl() && brocante()?.statut === 'PUBLIEE') {
            <h2>Plan cliquable publié</h2>
            <app-plan-cliquable [photoUrl]="photoUrl()" [emplacements]="brocante()!.emplacements ?? []" [lectureSeule]="true" />
            <h2>Réservations</h2>
            <table class="tableau">
              <thead><tr><th>Exposant</th><th>E-mail</th><th>Emplacements</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                @for (r of reservations(); track r.id) {
                  <tr>
                    <td>{{ r.user?.prenom }} {{ r.user?.nom }}</td>
                    <td>{{ r.user?.email }}</td>
                    <td>{{ numeros(r) }}</td>
                    <td>{{ euros(r.montant) }}</td>
                    <td>{{ r.statut }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5">Aucune réservation.</td></tr>
                }
              </tbody>
            </table>
            <h2>Bloquer un emplacement (réservé organisateur)</h2>
            <div class="blocage">
              @for (e of brocante()!.emplacements ?? []; track e.id) {
                @if (e.statut === 'LIBRE' || e.statut === 'BLOQUE') {
                  <button type="button" (click)="bloquer(e)">{{ e.statut === 'BLOQUE' ? 'Débloquer' : 'Bloquer' }} n° {{ e.numero }}</button>
                }
              }
            </div>
          }
        </section>
      }
    }
  `,
})
export class AdminBrocanteComponent implements OnInit {
  readonly id = input<string>();
  private readonly api = inject(ApiService);
  private readonly location = inject(Location);
  readonly euros = euros;
  readonly etapes: { id: Etape; libelle: string }[] = [
    { id: 'infos', libelle: 'Informations' },
    { id: 'photo', libelle: 'Photo' },
    { id: 'plan', libelle: 'Emplacements' },
    { id: 'publication', libelle: 'Publication' },
  ];
  readonly etape = signal<Etape>('infos');
  readonly brocante = signal<Brocante | null>(null);
  readonly plan = signal<Emplacement[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly versionPhoto = signal('');
  readonly message = signal('');
  readonly erreur = signal('');
  readonly envoi = signal(false);
  readonly photoUrl = computed(() => {
    const b = this.brocante();
    return b?.photoMime ? this.api.photoUrl(b.id, this.versionPhoto()) : '';
  });

  readonly form = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.minLength(3)]],
    date: ['', Validators.required],
    heureDebut: ['07:00', Validators.required],
    heureFin: ['18:00', Validators.required],
    adresse: ['', Validators.required],
    codePostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    ville: ['', Validators.required],
    prixEuros: [10, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  ngOnInit() {
    const id = this.id();
    if (id) this.charger(id);
  }

  private charger(id: string) {
    this.api.adminBrocante(id).subscribe({
      next: (b) => {
        this.brocante.set(b);
        this.plan.set(b.emplacements ?? []);
        this.form.patchValue({
          ...b,
          heureDebut: b.heureDebut.slice(0, 5),
          heureFin: b.heureFin.slice(0, 5),
          prixEuros: b.prixDefaut / 100,
          description: b.description ?? '',
        });
        if (b.statut === 'PUBLIEE') this.api.reservationsBrocante(id).subscribe((r) => this.reservations.set(r));
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  private reussite(message: string, suite?: Etape) {
    this.envoi.set(false);
    this.erreur.set('');
    this.message.set(message);
    if (suite) this.etape.set(suite);
  }

  private echec(e: unknown) {
    this.envoi.set(false);
    this.message.set('');
    this.erreur.set(messageErreur(e));
  }

  enregistrerInfos() {
    const { prixEuros, ...v } = this.form.getRawValue();
    const saisie = { ...v, prixDefaut: Math.round(prixEuros * 100), description: v.description || undefined };
    const b = this.brocante();
    this.envoi.set(true);
    (b ? this.api.modifierBrocante(b.id, saisie) : this.api.creerBrocante(saisie)).subscribe({
      next: (res) => {
        this.brocante.set({ ...b, ...res, emplacements: b?.emplacements ?? [] });
        if (!b) this.location.replaceState(`/admin/brocantes/${res.id}`);
        this.reussite('Informations enregistrées', 'photo');
      },
      error: (e) => this.echec(e),
    });
  }

  async photoChoisie(ev: Event) {
    const fichier = (ev.target as HTMLInputElement).files?.[0];
    const b = this.brocante();
    if (!fichier || !b) return;
    this.envoi.set(true);
    try {
      const blob = await redimensionner(fichier);
      this.api.envoyerPhoto(b.id, blob).subscribe({
        next: () => {
          this.brocante.set({ ...b, photoMime: 'image/jpeg' });
          this.versionPhoto.set(String(Date.now()));
          this.reussite('Photo enregistrée', 'plan');
        },
        error: (e) => this.echec(e),
      });
    } catch (e) {
      this.echec({ error: { message: 'Image illisible, essayez une autre photo' } });
    }
  }

  enregistrerPlan() {
    const b = this.brocante()!;
    this.envoi.set(true);
    this.api.enregistrerPlan(b.id, this.plan()).subscribe({
      next: (emps) => {
        this.plan.set(emps);
        this.brocante.set({ ...b, emplacements: emps });
        this.reussite(`${emps.length} emplacement(s) enregistré(s)`, 'publication');
      },
      error: (e) => this.echec(e),
    });
  }

  publier() {
    const b = this.brocante()!;
    this.envoi.set(true);
    this.api.publier(b.id).subscribe({
      next: () => {
        this.reussite('Brocante publiée : elle est visible des exposants');
        this.charger(b.id);
      },
      error: (e) => this.echec(e),
    });
  }

  bloquer(e: Emplacement) {
    const b = this.brocante()!;
    this.api.bloquer(b.id, e.id!, e.statut !== 'BLOQUE').subscribe({
      next: () => this.charger(b.id),
      error: (err) => this.echec(err),
    });
  }

  numeros(r: Reservation) {
    return r.emplacements.map((e) => e.numero).sort((a, b) => a - b).join(', ');
  }
}
