import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Emplacement } from '../core/models';
import { PlanCliquableComponent } from './plan-cliquable.component';

const emplacements: Emplacement[] = [
  { id: 'a', numero: 1, x: 0, y: 0, largeur: 10, hauteur: 10, prix: 1000, statut: 'LIBRE' },
  { id: 'b', numero: 2, x: 20, y: 0, largeur: 10, hauteur: 10, prix: 1000, statut: 'VENDU' },
  { id: 'c', numero: 3, x: 40, y: 0, largeur: 10, hauteur: 10, prix: 1000, statut: 'LIBRE' },
];

describe('PlanCliquableComponent', () => {
  let fixture: ComponentFixture<PlanCliquableComponent>;
  const boutons = () => Array.from(fixture.nativeElement.querySelectorAll('.emplacement')) as HTMLButtonElement[];

  beforeEach(() => {
    fixture = TestBed.createComponent(PlanCliquableComponent);
    fixture.componentRef.setInput('photoUrl', '/photo.jpg');
    fixture.componentRef.setInput('emplacements', emplacements);
    fixture.componentRef.setInput('selection', ['c']);
    fixture.detectChanges();
  });

  it('place chaque emplacement en pourcentage sur la photo', () => {
    expect(boutons()).toHaveLength(3);
    expect(boutons()[1].style.left).toBe('20%');
    expect(boutons()[1].style.width).toBe('10%');
  });

  it('colore selon le statut et la sélection', () => {
    expect(boutons().map((b) => b.className.replace('emplacement', '').trim())).toEqual(['libre', 'vendu', 'selectionne']);
  });

  it('désactive un emplacement vendu', () => {
    expect(boutons()[1].disabled).toBe(true);
    expect(boutons()[0].disabled).toBe(false);
  });

  it('émet l\'emplacement cliqué', () => {
    const emis: Emplacement[] = [];
    fixture.componentInstance.basculer.subscribe((e) => emis.push(e));
    boutons()[0].click();
    expect(emis.map((e) => e.numero)).toEqual([1]);
  });

  it('donne un libellé accessible', () => {
    expect(boutons()[0].getAttribute('aria-label')).toMatch(/^Emplacement 1, libre/);
    expect(boutons()[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('passe tout en lecture seule pour l\'admin', () => {
    fixture.componentRef.setInput('lectureSeule', true);
    fixture.detectChanges();
    expect(boutons().every((b) => b.disabled)).toBe(true);
  });

  it('borne le zoom entre 100 % et 300 %', () => {
    const c = fixture.componentInstance;
    c.zoomer(-0.5);
    expect(c.zoom()).toBe(1);
    for (let i = 0; i < 10; i++) c.zoomer(0.5);
    expect(c.zoom()).toBe(3);
  });
});
