# Brocantes France

Réservation d'emplacements de brocante sur plan photo cliquable, partout en France.

| Dossier | Contenu |
| --- | --- |
| `api/` | API NestJS 10 + TypeORM + PostgreSQL (auth JWT, brocantes, plan, réservations, Stripe, e-mails) |
| `web/` | Front Angular 19 (espace exposant + espace admin, plan cliquable, éditeur de plan) |
| `.github/workflows/ci.yml` | CI/CD : lint, tests unitaires, tests d'intégration, build, déploiement |
| `render.yaml` | Blueprint d'hébergement gratuit sur Render |

## Lancer en local

```bash
docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=brocantes postgres:16
docker exec pg createdb -U postgres brocantes_test

cd api && cp .env.example .env && npm install && npm run start:dev   # http://localhost:3000/api/health
cd web && npm install && npm start                                     # http://localhost:4200
```

Compte admin créé au démarrage : `ADMIN_EMAIL` / `ADMIN_PASSWORD` du fichier `.env`.

Tests :

```bash
cd api && npm test && npm run test:int
cd web && npm test
```

Après le premier `npm install`, committez les deux `package-lock.json` et remplacez `npm install` par `npm ci` dans `ci.yml`.

## Déployer gratuitement pour un test (≈ 30 minutes)

1. **Dépôt GitHub** : poussez ce dossier sur un dépôt GitHub (branche `main`).
2. **Base de données Neon** (neon.com, offre Free) : créez un projet, région Frankfurt, copiez la chaîne de connexion `postgres://…?sslmode=require`.
3. **Stripe en mode test** (dashboard.stripe.com) : récupérez la clé `sk_test_…`.
4. **Brevo** (brevo.com, offre gratuite) : menu SMTP & API, créez une clé SMTP ; notez l'identifiant et le mot de passe SMTP. Validez l'expéditeur utilisé dans `MAIL_FROM`.
5. **Render** (render.com) : New → Blueprint → choisissez le dépôt. Render lit `render.yaml` et crée `brocantes-api` et `brocantes-web`. Renseignez les variables demandées :
   - `DATABASE_URL` : la chaîne Neon
   - `FRONT_URL` : `https://brocantes-web.onrender.com`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` : le compte admin de test
   - `STRIPE_SECRET_KEY`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
   - `STRIPE_WEBHOOK_SECRET` : laissez vide pour l'instant (étape 6)
6. **Webhook Stripe** : Developers → Webhooks → Add endpoint
   `https://brocantes-api.onrender.com/api/paiements/webhook`, événements `checkout.session.completed` et `checkout.session.expired`. Copiez le secret `whsec_…` dans `STRIPE_WEBHOOK_SECRET` sur Render.
7. **URL de l'API dans le front** : si le nom du service Render diffère, corrigez `web/src/environments/environment.prod.ts`.
8. **CD GitHub Actions** : sur Render, Settings → Deploy Hook de chaque service. Dans GitHub, Settings → Secrets and variables → Actions :
   - secrets `RENDER_DEPLOY_HOOK_API` et `RENDER_DEPLOY_HOOK_WEB`
   - variable `API_URL` = `https://brocantes-api.onrender.com/api`
   - créez l'environnement `test` (Settings → Environments)

Chaque push sur `main` lance alors : tests → build → déploiement → vérification de `/api/health`.

### Tester le parcours

1. Connectez-vous avec le compte admin → Administration → Nouvelle brocante.
2. Photo depuis le téléphone, tracez les emplacements, enregistrez, publiez.
3. Déconnectez-vous, créez un compte exposant, cherchez la brocante, choisissez des emplacements.
4. Payez avec la carte de test `4242 4242 4242 4242`, date future, CVC quelconque.
5. L'e-mail de confirmation arrive ; l'emplacement passe en gris sur le plan.

### Limites des offres gratuites

- Render : l'API se met en veille après 15 minutes sans trafic ; le premier appel suivant prend environ une minute. 750 heures d'instance par mois.
- Neon : 1 Go de stockage par projet, mise en veille après 5 minutes d'inactivité.
- Les photos sont stockées en base (colonne `bytea`) : suffisant pour un test, à déplacer vers un stockage objet (S3, Cloudinary) en production.
- `synchronize: true` crée le schéma automatiquement : à remplacer par des migrations TypeORM avant la production.
