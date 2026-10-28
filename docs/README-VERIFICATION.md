# Public README verification

Checked 2026-10-28 against the current implementation and manifest.

- Rewrote the landing README around current features and first-time installation. Removed development-history/alpha/update-release prose from that page; retained technical material in `docs/DEVELOPMENT.md`. The repository's separate historical files are not linked from the landing page.
- Existing owner-supplied `assets/kazz-cover.png` matches the newly attached cover's SHA-256. The cover is used unchanged.
- Ten built-in imagegen calls produced ten feature-title PNGs. Every copied original has RGBA alpha with extrema 0 and 255; no pixels were edited. Spelling and feature emblems were inspected visually. Exact final prompts are in `assets/readme/prompts.json`.
- GitHub's Markdown API successfully rendered the README. All eleven image paths resolve locally, including the cover, and all images loaded in the browser. HTML image headings retain descriptive alt text.
- Inspected a local preview of GitHub's rendered HTML with approximate GitHub document styles at desktop and 390×844. Light/dark backgrounds retained readable art and text; phone preview had no horizontal overflow. This checks document content/layout, not every aspect of the live GitHub repository shell.
- The runtime packager includes the README's cover and title assets so extracted packages retain their illustrations. Runtime and source ZIP integrity and local links were checked after staging the files.
- Runtime source, manifest, dependencies and bundles are unchanged. No new runtime tests were added for this documentation change; GitHub's normal checks still apply.

README assets are documentation-only and make no runtime requests. Main-branch GitHub rendering should be checked once the pull request is merged.
