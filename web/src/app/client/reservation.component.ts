import { Component, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Reservation } from '../core/models';
import { euros } from '../shared/plan.utils';

/** Page de retour Stripe : attend la confirmation du webhook. */
@Component({
  selector: 'app-reservation',
  imports: [RouterLink],
  template: `
    <section class="carte etroite">
      @if (reservation(); as r) {
        @switch (r.statut) {
          @case ('PAYEE') {
            <h1>Paiement confirmé</h1>
            <p>Emplacement(s) n° {{ numeros(r) }} réservé(s) pour {{ euros(r.montant) }}.</p>
            <p>Un e-mail de confirmation vient de vous être envoyé.</p>
          }
          @case ('EN_ATTENTE') {
            <h1>Confirmation du paiement…</h1>
            <p>Nous attendons la confirmation de votre banque, cela prend quelques secondes.</p>
          }
          @default {
            <h1>Réservation non aboutie</h1>
            <p>Aucun montant n'a été débité ; les emplacements ont été remis en vente.</p>
          }
        }
      } @else if (erreur()) {
        <p class="erreur">{{ erreur() }}</p>
      } @else {
        <p>Chargement…</p>
      }
      <p><a routerLink="/mes-reservations">Voir mes réservations</a> · <a routerLink="/">Retour à la recherche</a></p>
    </section>
  `,
})
export class ReservationComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  private readonly paiement = inject(ActivatedRoute).snapshot.queryParamMap.get('paiement');
  readonly euros = euros;
  readonly reservation = signal<Reservation | null>(null);
  readonly erreur = signal('');
  private essais = 0;
  private minuteur?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    const req = this.paiement === 'annule' ? this.api.annulerReservation(this.id()) : this.api.reservation(this.id());
    req.subscribe({ next: (r) => this.recu(r), error: (e) => this.erreur.set(messageErreur(e)) });
  }

  ngOnDestroy() {
    clearTimeout(this.minuteur);
  }

  numeros(r: Reservation) {
    return r.emplacements.map((e) => e.numero).sort((a, b) => a - b).join(', ');
  }

  private recu(r: Reservation) {
    this.reservation.set(r);
    if (r.statut === 'EN_ATTENTE' && this.essais++ < 15) {
      this.minuteur = setTimeout(
        () => this.api.reservation(this.id()).subscribe({ next: (x) => this.recu(x) }),
        2000,
      );
    }
  }
}
