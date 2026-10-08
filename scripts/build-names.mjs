#!/usr/bin/env node
// Builds public/names.json from open data:
//  - nam_dict.txt (Jörg Michael, GFDL): ~48,000 first names, gender and frequency in 54 countries/areas
//  - INSEE, fichier des prénoms (France, births 1900-2025)
//  - INE, nombres por frecuencia (Spain, resident population)
//  - datos.gob.ar, histórico de nombres (Argentina, births 1922-2015)
//  - Retraite Québec, banque de prénoms (Quebec, births 1980-2025)
//
// Raw files are cached in data/raw/ (not versioned).
// Usage: npm run data   (or node scripts/build-names.mjs --offline to use the cache only)

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'public', 'names.json');
mkdirSync(RAW, { recursive: true });

const SOURCES = {
  namdict: 'https://raw.githubusercontent.com/lead-ratings/gender-guesser/master/gender_guesser/data/nam_dict.txt',
  fr: 'https://www.insee.fr/fr/statistiques/fichier/8595130/prenoms-2025-nat_csv.zip',
  es: 'https://www.ine.es/daco/daco42/nombyapel/nombres_por_edad_media.xlsx',
  ar: 'https://infra.datos.gob.ar/catalog/otros/dataset/2/distribution/2.1/download/historico-nombres.zip',
  qcF: 'https://www.donneesquebec.ca/recherche/dataset/13db2583-427a-4e5f-b679-8532d3df571f/resource/bf77b504-54b9-4db8-be53-b92156175c12/download/grande_listef_csv.csv',
  qcM: 'https://www.donneesquebec.ca/recherche/dataset/93d640ec-d059-4768-b7ed-388604b278aa/resource/039539f5-af55-4d8f-9010-ca718e45c2a5/download/grande_listeg_csv.csv',
};
const FILES = { namdict: 'nam_dict.txt', fr: 'fr.zip', es: 'es.xlsx', ar: 'ar.zip', qcF: 'qc_f.csv', qcM: 'qc_m.csv' };

// Countries / areas (labels are translated in src/i18n). `nd` = column position in nam_dict.txt.
export const COUNTRIES = [
  ['gb', 'United Kingdom', 'anglo', 30], ['ie', 'Ireland', 'anglo', 31], ['us', 'United States', 'anglo', 32],
  ['it', 'Italy', 'latin', 33], ['mt', 'Malta', 'latin', 34], ['pt', 'Portugal', 'latin', 35],
  ['es', 'Spain', 'hisp', 36], ['fr', 'France', 'franco', 37], ['be', 'Belgium', 'franco', 38],
  ['lu', 'Luxembourg', 'franco', 39], ['nl', 'Netherlands', 'north', 40], ['fy', 'East Frisia', 'north', 41],
  ['de', 'Germany', 'north', 42], ['at', 'Austria', 'north', 43], ['ch', 'Switzerland', 'north', 44],
  ['is', 'Iceland', 'nordic', 45], ['dk', 'Denmark', 'nordic', 46], ['no', 'Norway', 'nordic', 47],
  ['se', 'Sweden', 'nordic', 48], ['fi', 'Finland', 'nordic', 49], ['ee', 'Estonia', 'east', 50],
  ['lv', 'Latvia', 'east', 51], ['lt', 'Lithuania', 'east', 52], ['pl', 'Poland', 'east', 53],
  ['cz', 'Czechia', 'east', 54], ['sk', 'Slovakia', 'east', 55], ['hu', 'Hungary', 'east', 56],
  ['ro', 'Romania', 'east', 57], ['bg', 'Bulgaria', 'balkan', 58], ['ba', 'Bosnia and Herzegovina', 'balkan', 59],
  ['hr', 'Croatia', 'balkan', 60], ['xk', 'Kosovo', 'balkan', 61], ['mk', 'North Macedonia', 'balkan', 62],
  ['me', 'Montenegro', 'balkan', 63], ['rs', 'Serbia', 'balkan', 64], ['si', 'Slovenia', 'balkan', 65],
  ['al', 'Albania', 'balkan', 66], ['gr', 'Greece', 'balkan', 67], ['ru', 'Russia', 'slav', 68],
  ['by', 'Belarus', 'slav', 69], ['md', 'Moldova', 'slav', 70], ['ua', 'Ukraine', 'slav', 71],
  ['am', 'Armenia', 'cauc', 72], ['az', 'Azerbaijan', 'cauc', 73], ['ge', 'Georgia', 'cauc', 74],
  ['ca', 'Central Asia', 'cauc', 75], ['tr', 'Turkey', 'mideast', 76], ['ar', 'Arab world / Persia', 'mideast', 77],
  ['il', 'Israel', 'mideast', 78], ['cn', 'China', 'asia', 79], ['in', 'India / Sri Lanka', 'asia', 80],
  ['jp', 'Japan', 'asia', 81], ['kr', 'Korea', 'asia', 82], ['vn', 'Vietnam', 'asia', 83],
  ['xx', 'Other countries', 'other', 84],
  // National statistics sources outside nam_dict
  ['qc', 'Quebec', 'franco', null], ['rg', 'Argentina', 'hisp', null],
].map(([code, label, region, nd]) => ({ code, label, region, nd }));

