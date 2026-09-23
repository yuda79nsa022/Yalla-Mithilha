/**
 * Turns the reveal link's payload (title/category/image) into a single
 * opaque token instead of a plain, human-readable query string. This is
 * obfuscation, not real confidentiality: the key below ships inside this
 * same client bundle, since whoever decodes a link (the `/reveal` screen)
 * has to do it with no server round-trip, no login, and no config of its
 * own — see the file comment on `buildRevealUrl` in `reveal.ts`. Anyone
 * willing to read the bundled JS can recover the key. What it actually
 * buys: a raw link glimpsed on a shared screen, in browser history, in a
 * screenshot, or in a server access log no longer reveals the round's
 * answer at a glance — only a deliberate effort does.
 *
 * Deliberately hand-rolled rather than using `TextEncoder`/`btoa` or a
 * crypto library: this runs on whatever renders the shared screen, which
 * can be the native app (Hermes has no guaranteed `btoa`/`TextEncoder`) as
 * much as a browser. Working in UTF-16 code units end to end (`charCodeAt`
 * / `fromCharCode`, no byte-splitting) sidesteps that entirely, at the cost
 * of a longer encoded string than real base64 would give — a non-issue for
 * a URL that only has to fit in a QR code alongside a short title.
 */

/** Any fixed string works — it only has to match between whoever builds a link and whoever decodes it, both shipped from this same bundle. */
const REVEAL_KEY = 'yalla-mithilha-reveal-v1';

export interface RevealPayload {
  t: string;
  ca: string;
  ce: string;
  img?: string;
}

function xorCharCode(code: number, position: number): number {
  return code ^ REVEAL_KEY.charCodeAt(position % REVEAL_KEY.length);
}

function toHex4(n: number): string {
  return n.toString(16).padStart(4, '0');
}

export function encodeRevealToken(payload: RevealPayload): string {
  const json = JSON.stringify(payload);
  let out = '';
  for (let i = 0; i < json.length; i++) {
    out += toHex4(xorCharCode(json.charCodeAt(i), i));
  }
  return out;
}

/** `null` on anything malformed — a tampered or truncated token must never throw past this into the reveal screen. */
export function decodeRevealToken(token: string): RevealPayload | null {
  if (!token || token.length % 4 !== 0) return null;
  try {
    let json = '';
    for (let i = 0; i < token.length; i += 4) {
      const code = Number.parseInt(token.slice(i, i + 4), 16);
      if (Number.isNaN(code)) return null;
      json += String.fromCharCode(xorCharCode(code, i / 4));
    }
    const parsed: unknown = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as RevealPayload).t !== 'string' ||
      typeof (parsed as RevealPayload).ca !== 'string' ||
      typeof (parsed as RevealPayload).ce !== 'string'
    ) {
      return null;
    }
    return parsed as RevealPayload;
  } catch {
    return null;
  }
}
