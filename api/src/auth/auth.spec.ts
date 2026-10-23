import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '../entities';
import { fauxQb } from '../test-utils';
import { AuthGuard, AuthService } from './auth';

const jwt = new JwtService({ secret: 'test' });

function monter() {
  const qb = fauxQb();
  const users: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 'u1', ...d })),
    createQueryBuilder: jest.fn(() => qb),
  };
  return { service: new AuthService(users, jwt), users, qb };
}

const inscription = { prenom: 'Léa', nom: 'Martin', email: 'Lea@Test.fr ', password: 'motdepasse-solide', consentement: true };

describe('AuthService', () => {
  it('crée un compte client avec mot de passe haché', async () => {
    const { service, users } = monter();
    const res = await service.register(inscription);
    const saved = users.save.mock.calls[0][0];
    expect(saved.email).toBe('lea@test.fr');
    expect(saved.role).toBe(Role.CLIENT);
    expect(await bcrypt.compare('motdepasse-solide', saved.passwordHash)).toBe(true);
    expect(jwt.verify(res.accessToken)).toMatchObject({ sub: 'u1', role: Role.CLIENT });
  });

  it('refuse un e-mail déjà utilisé', async () => {
    const { service, users } = monter();
    users.findOne.mockResolvedValue({ id: 'u0' });
    await expect(service.register(inscription)).rejects.toThrow(ConflictException);
  });

  it('connecte avec le bon mot de passe et refuse le mauvais', async () => {
    const { service, qb } = monter();
    qb.getOne.mockResolvedValue({ id: 'u1', email: 'lea@test.fr', role: Role.CLIENT, passwordHash: await bcrypt.hash('bon-mot-de-passe', 4) });
    await expect(service.login({ email: 'lea@test.fr', password: 'bon-mot-de-passe' })).resolves.toHaveProperty('accessToken');
    await expect(service.login({ email: 'lea@test.fr', password: 'mauvais' })).rejects.toThrow(UnauthorizedException);
  });

  it('crée l\'admin une seule fois', async () => {
    const { service, users } = monter();
    await service.ensureAdmin(undefined, undefined);
    expect(users.save).not.toHaveBeenCalled();
    await service.ensureAdmin('admin@test.fr', 'secret-admin-123');
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ role: Role.ADMIN }));
    users.findOne.mockResolvedValue({ id: 'a1' });
    await service.ensureAdmin('admin@test.fr', 'secret-admin-123');
    expect(users.save).toHaveBeenCalledTimes(1);
  });
});

describe('AuthGuard', () => {
  const ctx = (authorization?: string) => {
    const req: any = { headers: { authorization } };
    return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null } as any };
  };
  const guard = (roles?: Role[]) => new AuthGuard(jwt, { getAllAndOverride: () => roles } as any);

  it('refuse sans jeton ou avec un jeton invalide', () => {
    expect(() => guard().canActivate(ctx().ctx)).toThrow(UnauthorizedException);
    expect(() => guard().canActivate(ctx('Bearer faux').ctx)).toThrow(UnauthorizedException);
  });

  it('accepte un jeton valide et expose l\'utilisateur', () => {
    const { req, ctx: c } = ctx(`Bearer ${jwt.sign({ sub: 'u1', role: Role.CLIENT })}`);
    expect(guard().canActivate(c)).toBe(true);
    expect(req.user.sub).toBe('u1');
  });

  it('refuse un client sur une route admin', () => {
    const { ctx: c } = ctx(`Bearer ${jwt.sign({ sub: 'u1', role: Role.CLIENT })}`);
    expect(() => guard([Role.ADMIN]).canActivate(c)).toThrow(ForbiddenException);
  });
});
