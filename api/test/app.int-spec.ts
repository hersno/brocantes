import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { GeocodageService } from '../src/brocantes/brocantes.service';
import { Reservation } from '../src/entities';
import { MailService } from '../src/mail/mail.service';
import { PaymentGateway } from '../src/paiements/payment.gateway';
import { ReservationsService } from '../src/reservations/reservations.service';
import { configurer } from '../src/setup';
import { dansUnAn } from '../src/test-utils';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Faux Stripe : signature "valide" acceptée, corps JSON { type, sessionId }. */
let compteurSession = 0;
const fauxPaiement: PaymentGateway = {
  creerSession: jest.fn(async () => {
    compteurSession++;
    return { id: `cs_test_${compteurSession}`, url: `https://checkout.test/cs_test_${compteurSession}` };
  }),
  expirerSession: jest.fn(async () => undefined),
  lireEvenement: (raw: Buffer, signature: string) => {
    if (signature !== 'valide') throw new Error('signature');
    return JSON.parse(raw.toString());
  },
};
const fauxMail = { envoyerConfirmation: jest.fn(async () => undefined) };

describe('API Brocantes (intégration)', () => {
  let app: INestApplication;
  let admin: string;
  let clientA: string;
  let clientB: string;
  let brocanteId: string;
  let emplacements: { id: string; numero: number }[];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaymentGateway).useValue(fauxPaiement)
      .overrideProvider(MailService).useValue(fauxMail)
      .overrideProvider(GeocodageService).useValue({ geocoder: async () => null })
      .compile();
    app = configurer(module.createNestApplication({ rawBody: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@brocantes.test', password: 'MotDePasseAdmin123!' })
      .expect(200);
    admin = login.body.accessToken;
  });

  afterAll(() => app.close());

  const api = () => request(app.getHttpServer());

  it('expose /health', () => api().get('/api/health').expect(200, { status: 'ok' }));

  describe('comptes', () => {
    const inscrire = (email: string) =>
      api().post('/api/auth/register').send({
        prenom: 'Client', nom: 'Test', email, password: 'motdepasse-solide', consentement: true,
      });

    it('crée deux comptes clients', async () => {
      clientA = (await inscrire('a@test.fr').expect(201)).body.accessToken;
      clientB = (await inscrire('b@test.fr').expect(201)).body.accessToken;
    });

    it('refuse un e-mail en double', () => inscrire('a@test.fr').expect(409));

    it('refuse un mot de passe trop court et sans consentement', () =>
      api().post('/api/auth/register').send({ prenom: 'X', nom: 'Y', email: 'c@test.fr', password: 'court', consentement: false }).expect(400));
  });

  describe('administration d\'une brocante', () => {
    const brocante = () => ({
      nom: 'Vide-grenier de la Croix-Rousse',
      date: dansUnAn(),
      heureDebut: '07:00',
      heureFin: '18:00',
      adresse: '1 boulevard de la Croix-Rousse',
      codePostal: '69004',
      ville: 'Lyon',
      prixDefaut: 1500,
    });

    it('interdit l\'espace admin à un client', () =>
      api().post('/api/admin/brocantes').set(auth(clientA)).send(brocante()).expect(403));

    it('interdit l\'espace admin sans connexion', () => api().get('/api/admin/brocantes').expect(401));

    it('valide le code postal', () =>
      api().post('/api/admin/brocantes').set(auth(admin)).send({ ...brocante(), codePostal: '690' }).expect(400));

    it('crée la brocante en brouillon', async () => {
      const res = await api().post('/api/admin/brocantes').set(auth(admin)).send(brocante()).expect(201);
      expect(res.body).toMatchObject({ statut: 'BROUILLON', departement: '69' });
      brocanteId = res.body.id;
    });

    it('n\'est pas visible du public tant qu\'elle n\'est pas publiée', () =>
      api().get(`/api/brocantes/${brocanteId}`).expect(404));

    it('refuse de publier sans photo', () =>
      api().post(`/api/admin/brocantes/${brocanteId}/publier`).set(auth(admin)).expect(400));

    it('importe la photo de la place', () =>
      api()
        .post(`/api/admin/brocantes/${brocanteId}/photo`)
        .set(auth(admin))
        .attach('photo', PNG_1PX, { filename: 'place.png', contentType: 'image/png' })
        .expect(201));

    it('refuse un plan avec numéros en double', () =>
      api()
        .put(`/api/admin/brocantes/${brocanteId}/emplacements`)
        .set(auth(admin))
        .send({ emplacements: [{ numero: 1, x: 0, y: 0, largeur: 10, hauteur: 10 }, { numero: 1, x: 20, y: 0, largeur: 10, hauteur: 10 }] })
        .expect(400));

    it('enregistre un plan de 6 emplacements numérotés', async () => {
      const plan = [1, 2, 3, 4, 5, 6].map((n) => ({ numero: n, x: (n - 1) * 15, y: 40, largeur: 12, hauteur: 10 }));
      const res = await api().put(`/api/admin/brocantes/${brocanteId}/emplacements`).set(auth(admin)).send({ emplacements: plan }).expect(200);
      expect(res.body).toHaveLength(6);
      expect(res.body[0]).toMatchObject({ numero: 1, prix: 1500, statut: 'LIBRE' });
      emplacements = res.body;
    });

    it('publie la brocante', () =>
      api().post(`/api/admin/brocantes/${brocanteId}/publier`).set(auth(admin)).expect(201));
  });

  describe('parcours client', () => {
    it('trouve la brocante par ville et par département', async () => {
      const parVille = await api().get('/api/brocantes').query({ ville: 'lyon' }).expect(200);
      expect(parVille.body.items[0]).toMatchObject({ id: brocanteId, emplacementsLibres: 6, prixMin: 1500 });
      const autreDep = await api().get('/api/brocantes').query({ departement: '75' }).expect(200);
      expect(autreDep.body.total).toBe(0);
    });

    it('affiche le plan et sert la photo', async () => {
      const res = await api().get(`/api/brocantes/${brocanteId}`).expect(200);
      expect(res.body.emplacements.map((e: any) => e.numero)).toEqual([1, 2, 3, 4, 5, 6]);
      await api().get(`/api/brocantes/${brocanteId}/photo`).expect('Content-Type', 'image/png').expect(200);
    });

    it('exige une connexion pour réserver', () =>
      api().post('/api/reservations').send({ brocanteId, emplacementIds: [emplacements[0].id] }).expect(401));

    it('refuse plus de 5 emplacements', () =>
      api().post('/api/reservations').set(auth(clientA)).send({ brocanteId, emplacementIds: emplacements.map((e) => e.id) }).expect(400));

    it('ne vend qu\'une fois un emplacement demandé en même temps par deux clients', async () => {
      const corps = { brocanteId, emplacementIds: [emplacements[0].id, emplacements[1].id] };
      const [a, b] = await Promise.all([
        api().post('/api/reservations').set(auth(clientA)).send(corps),
        api().post('/api/reservations').set(auth(clientB)).send(corps),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const perdant = a.status === 409 ? a : b;
      expect(perdant.body.message).toMatch(/déjà réservé/);
    });

    it('confirme le paiement par webhook, une seule fois', async () => {
      const mes = await api().get('/api/reservations/mes').set(auth(clientA)).expect(200);
      const mesB = await api().get('/api/reservations/mes').set(auth(clientB)).expect(200);
      const [reservation] = [...mes.body, ...mesB.body];
      expect(reservation.statut).toBe('EN_ATTENTE');

      await api().post('/api/paiements/webhook').set('stripe-signature', 'fausse').send({ type: 'paye', sessionId: reservation.stripeSessionId }).expect(400);
      for (let i = 0; i < 2; i++) {
        await api().post('/api/paiements/webhook').set('stripe-signature', 'valide').send({ type: 'paye', sessionId: reservation.stripeSessionId }).expect(200);
      }
      expect(fauxMail.envoyerConfirmation).toHaveBeenCalledTimes(1);
      expect(fauxMail.envoyerConfirmation).toHaveBeenCalledWith(expect.objectContaining({ numeros: [1, 2], montant: 3000 }));

      const detail = await api().get(`/api/brocantes/${brocanteId}`).expect(200);
      expect(detail.body.emplacements.slice(0, 2).map((e: any) => e.statut)).toEqual(['VENDU', 'VENDU']);
    });

    it('montre à l\'admin qui a réservé', async () => {
      const res = await api().get(`/api/admin/brocantes/${brocanteId}/reservations`).set(auth(admin)).expect(200);
      expect(res.body[0]).toMatchObject({ statut: 'PAYEE' });
      expect(res.body[0].user.email).toMatch(/@test\.fr$/);
    });

    it('libère un emplacement non payé après 15 minutes', async () => {
      const res = await api().post('/api/reservations').set(auth(clientB)).send({ brocanteId, emplacementIds: [emplacements[2].id] }).expect(201);
      const ds = app.get(DataSource);
      await ds.getRepository(Reservation).update(res.body.reservationId, { expireLe: new Date(Date.now() - 1000) });

      await expect(app.get(ReservationsService).libererExpirees()).resolves.toBe(1);
      const detail = await api().get(`/api/brocantes/${brocanteId}`).expect(200);
      expect(detail.body.emplacements[2].statut).toBe('LIBRE');
      expect(fauxPaiement.expirerSession).toHaveBeenCalled();
    });

    it('interdit de retracer le plan une fois des places vendues', () =>
      api()
        .put(`/api/admin/brocantes/${brocanteId}/emplacements`)
        .set(auth(admin))
        .send({ emplacements: [{ numero: 1, x: 0, y: 0, largeur: 10, hauteur: 10 }] })
        .expect(409));
  });
});
