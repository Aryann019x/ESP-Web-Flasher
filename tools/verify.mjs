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
    3. does the bootloader match the board's declared flash size, cover the
       partition table, and does every app image fit its slot?
    4. does each manifest point back at the same image as its board entry and
       keep every part inside that flash?
    5. does every image/font the page asks for exist, and is every asset in
       images/ and fonts/ actually used?
    6. are the social tags absolute? crawlers silently drop relative ones.

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

const FLASH_MB = [1, 2, 4, 8, 16, 32, 64, 128];
const CHIP_ID = { ESP32: 0x0000, 'ESP32-S3': 0x0009 };
const BOOT_AT = { ESP32: 0x1000, 'ESP32-S3': 0x0 };
const kb = (n) => `${Math.round(n / 1024)}K`;

// Read an ESP image at `off`: 24-byte header, then segments. Also returns the
// flash size and chip from the header, so a bad merge is caught here.
function readImage(buf, off) {
  if (off + 24 > buf.length || buf[off] !== 0xe9) return null;
  let p = off + 24;
  for (let i = 0; i < buf[off + 1]; i++) {
    if (p + 8 > buf.length) return null;
    const len = buf.readUInt32LE(p + 4);
    if (p + 8 + len > buf.length) return null;
    p += 8 + len;
  }
  return {
    end: p + 1 + (buf[off + 23] ? 32 : 0),
    chip: buf.readUInt16LE(off + 12),
    flashMb: FLASH_MB[buf[off + 3] >> 4],
  };
}

function readPartitions(buf) {
  if (buf.length < 0x9000 || buf.readUInt16LE(0x8000) !== 0x50aa) return null;
  const out = [];
  for (let i = 0; i < 0x1000 / 32; i++) {
    const o = 0x8000 + i * 32;
    if (o + 32 > buf.length) break;
    const magic = buf.readUInt16LE(o);
    if (magic === 0xebeb) return out.length ? out : null;
    if (magic !== 0x50aa) return null;
    out.push({
      type: buf[o + 2],
      off: buf.readUInt32LE(o + 4),
      size: buf.readUInt32LE(o + 8),
      label: buf.toString('ascii', o + 12, o + 28).replace(/\0.*$/, ''),
    });
  }
  return out.length ? out : null;
}

