import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Reservation } from '../core/models';
import { euros } from '../shared/plan.utils';

@Component({
  selector: 'app-mes-reservations',
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Mes réservations</h1>
    <table class="tableau">
      <thead><tr><th>Brocante</th><th>Date</th><th>Emplacements</th><th>Montant</th><th>Statut</th></tr></thead>
      <tbody>
        @for (r of reservations(); track r.id) {
          <tr>
            <td><a [routerLink]="['/brocantes', r.brocante?.id]">{{ r.brocante?.nom }}</a></td>
            <td>{{ r.brocante?.date | date: 'd MMM y' : '' : 'fr' }}</td>
            <td>{{ numeros(r) }}</td>
            <td>{{ euros(r.montant) }}</td>
            <td><span class="statut {{ r.statut }}">{{ libelles[r.statut] }}</span></td>
          </tr>
        } @empty {
          <tr><td colspan="5">Aucune réservation pour l'instant.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class MesReservationsComponent {
  readonly euros = euros;
  readonly reservations = signal<Reservation[]>([]);
  readonly libelles = { PAYEE: 'Payée', EN_ATTENTE: 'En attente', EXPIREE: 'Expirée', ANNULEE: 'Annulée' };

  constructor() {
    inject(ApiService).mesReservations().subscribe((r) => this.reservations.set(r));
  }

  numeros(r: Reservation) {
    return r.emplacements.map((e) => e.numero).sort((a, b) => a - b).join(', ');
  }
}
