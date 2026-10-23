import { BadRequestException, ConflictException } from '@nestjs/common';
import { Emplacement, StatutEmplacement } from '../entities';
import { dateExpiration, montantTotal, validerSelection, verifierDisponibles } from './reservations.rules';

const emp = (numero: number, statut = StatutEmplacement.LIBRE, prix = 1000) =>
  ({ numero, statut, prix }) as Emplacement;

describe('validerSelection', () => {
  it('dédoublonne les identifiants', () => {
    expect(validerSelection(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('refuse une sélection vide', () => {
    expect(() => validerSelection([])).toThrow(BadRequestException);
  });

  it('refuse plus de 5 emplacements', () => {
    expect(() => validerSelection(['1', '2', '3', '4', '5', '6'])).toThrow('Maximum 5');
  });
});

describe('verifierDisponibles', () => {
  it('passe si tout est libre', () => {
    expect(() => verifierDisponibles([emp(1), emp(2)])).not.toThrow();
  });

  it('nomme l\'emplacement déjà pris', () => {
    expect(() => verifierDisponibles([emp(1), emp(3, StatutEmplacement.VENDU)])).toThrow(
      'Emplacement n° 3 déjà réservé',
    );
  });

  it('liste plusieurs emplacements pris', () => {
    expect(() =>
      verifierDisponibles([emp(5, StatutEmplacement.EN_COURS), emp(2, StatutEmplacement.BLOQUE)]),
    ).toThrow(new ConflictException('Emplacements n° 2, 5 déjà réservés'));
  });
});

describe('montantTotal et dateExpiration', () => {
  it('additionne les prix en centimes', () => {
    expect(montantTotal([emp(1, undefined, 1500), emp(2, undefined, 2000)])).toBe(3500);
  });

  it('bloque 15 minutes', () => {
    const t = new Date('2026-10-23T10:00:00Z');
    expect(dateExpiration(t).toISOString()).toBe('2026-10-23T10:15:00.000Z');
  });
});
