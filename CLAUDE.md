# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, hand-written multi-page portfolio site (no framework, no bundler, no build step for JS/HTML). Pages are plain HTML files that pull in Tailwind, a few shared vanilla-JS scripts, and media hosted on Cloudflare R2. There are no tests and no lint config.

## Commands

```bash
npm run build.css   # tailwindcss watch: src/stylesheets/custom.css -> src/stylesheets/output.css
```

`output.css` is a committed build artifact — after editing `custom.css` or adding new Tailwind classes to HTML, regenerate it (a one-shot equivalent is `npx tailwindcss -i ./src/stylesheets/custom.css -o ./src/stylesheets/output.css`).

To preview locally, serve the repo root over HTTP (e.g. `python3 -m http.server`) rather than opening files directly — every asset reference is a **root-absolute path** (`/src/...`, `/favicon/...`) and `common.js` fetches `/src/nav.html`, both of which break under `file://`.

## Layout

- `index.html` — landing page (hero / about / skills / projects / contact), links out to detail pages.
- `src/projects/*.html` — one file per project detail page. These are the pages to copy when adding a project.
- `src/*.html` at the `src/` root — standalone Three.js CAD viewer pages (`AmeliaBearhart.html`, `Polarity.html`) and giant eDrawings HTML exports (`MEClubTrike2025.html`, `Tilty Loader.html`, ~8k lines of generated code — never hand-edit these).
- `src/nav.html` — shared navbar fragment, injected at runtime.
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
- `src/tailwind.config.js` sets `content: ["./**/*.html"]` but lives in `src/`; the npm script runs Tailwind from the repo root, so config resolution and content globbing are fragile — verify `output.css` actually contains new classes after a rebuild.
