# API Brocantes (NestJS)

```bash
cp .env.example .env
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=brocantes postgres:16
npm install
npm run start:dev          # http://localhost:3000/api/health
npm test                   # tests unitaires (+ npm run test:cov)
createdb -h localhost -U postgres brocantes_test
npm run test:int           # tests d'intégration (PostgreSQL réel)
```
