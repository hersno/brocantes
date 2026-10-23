import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean } from 'class-validator';
import { Response } from 'express';
import { AuthGuard, Roles } from '../auth/auth';
import { Brocante, Role } from '../entities';
import { BrocanteDto, BrocantesService, PlanDto, RechercheDto } from './brocantes.service';

class BlocageDto {
  @IsBoolean() bloque: boolean;
}

/** Vue publique : on ne renvoie jamais qui a réservé. */
function versPublic(b: Brocante) {
  return {
    ...b,
    emplacements: (b.emplacements ?? []).map(({ id, numero, x, y, largeur, hauteur, prix, tailleMetres, statut }) => ({
      id, numero, x, y, largeur, hauteur, prix, tailleMetres, statut,
    })),
  };
}

@Controller('brocantes')
export class BrocantesPublicController {
  constructor(private readonly service: BrocantesService) {}

  @Get()
  rechercher(@Query() q: RechercheDto) {
    return this.service.rechercher(q);
  }

  @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    return versPublic(await this.service.trouverPubliee(id));
  }

  @Get(':id/photo')
  async photo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { data, mime } = await this.service.photo(id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(data);
  }
}

@Controller('admin/brocantes')
@UseGuards(AuthGuard)
@Roles(Role.ADMIN)
export class BrocantesAdminController {
  constructor(private readonly service: BrocantesService) {}

  @Get()
  lister() {
    return this.service.listerAdmin();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.trouver(id);
  }

  @Post()
  creer(@Body() dto: BrocanteDto) {
    return this.service.creer(dto);
  }

  @Put(':id')
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BrocanteDto) {
    return this.service.modifier(id, dto);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  photo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() fichier: Express.Multer.File) {
    return this.service.enregistrerPhoto(id, fichier);
  }

  @Put(':id/emplacements')
  plan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlanDto) {
    return this.service.enregistrerPlan(id, dto);
  }

  @Post(':id/publier')
  publier(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.publier(id);
  }

  @Patch(':id/emplacements/:empId')
  bloquer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('empId', ParseUUIDPipe) empId: string,
    @Body() dto: BlocageDto,
  ) {
    return this.service.bloquer(id, empId, dto.bloque);
  }
}
