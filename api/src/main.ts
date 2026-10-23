import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurer } from './setup';

async function bootstrap() {
  // rawBody : nécessaire pour vérifier la signature des webhooks Stripe.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configurer(app);
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();
