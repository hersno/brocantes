import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Brocante } from '../core/models';

@Component({
  selector: 'app-admin-liste',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="titre-actions">
      <h1>Mes brocantes</h1>
      <a class="bouton principal" routerLink="/admin/brocantes/nouvelle">Nouvelle brocante</a>
    </div>
    <table class="tableau">
      <thead><tr><th>Nom</th><th>Date</th><th>Ville</th><th>Statut</th></tr></thead>
      <tbody>
        @for (b of brocantes(); track b.id) {
          <tr>
            <td><a [routerLink]="['/admin/brocantes', b.id]">{{ b.nom }}</a></td>
            <td>{{ b.date | date: 'd MMM y' : '' : 'fr' }}</td>
            <td>{{ b.ville }} ({{ b.departement }})</td>
            <td><span class="statut {{ b.statut }}">{{ b.statut === 'PUBLIEE' ? 'Publiée' : b.statut === 'BROUILLON' ? 'Brouillon' : 'Clôturée' }}</span></td>
          </tr>
        } @empty {
          <tr><td colspan="4">Aucune brocante. Créez la première.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class AdminListeComponent {
  readonly brocantes = signal<Brocante[]>([]);

  constructor() {
    inject(ApiService).adminBrocantes().subscribe((b) => this.brocantes.set(b));
  }
}
