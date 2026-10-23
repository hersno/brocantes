import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { messageErreur } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-connexion',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="carte etroite">
      <h1>Connexion</h1>
      <form [formGroup]="form" (ngSubmit)="valider()">
        <label>E-mail <input type="email" formControlName="email" autocomplete="email" /></label>
        <label>Mot de passe <input type="password" formControlName="password" autocomplete="current-password" /></label>
        @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
        <button class="principal" [disabled]="form.invalid || envoi()">Se connecter</button>
      </form>
      <p>Pas encore de compte ? <a routerLink="/inscription" [queryParams]="{ retour: retour }">Créer un compte</a></p>
    </section>
  `,
})
export class ConnexionComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly retour = inject(ActivatedRoute).snapshot.queryParamMap.get('retour') ?? '/';
  readonly erreur = signal('');
  readonly envoi = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  valider() {
    const { email, password } = this.form.getRawValue();
    this.envoi.set(true);
    this.auth.login(email, password).subscribe({
      next: (s) => this.router.navigateByUrl(s.user.role === 'ADMIN' && this.retour === '/' ? '/admin' : this.retour),
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.envoi.set(false);
      },
    });
  }
}
