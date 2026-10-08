// Serverless vote exchange between the two parents.
//
// Binary format (v1), deflate-compressed then base64url-encoded:
//   u8 version | u32 dataset hash | u32 date (minutes) | u8 length + UTF-8 first name
//   varint vote count | for each vote sorted by index: varint index delta, u8 code
// code = verdict (0 no, 1 yes, 2 love) + 3 × stars.
// ~1-2 bytes per vote: 500 votes fit in a single QR code.
import { deflateSync, inflateSync } from 'fflate';
import type { Dataset } from './data';
import type { Key } from './i18n';
import type { Verdict, Votes } from './store';

const FORMAT = 1;

export interface SharedVotes {
  name: string;
  sharedAt: number;
  votes: Votes;
}

export function encodeVotes(ds: Dataset, name: string, votes: Votes): string {
  const entries = Object.entries(votes)
    .map(([key, v]) => [ds.byKey.get(key)?.idx ?? -1, v] as const)
    .filter(([idx]) => idx >= 0)
    .sort((a, b) => a[0] - b[0]);
  const nameBytes = new TextEncoder().encode(name.slice(0, 40));
  const bytes: number[] = [FORMAT];
  const u32 = (n: number) => bytes.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const varint = (n: number) => {
    while (n >= 0x80) {
      bytes.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    bytes.push(n);
  };
  u32(ds.hash);
  u32(Math.floor(Date.now() / 60000));
  bytes.push(nameBytes.length, ...nameBytes);
  varint(entries.length);
  let prev = 0;
  for (const [idx, v] of entries) {
    varint(idx - prev);
    prev = idx;
    bytes.push((v.s === -1 ? 0 : v.s) + 3 * Math.min(5, Math.max(0, v.r)));
  }
  return toBase64Url(deflateSync(new Uint8Array(bytes), { level: 9 }));
}

/** Decoding error; `key` = translatable message */
export class ShareError extends Error {
  constructor(readonly key: Key) {
    super(key);
  }
}

/** Far above any real payload (every name voted ≈ 40 KB), but blocks oversized crafted links */
const MAX_PAYLOAD = 100_000;

export function decodeVotes(ds: Dataset, payload: string): SharedVotes {
  if (payload.length > MAX_PAYLOAD) throw new ShareError('error.invalid');
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(fromBase64Url(payload.trim()));
  } catch {
    throw new ShareError('error.unreadable');
  }
  let p = 0;
  const u8 = () => {
    if (p >= bytes.length) throw new ShareError('error.truncated');
    return bytes[p++];
  };
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  const varint = () => {
    let n = 0, shift = 0, b: number;
    do {
      b = u8();
      n += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return n;
  };
  if (u8() !== FORMAT) throw new ShareError('error.version');
  if (u32() !== ds.hash) throw new ShareError('error.datasetMismatch');
  const sharedAt = u32() * 60000;
  const nameLen = u8();
  const name = new TextDecoder().decode(bytes.slice(p, p + nameLen));
  p += nameLen;
  const count = varint();
  const votes: Votes = {};
  let idx = 0;
  for (let i = 0; i < count; i++) {
    idx += varint();
    const code = u8();
    const n = ds.names[idx];
    if (!n) throw new ShareError('error.inconsistent');
    const s = code % 3;
    votes[n.k] = { s: (s === 0 ? -1 : s) as Verdict, r: Math.floor(code / 3), t: sharedAt };
  }
  return { name, sharedAt, votes };
}

// ---------------------------------------------------------------------------------------------
// Link and QR codes

const HASH_PREFIX = '#v=';

export function shareUrl(payload: string): string {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  return url.toString() + HASH_PREFIX + payload;
}

/** Extracts the payload from a pasted link, a URL hash or a raw code */
export function extractPayload(text: string): string | null {
  const t = text.trim();
  const i = t.indexOf(HASH_PREFIX);
  if (i >= 0) return t.slice(i + HASH_PREFIX.length);
  if (/^[A-Za-z0-9_-]{8,}$/.test(t)) return t;
  return null;
}

/** Above this, a QR code gets too dense to scan comfortably from a screen */
export const SINGLE_QR_MAX = 900;
const CHUNK = 350;

/**
 * Splits into several QR codes, shown in a loop and reassembled by the in-app scanner.
 * Frame: "PD1:<i>/<n>:<id>:<chunk>"
 */
export function chunkPayload(payload: string): string[] {
  const n = Math.ceil(payload.length / CHUNK);
  const id = Math.random().toString(36).slice(2, 6);
  return Array.from({ length: n }, (_, i) => `PD1:${i + 1}/${n}:${id}:${payload.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

/** Reassembles scanned frames into the full payload. */
export class ChunkCollector {
  private id = '';
  private parts: string[] = [];
  total = 0;
  get received() {
    return this.parts.filter(Boolean).length;
  }
  /** Returns the full payload, or null while frames are missing. Also accepts a plain link. */
  add(text: string): string | null {
    const m = text.match(/^PD1:(\d+)\/(\d+):(\w+):(.*)$/s);
    if (!m) return extractPayload(text);
    const [, i, n, id, part] = m;
    if (id !== this.id) {
      this.id = id;
      this.parts = [];
      this.total = +n;
    }
    this.parts[+i - 1] = part;
    return this.received === this.total ? this.parts.join('') : null;
  }
}

// ---------------------------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
