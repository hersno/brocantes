import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StatutBrocante, StatutEmplacement } from '../entities';
import { dansUnAn, fauxQb } from '../test-utils';
import { BrocantesService, departementDepuisCodePostal, GeocodageService } from './brocantes.service';

const dto = () => ({
  nom: 'Vide-grenier du Vieux Lyon',
  date: dansUnAn(),
  heureDebut: '07:00',
  heureFin: '18:00',
  adresse: '1 place Saint-Jean',
  codePostal: '69005',
  ville: 'Lyon',
  prixDefaut: 1200,
});

function monter(brocante: any = null) {
  const qb = fauxQb();
  const brocantes: any = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 'b1', ...d })),
    findOne: jest.fn().mockResolvedValue(brocante),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const emplacements: any = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    save: jest.fn(async (e: any) => e),
    createQueryBuilder: jest.fn(() => qb),
  };
  const manager: any = {
    delete: jest.fn(),
    create: jest.fn((_: unknown, d: any) => d),
    save: jest.fn(async (d: any) => d),
  };
  const dataSource: any = { transaction: jest.fn((cb: any) => cb(manager)) };
  const geocodage: any = { geocoder: jest.fn().mockResolvedValue({ lat: 45.76, lng: 4.82 }) };
  return { service: new BrocantesService(brocantes, emplacements, dataSource, geocodage), brocantes, emplacements, manager, qb };
}

describe('departementDepuisCodePostal', () => {
  it.each([
    ['69005', '69'],
    ['75011', '75'],
    ['20000', '2A'],
    ['20200', '2B'],
    ['97400', '974'],
  ])('%s → %s', (cp, dep) => expect(departementDepuisCodePostal(cp)).toBe(dep));
});

