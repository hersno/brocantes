import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Session } from './models';

const CLE = 'brocantes.session';

export interface Inscription {
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  password: string;
  consentement: boolean;
}

function lireSession(): Session | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const s: Session = JSON.parse(brut);
    const exp = JSON.parse(atob(s.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp as number;
    return exp * 1000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = signal<Session | null>(lireSession());

  readonly utilisateur = computed(() => this.session()?.user ?? null);
  readonly connecte = computed(() => this.session() !== null);
  readonly estAdmin = computed(() => this.session()?.user.role === 'ADMIN');

  token(): string | null {
    return this.session()?.accessToken ?? null;
  }

  login(email: string, password: string) {
    return this.http
      .post<Session>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((s) => this.ouvrir(s)));
  }

  register(data: Inscription) {
    return this.http
      .post<Session>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((s) => this.ouvrir(s)));
  }

  logout() {
    try {
      localStorage.removeItem(CLE);
    } catch {
      /* stockage indisponible */
    }
    this.session.set(null);
  }

  private ouvrir(s: Session) {
    try {
      localStorage.setItem(CLE, JSON.stringify(s));
    } catch {
      /* stockage indisponible : session en mémoire uniquement */
    }
    this.session.set(s);
  }
}
