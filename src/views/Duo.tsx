import { useMemo, useState } from 'preact/hooks';
import { useDataset, useNav } from '../app';
import { formatDate, formatDay, t } from '../i18n';
import { reconcile, setState, useStore, type Match } from '../store';
import { LazyList, NameRow } from '../components/NameRow';
import { VerdictBadge } from '../components/Votes';
import { ShareSheet } from '../components/ShareSheet';
import { ReceiveSheet } from '../components/ReceiveSheet';

type Section = 'agree' | 'review' | 'disagree' | 'unseen';

export function Duo(props: { onImport: (payload: string) => void }) {
  const ds = useDataset();
  const nav = useNav();
  const myName = useStore((s) => s.myName);
  const votes = useStore((s) => s.votes);
  const partner = useStore((s) => s.partner);
  const rounds = useStore((s) => s.rounds);
  const [sheet, setSheet] = useState<'share' | 'receive' | null>(null);
  const [section, setSection] = useState<Section>('agree');
  const [confirmForget, setConfirmForget] = useState(false);

  const r = useMemo(() => (partner ? reconcile(votes, partner.votes) : null), [votes, partner]);
  const pName = partner?.name || t('common.partner');

  const rowsFor = (list: Match[]) => (
    <LazyList
      items={list}
      resetKey={section}
      render={(m) => {
        const n = ds.byKey.get(m.key);
        if (!n) return null;
        return <NameRow key={m.key} name={n} vote={votes[m.key]} extra={<VerdictBadge vote={partner!.votes[m.key]} who={pName} />} />;
      }}
    />
  );

  return (
    <div class="duo">
      <section class="panel">
        <h2>{t('duo.exchangeTitle')}</h2>
        <p class="muted">{t('duo.exchangeIntro')}</p>
        <div class="row-buttons">
          <button class="btn primary big" onClick={() => setSheet('share')}>
            {t('duo.show')}
            <span class="small">{t('duo.showSub')}</span>
          </button>
          <button class="btn big" onClick={() => setSheet('receive')}>
            {t('duo.receive')}
            <span class="small">{t('duo.receiveSub')}</span>
          </button>
        </div>
        {!myName && <p class="small warn">{t('duo.nameTip')}</p>}
      </section>

      {!partner || !r ? (
        <section class="panel empty-state">
          <p>
            {t('duo.noPartner1')}
            <br />
            {t('duo.noPartner2')}
          </p>
        </section>
      ) : (
        <>
          <section class="panel">
            <h2>
              {t('duo.youAnd', { name: pName })}
              <span class="muted small"> · {t('duo.votesOf', { date: formatDate(partner.sharedAt) })}</span>
            </h2>
            <div class="stats">
              <Stat n={r.agreements.length} label={t('duo.stat.agree')} tone="love" on={section === 'agree'} onClick={() => setSection('agree')} />
              <Stat n={r.theirsToReview.length} label={t('duo.stat.review', { name: pName })} tone="yes" on={section === 'review'} onClick={() => setSection('review')} />
              <Stat n={r.disagreements.length} label={t('duo.stat.disagree')} tone="no" on={section === 'disagree'} onClick={() => setSection('disagree')} />
              <Stat n={r.mineUnseen.length} label={t('duo.stat.unseen', { name: pName })} on={section === 'unseen'} onClick={() => setSection('unseen')} />
            </div>
            {rounds.length > 1 && (
              <p class="small muted">
                {t('duo.rounds')} {rounds.map((x) => t('duo.roundItem', { date: formatDay(x.at), count: x.agreements })).join(' → ')}
              </p>
            )}
          </section>

          <section class="panel">
            {section === 'agree' && (
              <>
                <h3>{t('duo.agreeTitle')}</h3>
                <p class="muted small">{t('duo.agreeHint')}</p>
                {r.agreements.length > 0 && <Podium matches={r.agreements.slice(0, 3)} />}
                {r.agreements.length ? rowsFor(r.agreements) : <p class="muted">{t('duo.noAgree')}</p>}
              </>
            )}
            {section === 'review' && (
              <>
                <h3>{t('duo.reviewTitle', { name: pName })}</h3>
                {r.theirsToReview.length > 0 ? (
                  <>
                    <button class="btn primary" onClick={() => nav.go('discover', 'partner')}>
                      {t('duo.reviewSwipe')}
                    </button>
                    {rowsFor(r.theirsToReview)}
                  </>
                ) : (
                  <p class="muted">{t('duo.reviewDone')}</p>
                )}
              </>
            )}
            {section === 'disagree' && (
              <>
                <h3>{t('duo.disagreeTitle')}</h3>
                <p class="muted small">{t('duo.disagreeHint')}</p>
                {r.disagreements.length ? rowsFor(r.disagreements) : <p class="muted">{t('duo.noDisagree')}</p>}
              </>
            )}
            {section === 'unseen' && (
              <>
                <h3>{t('duo.unseenTitle', { name: pName })}</h3>
                <p class="muted small">{t('duo.unseenHint')}</p>
                {rowsFor(r.mineUnseen)}
              </>
            )}
          </section>

          <section class="panel subtle">
            {confirmForget ? (
              <p>
                {t('duo.forgetConfirm', { name: pName })}{' '}
                <button class="btn danger small" onClick={() => setState({ partner: null, rounds: [] })}>
                  {t('duo.forgetYes')}
                </button>{' '}
                <button class="btn small" onClick={() => setConfirmForget(false)}>
                  {t('common.cancel')}
                </button>
              </p>
            ) : (
              <button class="link small" onClick={() => setConfirmForget(true)}>
                {t('duo.forget', { name: pName })}
              </button>
            )}
          </section>
        </>
      )}

      {sheet === 'share' && <ShareSheet onClose={() => setSheet(null)} />}
      {sheet === 'receive' && (
        <ReceiveSheet
          onClose={() => setSheet(null)}
          onPayload={(p) => {
            setSheet(null);
            props.onImport(p);
          }}
        />
      )}
    </div>
  );
}

function Stat(props: { n: number; label: string; tone?: string; on: boolean; onClick: () => void }) {
  return (
    <button class={`stat ${props.tone ?? ''} ${props.on ? 'on' : ''}`} onClick={props.onClick} aria-pressed={props.on}>
      <strong>{props.n}</strong>
      <span>{props.label}</span>
    </button>
  );
}

function Podium(props: { matches: Match[] }) {
  const ds = useDataset();
  const lastName = useStore((s) => s.lastName);
  return (
    <ol class="podium">
      {props.matches.map((m, i) => (
        <li key={m.key} class={`p${i + 1}`}>
          <span class="rank">{i + 1}</span>
          <span class="pname">{ds.byKey.get(m.key)?.n}</span>
          {lastName && <span class="small muted">{ds.byKey.get(m.key)?.n} {lastName}</span>}
        </li>
      ))}
    </ol>
  );
}
