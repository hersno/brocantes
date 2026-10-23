import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Jeton JWT factice (non signé) expirant dans une heure. */
function jeton(role: 'ADMIN' | 'CLIENT') {
  const payload = btoa(JSON.stringify({ sub: 'u1', role, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `x.${payload}.y`;
}

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ouvre la session à la connexion et reconnaît l\'admin', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('admin@test.fr', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: jeton('ADMIN'),
      user: { id: 'u1', email: 'admin@test.fr', prenom: 'A', nom: 'B', role: 'ADMIN' },
    });
    expect(auth.connecte()).toBe(true);
    expect(auth.estAdmin()).toBe(true);
    expect(localStorage.getItem('brocantes.session')).toContain('admin@test.fr');
  });

  it('restaure une session valide et ignore un jeton expiré', () => {
    const user = { id: 'u1', email: 'c@test.fr', prenom: 'C', nom: 'D', role: 'CLIENT' };
    localStorage.setItem('brocantes.session', JSON.stringify({ accessToken: jeton('CLIENT'), user }));
    expect(TestBed.inject(AuthService).connecte()).toBe(true);

    TestBed.resetTestingModule();
    const expire = `x.${btoa(JSON.stringify({ exp: 1 }))}.y`;
    localStorage.setItem('brocantes.session', JSON.stringify({ accessToken: expire, user }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    expect(TestBed.inject(AuthService).connecte()).toBe(false);
  });

  it('se déconnecte', () => {
    const auth = TestBed.inject(AuthService);
    auth.register({ prenom: 'C', nom: 'D', email: 'c@test.fr', password: 'motdepasse-solide', consentement: true }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/register`).flush({
      accessToken: jeton('CLIENT'),
      user: { id: 'u2', email: 'c@test.fr', prenom: 'C', nom: 'D', role: 'CLIENT' },
    });
    auth.logout();
    expect(auth.connecte()).toBe(false);
    expect(auth.token()).toBeNull();
  });
});
