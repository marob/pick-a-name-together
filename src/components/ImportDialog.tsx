import { useMemo, useState } from 'preact/hooks';
import { useDataset } from '../app';
import { formatDate, t } from '../i18n';
import { decodeVotes, ShareError } from '../share';
import { getState, reconcile, setState, type Votes } from '../store';
import { Sheet } from './Sheet';
import { toast } from './Toast';

/** Import confirmation: the partner's votes, or my own votes from another device */
export function ImportDialog(props: { payload: string; onClose: () => void; onDone: () => void }) {
  const ds = useDataset();
  const decoded = useMemo(() => {
    try {
      return { ok: decodeVotes(ds, props.payload) } as const;
    } catch (e) {
      return { error: e instanceof ShareError ? t(e.key) : t('error.invalid') } as const;
    }
  }, [props.payload]);
  const st = getState();
  const looksLikeMe = !!decoded.ok && !!st.myName && decoded.ok.name.trim().toLowerCase() === st.myName.trim().toLowerCase();
  const [mode, setMode] = useState<'partner' | 'self'>(looksLikeMe ? 'self' : 'partner');

  if (!decoded.ok) {
    return (
      <Sheet title={t('import.failedTitle')} onClose={props.onClose}>
        <p class="error">{decoded.error}</p>
        <button class="btn" onClick={props.onClose}>
          {t('common.close')}
        </button>
      </Sheet>
    );
  }
  const data = decoded.ok;
  const count = Object.keys(data.votes).length;
  const likes = Object.values(data.votes).filter((v) => v.s > 0).length;
  const displayName = data.name || t('common.partner');

  const confirm = () => {
    if (mode === 'partner') {
      setState((s) => {
        const { agreements } = reconcile(s.votes, data.votes);
        return {
          partner: { name: displayName, votes: data.votes, sharedAt: data.sharedAt, importedAt: Date.now() },
          rounds: [...s.rounds, { at: Date.now(), partnerCount: count, agreements: agreements.length }].slice(-30),
        };
      });
      toast(t('import.donePartner', { name: displayName }));
    } else {
      // Merge: for each name, the most recent vote wins
      setState((s) => {
        const votes: Votes = { ...s.votes };
        for (const [k, v] of Object.entries(data.votes)) if (!votes[k] || votes[k].t < v.t) votes[k] = v;
        return { votes };
      });
      toast(t('import.doneSelf', { count }));
    }
    props.onClose();
    props.onDone();
  };

  return (
    <Sheet
      title={t('import.title')}
      onClose={props.onClose}
      footer={
        <>
          <button class="btn" onClick={props.onClose}>
            {t('common.cancel')}
          </button>
          <button class="btn primary" onClick={confirm}>
            {t('receive.import')}
          </button>
        </>
      }
    >
      <p>
        <strong>{data.name || t('import.noName')}</strong> · {t('import.summary', { count, likes, date: formatDate(data.sharedAt) })}
      </p>
      <fieldset class="choices">
        <label class={mode === 'partner' ? 'choice on' : 'choice'}>
          <input type="radio" name="mode" checked={mode === 'partner'} onChange={() => setMode('partner')} />
          <span>
            <strong>{t('import.partner')}</strong>
            <br />
            <span class="small muted">
              {t('import.partnerHint')}
              {st.partner ? t('import.replaces', { name: st.partner.name }) : ''}
            </span>
          </span>
        </label>
        <label class={mode === 'self' ? 'choice on' : 'choice'}>
          <input type="radio" name="mode" checked={mode === 'self'} onChange={() => setMode('self')} />
          <span>
            <strong>{t('import.self')}</strong>
            <br />
            <span class="small muted">{t('import.selfHint')}</span>
          </span>
        </label>
      </fieldset>
    </Sheet>
  );
}
