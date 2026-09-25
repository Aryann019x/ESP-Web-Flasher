# ESP Web Flasher

> Flash ESP32 and ESP32-S3 firmware straight from the browser. No installer,
> no toolchain, no uploads — the image streams from your machine to the chip
> over USB.

Pick a board, check the wiring, hit flash, read the boot log.

**You need:** Chrome or Edge on a desktop, and a USB **data** cable.
Charge-only cables are the number one reason flashing fails.

## Features

- **Prebuilt images** across ESP32 and ESP32-S3. Every board card shows its
  SHA-256, so you can verify exactly what you're flashing.
- **Bring your own `.bin`.** Switch the picker to *Your .bin* and drop a file.
  The chip family and flash offset are read from the image header — the loader
  looks for the `0xE9` image magic (`0xEA` means ESP8266), reads the chip id at
  `+12`, and works out whether the file is a merged image or an app-only build.
  Nothing is uploaded.
- **Per-board wiring.** Each board carries a schematic, a pin table and a
  connection guide.
- **Live serial console.** Connect, watch the boot log, send with CRLF control,
  and copy / save / clear the output.
- **Dark and light themes**, a zoomable schematic, and self-hosted fonts —
  nothing but two libraries is fetched from a CDN.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The whole app — markup, styles and logic, no build step |
| `boards.js` | **The one file to edit.** Every board with its chip, file, hash and assets |
| `manifests/*.json` | One ESP Web Tools manifest per firmware |
| `firmware/*.bin` | The prebuilt images |
| `diagrams/*.png` | Wiring diagrams, one per chip |
| `connections/*.md` | Per-board pin tables and wiring notes |
| `fonts/`, `images/` | Self-hosted fonts, theme backdrops, social card |
| `vercel.json` | CORS and content-type headers the flashed files need |
| `tools/verify.mjs` | Dependency-free integrity check, also run by CI |

## Run it locally

Any static server will do. Web Serial needs a secure context, and `localhost`
counts as one:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

## Go live

Any static host — Vercel, Netlify, GitHub Pages. Opening `index.html` over
`file://` will not work, and neither will plain HTTP: browsers only expose USB
to HTTPS or `localhost`.

`vercel.json` ships the headers the flasher depends on:

| Path | Header | Why |
| --- | --- | --- |
| `/firmware/*` | `Access-Control-Allow-Origin: *` | ESP Web Tools fetches the image itself |
| `/firmware/*` | `Content-Type: application/octet-stream` | served as opaque bytes, not sniffed |
| `/manifests/*` | `Access-Control-Allow-Origin: *` | manifest is fetched the same way |
| `/manifests/*` | `Content-Type: application/json` | parsed as a manifest, not a download |

```sh
vercel --prod      # or: push to a repo and import it in the dashboard
```

### After the first deploy

1. **Import and deploy** — Vercel → Add New → Project → this repo → Deploy. No
   build step, no build settings; free HTTPS and a redeploy on every push.
2. **Point the social card at the real origin.** `og:url`, `og:image`,
   `twitter:image` and `<link rel="canonical">` all carry a placeholder origin.
   Swap every one of them for your production URL once the domain is decided —
   there is a marked comment in `index.html`'s `<head>` saying exactly where.
3. **Optional — comments.** The Discussion band is built but inert: it stays
   hidden and requests nothing from `giscus.app` until it is configured. To
   switch it on, enable Discussions (repo → Settings → General → Features),
   install https://github.com/apps/giscus on the repo, then paste `category`
   and `categoryId` from https://giscus.app into the `GISCUS` object at the top
   of the script in `index.html`, then fill `repoId` with the repo's node id
   (`gh api repos/<owner>/<repo> --jq .node_id`). All three stay blank until
   then, so nothing loads.
4. **Optional — a free subdomain.** `is-a.dev` and `runs-on.dev` both allocate
   subdomains through a pull request that adds one small JSON file pointing a
   CNAME at your Vercel URL.

## Add a board

1. Put the merged `.bin` in `firmware/`. Full images sit at offset `0x0000`;
   app-only builds go at `0x10000` and set erase off in their manifest.
2. Copy an entry in `boards.js` and change `name`, `group`, `chip`, `file` and
   `manifest`.
3. Add its SHA-256:
   `Get-FileHash -Algorithm SHA256 firmware\your-board.bin`
4. Optional: point `diagram` and `guide` at a schematic and a wiring guide.

Then **bump the `boards.js?v=` number in `index.html`** so returning visitors
get the new list. The dropdowns, the board library, the hero panel and the
generated flash command all rebuild themselves from `boards.js` — there is no
other file to touch.

Diagrams are **per chip, not per display**: swapping a panel is a firmware
define, not a wiring change, so every ESP32-S3 board shares one diagram.
Wiring *guides* stay per board, because pin notes and the touch-vs-buttons
difference do vary.

## Checks

```sh
node tools/verify.mjs
```

Needs nothing but Node. It fails if any board's files are missing, if an
advertised SHA-256 no longer matches its `.bin`, if a manifest drifts away
from the board it belongs to, if an asset in `images/` or `fonts/` is
referenced but absent or present but unused, or if the social tags stop being
absolute. CI runs it on every push and pull request — see
`.github/workflows/verify.yml`.

## Credits and licence

The site code is MIT — see `LICENSE`. The bundled firmware is **not**: each
image belongs to its own project under its own licence, with sources listed in
`ATTRIBUTION.md`. Every image is pinned by SHA-256 so it can be checked
against official releases.

Use these tools only on hardware and networks you own or are explicitly
authorised to test.
