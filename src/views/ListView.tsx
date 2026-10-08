import { useMemo, useState } from 'preact/hooks';
import { useDataset, useNav } from '../app';
import { makeFilter, matchesSearch, popularity, type Name } from '../data';
import { t, type Key } from '../i18n';
import { useStore, voteValue } from '../store';
import { LazyList, NameRow } from '../components/NameRow';

type Status = 'all' | 'unvoted' | 'yes' | 'love' | 'no';
type Sort = 'alpha' | 'popular' | 'rare' | 'mine';

const STATUS: Status[] = ['all', 'unvoted', 'love', 'yes', 'no'];
const SORTS: Sort[] = ['alpha', 'popular', 'rare', 'mine'];

export function ListView() {
  const ds = useDataset();
  const nav = useNav();
  const filters = useStore((s) => s.filters);
  const votes = useStore((s) => s.votes);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [sort, setSort] = useState<Sort>('alpha');
  const [useFilters, setUseFilters] = useState(true);

  const base = useMemo(() => {
    const keep = makeFilter(ds, filters);
    return useFilters ? ds.names.filter(keep) : ds.names;
  }, [ds, filters, useFilters]);

  const items = useMemo(() => {
    let list = base.filter((n) => matchesSearch(n, q));
    list = list.filter((n) => {
      const v = votes[n.k];
      switch (status) {
        case 'unvoted': return !v;
        case 'yes': return v?.s === 1;
        case 'love': return v?.s === 2;
        case 'no': return v?.s === -1;
        default: return true;
      }
    });
    const cmp: Record<Sort, (a: Name, b: Name) => number> = {
      alpha: (a, b) => a.k.localeCompare(b.k),
      popular: (a, b) => popularity(b) - popularity(a),
      rare: (a, b) => popularity(a) - popularity(b),
      mine: (a, b) => voteValue(votes[b.k]) - voteValue(votes[a.k]) || a.k.localeCompare(b.k),
    };
    return list.slice().sort(cmp[sort]);
  }, [base, q, status, sort, votes]);

  return (
    <div class="list-view">
      <div class="toolbar">
        <input type="search" placeholder={t('list.search')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('list.search')} />
        <select value={sort} onChange={(e) => setSort(e.currentTarget.value as Sort)} aria-label={t('list.sort')}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`list.sort.${s}` as Key)}
            </option>
          ))}
        </select>
      </div>
      <div class="chip-row" role="tablist">
        {STATUS.map((s) => (
          <button key={s} role="tab" aria-selected={status === s} class={status === s ? 'pill on' : 'pill'} onClick={() => setStatus(s)}>
            {t(`list.status.${s}` as Key)}
          </button>
        ))}
      </div>
      <p class="muted small">
        {t('list.count', { count: items.length })} ·{' '}
        <label class="inline">
          <input type="checkbox" checked={useFilters} onChange={(e) => setUseFilters(e.currentTarget.checked)} /> {t('list.applyFilters')}
        </label>{' '}
        ·{' '}
        <button class="link" onClick={nav.openFilters}>
          {t('list.edit')}
        </button>
      </p>
      <LazyList items={items} resetKey={`${q}|${status}|${sort}|${useFilters}|${base.length}`} render={(n) => <NameRow key={n.k} name={n} vote={votes[n.k]} />} />
    </div>
  );
}
