import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface ConfirmationMail {
  to: string;
  prenom: string;
  brocante: string;
  date: string;
  heureDebut: string;
  adresse: string;
  numeros: number[];
  montant: number; // centimes
  reference: string;
}

export function euros(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function contenuConfirmation(m: ConfirmationMail) {
  const places = m.numeros.length > 1 ? `vos emplacements n° ${m.numeros.join(', ')}` : `votre emplacement n° ${m.numeros[0]}`;
  const sujet = `Confirmation de réservation – ${m.brocante}`;
  const texte = [
    `Bonjour ${m.prenom},`,
    '',
    `Votre paiement de ${euros(m.montant)} est confirmé pour ${places}.`,
    '',
    `Brocante : ${m.brocante}`,
    `Date : ${m.date} à partir de ${m.heureDebut.slice(0, 5)}`,
    `Adresse : ${m.adresse}`,
    `Référence : ${m.reference}`,
    '',
    'Présentez cet e-mail à l\'organisateur le jour J.',
    'L\'équipe Brocantes France',
  ].join('\n');
  return { sujet, texte };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: nodemailer.Transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : nodemailer.createTransport({ jsonTransport: true });

  async envoyerConfirmation(m: ConfirmationMail): Promise<void> {
    const { sujet, texte } = contenuConfirmation(m);
    try {
      await this.transport.sendMail({
        from: process.env.MAIL_FROM ?? 'Brocantes France <no-reply@brocantes.test>',
        to: m.to,
        subject: sujet,
        text: texte,
      });
      this.logger.log(`Confirmation envoyée à ${m.to} (${m.reference})`);
    } catch (e) {
      // Le paiement reste valide même si l'e-mail échoue : on journalise pour relance.
      this.logger.error(`Échec d'envoi de la confirmation ${m.reference} : ${(e as Error).message}`);
    }
  }
}
