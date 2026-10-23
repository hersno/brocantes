import { ChangeDetectionStrategy, Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Emplacement } from '../core/models';
import { deplacer, dupliquer, euros, prochainNumero, rectangleDepuisGlisser, versPourcentage } from './plan.utils';

type Geste =
  | { type: 'trace'; depart: { x: number; y: number }; courant: { x: number; y: number } }
  | { type: 'deplace'; index: number; decalage: { x: number; y: number } };

/** Éditeur admin : tracer, numéroter, déplacer, dupliquer les emplacements sur la photo. */
@Component({
  selector: 'app-plan-editeur',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="aide">Cliquez sur la photo pour poser un emplacement, ou glissez pour tracer un rectangle. Faites glisser un emplacement pour le déplacer.</p>
    <div class="barre">
      <button type="button" (click)="annuler()" [disabled]="!historique().length">Annuler</button>
      <button type="button" (click)="dupliquerSelection()" [disabled]="selectionIndex() === null">Dupliquer à côté</button>
      <button type="button" (click)="supprimerSelection()" [disabled]="selectionIndex() === null">Supprimer</button>
      <span class="compteur">{{ emplacements().length }} emplacement(s)</span>
    </div>
    <div class="cadre" #cadre
      (pointerdown)="debut($event)" (pointermove)="bouger($event)" (pointerup)="fin($event)" (pointercancel)="geste.set(null)">
      <img [src]="photoUrl()" alt="Photo de la place" draggable="false" />
      @for (e of emplacements(); track $index; let i = $index) {
        <div class="emp" [class.actif]="i === selectionIndex()"
          [style.left.%]="e.x" [style.top.%]="e.y" [style.width.%]="e.largeur" [style.height.%]="e.hauteur"
          (pointerdown)="saisir($event, i)">{{ e.numero }}</div>
      }
      @if (brouillon(); as b) {
        <div class="emp brouillon" [style.left.%]="b.x" [style.top.%]="b.y" [style.width.%]="b.largeur" [style.height.%]="b.hauteur"></div>
      }
    </div>
    @if (selection(); as s) {
      <fieldset class="details">
        <legend>Emplacement n° {{ s.numero }}</legend>
        <label>Numéro <input type="number" min="1" [ngModel]="s.numero" (ngModelChange)="modifier({ numero: $event })" /></label>
        <label>Prix (€) <input type="number" min="0" step="0.5" [ngModel]="(s.prix ?? prixDefaut()) / 100" (ngModelChange)="modifier({ prix: Math.round($event * 100) })" /></label>
        <label>Taille (m) <input type="number" min="0.5" step="0.5" [ngModel]="s.tailleMetres ?? 2" (ngModelChange)="modifier({ tailleMetres: $event })" /></label>
        <label>Largeur (%) <input type="number" min="1" max="100" [ngModel]="s.largeur" (ngModelChange)="modifier({ largeur: $event })" /></label>
        <label>Hauteur (%) <input type="number" min="1" max="100" [ngModel]="s.hauteur" (ngModelChange)="modifier({ hauteur: $event })" /></label>
        <p>Prix affiché : {{ euros(s.prix ?? prixDefaut()) }}</p>
      </fieldset>
    }
  `,
  styles: `
    .aide { font-size: 14px; color: var(--texte-2); }
    .barre { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
    .compteur { margin-left: auto; font-size: 14px; }
    .cadre { position: relative; touch-action: none; user-select: none; border-radius: 8px; overflow: hidden; border: 1px solid var(--bord); }
    .cadre img { display: block; width: 100%; height: auto; pointer-events: none; }
    .emp { position: absolute; display: grid; place-items: center; background: rgb(31 157 85 / 0.75); color: #fff;
      border: 2px solid #fff; border-radius: 4px; font: 600 12px/1 system-ui, sans-serif; cursor: move; }
    .emp.actif { background: rgb(29 78 216 / 0.85); outline: 3px solid #ffd400; }
    .emp.brouillon { background: rgb(29 78 216 / 0.3); border-style: dashed; pointer-events: none; }
    .details { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 12px; }
    .details label { display: grid; gap: 4px; font-size: 13px; }
  `,
})
export class PlanEditeurComponent {
  readonly photoUrl = input.required<string>();
  readonly prixDefaut = input(1000);
  readonly emplacements = model<Emplacement[]>([]);

  readonly selectionIndex = signal<number | null>(null);
  readonly historique = signal<Emplacement[][]>([]);
  readonly geste = signal<Geste | null>(null);
  readonly selection = computed(() => {
    const i = this.selectionIndex();
    return i === null ? null : this.emplacements()[i] ?? null;
  });
  readonly brouillon = computed(() => {
    const g = this.geste();
    return g?.type === 'trace' ? rectangleDepuisGlisser(g.depart, g.courant) : null;
  });

  protected readonly Math = Math;
  protected readonly euros = euros;
  private readonly cadre = viewChild.required<ElementRef<HTMLElement>>('cadre');

  private point(ev: PointerEvent) {
    return versPourcentage(ev.clientX, ev.clientY, this.cadre().nativeElement.getBoundingClientRect());
  }

  private memoriser() {
    this.historique.update((h) => [...h.slice(-29), this.emplacements()]);
  }

  debut(ev: PointerEvent) {
    const p = this.point(ev);
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.geste.set({ type: 'trace', depart: p, courant: p });
  }

  saisir(ev: PointerEvent, index: number) {
    ev.stopPropagation();
    const p = this.point(ev);
    const e = this.emplacements()[index];
    this.selectionIndex.set(index);
    this.memoriser();
    this.cadre().nativeElement.setPointerCapture?.(ev.pointerId);
    this.geste.set({ type: 'deplace', index, decalage: { x: p.x - e.x, y: p.y - e.y } });
  }

  bouger(ev: PointerEvent) {
    const g = this.geste();
    if (!g) return;
    const p = this.point(ev);
    if (g.type === 'trace') {
      this.geste.set({ ...g, courant: p });
    } else {
      this.emplacements.update((liste) =>
        liste.map((e, i) => (i === g.index ? deplacer(e, p.x - g.decalage.x, p.y - g.decalage.y) : e)),
      );
    }
  }

  fin(ev: PointerEvent) {
    const g = this.geste();
    this.geste.set(null);
    if (g?.type !== 'trace') return;
    this.ajouter(rectangleDepuisGlisser(g.depart, this.point(ev)));
  }

  ajouter(rect: Pick<Emplacement, 'x' | 'y' | 'largeur' | 'hauteur'>) {
    this.memoriser();
    const nouveau: Emplacement = { ...rect, numero: prochainNumero(this.emplacements()), prix: this.prixDefaut(), tailleMetres: 2 };
    this.emplacements.update((l) => [...l, nouveau]);
    this.selectionIndex.set(this.emplacements().length - 1);
  }

  modifier(champs: Partial<Emplacement>) {
    const i = this.selectionIndex();
    if (i === null) return;
    this.memoriser();
    this.emplacements.update((l) => l.map((e, j) => (j === i ? { ...e, ...champs } : e)));
  }

  dupliquerSelection() {
    const s = this.selection();
    if (!s) return;
    this.memoriser();
    this.emplacements.update((l) => [...l, dupliquer(s, prochainNumero(l))]);
    this.selectionIndex.set(this.emplacements().length - 1);
  }

  supprimerSelection() {
    const i = this.selectionIndex();
    if (i === null) return;
    this.memoriser();
    this.emplacements.update((l) => l.filter((_, j) => j !== i));
    this.selectionIndex.set(null);
  }

  annuler() {
    const h = this.historique();
    if (!h.length) return;
    this.emplacements.set(h[h.length - 1]);
    this.historique.set(h.slice(0, -1));
    this.selectionIndex.set(null);
  }
}
