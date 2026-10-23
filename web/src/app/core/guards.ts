import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const connecteGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  return auth.connecte() || inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};

export const adminGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  if (auth.estAdmin()) return true;
  return inject(Router).createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};
