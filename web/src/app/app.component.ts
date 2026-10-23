import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="barre-haut">
      <a routerLink="/" class="logo">Brocantes France</a>
      <nav>
        <a routerLink="/" routerLinkActive="actif" [routerLinkActiveOptions]="{ exact: true }">Rechercher</a>
        @if (auth.estAdmin()) { <a routerLink="/admin" routerLinkActive="actif">Administration</a> }
        @if (auth.connecte()) {
          <a routerLink="/mes-reservations" routerLinkActive="actif">Mes réservations</a>
          <button type="button" class="lien" (click)="deconnecter()">Déconnexion</button>
        } @else {
          <a routerLink="/connexion" routerLinkActive="actif">Connexion</a>
        }
      </nav>
    </header>
    <main><router-outlet /></main>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  deconnecter() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