/** Region display order */
export const REGIONS = ['franco', 'hisp', 'anglo', 'latin', 'north', 'nordic', 'east', 'balkan', 'slav', 'cauc', 'mideast', 'asia', 'other'];

// ---------------------------------------------------------------------------------------------

async function fetchRaw(key) {
  const file = join(RAW, FILES[key]);
  if (existsSync(file)) return file;
  if (process.argv.includes('--offline')) throw new Error(`${file} missing (--offline mode)`);
  console.log(`↓ ${SOURCES[key]}`);
  const res = await fetch(SOURCES[key], { headers: { 'User-Agent': 'Mozilla/5.0 (pick-a-name-together data build)' } });
  if (!res.ok) throw new Error(`${SOURCES[key]} → HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Grouping key: letters only, no accents, lowercase. */
const keyOf = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
const titleCase = (s) => s.toLowerCase().replace(/(^|[-' ])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());

/** nam_dict scale: 10 ≈ 2% of the population of one sex, each step = factor of 2. */
const scoreOf = (share) => Math.max(0, Math.min(13, 10 + Math.floor(Math.log2(share / 0.02))));

// Accumulator per key
const names = new Map();
function entry(key) {
  let e = names.get(key);
  if (!e) {
    e = { forms: {}, c: {}, f: 0, m: 0, ndGender: [], extra: {} };
    names.set(key, e);
  }
  return e;
}
/** Spellings seen per source. es/qc/rg (uppercase, no accents) are only a last resort. */
const RELIABLE_FORM_SOURCES = ['nd', 'fr'];
function addForm(e, form, weight, src) {
  const m = (e.forms[src] ??= new Map());
  m.set(form, (m.get(form) ?? 0) + weight);
}
/** Ranked spellings: each source votes with a total weight of 1, split by its frequencies. */
function rankForms(e) {
  let srcs = RELIABLE_FORM_SOURCES.filter((s) => e.forms[s]);
  if (!srcs.length) srcs = Object.keys(e.forms);
  const votes = new Map();
  for (const s of srcs) {
    const m = e.forms[s];
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    for (const [f, w] of m) votes.set(f, (votes.get(f) ?? 0) + w / tot);
  }
  return [...votes.entries()].sort((a, b) => b[1] - a[1]);
}
const setScore = (e, cc, s) => { if (s > 0) e.c[cc] = Math.max(e.c[cc] ?? 0, s); };

// ---------------------------------------------------------------------------------------------
// nam_dict

const ND_GENDER = { M: 0, '1M': 0.1, '?M': 0.25, '?': 0.5, '?F': 0.75, '1F': 0.9, F: 1 };

async function loadNamDict() {
  const lines = readFileSync(await fetchRaw('namdict'), 'utf8').split('\n');
  let count = 0;
  for (const line of lines) {
    if (!line || line[0] === '#' || line[0] === '=') continue;
    if (line[29] === '+') continue; // "expanded umlaut" duplicates
    const code = line.slice(0, 2).trim();
    if (!(code in ND_GENDER)) continue;
    const raw = line.slice(3, 29).trim();
    if (!raw) continue;
    const form = raw.replace(/\+/g, '-');
    const key = keyOf(form);
    if (key.length < 2) continue;
    const e = entry(key);
    let total = 0;
    for (const c of COUNTRIES) {
      if (c.nd == null) continue;
      const ch = line[c.nd];
      if (!ch || ch === ' ') continue;
      const s = parseInt(ch, 16);
      if (!s) continue;
      setScore(e, c.code, s);
      total += 2 ** s;
    }
    if (!total) continue;
    addForm(e, form, total, 'nd');
    e.ndGender.push([ND_GENDER[code], total]);
    count++;
  }
  console.log(`nam_dict: ${count} lines`);
}

// ---------------------------------------------------------------------------------------------
// France (INSEE)

const FR_FROM = 1980, FR_LAST = 2025;
async function loadFrance() {
  const zip = unzipSync(readFileSync(await fetchRaw('fr')));
  const csv = strFromU8(Object.values(zip)[0]);
  const acc = new Map(); // form -> {sex totals, decades, recent, last}
  const sexTotals = [0, 0], recentTotals = [0, 0];
  for (const line of csv.split('\n').slice(1)) {
    const [sexe, prenom, periode, valeur] = line.trim().split(';');
    if (!prenom || prenom.startsWith('_')) continue;
    const year = +periode, n = +valeur, sx = +sexe - 1;
    if (!(year >= 1950) || !(sx === 0 || sx === 1)) continue;
    let a = acc.get(prenom);
    if (!a) acc.set(prenom, (a = { s: [0, 0], rs: [0, 0], d: new Array(8).fill(0), r: 0, last: 0 }));
    a.d[Math.min(7, Math.floor((year - 1950) / 10))] += n;
    if (year >= FR_FROM) { a.s[sx] += n; sexTotals[sx] += n; }
    if (year > FR_LAST - 10) { a.r += n; a.rs[sx] += n; recentTotals[sx] += n; }
    if (year === FR_LAST) a.last += n;
  }
  // Group spellings (Léa / Lea) before computing the score
  const byKey = new Map();
  for (const [prenom, a] of acc) {
    const form = titleCase(prenom);
    const key = keyOf(form);
    if (key.length < 2) continue;
    let k = byKey.get(key);
    if (!k) byKey.set(key, (k = { forms: [], s: [0, 0], rs: [0, 0], d: new Array(8).fill(0), r: 0, n: 0 }));
    k.forms.push([form, a.s[0] + a.s[1] + a.r]);
    k.s[0] += a.s[0]; k.s[1] += a.s[1];
    k.rs[0] += a.rs[0]; k.rs[1] += a.rs[1];
    k.d = k.d.map((v, i) => v + a.d[i]); k.r += a.r; k.n += a.last;
  }
  let kept = 0;
  for (const [key, k] of byKey) {
    if (k.s[0] + k.s[1] < 100 && k.r < 30) continue;
    const e = entry(key);
    for (const [form, w] of k.forms) addForm(e, form, w, 'fr');
    e.m += k.s[0]; e.f += k.s[1];
    // Share over 1980-2025 or over the last 10 years (recent names such as Mia)
    const share = Math.max(k.s[0] / sexTotals[0], k.s[1] / sexTotals[1], k.rs[0] / recentTotals[0], k.rs[1] / recentTotals[1]);
    e.c.fr = scoreOf(share) || 1; // national stats override nam_dict
    e.extra.fr = { d: k.d, r: k.r, n: k.n };
    kept++;
  }
  console.log(`France: ${kept} names`);
}

// ---------------------------------------------------------------------------------------------
// Spain (INE): xlsx read by hand (zip + XML)

async function loadSpain() {
  const zip = unzipSync(readFileSync(await fetchRaw('es')));
  const sst = [...strFromU8(zip['xl/sharedStrings.xml']).matchAll(/<si>(?:<t[^>]*>([^<]*)<\/t>|.*?)<\/si>/gs)].map((m) => m[1] ?? '');
  const sheets = { m: 'xl/worksheets/sheet1.xml', f: 'xl/worksheets/sheet2.xml' }; // Hombres, Mujeres
  let kept = 0;
  for (const [sx, path] of Object.entries(sheets)) {
    const rows = [];
    for (const row of strFromU8(zip[path]).matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
      const cells = {};
      for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)) {
        cells[c[1]] = /t="s"/.test(c[2]) ? sst[+c[3]] : c[3];
      }
      if (/^\d+$/.test(cells.A ?? '') && cells.B && cells.C) rows.push([cells.B, +cells.C]);
    }
    const total = rows.reduce((s, r) => s + r[1], 0);
    for (const [nombre, freq] of rows) {
      if (nombre.includes(' ') || freq < 200) continue; // skip compound names such as "MARIA JOSE"
      const form = titleCase(nombre);
      const key = keyOf(form);
      if (key.length < 2) continue;
      const e = entry(key);
      addForm(e, form, freq, 'es');
      e[sx] += freq;
      setScore(e, 'es', scoreOf(freq / total) || 1);
      e.extra.es = (e.extra.es ?? 0) + freq;
      kept++;
    }
  }
  console.log(`Spain: ${kept} names`);
}

// ---------------------------------------------------------------------------------------------
// Quebec (Retraite Québec): one column per year, values "<5" and "."

async function loadQuebec() {
  let kept = 0;
  for (const [sx, k] of [['f', 'qcF'], ['m', 'qcM']]) {
    const lines = readFileSync(await fetchRaw(k), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
    const header = lines[0].split(',');
    const rows = [];
    let total = 0, recentTotal = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      if (!cols[0]) continue;
      let n = 0, recent = 0;
      for (let i = 1; i < cols.length; i++) {
        const v = /^\d+$/.test(cols[i]) ? +cols[i] : 0;
        n += v;
        if (+header[i] > 2015) recent += v;
      }
      total += n; recentTotal += recent;
      rows.push([cols[0], n, recent]);
    }
    for (const [prenom, n, recent] of rows) {
      if (prenom.includes(' ') || n < 50) continue;
      const form = titleCase(prenom);
      const key = keyOf(form);
      if (key.length < 2) continue;
      const e = entry(key);
      addForm(e, form, n, 'qc');
      e[sx] += n;
      setScore(e, 'qc', scoreOf(Math.max(n / total, recent / recentTotal)) || 1);
      e.extra.qc = (e.extra.qc ?? 0) + recent;
      kept++;
    }
  }
  console.log(`Quebec: ${kept} names`);
}

// ---------------------------------------------------------------------------------------------
// Argentina: 220 MB of CSV (nombre,cantidad,anio), streamed. The source has no sex column.

async function loadArgentina() {
  const zipFile = await fetchRaw('ar');
  // Streamed decompression via `unzip -p` (in-memory fflate would be too heavy for 220 MB)
  const proc = spawn('unzip', ['-p', zipFile]);
  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  const acc = new Map();
  let total = 0, first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    const i = line.lastIndexOf(',', line.lastIndexOf(',') - 1);
    const nombre = line.slice(0, i).replace(/^"|"$/g, '').trim();
    const [cant, anio] = line.slice(i + 1).split(',').map(Number);
    if (anio < 1980 || !nombre || nombre.includes(' ')) { if (anio >= 1980) total += cant || 0; continue; }
    total += cant;
    acc.set(nombre, (acc.get(nombre) ?? 0) + cant);
  }
  let kept = 0;
  for (const [nombre, n] of acc) {
    if (n < 300) continue;
    const form = titleCase(nombre);
    const key = keyOf(form);
    if (key.length < 2 || !names.has(key)) continue; // skip names whose sex is unknown from other sources
    const e = entry(key);
    addForm(e, form, n, 'rg');
    // Total for both sexes: double the share to approximate a "share of one sex"
    setScore(e, 'rg', scoreOf((2 * n) / total) || 1);
    kept++;
  }
  console.log(`Argentina: ${kept} names`);
}

// ---------------------------------------------------------------------------------------------

function femaleShare(e) {
  if (e.f + e.m > 0) return e.f / (e.f + e.m);
  const w = e.ndGender.reduce((s, [, t]) => s + t, 0);
  if (!w) return null;
  return e.ndGender.reduce((s, [g, t]) => s + g * t, 0) / w;
}

async function main() {
  await loadNamDict();
  await loadFrance();
  await loadSpain();
  await loadQuebec();
  await loadArgentina();

  const out = [];
  for (const [key, e] of names) {
    const fs = femaleShare(e);
    if (fs == null) continue;
    const scores = Object.values(e.c);
    const max = Math.max(0, ...scores);
    // Drop very rare variants found in a single country
    if (max < 2 || (max < 4 && scores.length < 2)) continue;
    const forms = rankForms(e);
    const display = forms[0][0];
    // Other notable spellings (not mere case variants)
    const alt = forms.slice(1).filter(([f, w]) => w >= 0.04 && f.toLowerCase() !== display.toLowerCase()).map(([f]) => f);
    const c = Object.entries(e.c).sort((a, b) => b[1] - a[1]).map(([cc, s]) => cc + s.toString(16)).join('');
    const rec = { n: display, k: key, f: Math.round(fs * 100), c };
    if (alt.length) rec.a = alt.slice(0, 4);
    if (e.extra.fr) rec.fr = [...e.extra.fr.d, e.extra.fr.r, e.extra.fr.n];
    if (e.extra.es) rec.es = e.extra.es;
    if (e.extra.qc) rec.qc = e.extra.qc;
    out.push(rec);
  }
  out.sort((a, b) => a.k.localeCompare(b.k));

  // Dataset hash: shared votes reference names by their index
  let hash = 0x811c9dc5;
  for (const ch of out.map((n) => n.k).join(',')) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const data = {
    version: new Date().toISOString().slice(0, 10),
    hash,
    countries: COUNTRIES.map(({ code, region }) => ({ code, region })),
    regions: REGIONS,
    sources: Object.values(SOURCES),
    names: out,
  };
  writeFileSync(OUT, JSON.stringify(data));
  const size = (readFileSync(OUT).length / 1024 / 1024).toFixed(2);
  console.log(`→ ${OUT}: ${out.length} names, ${size} MB`);
}

main().catch((err) => { console.error(err); process.exit(1); });
