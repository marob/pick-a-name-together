import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { loadDataset, makeFilter, type Dataset, type Filters } from './data';
import { detectLang, LANGS, setLang, t, type Key, type Lang } from './i18n';
import { getState, useStore } from './store';
import { Discover, type DiscoverSource } from './views/Discover';
import { ListView } from './views/ListView';
import { MyChoices } from './views/MyChoices';
import { Duo } from './views/Duo';
import { FiltersSheet } from './components/FiltersSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { ImportDialog } from './components/ImportDialog';
import { Toasts } from './components/Toast';
import { extractPayload } from './share';

const DatasetContext = createContext<Dataset>(null as unknown as Dataset);
export const useDataset = () => useContext(DatasetContext);

export type Tab = 'discover' | 'list' | 'mine' | 'duo';
const TABS: { id: Tab; label: Key; icon: string }[] = [
  { id: 'discover', label: 'tab.discover', icon: '✦' },
  { id: 'list', label: 'tab.list', icon: '☰' },
  { id: 'mine', label: 'tab.mine', icon: '♥' },
  { id: 'duo', label: 'tab.duo', icon: '⇄' },
];

/** Shared navigation: switch tab, optionally opening Discover on a given source */
export interface Nav {
  go: (tab: Tab, source?: DiscoverSource) => void;
  openFilters: () => void;
}
const NavContext = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavContext);

export function App() {
  const saved = useStore((s) => s.lang);
  const lang = LANGS.some((l) => l.code === saved) ? (saved as Lang) : detectLang();
  // Before children render: t() reads the current language
  setLang(lang);

  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadDataset().then(setDs, (e) => setError(String(e.message ?? e)));
  }, []);

  if (error)
    return (
      <div class="splash">
        {t('app.loadError')}
        <br />
        {error}
      </div>
    );
  if (!ds)
    return (
      <div class="splash">
        <div class="spinner" />
        {t('app.loading')}
      </div>
    );
  return (
    <DatasetContext.Provider value={ds}>
      {/* Changing language remounts the UI so every text is recomputed */}
      <Shell key={lang} />
    </DatasetContext.Provider>
  );
}

function Shell() {
  const ds = useDataset();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (sessionStorage.getItem('tab') as Tab) || 'discover';
    } catch {
      return 'discover';
    }
  });
  const [source, setSource] = useState<DiscoverSource>('new');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // First launch: ask for the user's name (shown to their partner).
  // After a language change (remount), the settings stay open.
  const [settingsOpen, setSettingsOpen] = useState(() => !getState().myName || consumeReopenSettings());
  const [incoming, setIncoming] = useState<string | null>(null);
  const filters = useStore((s) => s.filters);
  const filteredCount = useMemo(() => ds.names.filter(makeFilter(ds, filters)).length, [ds, filters]);

  useEffect(() => {
    try {
      sessionStorage.setItem('tab', tab);
    } catch {}
  }, [tab]);

  // Share link opened (#v=…): offer to import it
  useEffect(() => {
    const check = () => {
      const payload = extractPayload(location.hash);
      if (payload) {
        setIncoming(payload);
        history.replaceState(null, '', location.pathname + location.search);
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const nav: Nav = {
    go: (tb, src) => {
      if (src) setSource(src);
      setTab(tb);
      window.scrollTo(0, 0);
    },
    openFilters: () => setFiltersOpen(true),
  };

  const activeFilters = countActiveFilters(filters);

  return (
    <NavContext.Provider value={nav}>
      <header class="topbar">
        <div class="brand">
          <span class="logo" aria-hidden="true">
            ♥
          </span>
          <span>{t('app.title')}</span>
        </div>
        <nav class="tabs" aria-label={t('nav.sections')}>
          {TABS.map((tb) => (
            <button key={tb.id} class={tab === tb.id ? 'tab active' : 'tab'} onClick={() => nav.go(tb.id)} aria-current={tab === tb.id}>
              <span class="tab-icon" aria-hidden="true">
                {tb.icon}
              </span>
              <span class="tab-label">{t(tb.label)}</span>
            </button>
          ))}
        </nav>
        <div class="topbar-actions">
          <button class="btn ghost" onClick={() => setFiltersOpen(true)} title={t('top.filters')}>
            <span aria-hidden="true">⚲</span> {t('top.filters')}
            {activeFilters > 0 && <span class="badge">{activeFilters}</span>}
          </button>
          <button class="btn ghost icon" onClick={() => setSettingsOpen(true)} title={t('top.settings')} aria-label={t('top.settings')}>
            ⚙
          </button>
        </div>
      </header>

      <main class="content">
        {tab === 'discover' && <Discover source={source} onSourceChange={setSource} filteredCount={filteredCount} />}
        {tab === 'list' && <ListView />}
        {tab === 'mine' && <MyChoices />}
        {tab === 'duo' && <Duo onImport={setIncoming} />}
      </main>

      {filtersOpen && <FiltersSheet onClose={() => setFiltersOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {incoming && <ImportDialog payload={incoming} onClose={() => setIncoming(null)} onDone={() => nav.go('duo')} />}
      <Toasts />
    </NavContext.Provider>
  );
}

let reopenSettings = false;
/** Called by the language picker, just before the UI remounts */
export const keepSettingsOpen = () => void (reopenSettings = true);
function consumeReopenSettings() {
  const r = reopenSettings;
  reopenSettings = false;
  return r;
}

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.genders.length < 3) n++;
  if (f.origins.length) n++;
  if (f.notTooPopular) n++;
  if (f.minLen > 2 || f.maxLen < 20) n++;
  if (f.startsWith) n++;
  return n;
}
