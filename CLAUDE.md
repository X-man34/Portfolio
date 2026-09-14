# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, hand-written multi-page portfolio site (no framework, no bundler, no build step for JS/HTML). Pages are plain HTML files that pull in Tailwind, a few shared vanilla-JS scripts, and media hosted on Cloudflare R2. There are no tests and no lint config.

## Commands

```bash
npm run build.css   # tailwindcss watch: src/stylesheets/custom.css -> src/stylesheets/output.css
```

`output.css` is a committed build artifact. Rebuild it after editing `custom.css` (one-shot: `npx tailwindcss -i ./src/stylesheets/custom.css -o ./src/stylesheets/output.css`). Note the split: **`output.css` only carries the component classes defined in `custom.css`** — content globbing does not pick up classes from the HTML (a rebuild with no `custom.css` change is byte-identical), so plain Tailwind utilities written in markup are served by the Tailwind CDN instead. Practical rule: new reusable component classes go in `custom.css` and need a rebuild; one-off utilities in HTML just work.

To preview locally, serve the repo root over HTTP (e.g. `python3 -m http.server`) rather than opening files directly — every asset reference is a **root-absolute path** (`/src/...`, `/favicon/...`) and `common.js` fetches `/src/nav.html`, both of which break under `file://`.

## Layout

