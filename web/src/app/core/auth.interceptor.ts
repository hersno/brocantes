import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const requete = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(requete).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token) {
        auth.logout();
        router.navigate(['/connexion'], { queryParams: { retour: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

/** Message lisible depuis une erreur NestJS. */
export function messageErreur(err: unknown): string {
  const e = err as HttpErrorResponse;
  if (e?.status === 0) return 'Serveur injoignable. Il se réveille peut-être, réessayez dans 30 secondes.';
  const m = e?.error?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? 'Une erreur est survenue';
}
