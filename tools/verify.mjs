#!/usr/bin/env node
/*
  Integrity check for the flasher's data and assets. No dependencies, no build
  step — it only needs Node, so it can run locally (`node tools/verify.mjs`) and
  in CI (.github/workflows/verify.yml).

  It answers the questions that actually break this site:
    1. does every board point at files that exist?
    2. does the SHA-256 printed under a board still match that board's .bin?
       (a rebuilt .bin committed without updating boards.js would show a hash
       that is a lie, and the "verify what you flash" claim with it)
    3. does each manifest point back at the same image as its board entry?
    4. does every image/font the page asks for exist, and is every asset in
       images/ and fonts/ actually used?
    5. are the social tags absolute? crawlers silently drop relative ones.

  Exits 1 with a list of problems, or 0 when everything lines up.
*/
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => join(root, p);
const strip = (p) => String(p).split('?')[0].split('#')[0];
const read = (p) => readFileSync(at(p), 'utf8').trim();

const problems = [];
const note = (msg) => problems.push(msg);

// ---------------------------------------------------------------- boards.js
// boards.js is a plain script that declares const FIRMWARE, so evaluate it in a
// function scope rather than pretending it is a module.
let FIRMWARE;
try {
  FIRMWARE = new Function(`${read('boards.js')}\nreturn FIRMWARE;`)();
} catch (err) {
  console.error(`boards.js could not be evaluated: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(FIRMWARE) || !FIRMWARE.length) {
  console.error('boards.js did not expose a non-empty FIRMWARE array');
  process.exit(1);
}

const sha256 = (p) => createHash('sha256').update(readFileSync(at(p))).digest('hex');
const ASSET_EXT = /\.(woff2|png|jpe?g|svg|webp|avif)$/i;

const seenIds = new Set();
for (const board of FIRMWARE) {
  const id = board.id || board.name;
  if (!board.id) note(`${id}: entry has no id`);
  if (seenIds.has(board.id)) note(`${id}: duplicate board id`);
  seenIds.add(board.id);

  // 1. referenced files exist
  for (const key of ['file', 'manifest', 'diagram', 'guide']) {
    if (!board[key]) continue;
    if (!existsSync(at(strip(board[key])))) note(`${id}: ${key} is missing -> ${board[key]}`);
  }

  // 2. the advertised hash matches the shipped bytes
  if (board.file && board.sha && existsSync(at(board.file))) {
    const actual = sha256(board.file);
    if (actual !== board.sha) {
      note(`${id}: sha256 does not match ${board.file}\n      declared ${board.sha}\n      actual   ${actual}`);
    }
  } else if (board.file && !board.sha) {
    note(`${id}: no sha declared in boards.js`);
  }

  // 3. the manifest agrees with the board entry
  const mpath = board.manifest && strip(board.manifest);
  if (mpath && existsSync(at(mpath))) {
    let manifest;
    try {
      manifest = JSON.parse(read(mpath));
    } catch (err) {
      note(`${id}: ${mpath} is not valid JSON (${err.message})`);
    }
    if (manifest) {
      const parts = (manifest.builds || []).flatMap((b) => b.parts || []);
      if (!parts.length) note(`${id}: ${mpath} declares no parts`);
      const want = resolve(root, strip(board.file));
      for (const part of parts) {
        if (!part.path) { note(`${id}: ${mpath} has a part with no path`); continue; }
        const resolved = resolve(root, dirname(mpath), strip(part.path));
        if (resolved !== want) {
          note(`${id}: ${mpath} points at ${part.path} but the board says ${board.file}`);
        }
        if (typeof part.offset !== 'number') note(`${id}: ${mpath} part ${part.path} has no numeric offset`);
      }
      for (const build of manifest.builds || []) {
        if (!build.chipFamily) note(`${id}: ${mpath} has a build with no chipFamily`);
      }
    }
  }
}

// ---------------------------------------------------------------- index.html
const html = read('index.html');

// 4a. every referenced asset exists
const referenced = new Set(
  [...html.matchAll(/(?:images|fonts)\/[A-Za-z0-9._-]+/g)].map((m) => m[0]).filter((p) => ASSET_EXT.test(p))
);
for (const ref of referenced) {
  if (!existsSync(at(ref))) note(`index.html references a missing asset: ${ref}`);
}

// 4b. every asset on disk is referenced (no dead weight in the repo)
for (const dir of ['images', 'fonts']) {
  for (const file of readdirSync(at(dir))) {
    if (!ASSET_EXT.test(file)) continue;
    if (!referenced.has(`${dir}/${file}`)) note(`${dir}/${file} is never referenced by index.html`);
  }
}

// 5. social tags must be absolute
for (const prop of ['og:image', 'og:url']) {
  const m = html.match(new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]+)"`));
  if (!m) note(`index.html has no ${prop} tag`);
  else if (!/^https?:\/\//.test(m[1])) note(`${prop} must be an absolute URL, found "${m[1]}"`);
}
const tw = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/);
if (!tw) note('index.html has no twitter:image tag');
else if (!/^https?:\/\//.test(tw[1])) note(`twitter:image must be an absolute URL, found "${tw[1]}"`);
if (!/<link\s+rel="canonical"/.test(html)) note('index.html has no canonical link');

// ---------------------------------------------------------------- report
console.log(`checked ${FIRMWARE.length} boards, ${referenced.size} referenced assets`);
console.log(`firmware images: ${readdirSync(at('firmware')).filter((f) => f.endsWith('.bin')).length}`);
console.log(`manifests: ${readdirSync(at('manifests')).filter((f) => f.endsWith('.json')).length}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nall good: paths, hashes, manifests, assets and social tags line up');
