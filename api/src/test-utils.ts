/** Faux QueryBuilder chaînable pour les tests unitaires. */
export function fauxQb(resultats: { one?: unknown; many?: unknown[]; count?: number; raw?: unknown[] } = {}) {
  const q: any = {};
  for (const k of ['setLock', 'where', 'andWhere', 'orderBy', 'skip', 'take', 'select', 'addSelect', 'groupBy', 'relation', 'of']) {
    q[k] = jest.fn(() => q);
  }
  q.getOne = jest.fn().mockResolvedValue(resultats.one ?? null);
  q.getMany = jest.fn().mockResolvedValue(resultats.many ?? []);
  q.loadMany = jest.fn().mockResolvedValue(resultats.many ?? []);
  q.getCount = jest.fn().mockResolvedValue(resultats.count ?? 0);
  q.getManyAndCount = jest.fn().mockResolvedValue([resultats.many ?? [], resultats.count ?? 0]);
  q.getRawMany = jest.fn().mockResolvedValue(resultats.raw ?? []);
  return q;
}

export function dansUnAn(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
