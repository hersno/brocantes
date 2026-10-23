process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/brocantes_test';
process.env.JWT_SECRET = 'secret-de-test';
process.env.ADMIN_EMAIL = 'admin@brocantes.test';
process.env.ADMIN_PASSWORD = 'MotDePasseAdmin123!';
process.env.FRONT_URL = 'http://localhost:4200';
delete process.env.SMTP_HOST;
