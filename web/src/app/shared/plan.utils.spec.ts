import { Emplacement } from '../core/models';
import {
  basculerSelection,
  deplacer,
  dupliquer,
  etatVisuel,
  libelle,
  prochainNumero,
  rectangleDepuisGlisser,
  versPourcentage,
} from './plan.utils';

const emp = (id: string, statut: Emplacement['statut'] = 'LIBRE'): Emplacement => ({
  id, numero: Number(id), x: 10, y: 10, largeur: 10, hauteur: 10, prix: 1500, statut,
});

describe('plan.utils', () => {
  it('numérote à la suite du plus grand numéro', () => {
    expect(prochainNumero([])).toBe(1);
    expect(prochainNumero([{ numero: 4 }, { numero: 2 }])).toBe(5);
  });

  it('convertit un clic écran en pourcentage borné', () => {
    const cadre = { left: 100, top: 50, width: 400, height: 200 };
    expect(versPourcentage(300, 150, cadre)).toEqual({ x: 50, y: 50 });
    expect(versPourcentage(900, 0, cadre)).toEqual({ x: 100, y: 0 });
  });

  it('pose un emplacement par défaut sur un simple clic', () => {
    expect(rectangleDepuisGlisser({ x: 50, y: 50 }, { x: 50.2, y: 50 })).toEqual({ x: 47, y: 47, largeur: 6, hauteur: 6 });
    expect(rectangleDepuisGlisser({ x: 99, y: 1 }, { x: 99, y: 1 })).toEqual({ x: 94, y: 0, largeur: 6, hauteur: 6 });
  });

  it('trace un rectangle dans n\'importe quel sens', () => {
    expect(rectangleDepuisGlisser({ x: 40, y: 30 }, { x: 20, y: 10 })).toEqual({ x: 20, y: 10, largeur: 20, hauteur: 20 });
  });

  it('garde un emplacement déplacé dans l\'image', () => {
    expect(deplacer(emp('1'), 95, -5)).toMatchObject({ x: 90, y: 0 });
  });

  it('duplique à droite puis en dessous en bout de rangée', () => {
    expect(dupliquer(emp('1'), 2)).toMatchObject({ numero: 2, x: 20.5, y: 10 });
    expect(dupliquer({ ...emp('1'), x: 85 }, 2)).toMatchObject({ x: 85, y: 20.5 });
  });

  it('sélectionne, désélectionne et respecte le maximum de 5', () => {
    let s = basculerSelection([], emp('1'));
    expect(s).toEqual(['1']);
    s = basculerSelection(s, emp('1'));
    expect(s).toEqual([]);
    const plein = ['1', '2', '3', '4', '5'];
    expect(basculerSelection(plein, emp('6'))).toBe(plein);
  });

  it('ignore un emplacement vendu ou bloqué', () => {
    expect(basculerSelection([], emp('1', 'VENDU'))).toEqual([]);
    expect(basculerSelection([], emp('2', 'BLOQUE'))).toEqual([]);
  });

  it('décrit l\'état pour les couleurs et l\'accessibilité', () => {
    expect(etatVisuel(emp('1'), ['1'])).toBe('selectionne');
    expect(etatVisuel(emp('1', 'EN_COURS'), [])).toBe('en-cours');
    expect(libelle(emp('7')).replace(/\s/g, ' ')).toBe('Emplacement 7, libre, 15,00 €');
  });
});