describe('BrocantesService', () => {
  it('crée une brocante en brouillon avec département et coordonnées', async () => {
    const { service } = monter();
    const b = await service.creer(dto());
    expect(b).toMatchObject({ departement: '69', lat: 45.76, lng: 4.82, statut: StatutBrocante.BROUILLON });
  });

  it('refuse une date passée', async () => {
    const { service } = monter();
    await expect(service.creer({ ...dto(), date: '2020-01-01' })).rejects.toThrow(BadRequestException);
  });

  it('modifie une brocante existante', async () => {
    const { service } = monter({ id: 'b1', emplacements: [] });
    await expect(service.modifier('b1', { ...dto(), codePostal: '75011' })).resolves.toMatchObject({ departement: '75' });
  });

  it('renvoie 404 pour une brocante inconnue ou non publiée', async () => {
    await expect(monter(null).service.trouver('x')).rejects.toThrow(NotFoundException);
    await expect(
      monter({ id: 'b1', statut: StatutBrocante.BROUILLON, emplacements: [] }).service.trouverPubliee('b1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('trie les emplacements par numéro', async () => {
    const { service } = monter({ id: 'b1', statut: StatutBrocante.PUBLIEE, emplacements: [{ numero: 3 }, { numero: 1 }] });
    const b = await service.trouverPubliee('b1');
    expect(b.emplacements.map((e) => e.numero)).toEqual([1, 3]);
  });

  it('enregistre le plan en appliquant le prix par défaut', async () => {
    const { service, manager } = monter({ id: 'b1', prixDefaut: 1200, emplacements: [] });
    const plan = await service.enregistrerPlan('b1', {
      emplacements: [
        { numero: 2, x: 20, y: 10, largeur: 10, hauteur: 10 },
        { numero: 1, x: 5, y: 10, largeur: 10, hauteur: 10, prix: 2000 },
      ],
    });
    expect(manager.delete).toHaveBeenCalled();
    expect(plan.map((e) => [e.numero, e.prix])).toEqual([[1, 2000], [2, 1200]]);
  });

  it('interdit de modifier le plan quand un emplacement est vendu', async () => {
    const { service } = monter({ id: 'b1', emplacements: [{ numero: 1, statut: StatutEmplacement.VENDU }] });
    await expect(
      service.enregistrerPlan('b1', { emplacements: [{ numero: 1, x: 0, y: 0, largeur: 5, hauteur: 5 }] }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuse une photo au mauvais format', async () => {
    const { service } = monter({ id: 'b1', emplacements: [] });
    await expect(service.enregistrerPhoto('b1', { buffer: Buffer.from(''), mimetype: 'image/gif', size: 1 })).rejects.toThrow('Format');
    await expect(service.enregistrerPhoto('b1', undefined)).rejects.toThrow('Photo manquante');
  });

  it('enregistre une photo JPEG', async () => {
    const { service, brocantes } = monter({ id: 'b1', emplacements: [] });
    await service.enregistrerPhoto('b1', { buffer: Buffer.from('img'), mimetype: 'image/jpeg', size: 3 });
    expect(brocantes.update).toHaveBeenCalledWith('b1', expect.objectContaining({ photoMime: 'image/jpeg' }));
  });

  it('refuse de changer la photo quand des emplacements sont réservés', async () => {
    const { service, emplacements } = monter({ id: 'b1', emplacements: [] });
    emplacements.count.mockResolvedValue(2);
    await expect(
      service.enregistrerPhoto('b1', { buffer: Buffer.from('img'), mimetype: 'image/png', size: 3 }),
    ).rejects.toThrow(ConflictException);
  });

  it('renvoie la photo ou 404', async () => {
    const { service, qb } = monter();
    await expect(service.photo('b1')).rejects.toThrow(NotFoundException);
    qb.getOne.mockResolvedValue({ photo: Buffer.from('x'), photoMime: 'image/png' });
    await expect(service.photo('b1')).resolves.toMatchObject({ mime: 'image/png' });
  });

  it('refuse de publier sans photo ou sans emplacement', async () => {
    const { service, qb } = monter({ id: 'b1', emplacements: [] });
    await expect(service.publier('b1')).rejects.toThrow('photo');
    qb.getCount.mockResolvedValue(1);
    await expect(service.publier('b1')).rejects.toThrow('emplacement');
  });

  it('publie une brocante complète', async () => {
    const { service, qb, brocantes } = monter({ id: 'b1', emplacements: [{ numero: 1 }] });
    qb.getCount.mockResolvedValue(1);
    await expect(service.publier('b1')).resolves.toMatchObject({ statut: StatutBrocante.PUBLIEE });
    expect(brocantes.update).toHaveBeenCalledWith('b1', { statut: StatutBrocante.PUBLIEE });
  });

  it('bloque puis débloque un emplacement libre', async () => {
    const { service, emplacements } = monter();
    emplacements.findOne.mockResolvedValue({ numero: 4, statut: StatutEmplacement.LIBRE });
    await expect(service.bloquer('b1', 'e4', true)).resolves.toMatchObject({ statut: StatutEmplacement.BLOQUE });
    await expect(service.bloquer('b1', 'e4', true)).rejects.toThrow('n° 4 non modifiable');
    await expect(service.bloquer('b1', 'e4', false)).resolves.toMatchObject({ statut: StatutEmplacement.LIBRE });
    emplacements.findOne.mockResolvedValue(null);
    await expect(service.bloquer('b1', 'ex', true)).rejects.toThrow(NotFoundException);
  });

  it('recherche avec filtres et ajoute places libres et prix minimum', async () => {
    const { service, qb } = monter();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'b1', nom: 'A' }, { id: 'b2', nom: 'B' }], 2]);
    qb.getRawMany.mockResolvedValue([{ brocanteId: 'b1', libres: '12', prixMin: '800' }]);
    const res = await service.rechercher({ ville: 'Lyon', departement: '69', du: '2027-01-01', au: '2027-12-31', q: 'grenier', page: 2 });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.andWhere).toHaveBeenCalledWith('b.departement = :dep', { dep: '69' });
    expect(res.items).toEqual([
      expect.objectContaining({ id: 'b1', emplacementsLibres: 12, prixMin: 800 }),
      expect.objectContaining({ id: 'b2', emplacementsLibres: 0, prixMin: null }),
    ]);
  });

  it('liste les brocantes côté admin', async () => {
    const { service, brocantes } = monter();
    await service.listerAdmin();
    expect(brocantes.find).toHaveBeenCalled();
  });
});

describe('GeocodageService', () => {
  const origFetch = global.fetch;
  afterEach(() => (global.fetch = origFetch));

  it('renvoie les coordonnées de la Base Adresse Nationale', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { coordinates: [4.82, 45.76] } }] }),
    }) as any;
    await expect(new GeocodageService().geocoder('1 place Saint-Jean', '69005')).resolves.toEqual({ lat: 45.76, lng: 4.82 });
  });

  it('renvoie null si le service est indisponible', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as any;
    await expect(new GeocodageService().geocoder('x', '69005')).resolves.toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    await expect(new GeocodageService().geocoder('x', '69005')).resolves.toBeNull();
  });
});
