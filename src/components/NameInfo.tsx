import { useDataset } from '../app';
import { countryLabel, genderLabel, levelLabel, topCountries, type Name } from '../data';
import { formatNumber, t } from '../i18n';
import { useStore } from '../store';

export function GenderTag(props: { name: Name }) {
  const { gender, f } = props.name;
  const title = gender === 'u' ? t('info.girlsShare', { pct: f }) : undefined;
  return (
    <span class={`gender g-${gender}`} title={title}>
      {genderLabel(gender)}
    </span>
  );
}

/** Chips for the countries where the name is most common (filtered origins first) */
export function CountryChips(props: { name: Name; max?: number }) {
  const ds = useDataset();
  const origins = useStore((s) => s.filters.origins);
  return (
    <span class="chips">
      {topCountries(ds, props.name, props.max ?? 4, origins).map(({ country, level }) => (
        <span
          key={country.code}
          class={`chip lvl-${Math.min(4, Math.floor(level / 3))}`}
          title={t('info.chipTitle', { country: countryLabel(country.code), level: levelLabel(level) })}
        >
          {countryLabel(country.code)}
        </span>
      ))}
    </span>
  );
}

/** Full details of a name */
export function NameDetails(props: { name: Name }) {
  const ds = useDataset();
  const n = props.name;
  const countries = topCountries(ds, n, 10);
  return (
    <div class="details">
      {n.a && n.a.length > 0 && (
        <p class="muted">
          {t('info.altSpellings')} <em>{n.a.join(', ')}</em>
        </p>
      )}
      <p class="muted">
        {genderLabel(n.gender)}
        {n.f > 0 && n.f < 100 ? ` · ${t('info.girlsShare', { pct: n.f })}` : ''}
      </p>
      <div class="levels">
        {countries.map(({ country, level }) => (
          <div class="level-row" key={country.code}>
            <span class="level-label">{countryLabel(country.code)}</span>
            <span class="level-bar" aria-hidden="true">
              <span style={{ width: `${(level / 13) * 100}%` }} />
            </span>
            <span class="level-text">{levelLabel(level)}</span>
          </div>
        ))}
      </div>
      {n.fr && <FranceTrend data={n.fr} />}
      {(n.es || n.qc) && (
        <p class="muted small">
          {n.es ? `${t('info.spain', { n: n.es })} ` : null}
          {n.qc ? t('info.quebec', { n: n.qc }) : null}
        </p>
      )}
    </div>
  );
}

/** Sparkline of births in France per decade */
function FranceTrend(props: { data: number[] }) {
  const decades = props.data.slice(0, 8);
  const [recent, last] = props.data.slice(8);
  // The 2020s are incomplete (2020-2025): extrapolate to compare with other decades
  const values = decades.map((v, i) => (i === 7 ? (v * 10) / 6 : v));
  const max = Math.max(1, ...values);
  const w = 160, h = 36, step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <div class="trend">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={t('info.trendAria')}>
        <polyline points={`0,${h} ${pts} ${w},${h}`} class="trend-area" />
        <polyline points={pts} class="trend-line" />
      </svg>
      <div class="small muted">
        {t('info.trendTitle')}
        <br />
        {t('info.trendRecent', { recent })}
        {last ? t('info.trendLast', { last: formatNumber(last) }) : ''}
      </div>
    </div>
  );
}
