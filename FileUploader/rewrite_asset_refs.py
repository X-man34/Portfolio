#!/usr/bin/env python3
"""Repoint /assets/... references in the site to the R2 bucket public URL.

- Resolves each reference against the real on-disk file (case-insensitive) so the
  emitted URL matches the case-sensitive R2 object key.
- URL-encodes path segments (spaces -> %20, etc.).
- Skips .glb references (janky viewer being replaced later; glbs not mirrored to
  their asset subfolders in the bucket).
- Only rewrites references whose target actually exists under assets/.
"""
import os
import re
import sys
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BASE = "https://files.calebhottes.com/"
APPLY = "--apply" in sys.argv

TARGET_EXTS = (".html", ".js", ".css")
# match an opening quote/paren delimiter, then an optional leading slash + assets/... path
PAT = re.compile(r"""(?P<pre>["'(])(?P<path>/?assets/[^"')]+)""")

# Build a case-insensitive index of real relative paths under assets/
real_index = {}
for dirpath, _dirs, files in os.walk(ASSETS):
    for fn in files:
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, ASSETS).replace(os.sep, "/")
        real_index[rel.lower()] = rel


def resolve(rel):
    """Return the correctly-cased rel path, or None if it doesn't exist."""
    return real_index.get(rel.lower())


changes = []       # (file, original_path, new_url)
skipped_glb = []   # (file, path)
unresolved = []    # (file, path)


def process(path_text, filename):
    """path_text is like '/assets/Senior Design/modifiedthumbnail.png'."""
    rel = path_text.lstrip("/")
    assert rel.startswith("assets/")
    rel = rel[len("assets/"):]
    if rel.lower().endswith(".glb"):
        skipped_glb.append((filename, path_text))
        return None
    real = resolve(rel)
    if real is None:
        unresolved.append((filename, path_text))
        return None
    url = BASE + quote(real, safe="/")
    changes.append((filename, path_text, url))
    return url


# Scope: only the site's own pages — src/** plus the root index.html.
# Do NOT touch pages under assets/ (self-contained reports whose relative
# asset refs already resolve correctly when served from the bucket).
files = [os.path.join(ROOT, "index.html")]
for dirpath, _dirs, fnames in os.walk(os.path.join(ROOT, "src")):
    if os.sep + "node_modules" in dirpath:
        continue
    for fn in fnames:
        if fn.endswith(TARGET_EXTS):
            files.append(os.path.join(dirpath, fn))
files = sorted(set(files))

for fpath in files:
    with open(fpath, "r", encoding="utf-8", errors="surrogatepass") as fh:
        content = fh.read()
    rel_name = os.path.relpath(fpath, ROOT)

    def repl(m):
        new = process(m.group("path"), rel_name)
        if new is None:
            return m.group(0)
        return m.group("pre") + new

    new_content = PAT.sub(repl, content)
    if APPLY and new_content != content:
        with open(fpath, "w", encoding="utf-8", errors="surrogatepass") as fh:
            fh.write(new_content)

print(f"{'APPLIED' if APPLY else 'DRY RUN'} — {len(changes)} rewrites, "
      f"{len(skipped_glb)} glb skipped, {len(unresolved)} UNRESOLVED\n")
print("=== REWRITES ===")
for f, p, u in changes:
    print(f"  [{f}]\n    {p}\n    -> {u}")
if skipped_glb:
    print("\n=== SKIPPED (.glb, left local) ===")
    for f, p in skipped_glb:
        print(f"  [{f}] {p}")
if unresolved:
    print("\n=== UNRESOLVED (no matching file under assets/ — left unchanged) ===")
    for f, p in unresolved:
        print(f"  [{f}] {p}")
