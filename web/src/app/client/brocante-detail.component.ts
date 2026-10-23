import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { Brocante, Emplacement } from '../core/models';
import { PlanCliquableComponent } from '../shared/plan-cliquable.component';
import { basculerSelection, euros, MAX_SELECTION } from '../shared/plan.utils';

@Component({
  selector: 'app-brocante-detail',
  imports: [PlanCliquableComponent, DatePipe],
  template: `
    @if (brocante(); as b) {
      <header class="entete">
        <h1>{{ b.nom }}</h1>
        <p>{{ b.date | date: 'EEEE d MMMM y' : '' : 'fr' }} · {{ b.heureDebut.slice(0, 5) }}–{{ b.heureFin.slice(0, 5) }}</p>
        <p>{{ b.adresse }}, {{ b.codePostal }} {{ b.ville }}</p>
        @if (b.description) { <p>{{ b.description }}</p> }
      </header>

      <div class="grille">
        <app-plan-cliquable
          [photoUrl]="api.photoUrl(b.id)"
          [emplacements]="b.emplacements ?? []"
          [selection]="selection()"
          (basculer)="basculer($event)" />

        <aside class="carte panier" aria-live="polite">
          <h2>Votre sélection</h2>
          @for (e of choisis(); track e.id) {
            <p class="ligne-panier">Emplacement n° {{ e.numero }} · {{ e.tailleMetres }} m <strong>{{ euros(e.prix) }}</strong></p>
          } @empty {
            <p>Touchez un emplacement vert sur le plan (maximum {{ max }}).</p>
          }
          <p class="total">Total : <strong>{{ euros(total()) }}</strong></p>
          @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
          <button class="principal" [disabled]="!choisis().length || envoi()" (click)="payer()">
            {{ auth.connecte() ? 'Payer par carte' : 'Se connecter pour réserver' }}
          </button>
          <p class="note">Les emplacements sont bloqués 15 minutes pendant le paiement.</p>
        </aside>
      </div>
    } @else if (erreur()) {
      <p class="erreur">{{ erreur() }}</p>
    } @else {
      <p>Chargement…</p>
    }
  `,
})
export class BrocanteDetailComponent implements OnInit {
  readonly id = input.required<string>();
  readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly euros = euros;
  readonly max = MAX_SELECTION;

  readonly brocante = signal<Brocante | null>(null);
  readonly selection = signal<string[]>([]);
  readonly erreur = signal('');
  readonly envoi = signal(false);
  readonly choisis = computed(() =>
    (this.brocante()?.emplacements ?? []).filter((e) => e.id && this.selection().includes(e.id)),
  );
  readonly total = computed(() => this.choisis().reduce((s, e) => s + (e.prix ?? 0), 0));

  ngOnInit() {
    this.charger();
  }

  charger() {
    this.api.brocante(this.id()).subscribe({
      next: (b) => {
        this.brocante.set(b);
        const libres = new Set((b.emplacements ?? []).filter((e) => e.statut === 'LIBRE').map((e) => e.id));
        this.selection.update((s) => s.filter((id) => libres.has(id)));
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  basculer(e: Emplacement) {
    this.erreur.set('');
    const avant = this.selection();
    const apres = basculerSelection(avant, e);
    if (apres === avant && e.id && !avant.includes(e.id)) {
      this.erreur.set(`Maximum ${MAX_SELECTION} emplacements par commande`);
    }
    this.selection.set(apres);
  }

  payer() {
    if (!this.auth.connecte()) {
      this.router.navigate(['/connexion'], { queryParams: { retour: this.router.url } });
      return;
    }
    this.envoi.set(true);
    this.api.reserver(this.id(), this.selection()).subscribe({
      next: (r) => window.location.assign(r.paiementUrl),
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.envoi.set(false);
        this.charger();
      },
    });
  }
}
