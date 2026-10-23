import { Routes } from '@angular/router';
import { adminGuard, connecteGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./client/recherche.component').then((m) => m.RechercheComponent), title: 'Brocantes France' },
  { path: 'brocantes/:id', loadComponent: () => import('./client/brocante-detail.component').then((m) => m.BrocanteDetailComponent) },
  { path: 'connexion', loadComponent: () => import('./auth/connexion.component').then((m) => m.ConnexionComponent), title: 'Connexion' },
  { path: 'inscription', loadComponent: () => import('./auth/inscription.component').then((m) => m.InscriptionComponent), title: 'Inscription' },
  {
    path: 'reservations/:id',
    canActivate: [connecteGuard],
    loadComponent: () => import('./client/reservation.component').then((m) => m.ReservationComponent),
  },
  {
    path: 'mes-reservations',
    canActivate: [connecteGuard],
    loadComponent: () => import('./client/mes-reservations.component').then((m) => m.MesReservationsComponent),
    title: 'Mes réservations',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: '', loadComponent: () => import('./admin/admin-liste.component').then((m) => m.AdminListeComponent), title: 'Administration' },
      { path: 'brocantes/nouvelle', loadComponent: () => import('./admin/admin-brocante.component').then((m) => m.AdminBrocanteComponent) },
      { path: 'brocantes/:id', loadComponent: () => import('./admin/admin-brocante.component').then((m) => m.AdminBrocanteComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
