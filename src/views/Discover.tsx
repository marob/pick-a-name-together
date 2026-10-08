import { forwardRef } from 'preact/compat';
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'preact/hooks';
import { useDataset, useNav } from '../app';
import { makeFilter, shuffle, type Name } from '../data';
import { t } from '../i18n';
import { getState, setState, useStore, voteValue, type Verdict, type Vote } from '../store';
import { CountryChips, GenderTag, NameDetails } from '../components/NameInfo';
import { Stars, VerdictBadge } from '../components/Votes';

/** new = filtered names not rated yet; partner = the partner's "yes" names I haven't seen */
export type DiscoverSource = 'new' | 'partner';

interface HistoryItem {
  key: string;
  prev?: Vote;
}

export function Discover(props: { source: DiscoverSource; onSourceChange: (s: DiscoverSource) => void; filteredCount: number }) {
  const ds = useDataset();
  const nav = useNav();
  const filters = useStore((s) => s.filters);
  const votes = useStore((s) => s.votes);
  const partner = useStore((s) => s.partner);
  const lastName = useStore((s) => s.lastName);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const source = props.source === 'partner' && !partner ? 'new' : props.source;
  const pName = partner?.name || t('common.partner');

  // Queue, recomputed only when the source or filters change (not on every vote)
  const queue = useMemo<Name[]>(() => {
    const voted = getState().votes;
    if (source === 'partner' && partner) {
      return Object.entries(partner.votes)
        .filter(([k, v]) => v.s > 0 && !voted[k])
        .sort((a, b) => voteValue(b[1]) - voteValue(a[1]))
        .map(([k]) => ds.byKey.get(k))
        .filter((n): n is Name => !!n);
    }
    const keep = makeFilter(ds, filters);
    return shuffle(ds.names.filter((n) => keep(n) && !voted[n.k]));
  }, [ds, filters, source, partner]);

  const pending = queue.filter((n) => !votes[n.k] && !skipped.has(n.k));
  const current = pending[0];
  const next = pending[1];
  const partnerPending = useMemo(
    () => (partner ? Object.entries(partner.votes).filter(([k, v]) => v.s > 0 && !votes[k]).length : 0),
    [partner, votes],
  );

  useEffect(() => setShowDetails(false), [current?.k]);

  const decide = (s: Verdict | 'skip', r = 0) => {
    if (!current) return;
    const key = current.k;
    if (s === 'skip') {
      setSkipped((prev) => new Set(prev).add(key));
      return;
    }
    setHistory((h) => [...h.slice(-50), { key, prev: getState().votes[key] }]);
    setState((st) => ({ votes: { ...st.votes, [key]: { s, r, t: Date.now() } } }));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setState((st) => {
      const v = { ...st.votes };
      if (last.prev) v[last.key] = last.prev;
      else delete v[last.key];
      return { votes: v };
    });
    // The name goes back to the front of the queue
    setSkipped((prev) => {
      const s = new Set(prev);
      s.delete(last.key);
      return s;
    });
  };

  // Keyboard shortcuts (desktop)
  const cardRef = useRef<SwipeCardHandle>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (document.querySelector('.sheet')) return;
      const map: Record<string, Verdict | 'skip'> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 2, ArrowDown: 'skip' };
      if (e.key in map) {
        e.preventDefault();
        cardRef.current?.fling(map[e.key]);
      } else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        undo();
      } else if (e.key >= '1' && e.key <= '5') {
        cardRef.current?.fling(1, +e.key);
      } else if (e.key === 'i' || e.key === ' ') {
        e.preventDefault();
        setShowDetails((d) => !d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div class="discover">
      {partner && (
        <div class="segmented" role="tablist">
          <button role="tab" aria-selected={source === 'new'} class={source === 'new' ? 'on' : ''} onClick={() => props.onSourceChange('new')}>
            {t('discover.allNames')}
          </button>
          <button
            role="tab"
            aria-selected={source === 'partner'}
            class={source === 'partner' ? 'on' : ''}
            onClick={() => props.onSourceChange('partner')}
          >
            {t('discover.partnerPicks', { name: pName })} {partnerPending > 0 && <span class="badge">{partnerPending}</span>}
          </button>
        </div>
      )}

      <p class="counter muted">
        {source === 'new' ? (
          <>
            {t('discover.counter', { count: pending.length, total: props.filteredCount })} ·{' '}
            <button class="link" onClick={nav.openFilters}>
              {t('discover.editFilters')}
            </button>
          </>
        ) : (
          t('discover.partnerCounter', { count: pending.length, name: pName })
        )}
      </p>

      <div class="deck">
        {next && <div class="card behind" aria-hidden="true"><div class="card-name">{next.n}</div></div>}
        {current ? (
          <SwipeCard ref={cardRef} key={current.k} name={current} lastName={lastName} theirs={partner?.votes[current.k]} partnerName={pName} onDecide={decide} showDetails={showDetails} onToggleDetails={() => setShowDetails((d) => !d)} />
        ) : (
          <div class="card empty">
            {source === 'partner' ? (
              <p>
                {t('discover.partnerDone', { name: pName })}
                <br />
                {t('discover.goCompare')}
              </p>
            ) : props.filteredCount === 0 ? (
              <p>
                {t('discover.noMatch')}
                <br />
                <button class="btn" onClick={nav.openFilters}>
                  {t('discover.changeFilters')}
                </button>
              </p>
            ) : (
              <p>
                {t('discover.allDone')}
                <br />
                {skipped.size > 0 && (
                  <button class="btn" onClick={() => setSkipped(new Set())}>
                    {t('discover.reviewSkipped', { count: skipped.size })}
                  </button>
                )}{' '}
                <button class="btn" onClick={nav.openFilters}>
                  {t('discover.widen')}
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      <div class="actions">
        <button class="round undo" onClick={undo} disabled={!history.length} title={`${t('vote.undoLast')} (⌫)`} aria-label={t('vote.undoLast')}>
          ↶
        </button>
        <button class="round no" onClick={() => cardRef.current?.fling(-1)} disabled={!current} title={`${t('vote.no')} (←)`} aria-label={t('vote.no')}>
          ✕
        </button>
        <button class="round love" onClick={() => cardRef.current?.fling(2)} disabled={!current} title={`${t('vote.love')} (↑)`} aria-label={t('vote.love')}>
          ♥
        </button>
        <button class="round yes" onClick={() => cardRef.current?.fling(1)} disabled={!current} title={`${t('vote.yes')} (→)`} aria-label={t('vote.yes')}>
          ✓
        </button>
        <button class="round skip" onClick={() => cardRef.current?.fling('skip')} disabled={!current} title={`${t('vote.skip')} (↓)`} aria-label={t('vote.skip')}>
          ⤼
        </button>
      </div>
      <p class="hint muted small">{t('discover.hint')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

interface SwipeCardHandle {
  fling: (s: Verdict | 'skip', r?: number) => void;
}

const THRESHOLD = 90;

const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    name: Name;
    lastName: string;
    theirs?: Vote;
    partnerName?: string;
    onDecide: (s: Verdict | 'skip', r?: number) => void;
    showDetails: boolean;
    onToggleDetails: () => void;
  }
>(function SwipeCard(props, ref) {
  const { name } = props;
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<Verdict | 'skip' | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const fling = (s: Verdict | 'skip', r = 0) => {
    if (leaving !== null) return;
    setLeaving(s);
    setTimeout(() => props.onDecide(s, r), 180);
  };
  useImperativeHandle(ref, () => ({ fling }));

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    const { x, y } = drag;
    if (y < -THRESHOLD && Math.abs(y) > Math.abs(x)) fling(2);
    else if (x > THRESHOLD) fling(1);
    else if (x < -THRESHOLD) fling(-1);
    else if (y > THRESHOLD * 1.5) fling('skip');
    setDrag({ x: 0, y: 0, active: false });
  };

  let transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`;
  if (leaving === 1) transform = 'translate(120vw, 0) rotate(25deg)';
  else if (leaving === -1) transform = 'translate(-120vw, 0) rotate(-25deg)';
  else if (leaving === 2) transform = 'translate(0, -120vh) scale(1.05)';
  else if (leaving === 'skip') transform = 'translate(0, 60vh) scale(.9)';
  const hint = leaving ?? (drag.y < -40 && Math.abs(drag.y) > Math.abs(drag.x) ? 2 : drag.x > 40 ? 1 : drag.x < -40 ? -1 : null);

  return (
    <article
      class={`card ${drag.active ? 'dragging' : ''} ${leaving !== null ? 'leaving' : ''}`}
      style={{ transform, opacity: leaving !== null ? 0 : 1 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {hint !== null && hint !== 'skip' && (
        <div class={`stamp ${hint === 1 ? 'yes' : hint === -1 ? 'no' : 'love'}`}>{hint === 1 ? t('vote.yes') : hint === -1 ? t('vote.no') : t('vote.love')}</div>
      )}
      <div class="card-top">
        <GenderTag name={name} />
        {props.theirs && props.theirs.s > 0 && <VerdictBadge vote={props.theirs} who={props.partnerName} />}
      </div>
      <div class="card-name">{name.n}</div>
      {props.lastName && (
        <div class="card-full">
          {name.n} {props.lastName}
        </div>
      )}
      <CountryChips name={name} max={5} />
      <div class="card-rate">
        <span class="small muted">{t('card.rateYes')}</span>
        <Stars value={0} onChange={(r) => fling(1, r)} size="large" />
      </div>
      <button class="link card-more" onClick={props.onToggleDetails} aria-expanded={props.showDetails}>
        {props.showDetails ? t('card.less') : t('card.more')}
      </button>
      {props.showDetails && <NameDetails name={name} />}
    </article>
  );
});
