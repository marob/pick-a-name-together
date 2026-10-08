import { useMemo, useState } from 'preact/hooks';
import { useDataset } from '../app';
import { countryLabel, DEFAULT_FILTERS, genderLabel, LEVELS, makeFilter, originLabel, regionLabel, type Gender } from '../data';
import { t } from '../i18n';
import { setFilters, useStore } from '../store';
import { Sheet } from './Sheet';

export function FiltersSheet(props: { onClose: () => void }) {
  const ds = useDataset();
  const f = useStore((s) => s.filters);
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const count = useMemo(() => ds.names.filter(makeFilter(ds, f)).length, [ds, f]);

  const toggleGender = (g: Gender) => {
    const set = new Set(f.genders);
    set.has(g) ? set.delete(g) : set.add(g);
    if (set.size) setFilters({ genders: [...set] as Gender[] });
  };
  const toggleOrigin = (o: string) =>
    setFilters({ origins: f.origins.includes(o) ? f.origins.filter((x) => x !== o) : [...f.origins, o] });

  return (
    <Sheet
      title={t('filters.title')}
      onClose={props.onClose}
      footer={
        <>
          <button class="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
            {t('filters.reset')}
          </button>
          <button class="btn primary" onClick={props.onClose}>
            {t('filters.see', { count })}
          </button>
        </>
      }
    >
      <fieldset>
        <legend>{t('filters.gender')}</legend>
        <div class="chip-row">
          {(['f', 'm', 'u'] as Gender[]).map((g) => (
            <button key={g} class={f.genders.includes(g) ? 'pill on' : 'pill'} aria-pressed={f.genders.includes(g)} onClick={() => toggleGender(g)}>
              {genderLabel(g)}
            </button>
          ))}
        </div>
        <p class="small muted">{t('filters.unisexHint')}</p>
      </fieldset>

      <fieldset>
        <legend>{t('filters.origins')}</legend>
        <p class="small muted">{t('filters.originsHint')}</p>
        <div class="chip-row">
          {ds.regions.map((code) => {
            const id = `region:${code}`;
            const countries = ds.countries.filter((c) => c.region === code);
            const selectedInside = countries.filter((c) => f.origins.includes(c.code)).length;
            return (
              <span key={code} class="pill-group">
                <button class={f.origins.includes(id) ? 'pill on' : 'pill'} aria-pressed={f.origins.includes(id)} onClick={() => toggleOrigin(id)}>
                  {regionLabel(code)}
                </button>
                {countries.length > 1 && (
                  <button
                    class={`pill more ${selectedInside ? 'on' : ''}`}
                    aria-label={t('filters.regionCountries', { region: regionLabel(code) })}
                    aria-expanded={openRegion === code}
                    onClick={() => setOpenRegion(openRegion === code ? null : code)}
                  >
                    {selectedInside || '▾'}
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {openRegion && (
          <div class="chip-row sub">
            {ds.countries
              .filter((c) => c.region === openRegion)
              .map((c) => (
                <button
                  key={c.code}
                  class={f.origins.includes(c.code) ? 'pill on' : 'pill'}
                  aria-pressed={f.origins.includes(c.code)}
                  onClick={() => toggleOrigin(c.code)}
                >
                  {countryLabel(c.code)}
                </button>
              ))}
          </div>
        )}
        {f.origins.length > 0 && (
          <>
            <p class="small">
              {t('filters.selection')}{' '}
              <strong>{f.origins.map(originLabel).join(f.originMode === 'all' ? t('filters.and') : t('filters.or'))}</strong>
            </p>
            {f.origins.length > 1 && (
              <div class="segmented">
                <button class={f.originMode === 'any' ? 'on' : ''} onClick={() => setFilters({ originMode: 'any' })}>
                  {t('filters.modeAny')}
                </button>
                <button class={f.originMode === 'all' ? 'on' : ''} onClick={() => setFilters({ originMode: 'all' })}>
                  {t('filters.modeAll')}
                </button>
              </div>
            )}
            {f.originMode === 'all' && f.origins.length > 1 && <p class="small muted">{t('filters.modeAllHint')}</p>}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>{f.origins.length ? t('filters.frequencyIn') : t('filters.frequency')}</legend>
        <div class="segmented">
          {LEVELS.map((l) => (
            <button key={l.min} class={f.minLevel === l.min ? 'on' : ''} onClick={() => setFilters({ minLevel: l.min })}>
              {t(l.label)}
            </button>
          ))}
        </div>
        <label class="inline">
          <input type="checkbox" checked={f.notTooPopular} onChange={(e) => setFilters({ notTooPopular: e.currentTarget.checked })} />{' '}
          {t('filters.notTooPopular')}
        </label>
      </fieldset>

      <fieldset>
        <legend>{t('filters.shape')}</legend>
        <div class="grid2">
          <label>
            {t('filters.minLen')}
            <input type="number" min={2} max={20} value={f.minLen} onInput={(e) => setFilters({ minLen: +e.currentTarget.value || 2 })} />
          </label>
          <label>
            {t('filters.maxLen')}
            <input type="number" min={2} max={20} value={f.maxLen} onInput={(e) => setFilters({ maxLen: +e.currentTarget.value || 20 })} />
          </label>
          <label>
            {t('filters.startsWith')}
            <input
              type="text"
              value={f.startsWith}
              maxLength={10}
              onInput={(e) => setFilters({ startsWith: e.currentTarget.value })}
              placeholder={t('filters.startsWithPh')}
            />
          </label>
        </div>
        <label class="inline">
          <input type="checkbox" checked={f.excludeCompound} onChange={(e) => setFilters({ excludeCompound: e.currentTarget.checked })} />{' '}
          {t('filters.excludeCompound')}
        </label>
      </fieldset>
    </Sheet>
  );
}
