import { contenuConfirmation, euros, MailService } from './mail.service';

const mail = {
  to: 'lea@test.fr',
  prenom: 'Léa',
  brocante: 'Brocante de Lyon',
  date: '2027-05-01',
  heureDebut: '07:00:00',
  adresse: '1 rue A, 69001 Lyon',
  numeros: [3, 7],
  montant: 3000,
  reference: 'AB12CD34',
};

describe('MailService', () => {
  it('formate les montants en euros', () => {
    expect(euros(1550).replace(/\s/g, ' ')).toBe('15,50 €');
  });

  it('rédige un e-mail de confirmation complet', () => {
    const { sujet, texte } = contenuConfirmation(mail);
    expect(sujet).toBe('Confirmation de réservation – Brocante de Lyon');
    expect(texte).toContain('emplacements n° 3, 7');
    expect(texte).toContain('à partir de 07:00');
    expect(texte).toContain('AB12CD34');
  });

  it('accorde au singulier pour un seul emplacement', () => {
    expect(contenuConfirmation({ ...mail, numeros: [5] }).texte).toContain('votre emplacement n° 5');
  });

  it('envoie sans SMTP configuré (transport JSON) sans lever d\'erreur', async () => {
    delete process.env.SMTP_HOST;
    await expect(new MailService().envoyerConfirmation(mail)).resolves.toBeUndefined();
  });
});
