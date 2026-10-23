import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanEditeurComponent } from './plan-editeur.component';

describe('PlanEditeurComponent', () => {
  let fixture: ComponentFixture<PlanEditeurComponent>;
  let c: PlanEditeurComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(PlanEditeurComponent);
    fixture.componentRef.setInput('photoUrl', '/photo.jpg');
    fixture.componentRef.setInput('prixDefaut', 1200);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('numérote automatiquement les emplacements ajoutés', () => {
    c.ajouter({ x: 0, y: 0, largeur: 5, hauteur: 5 });
    c.ajouter({ x: 10, y: 0, largeur: 5, hauteur: 5 });
    expect(c.emplacements().map((e) => [e.numero, e.prix])).toEqual([[1, 1200], [2, 1200]]);
  });

  it('duplique, modifie, supprime puis annule', () => {
    c.ajouter({ x: 0, y: 0, largeur: 5, hauteur: 5 });
    c.dupliquerSelection();
    expect(c.emplacements()).toHaveLength(2);
    expect(c.emplacements()[1]).toMatchObject({ numero: 2, x: 5.5 });

    c.modifier({ numero: 10 });
    expect(c.emplacements()[1].numero).toBe(10);

    c.supprimerSelection();
    expect(c.emplacements()).toHaveLength(1);
    c.annuler();
    expect(c.emplacements()).toHaveLength(2);
  });

  it('affiche un bloc numéroté par emplacement', () => {
    c.ajouter({ x: 0, y: 0, largeur: 5, hauteur: 5 });
    fixture.detectChanges();
    const blocs = fixture.nativeElement.querySelectorAll('.emp');
    expect(blocs).toHaveLength(1);
    expect(blocs[0].textContent.trim()).toBe('1');
  });
});