function checkImage(id, chip, buf, file, wantFlash) {
  const bootAt = BOOT_AT[chip];
  if (bootAt === undefined) {
    note(`${id}: no image check for chip ${chip}`);
    return null;
  }

  const boot = readImage(buf, bootAt);
  if (!boot) {
    note(`${id}: ${file} has no bootloader at 0x${bootAt.toString(16)}`);
    return null;
  }
  if (boot.chip !== CHIP_ID[chip]) {
    note(`${id}: ${file} bootloader is for chip 0x${boot.chip.toString(16)}, expected ${chip}`);
  }
  if (!boot.flashMb) {
    note(`${id}: ${file} bootloader has an invalid flash size`);
    return null;
  }
  if (wantFlash && boot.flashMb !== wantFlash) {
    note(`${id}: ${file} bootloader says ${boot.flashMb}MB flash, board entry says ${wantFlash}MB`);
  }

  const parts = readPartitions(buf);
  if (!parts) {
    note(`${id}: ${file} has no valid partition table`);
    return null;
  }

  const ordered = [...parts].sort((a, b) => a.off - b.off);
  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i];
    if (p.off % 0x1000) note(`${id}: ${file} ${p.label} is not 4K aligned`);
    if (i && p.off < ordered[i - 1].off + ordered[i - 1].size) {
      note(`${id}: ${file} ${ordered[i - 1].label} overlaps ${p.label}`);
    }
  }
  const end = Math.max(...ordered.map((p) => p.off + p.size));
  if (end > boot.flashMb * 1024 * 1024) {
    note(`${id}: ${file} partitions end at ${kb(end)} but the bootloader says ${boot.flashMb}MB`);
  }

  const apps = ordered.filter((p) => p.type === 0);
  if (!apps.length) note(`${id}: ${file} has no app partition`);
  let images = 0;
  for (const app of apps) {
    if (app.off >= buf.length) continue; // trimmed image, slot is past the end
    if (buf[app.off] !== 0xe9) {
      const blank = buf.subarray(app.off, Math.min(app.off + 0x1000, buf.length)).every((b) => b === 0xff);
      if (!blank) note(`${id}: ${file} ${app.label} is not an app image`);
      continue;
    }
    const img = readImage(buf, app.off);
    if (!img) {
      note(`${id}: ${file} ${app.label} has a broken image`);
      continue;
    }
    if (img.chip !== CHIP_ID[chip]) {
      note(`${id}: ${file} ${app.label} is for chip 0x${img.chip.toString(16)}, expected ${chip}`);
    }
    if (wantFlash && img.flashMb !== wantFlash) {
      note(`${id}: ${file} ${app.label} says ${img.flashMb}MB flash, board entry says ${wantFlash}MB`);
    }
    if (img.end > app.off + app.size) {
      note(`${id}: ${file} ${app.label} uses ${kb(img.end - app.off)} of a ${kb(app.size)} slot`);
    }
    images++;
  }
  if (!images) note(`${id}: ${file} has no app image`);
  return boot.flashMb;
}

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

  // 3. the image itself: bootloader, partitions, app fit, declared flash size
  let flashMb = null;
  if (board.file && existsSync(at(board.file))) {
    flashMb = checkImage(id, board.chip, readFileSync(at(board.file)), board.file, board.flash);
  }

  // 4. the manifest agrees with the board entry
  const mpath = board.manifest && strip(board.manifest);
  if (mpath && existsSync(at(mpath))) {
    let manifest;
    try {
      manifest = JSON.parse(read(mpath));
    } catch (err) {
      note(`${id}: ${mpath} is not valid JSON (${err.message})`);
    }
    if (manifest) {
      const builds = manifest.builds || [];
      const parts = builds.flatMap((b) => b.parts || []);
      if (!parts.length) note(`${id}: ${mpath} declares no parts`);
      const want = resolve(root, strip(board.file));
      const resolvedParts = [];
      for (const part of parts) {
        if (!part.path) { note(`${id}: ${mpath} has a part with no path`); continue; }
        const resolved = resolve(root, dirname(mpath), strip(part.path));
        if (!existsSync(resolved)) {
          note(`${id}: ${mpath} part is missing -> ${part.path}`);
          continue;
        }
        if (typeof part.offset !== 'number') {
          note(`${id}: ${mpath} part ${part.path} has no numeric offset`);
          continue;
        }
        resolvedParts.push({ offset: part.offset, size: readFileSync(resolved).length, file: part.path });
      }
      if (!parts.some((part) => part.path && resolve(root, dirname(mpath), strip(part.path)) === want)) {
        note(`${id}: ${mpath} never points at ${board.file}`);
      }
      resolvedParts.sort((a, b) => a.offset - b.offset);
      for (let i = 0; i < resolvedParts.length; i++) {
        const part = resolvedParts[i];
        if (flashMb && part.offset + part.size > flashMb * 1024 * 1024) {
          note(`${id}: ${mpath} part ${part.file} ends past the ${flashMb}MB flash`);
        }
        if (i && part.offset < resolvedParts[i - 1].offset + resolvedParts[i - 1].size) {
          note(`${id}: ${mpath} parts ${resolvedParts[i - 1].file} and ${part.file} overlap`);
        }
      }
      for (const build of builds) {
        if (!build.chipFamily) note(`${id}: ${mpath} has a build with no chipFamily`);
        else if (board.chip && build.chipFamily !== board.chip) {
          note(`${id}: ${mpath} says ${build.chipFamily} but the board says ${board.chip}`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- index.html
const html = read('index.html');

// 5a. every referenced asset exists
const referenced = new Set(
  [...html.matchAll(/(?:images|fonts)\/[A-Za-z0-9._-]+/g)].map((m) => m[0]).filter((p) => ASSET_EXT.test(p))
);
for (const ref of referenced) {
  if (!existsSync(at(ref))) note(`index.html references a missing asset: ${ref}`);
}

// 5b. every asset on disk is referenced (no dead weight in the repo)
for (const dir of ['images', 'fonts']) {
  for (const file of readdirSync(at(dir))) {
    if (!ASSET_EXT.test(file)) continue;
    if (!referenced.has(`${dir}/${file}`)) note(`${dir}/${file} is never referenced by index.html`);
  }
}

// 6. social tags must be absolute
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
console.log(`firmware files: ${readdirSync(at('firmware')).filter((f) => f.endsWith('.bin')).length}`);
console.log(`manifests: ${readdirSync(at('manifests')).filter((f) => f.endsWith('.json')).length}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nall good: paths, hashes, images, manifests, assets and social tags line up');
