import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Brocante } from '../core/models';
import { euros } from '../shared/plan.utils';

@Component({
  selector: 'app-recherche',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <section class="hero">
      <h1>Trouvez votre brocante et réservez votre emplacement</h1>
      <form class="filtres" [formGroup]="form" (ngSubmit)="chercher(1)">
        <label>Ville ou code postal <input formControlName="ville" placeholder="Lyon, 69004…" /></label>
        <label>Département <input formControlName="departement" placeholder="69" maxlength="3" /></label>
        <label>Du <input type="date" formControlName="du" /></label>
        <label>Au <input type="date" formControlName="au" /></label>
        <label>Nom <input formControlName="q" placeholder="vide-grenier…" /></label>
        <button class="principal">Rechercher</button>
      </form>
    </section>

    @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
    @if (chargement()) { <p>Recherche…</p> }

    <p class="resume">{{ total() }} brocante(s) à venir</p>
    <ul class="resultats">
      @for (b of resultats(); track b.id) {
        <li class="carte">
          <a [routerLink]="['/brocantes', b.id]">
            <h2>{{ b.nom }}</h2>
            <p>{{ b.date | date: 'EEEE d MMMM y' : '' : 'fr' }} · {{ b.heureDebut.slice(0, 5) }}–{{ b.heureFin.slice(0, 5) }}</p>
            <p>{{ b.ville }} ({{ b.departement }})</p>
            <p class="badge">{{ b.emplacementsLibres }} place(s) libre(s) @if (b.prixMin !== null) { · dès {{ euros(b.prixMin) }} }</p>
          </a>
        </li>
      } @empty {
        @if (!chargement()) { <li>Aucune brocante ne correspond à ces critères.</li> }
      }
    </ul>
    @if (total() > page() * 20) {
      <button (click)="chercher(page() + 1)">Page suivante</button>
    }
  `,
})
export class RechercheComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly euros = euros;
  readonly resultats = signal<Brocante[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly chargement = signal(false);
  readonly erreur = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({ ville: '', departement: '', du: '', au: '', q: '' });

  ngOnInit() {
    this.chercher(1);
  }

  chercher(page: number) {
    this.chargement.set(true);
    this.erreur.set('');
    this.api.rechercher({ ...this.form.getRawValue(), page }).subscribe({
      next: (r) => {
        this.resultats.set(page === 1 ? r.items : [...this.resultats(), ...r.items]);
        this.total.set(r.total);
        this.page.set(page);
        this.chargement.set(false);
      },
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.chargement.set(false);
      },
    });
  }
}
