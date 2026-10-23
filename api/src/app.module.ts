import { Controller, Get, Module, OnApplicationBootstrap } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController, AuthGuard, AuthService } from './auth/auth';
import { BrocantesAdminController, BrocantesPublicController } from './brocantes/brocantes.controller';
import { BrocantesService, GeocodageService } from './brocantes/brocantes.service';
import { ENTITIES } from './entities';
import { MailService } from './mail/mail.service';
import { PaymentGateway, StripeGateway } from './paiements/payment.gateway';
import {
  ExpirationTask,
  ReservationsAdminController,
  ReservationsController,
  WebhookController,
} from './reservations/reservations.controller';
import { ReservationsService } from './reservations/reservations.service';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

const estTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/brocantes',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: ENTITIES,
      // Version de test : schéma synchronisé automatiquement. En production, passer aux migrations.
      synchronize: true,
      dropSchema: estTest,
    }),
    TypeOrmModule.forFeature(ENTITIES),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-a-changer',
      signOptions: { expiresIn: '1h' },
    }),
    ...(estTest ? [] : [ScheduleModule.forRoot()]),
  ],
  controllers: [
    HealthController,
    AuthController,
    BrocantesPublicController,
    BrocantesAdminController,
    ReservationsController,
    ReservationsAdminController,
    WebhookController,
  ],
  providers: [
    AuthService,
    AuthGuard,
    BrocantesService,
    GeocodageService,
    ReservationsService,
    ExpirationTask,
    MailService,
    { provide: PaymentGateway, useClass: StripeGateway },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly auth: AuthService) {}

  onApplicationBootstrap() {
    return this.auth.ensureAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  }
}
