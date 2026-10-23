import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { messageErreur } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-inscription',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="carte etroite">
      <h1>Créer un compte exposant</h1>
      <form [formGroup]="form" (ngSubmit)="valider()">
        <div class="ligne">
          <label>Prénom <input formControlName="prenom" autocomplete="given-name" /></label>
          <label>Nom <input formControlName="nom" autocomplete="family-name" /></label>
        </div>
        <label>E-mail <input type="email" formControlName="email" autocomplete="email" /></label>
        <label>Téléphone <input type="tel" formControlName="telephone" autocomplete="tel" /></label>
        <label>Mot de passe (12 caractères minimum)
          <input type="password" formControlName="password" autocomplete="new-password" />
        </label>
        <label class="case">
          <input type="checkbox" formControlName="consentement" />
          J'accepte que mes données soient utilisées pour gérer mes réservations.
        </label>
        @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
        <button class="principal" [disabled]="form.invalid || envoi()">Créer mon compte</button>
      </form>
      <p>Déjà inscrit ? <a routerLink="/connexion" [queryParams]="{ retour: retour }">Se connecter</a></p>
    </section>
  `,
})
export class InscriptionComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly retour = inject(ActivatedRoute).snapshot.queryParamMap.get('retour') ?? '/';
  readonly erreur = signal('');
  readonly envoi = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telephone: [''],
    password: ['', [Validators.required, Validators.minLength(12)]],
    consentement: [false, Validators.requiredTrue],
  });

  valider() {
    this.envoi.set(true);
    const v = this.form.getRawValue();
    this.auth.register({ ...v, telephone: v.telephone || undefined }).subscribe({
      next: () => this.router.navigateByUrl(this.retour),
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.envoi.set(false);
      },
    });
  }
}
