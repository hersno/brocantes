import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Configuration commune à main.ts et aux tests d'intégration. */
export function configurer(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONT_URL?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}
