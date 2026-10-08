import { useMemo, useState } from 'preact/hooks';
import { useDataset, useNav } from '../app';
import type { Name } from '../data';
import { t } from '../i18n';
import { useStore, voteValue } from '../store';
import { LazyList, NameRow } from '../components/NameRow';
import { VerdictBadge } from '../components/Votes';

/** My "yes" and loved names, ranked; rejected names remain available to reconsider */
export function MyChoices() {
  const ds = useDataset();
  const nav = useNav();
  const votes = useStore((s) => s.votes);
  const partner = useStore((s) => s.partner);
  const [showNo, setShowNo] = useState(false);

  // Order is frozen while rating (otherwise the row jumps on every star); it refreshes when a
  // name enters or leaves the selection, or when coming back to the tab
  const likedCount = Object.values(votes).filter((v) => v.s > 0).length;
  const order = useMemo(() => votes, [likedCount]);
  const { liked, refused } = useMemo(() => {
    const liked: Name[] = [], refused: Name[] = [];
    for (const [k, v] of Object.entries(votes)) {
      const n = ds.byKey.get(k);
      if (!n) continue;
      (v.s > 0 ? liked : refused).push(n);
    }
    liked.sort((a, b) => voteValue(order[b.k]) - voteValue(order[a.k]) || a.k.localeCompare(b.k));
    refused.sort((a, b) => a.k.localeCompare(b.k));
    return { liked, refused };
  }, [ds, votes, order]);

  const loves = liked.filter((n) => votes[n.k]?.s === 2).length;

  if (!Object.keys(votes).length) {
    return (
      <div class="empty-state">
        <p>{t('mine.empty')}</p>
        <button class="btn primary" onClick={() => nav.go('discover')}>
          {t('mine.start')}
        </button>
      </div>
    );
  }

  const partnerBadge = (n: Name) => (partner ? <VerdictBadge vote={partner.votes[n.k]} who={partner.name} /> : null);

  return (
    <div class="mine">
      <p class="muted">
        {t('mine.summary', { liked: liked.length, loves, refused: refused.length })} {t('mine.starsHint')}
      </p>
      <LazyList items={liked} resetKey={liked.length} render={(n) => <NameRow key={n.k} name={n} vote={votes[n.k]} extra={partnerBadge(n)} />} />
      <details class="refused" open={showNo} onToggle={(e) => setShowNo((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>{t('mine.refused', { count: refused.length })}</summary>
        {showNo && <LazyList items={refused} resetKey={refused.length} render={(n) => <NameRow key={n.k} name={n} vote={votes[n.k]} extra={partnerBadge(n)} />} />}
      </details>
    </div>
  );
}
