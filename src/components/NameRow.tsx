import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Name } from '../data';
import type { Vote } from '../store';
import { CountryChips, GenderTag, NameDetails } from './NameInfo';
import { VoteControls } from './Votes';
import { t } from '../i18n';

/** List row: name, quick info, vote buttons; clicking expands the details */
export function NameRow(props: { name: Name; vote?: Vote; extra?: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const { name, vote } = props;
  return (
    <li class={`row ${vote ? `voted-${vote.s === -1 ? 'no' : vote.s === 2 ? 'love' : 'yes'}` : ''}`}>
      <div class="row-main" onClick={() => setOpen(!open)} role="button" tabIndex={0} aria-expanded={open} onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}>
        <div class="row-name">
          <strong>{name.n}</strong>
          <GenderTag name={name} />
        </div>
        <CountryChips name={name} max={3} />
        {props.extra}
      </div>
      <VoteControls nameKey={name.k} vote={vote} compact />
      {open && <NameDetails name={name} />}
    </li>
  );
}

/** List rendered in chunks (16,000 names): more rows appear on scroll */
export function LazyList<T>(props: { items: T[]; render: (item: T) => ComponentChildren; step?: number; resetKey?: unknown }) {
  const step = props.step ?? 60;
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setCount(step), [props.resetKey]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, props.items.length]);
  return (
    <>
      <ul class="rows">{props.items.slice(0, count).map(props.render)}</ul>
      {props.items.length > count && <div ref={sentinel} class="sentinel muted small">{t('list.loading')}</div>}
    </>
  );
}
