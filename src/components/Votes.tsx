import { t } from '../i18n';
import { rate, vote, type Vote } from '../store';

export function Stars(props: { value: number; onChange?: (r: number) => void; size?: 'small' | 'large'; label?: string }) {
  const { value, onChange } = props;
  return (
    <span
      class={`stars ${props.size ?? ''} ${onChange ? 'editable' : ''}`}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={props.label ?? t('stars.aria', { count: value })}
    >
      {[1, 2, 3, 4, 5].map((i) =>
        onChange ? (
          <button
            key={i}
            type="button"
            class={i <= value ? 'star on' : 'star'}
            role="radio"
            aria-checked={i === value}
            aria-label={t('stars.n', { count: i })}
            onClick={(e) => {
              e.stopPropagation();
              onChange(i === value ? 0 : i);
            }}
          >
            ★
          </button>
        ) : (
          <span key={i} class={i <= value ? 'star on' : 'star'} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </span>
  );
}

/** No / Yes / Love buttons + stars, to re-rate a name at any time */
export function VoteControls(props: { nameKey: string; vote?: Vote; compact?: boolean }) {
  const { nameKey: key, vote: v } = props;
  const toggle = (s: -1 | 1 | 2) => vote(key, v?.s === s ? null : s);
  return (
    <div class={props.compact ? 'vote-controls compact' : 'vote-controls'} onClick={(e) => e.stopPropagation()}>
      <button type="button" class={`vbtn no ${v?.s === -1 ? 'on' : ''}`} onClick={() => toggle(-1)} aria-pressed={v?.s === -1} title={t('vote.no')}>
        ✕<span class="vlabel">{t('vote.no')}</span>
      </button>
      <button type="button" class={`vbtn yes ${v?.s === 1 ? 'on' : ''}`} onClick={() => toggle(1)} aria-pressed={v?.s === 1} title={t('vote.yes')}>
        ✓<span class="vlabel">{t('vote.yes')}</span>
      </button>
      <button type="button" class={`vbtn love ${v?.s === 2 ? 'on' : ''}`} onClick={() => toggle(2)} aria-pressed={v?.s === 2} title={t('vote.love')}>
        ♥<span class="vlabel">{t('vote.love')}</span>
      </button>
      <Stars value={v && v.s > 0 ? v.r : 0} onChange={(r) => rate(key, r)} />
    </div>
  );
}

export function VerdictBadge(props: { vote?: Vote; who?: string }) {
  const v = props.vote;
  const prefix = props.who ? t('verdict.who', { who: props.who }) : '';
  if (!v)
    return (
      <span class="verdict none">
        {prefix}
        {t('verdict.unseen')}
      </span>
    );
  if (v.s === -1)
    return (
      <span class="verdict no">
        {prefix}✕ {t('verdict.no')}
      </span>
    );
  return (
    <span class={`verdict ${v.s === 2 ? 'love' : 'yes'}`}>
      {prefix}
      {v.s === 2 ? `♥ ${t('verdict.love')}` : `✓ ${t('verdict.yes')}`}
      {v.r > 0 && <Stars value={v.r} size="small" />}
    </span>
  );
}
