#!/usr/bin/env node
// Foundry — design token contrast validator.
// Apache-2.0. Node >= 20, standard library only. No install, no network.
//
// Usage:
//   node check-token-contrast.mjs <tokens.css> [more.css ...] [--manifest tokens.manifest.json]
//                                [--theme dark] [--json report.json]
//
// Parses CSS custom properties per theme selector, resolves var() chains, and checks every
// pair declared in the manifest against its WCAG 2.2 threshold. Exits 1 on any failure.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

const DEFAULT_THRESHOLDS = { text: 4.5, 'large-text': 3, 'non-text': 3, enhanced: 7 };
const SC = {
  text: 'WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA)',
  'large-text': 'WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA), large text',
  'non-text': 'WCAG 2.2 SC 1.4.11 Non-text Contrast (AA)',
  enhanced: 'WCAG 2.2 SC 1.4.6 Contrast (Enhanced) (AAA)',
};

// ---------- colour maths (WCAG relative luminance) ----------

const clamp255 = (n) => Math.min(255, Math.max(0, n));

function parseColor(raw) {
  const v = String(raw).trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length < 3) return null;
    return parts.map((p) => clamp255(p.endsWith('%') ? Math.round((parseFloat(p) / 100) * 255) : parseFloat(p)));
  }
  m = /^hsla?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    return hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100);
  }
  const NAMED = { white: [255, 255, 255], black: [0, 0, 0], transparent: null };
  if (v in NAMED) return NAMED[v];
  return null;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return seg.map((n) => Math.round((n + m) * 255));
}

const toLinear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

export function contrastRatio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return Number((((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2));
}

// ---------- CSS custom property extraction, per theme scope ----------

function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }

/** @returns {Map<string, Map<string,string>>} scope selector -> token name -> raw value */
export function extractTokens(css) {
  const out = new Map();
  const text = stripComments(css);
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const body = m[2];
    const decls = [...body.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);?/g)];
    if (decls.length === 0) continue;
    for (const sel of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!out.has(sel)) out.set(sel, new Map());
      const scope = out.get(sel);
      for (const d of decls) scope.set(d[1], d[2].trim());
    }
  }
  return out;
}

/** Theme name from a scope selector: ':root' -> 'default', "[data-theme='dark']" -> 'dark'. */
function themeOf(selector) {
  const m = /\[data-theme=['"]?([a-z0-9_-]+)['"]?\]/i.exec(selector);
  if (m) return m[1];
  if (/^:root$/.test(selector) || /^html$/.test(selector) || /^\*?:where\(:root\)$/.test(selector)) return 'default';
  return null; // component or unrelated scope; ignored for theme validation
}

export function buildThemes(scopes) {
  const base = new Map();
  for (const [sel, tokens] of scopes) if (themeOf(sel) === 'default') for (const [k, v] of tokens) base.set(k, v);
  const themes = new Map([['default', new Map(base)]]);
  for (const [sel, tokens] of scopes) {
    const name = themeOf(sel);
    if (!name || name === 'default') continue;
    if (!themes.has(name)) themes.set(name, new Map(base));
    const t = themes.get(name);
    for (const [k, v] of tokens) t.set(k, v);
  }
  return themes;
}

/** Resolve var() chains within a theme. Depth-capped so cycles cannot hang the run. */
export function resolve(tokens, name, depth = 0) {
  if (depth > 10) return { error: `reference depth > 10 starting at ${name}` };
  const raw = tokens.get(name);
  if (raw === undefined) return { error: `undefined token ${name}` };
  const v = raw.trim();
  const m = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
  if (m) {
    const next = resolve(tokens, m[1], depth + 1);
    if (!next.error) return { ...next, depth: (next.depth ?? 0) + 1 };
    if (m[2]) return { value: m[2].trim(), depth: depth + 1 };
    return next;
  }
  return { value: v, depth };
}

// ---------- manifest ----------

function loadManifest(argPath, cssPaths) {
  const candidates = argPath
    ? [argPath]
    : cssPaths.map((p) => join(dirname(p), 'tokens.manifest.json'));
  for (const c of candidates) if (existsSync(c)) return JSON.parse(readFileSync(c, 'utf8'));
  return null;
}

// ---------- main ----------

function main(argv) {
  const args = argv.slice(2);
  const cssFiles = args.filter((a) => !a.startsWith('--') && /\.(css|scss)$/.test(a));
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

  if (cssFiles.length === 0) {
    console.error('usage: check-token-contrast.mjs <tokens.css> [--manifest tokens.manifest.json] [--theme dark] [--json report.json]');
    return 2;
  }

  const scopes = new Map();
  for (const f of cssFiles) {
    for (const [sel, tokens] of extractTokens(readFileSync(f, 'utf8'))) {
      if (!scopes.has(sel)) scopes.set(sel, new Map());
      for (const [k, v] of tokens) scopes.get(sel).set(k, v);
    }
  }
  const themes = buildThemes(scopes);

  const manifest = loadManifest(flag('manifest'), cssFiles);
  if (!manifest) {
    console.error('No manifest found. Create tokens.manifest.json next to your tokens file.');
    console.error('See references/contrast-validation.md for the format.');
    return 2;
  }
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(manifest.thresholds ?? {}) };
  const only = flag('theme');

  const results = [];
  let failures = 0, errors = 0;

  for (const [themeName, tokens] of themes) {
    if (only && only !== themeName) continue;
    const overrides = manifest.themeThresholds?.[themeName] ?? {};
    for (const pair of manifest.pairs ?? []) {
      const kind = pair.kind ?? 'text';
      const min = overrides[kind] ?? pair.min ?? thresholds[kind];
      if (min === undefined) { console.error(`unknown pair kind "${kind}"`); errors++; continue; }

      const fgR = resolve(tokens, pair.foreground);
      const bgR = resolve(tokens, pair.background);
      if (fgR.error || bgR.error) {
        errors++;
        results.push({ theme: themeName, ...pair, status: 'error', reason: fgR.error ?? bgR.error });
        continue;
      }
      const fg = parseColor(fgR.value), bg = parseColor(bgR.value);
      if (!fg || !bg) {
        errors++;
        results.push({ theme: themeName, ...pair, status: 'error',
          reason: `unparseable colour: ${!fg ? fgR.value : bgR.value}` });
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      const pass = ratio >= min;
      if (!pass) failures++;
      results.push({ theme: themeName, foreground: pair.foreground, background: pair.background,
        kind, ratio, min, status: pass ? 'pass' : 'fail', standard: SC[kind] ?? kind });
    }
  }

  for (const r of results) {
    if (r.status === 'pass') continue;
    const detail = r.status === 'error' ? r.reason : `${r.ratio}:1 < ${r.min}:1  [${r.standard}]`;
    console.error(`${r.status.toUpperCase()}  [${r.theme}] ${r.foreground} on ${r.background} — ${detail}`);
  }

  const passes = results.filter((r) => r.status === 'pass').length;
  console.log(`themes: ${[...themes.keys()].join(', ')}`);
  console.log(`pairs checked: ${results.length} | pass: ${passes} | fail: ${failures} | error: ${errors}`);

  const jsonOut = flag('json');
  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ generatedFrom: cssFiles, results }, null, 2));
    console.log(`report written to ${jsonOut}`);
  }
  return failures > 0 || errors > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv));