- `index.html` — landing page. Compact hero, then About/Skills as collapsed `<details>` panels, a slim CAD-viewer band, then the project list. Each project entry shows title + description with the media and "See more details" button inside a `<details class="home-project-details">`. A small inline script at the bottom opens a `<details>` when it is the URL hash target (so the navbar's `#skills` link works).
- `src/projects/*.html` — one file per project detail page. These are the pages to copy when adding a project.
- `src/*.html` at the `src/` root — standalone Three.js CAD viewer pages (`AmeliaBearhart.html`, `Polarity.html`) and giant eDrawings HTML exports (`MEClubTrike2025.html`, `Tilty Loader.html`, ~8k lines of generated code — never hand-edit these).
- `src/nav.html` — shared navbar fragment, injected at runtime into every page. Holds the hamburger (☰) dropdown listing every detail page. Because `common.js` injects it with `innerHTML`, **`<script>` tags inside it will not execute** — the menu toggle uses inline `onclick` attributes for that reason. All its links are root-absolute (`/index.html#…`, `/src/projects/…`).
- `FileUploader/` — Windows-only tooling for the R2 bucket (see below). Includes a vendored `rclone.exe`.

## Shared page conventions

Every content page's `<head>` includes, in this order: Tailwind CDN (`cdn.tailwindcss.com`), Font Awesome CDN, favicons, `/src/stylesheets/output.css`, and `/src/scripts/common.js`. The Tailwind CDN and the compiled `output.css` are both loaded; the compiled sheet supplies the `@apply`-based component classes in `custom.css` (`.detail-page-*`, `.project-media`, `.see-more-details-button`, `.enlargeable-modal-*`, `.mg-*`).

`src/scripts/common.js` runs on every page and does templating by CSS class — put empty elements with `.my-name`, `.my-email`, `.my-phone`, `.year`, or `.email-link` in the markup and it fills them in. Contact details live only in that file; change them there, not in the pages. It also injects `src/nav.html` into `<div id="navbar-placeholder"></div>` (so every page needs that div) and hides `.android-hidden` elements on Android.

`src/scripts/media-gallery.js` provides the `MediaGallery` lightbox. Two ways to use it: add `data-mg-auto` to a container whose children carry `data-mg-src` / `data-mg-type` / `data-mg-poster` (auto-inits on DOMContentLoaded), or construct it explicitly with `new MediaGallery(el, { items, preload, modalId })`. It builds its own modal DOM.

`src/scripts/enlargeImage.js` is the older single-image modal (`onclick="openEnlargeableImageModal(this.src)"`); it assumes `#enlargeableImageModal` and a `.close` element exist on the page and throws if they don't.

`src/scripts/CADRenderer.js` exposes `initializeViewer(modelUrl)` — a Three.js r138 (CDN, legacy non-module builds) GLTF + DRACO viewer that takes over the whole `<body>`. Viewer pages load the four CDN scripts, then `CADRenderer.js`, then call `initializeViewer(...)`.

## Media / assets

There is no `assets/` directory in the repo — all images, videos, PDFs, and `.glb` models were migrated to Cloudflare R2 and are referenced by absolute URL under `https://files.calebhottes.com/...` (URL-encoded, case-sensitive object keys). New media goes to the bucket, not into git.

`FileUploader/rewrite_asset_refs.py` is the one-time migration script that rewrote `/assets/...` references to bucket URLs (`--apply` to write; dry-run otherwise). It skipped `.glb`, so `src/AmeliaBearhart.html` and `src/Polarity.html` still point at dead `/assets/**.glb` paths — those two viewers are broken and superseded by the hosted viewer at `https://cad.calebhottes.com/website/?model=<name>`.

`FileUploader/manage_models.bat` (Windows, uses the vendored rclone against the `portfolio-bucket:portfolio/` remote) is the interactive tool for listing/uploading/renaming/deleting CAD models. It keeps `index.json` — the `name` -> `file` map the hosted CAD viewer resolves `?model=` against — in sync between local and bucket.

## Gotchas

- `node_modules/` is committed, and its files plus the vendored rclone docs show up as modified in `git status` due to CRLF churn. Don't sweep those into commits.
- `src/tailwind.config.js` sets `content: ["./**/*.html"]` but lives in `src/`, while the npm script runs Tailwind from the repo root — which is why content globbing never resolves (see Commands). Leave it alone unless you intend to fix the whole arrangement; the site depends on the CDN covering the gap.

## Working with the R2 bucket

The vendored `rclone.exe` runs fine from WSL, e.g. from `FileUploader/`:

```bash
R=./rclone-v1.73.5-windows-amd64/rclone.exe
$R ls   portfolio-bucket:portfolio/<prefix>/
$R copyto <local> portfolio-bucket:portfolio/<prefix>/<name>
```

- It is a **Windows** binary, so it cannot read Linux-only paths — `/tmp/foo.png` resolves to `C:/tmp/foo.png` and fails. Stage files somewhere under the repo (a Windows-visible path) before uploading.
- Large uploads (300 MB+ installers, `.glb` models) take minutes; run them with `run_in_background`.
- Verify with `curl -sI https://files.calebhottes.com/<key>` — a 200 means it is live and public.
- **Always `copy` `index.json` down from the bucket before editing it.** The bucket copy is the source of truth and drifts ahead of the one committed in `FileUploader/`; it has gained fields (`displayName`) and entries that the local copy lacked. Edit the pulled copy, then `copyto` it back.
- `index.json` entries are `{name, displayName, file}`; the hosted viewer at `https://cad.calebhottes.com/website/?model=<name>` resolves `<name>` against it. Adding a model = upload the `.glb` to `cad-models/` + add an entry + push `index.json`.
- Don't upload internal working notes to the bucket. The research-lab `Project Status.md`, for example, contains personal Zoom links.
- Asset drop-off folders the user creates in the repo root (`TempUTTTAssets/`, `Research Lab Assets/`, `CAD Files to work with/`, loose `.glb` files) are staging areas, not content. There is no `.gitignore`, so never `git add -A` — a single one of those folders can be a gigabyte.

## Adding a project page

Copy an existing page in `src/projects/` (`DesignProject2.html` is the cleanest template) and keep its structure: same `<head>` block, `#navbar-placeholder`, `detail-page-*` classes, a `grid grid-cols-1 md:grid-cols-2 gap-8` of `.project-media` cards, the `#enlargeableImageModal` div, the footer, and `enlargeImage.js` last. Use `md:col-span-2` for a card that should span the row. For a GitHub link, match the robotics pages: a dark `bg-gray-900` inline-flex button with the inline SVG, placed in a `mb-6` div under the `<h2>` — not a blue `.see-more-details-button`.

Then add a matching entry to the project list in `index.html` (title + description outside the `<details>`, media + button inside) and a link in the `src/nav.html` hamburger.

If a project has no supplied thumbnail, one can be rendered from a PDF: `pdftoppm -png -r 150 -f 1 -l 1 doc.pdf out` then crop with `convert`. Both are available.
