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

## Deployment

Static site on Vercel over HTTPS — browsers only expose USB to HTTPS or
`localhost`, so `file://` and plain HTTP will never work. The CORS and
content-type headers the flasher needs ship in `vercel.json`:

| Path | Header | Why |
| --- | --- | --- |
| `/firmware/*` | `Access-Control-Allow-Origin: *` | ESP Web Tools fetches the image itself |
| `/firmware/*` | `Content-Type: application/octet-stream` | served as opaque bytes, not sniffed |
| `/manifests/*` | `Access-Control-Allow-Origin: *` | manifest is fetched the same way |
| `/manifests/*` | `Content-Type: application/json` | parsed as a manifest, not a download |

```sh
vercel --prod
```

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
