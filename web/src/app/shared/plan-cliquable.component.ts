import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Emplacement } from '../core/models';
import { estSelectionnable, etatVisuel, libelle } from './plan.utils';

/**
 * Plan interactif façon billetterie : la photo de la place avec, par-dessus,
 * un bouton par emplacement positionné en pourcentage.
 */
@Component({
  selector: 'app-plan-cliquable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="outils">
      <button type="button" (click)="zoomer(-0.5)" [disabled]="zoom() <= 1" aria-label="Dézoomer">−</button>
      <span>{{ zoom() * 100 }} %</span>
      <button type="button" (click)="zoomer(0.5)" [disabled]="zoom() >= 3" aria-label="Zoomer">+</button>
      <ul class="legende">
        <li><i class="libre"></i>Libre</li>
        <li><i class="selectionne"></i>Votre choix</li>
        <li><i class="en-cours"></i>En cours</li>
        <li><i class="vendu"></i>Vendu</li>
      </ul>
    </div>
    <div class="defilement">
      <div class="plan" [style.width.%]="zoom() * 100">
        <img [src]="photoUrl()" alt="Photo de la place de la brocante" />
        @for (e of emplacements(); track e.id ?? e.numero) {
          <button
            type="button"
            class="emplacement {{ etat(e) }}"
            [style.left.%]="e.x"
            [style.top.%]="e.y"
            [style.width.%]="e.largeur"
            [style.height.%]="e.hauteur"
            [disabled]="lectureSeule() || !selectionnable(e)"
            [attr.aria-pressed]="etat(e) === 'selectionne'"
            [attr.aria-label]="libelle(e)"
            [title]="libelle(e)"
            (click)="basculer.emit(e)"
          >
            {{ e.numero }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .outils { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .outils button { width: 36px; height: 36px; font-size: 18px; }
    .legende { display: flex; gap: 12px; list-style: none; margin: 0 0 0 auto; padding: 0; font-size: 13px; }
    .legende i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
    .defilement { overflow: auto; border-radius: 8px; border: 1px solid var(--bord); touch-action: pan-x pan-y pinch-zoom; }
    .plan { position: relative; min-width: 100%; }
    .plan img { display: block; width: 100%; height: auto; user-select: none; }
    .emplacement {
      position: absolute; display: grid; place-items: center; padding: 0;
      border: 2px solid #fff; border-radius: 4px; font: 600 12px/1 system-ui, sans-serif;
      color: #fff; cursor: pointer; box-shadow: 0 1px 3px rgb(0 0 0 / 0.4); min-width: 18px; min-height: 18px;
    }
    .emplacement:disabled { cursor: not-allowed; }
    .emplacement:focus-visible { outline: 3px solid #ffd400; outline-offset: 1px; }
    .libre, .legende .libre { background: #1f9d55; }
    .selectionne, .legende .selectionne { background: #1d4ed8; }
    .en-cours, .legende .en-cours { background: #e08a00; }
    .vendu, .legende .vendu { background: #7b7b7b; }
    .bloque { background: #4b4b4b; }
  `,
})
export class PlanCliquableComponent {
  readonly photoUrl = input.required<string>();
  readonly emplacements = input<Emplacement[]>([]);
  readonly selection = input<string[]>([]);
  readonly lectureSeule = input(false);
  readonly basculer = output<Emplacement>();

  readonly zoom = signal(1);
  private readonly sel = computed(() => this.selection());

  etat(e: Emplacement) {
    return etatVisuel(e, this.sel());
  }

  selectionnable(e: Emplacement) {
    return estSelectionnable(e.statut) || etatVisuel(e, this.sel()) === 'selectionne';
  }

  libelle(e: Emplacement) {
    return libelle(e, this.sel());
  }

  zoomer(pas: number) {
    this.zoom.update((z) => Math.min(3, Math.max(1, z + pas)));
  }
}
