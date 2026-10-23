import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { authInterceptor, messageErreur } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('ApiService et intercepteur', () => {
  let http: HttpTestingController;
  let api: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token: () => 'jeton-test', logout: jest.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
  });

  afterEach(() => http.verify());

  it('envoie seulement les filtres renseignés', () => {
    api.rechercher({ ville: 'Lyon', departement: '', page: 2 }).subscribe();
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/brocantes`);
    expect(req.request.params.get('ville')).toBe('Lyon');
    expect(req.request.params.has('departement')).toBe(false);
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ page: 2, total: 0, items: [] });
  });

  it('ajoute le jeton JWT', () => {
    api.mesReservations().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/reservations/mes`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jeton-test');
    req.flush([]);
  });

  it('n\'envoie au serveur que les champs du plan', () => {
    api.enregistrerPlan('b1', [{ id: 'x', numero: 1, x: 1, y: 2, largeur: 3, hauteur: 4, prix: 100, statut: 'LIBRE' }]).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/admin/brocantes/b1/emplacements`);
    expect(req.request.body.emplacements[0]).not.toHaveProperty('statut');
    expect(req.request.body.emplacements[0]).not.toHaveProperty('id');
    req.flush([]);
  });

  it('déconnecte sur 401', () => {
    const auth = TestBed.inject(AuthService);
    TestBed.inject(HttpClient).get('/x').subscribe({ error: () => undefined });
    http.expectOne('/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalled();
  });

  it('rend les erreurs lisibles', () => {
    expect(messageErreur({ status: 409, error: { message: 'Emplacement n° 3 déjà réservé' } })).toBe('Emplacement n° 3 déjà réservé');
    expect(messageErreur({ status: 400, error: { message: ['a', 'b'] } })).toBe('a, b');
    expect(messageErreur({ status: 0 })).toMatch(/injoignable/);
  });
});
