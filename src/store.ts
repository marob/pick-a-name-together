// Application state, persisted in the device's localStorage.
import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_FILTERS, type Filters } from './data';
import type { Lang } from './i18n';

/** -1 = no, 1 = yes, 2 = love it */
export type Verdict = -1 | 1 | 2;

export interface Vote {
  s: Verdict;
  /** Stars 0-5 (0 = not rated) */
  r: number;
  /** Timestamp (ms) */
  t: number;
}

export type Votes = Record<string, Vote>;

export interface Partner {
  name: string;
  votes: Votes;
  /** When the partner shared their votes (ms) */
  sharedAt: number;
  importedAt: number;
}

export interface State {
  /** Chosen language ('' = browser language) */
  lang: Lang | '';
  myName: string;
  lastName: string;
  votes: Votes;
  partner: Partner | null;
  filters: Filters;
  /** Import history (successive reconciliation rounds) */
  rounds: { at: number; partnerCount: number; agreements: number }[];
}

const STORAGE_KEY = 'pick-a-name-together:v1';
const LEGACY_KEYS = ['prenoms-duo:v1'];

function load(): State {
  const base: State = { lang: '', myName: '', lastName: '', votes: {}, partner: null, filters: DEFAULT_FILTERS, rounds: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return { ...base, ...saved, filters: { ...DEFAULT_FILTERS, ...saved.filters } };
  } catch {
    return base;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private browsing…): the app still works, without persistence
  }
  listeners.forEach((l) => l());
}

export function useStore<T>(select: (s: State) => T): T {
  const [value, setValue] = useState(() => select(state));
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    const update = () => setValue(() => selectRef.current(state));
    listeners.add(update);
    update();
    return () => void listeners.delete(update);
  }, []);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Actions

export function vote(key: string, s: Verdict | null, r?: number) {
  setState((st) => {
    const votes = { ...st.votes };
    if (s === null) delete votes[key];
    else votes[key] = { s, r: r ?? (s === -1 ? 0 : votes[key]?.r ?? 0), t: Date.now() };
    return { votes };
  });
}

export function rate(key: string, r: number) {
  setState((st) => {
    const prev = st.votes[key];
    // Rating an unrated (or rejected) name turns it into a "yes"
    const s: Verdict = prev && prev.s > 0 ? prev.s : 1;
    return { votes: { ...st.votes, [key]: { s, r, t: Date.now() } } };
  });
}

export function setFilters(patch: Partial<Filters>) {
  setState((st) => ({ filters: { ...st.filters, ...patch } }));
}

// ---------------------------------------------------------------------------------------------
// Reconciliation

export interface Match {
  key: string;
  mine?: Vote;
  theirs?: Vote;
  /** Combined score used to rank matches */
  score: number;
}

/** Value of a vote: love > yes, stars as a bonus */
export const voteValue = (v?: Vote) => (!v || v.s < 0 ? 0 : (v.s === 2 ? 3 : 1) + v.r);

export function reconcile(mine: Votes, theirs: Votes) {
  const agreements: Match[] = [];
  const disagreements: Match[] = [];
  const theirsToReview: Match[] = []; // their "yes" names I haven't seen
  const mineUnseen: Match[] = []; // my "yes" names they haven't seen
  const bothNo: string[] = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  for (const key of keys) {
    const a = mine[key], b = theirs[key];
    const m: Match = { key, mine: a, theirs: b, score: voteValue(a) + voteValue(b) };
    if (a && b) {
      if (a.s > 0 && b.s > 0) agreements.push(m);
      else if (a.s > 0 || b.s > 0) disagreements.push(m);
      else bothNo.push(key);
    } else if (b && b.s > 0) theirsToReview.push(m);
    else if (a && a.s > 0) mineUnseen.push(m);
  }
  const byScore = (x: Match, y: Match) => y.score - x.score || x.key.localeCompare(y.key);
  agreements.sort(byScore);
  disagreements.sort(byScore);
  theirsToReview.sort(byScore);
  mineUnseen.sort(byScore);
  return { agreements, disagreements, theirsToReview, mineUnseen, bothNo };
}
