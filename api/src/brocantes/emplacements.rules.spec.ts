import { BadRequestException } from '@nestjs/common';
import { prochainNumero, validerHoraires, validerPlan } from './emplacements.rules';

const e = (numero: number, x = 0, y = 0, largeur = 10, hauteur = 10) => ({ numero, x, y, largeur, hauteur });

describe('validerPlan', () => {
  it('accepte un plan valide', () => {
    expect(() => validerPlan([e(1), e(2, 20), e(3, 90, 90)])).not.toThrow();
  });

  it('refuse un numéro en double', () => {
    expect(() => validerPlan([e(1), e(1, 30)])).toThrow('Numéro d\'emplacement en double : 1');
  });

  it('refuse un numéro nul ou décimal', () => {
    expect(() => validerPlan([e(0)])).toThrow(BadRequestException);
    expect(() => validerPlan([e(1.5)])).toThrow(BadRequestException);
  });

  it('refuse un emplacement qui sort de l\'image', () => {
    expect(() => validerPlan([e(4, 95, 0, 10, 10)])).toThrow('L\'emplacement n° 4 sort de l\'image');
  });

  it('refuse un prix négatif', () => {
    expect(() => validerPlan([{ ...e(1), prix: -5 }])).toThrow('Prix invalide');
  });
});

describe('prochainNumero', () => {
  it('commence à 1 puis incrémente le maximum', () => {
    expect(prochainNumero([])).toBe(1);
    expect(prochainNumero([1, 7, 3])).toBe(8);
  });
});

describe('validerHoraires', () => {
  const maintenant = new Date('2026-10-23T10:00:00');

  it('accepte une date future et des heures cohérentes', () => {
    expect(() => validerHoraires('2026-11-01', '07:00', '18:00', maintenant)).not.toThrow();
  });

  it('accepte aujourd\'hui', () => {
    expect(() => validerHoraires('2026-10-23', '07:00', '18:00', maintenant)).not.toThrow();
  });

  it('refuse une date passée', () => {
    expect(() => validerHoraires('2026-10-01', '07:00', '18:00', maintenant)).toThrow('futur');
  });

  it('refuse une heure de fin avant le début', () => {
    expect(() => validerHoraires('2026-11-01', '18:00', '07:00', maintenant)).toThrow('heure de fin');
  });
});
