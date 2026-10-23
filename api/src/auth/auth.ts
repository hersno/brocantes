import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  HttpCode,
  Injectable,
  Post,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Equals, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Role, User } from '../entities';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export class RegisterDto {
  @IsString() @IsNotEmpty() prenom: string;
  @IsString() @IsNotEmpty() nom: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() telephone?: string;
  @IsString() @MinLength(12) password: string;
  @Equals(true, { message: 'Le consentement RGPD est obligatoire' }) consentement: boolean;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail');
    }
    const user = await this.users.save(
      this.users.create({
        email,
        prenom: dto.prenom,
        nom: dto.nom,
        telephone: dto.telephone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: Role.CLIENT,
      }),
    );
    return this.token(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email.toLowerCase().trim() })
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    return this.token(user);
  }

  /** Crée le compte administrateur au démarrage s'il n'existe pas. */
  async ensureAdmin(email?: string, password?: string) {
    if (!email || !password) return;
    const existing = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return;
    await this.users.save(
      this.users.create({
        email: email.toLowerCase(),
        prenom: 'Admin',
        nom: 'Brocantes',
        passwordHash: await bcrypt.hash(password, 10),
        role: Role.ADMIN,
      }),
    );
  }

  private token(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role },
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest().user,
);

/** Vérifie le JWT puis, si @Roles est présent, le rôle. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      req.user = this.jwt.verify<JwtPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException();
    return true;
  }
}
