import { useState } from 'preact/hooks';
import { keepSettingsOpen, useDataset } from '../app';
import { detectLang, formatDay, LANGS, t, type Lang } from '../i18n';
import { setState, useStore } from '../store';
import { Sheet } from './Sheet';

export function SettingsSheet(props: { onClose: () => void }) {
  const ds = useDataset();
  const lang = useStore((s) => s.lang);
  const myName = useStore((s) => s.myName);
  const lastName = useStore((s) => s.lastName);
  const count = useStore((s) => Object.keys(s.votes).length);
  const [confirmReset, setConfirmReset] = useState(false);
  const autoLabel = LANGS.find((l) => l.code === detectLang())?.label ?? '';

  const changeLang = (value: string) => {
    keepSettingsOpen();
    setState({ lang: value as Lang | '' });
  };

  return (
    <Sheet
      title={t('settings.title')}
      onClose={props.onClose}
      footer={
        <button class="btn primary" onClick={props.onClose}>
          {t('common.ok')}
        </button>
      }
    >
      <fieldset>
        <label>
          {t('settings.language')}
          <select value={lang} onChange={(e) => changeLang(e.currentTarget.value)}>
            <option value="">{t('settings.langAuto', { lang: autoLabel })}</option>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <label>
          {t('settings.myName')}
          <input
            type="text"
            value={myName}
            maxLength={40}
            placeholder={t('settings.myNamePh')}
            onInput={(e) => setState({ myName: e.currentTarget.value })}
          />
        </label>
        <p class="small muted">{t('settings.myNameHint')}</p>
        <label>
          {t('settings.lastName')}
          <input type="text" value={lastName} maxLength={60} onInput={(e) => setState({ lastName: e.currentTarget.value })} />
        </label>
        <p class="small muted">{t('settings.lastNameHint')}</p>
      </fieldset>

      <fieldset>
        <legend>{t('settings.myData')}</legend>
        <p class="small">
          {t('settings.votesStored', { count })} {t('settings.transferHint')}
        </p>
        {confirmReset ? (
          <p>
            {t('settings.resetConfirm')}{' '}
            <button
              class="btn danger small"
              onClick={() => {
                setState({ votes: {}, partner: null, rounds: [] });
                setConfirmReset(false);
              }}
            >
              {t('settings.resetYes')}
            </button>{' '}
            <button class="btn small" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
          </p>
        ) : (
          <button class="link small danger-text" onClick={() => setConfirmReset(true)}>
            {t('settings.reset')}
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('settings.about')}</legend>
        <p class="small muted">{t('settings.aboutText', { count: ds.names.length, date: formatDay(Date.parse(`${ds.version}T12:00:00`)) })}</p>
      </fieldset>
    </Sheet>
  );
}
