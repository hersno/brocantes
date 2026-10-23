import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Request } from 'express';
import { AuthGuard, CurrentUser, JwtPayload, Roles } from '../auth/auth';
import { Role } from '../entities';
import { PaymentGateway } from '../paiements/payment.gateway';
import { ReservationsService, ReserverDto } from './reservations.service';

@Controller('reservations')
@UseGuards(AuthGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Post()
  reserver(@CurrentUser() user: JwtPayload, @Body() dto: ReserverDto) {
    return this.service.reserver(user, dto);
  }

  @Get('mes')
  mes(@CurrentUser() user: JwtPayload) {
    return this.service.mesReservations(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(user, id);
  }

  @Delete(':id')
  annuler(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.annuler(user, id);
  }
}

@Controller('admin/brocantes/:id/reservations')
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class ReservationsAdminController {
  constructor(private readonly service: ReservationsService) {}

  @Get()
  lister(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.pourBrocante(id);
  }
}

@Controller('paiements')
export class WebhookController {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly service: ReservationsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody || !signature) throw new BadRequestException('Signature manquante');
    let evt;
    try {
      evt = this.gateway.lireEvenement(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Signature invalide');
    }
    if (evt.type === 'paye' && evt.sessionId) await this.service.confirmerPaiement(evt.sessionId);
    if (evt.type === 'expire' && evt.sessionId) await this.service.libererSession(evt.sessionId);
    return { recu: true };
  }
}

@Injectable()
export class ExpirationTask {
  constructor(private readonly service: ReservationsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  executer() {
    return this.service.libererExpirees();
  }
}
