import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

export interface SessionPaiement {
  reservationId: string;
  montant: number; // centimes
  description: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

export interface EvenementPaiement {
  type: 'paye' | 'expire' | 'ignore';
  sessionId?: string;
}

/** Abstraction du prestataire de paiement (remplacée par un faux en test). */
export abstract class PaymentGateway {
  abstract creerSession(p: SessionPaiement): Promise<{ id: string; url: string }>;
  abstract lireEvenement(rawBody: Buffer, signature: string): EvenementPaiement;
  /** Ferme une session de paiement non utilisée (meilleur effort). */
  abstract expirerSession(id: string): Promise<void>;
}

@Injectable()
export class StripeGateway extends PaymentGateway {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_absent');

  async creerSession(p: SessionPaiement) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: p.email,
      client_reference_id: p.reservationId,
      // 30 minutes est le minimum Stripe ; nos emplacements sont libérés à 15 minutes
      // et la confirmation vérifie que la réservation est encore valide.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: p.montant,
            product_data: { name: p.description },
          },
        },
      ],
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
    });
    return { id: session.id, url: session.url! };
  }

  async expirerSession(id: string) {
    await this.stripe.checkout.sessions.expire(id).catch(() => undefined);
  }

  lireEvenement(rawBody: Buffer, signature: string): EvenementPaiement {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
    const session = event.data.object as Stripe.Checkout.Session;
    if (event.type === 'checkout.session.completed') return { type: 'paye', sessionId: session.id };
    if (event.type === 'checkout.session.expired') return { type: 'expire', sessionId: session.id };
    return { type: 'ignore' };
  }
}
