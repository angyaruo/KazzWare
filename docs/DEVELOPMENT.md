# Development and manual installation

KazzWare uses Lumiverse's public Spindle APIs. Requires Lumiverse 1.2.5+, Bun 1.4.4+, and a configured model connection. The repository tracks both prebuilt ESM bundles in `dist/`; the custom build embeds mascot artwork and its local display font. There are no runtime npm dependencies.

## Build and check

```sh
npm ci --ignore-scripts
bun run typecheck
bun test
bun run build
bun run preview
bun scripts/check-host.ts /path/to/Lumiverse
```

The last command checks the backend using the exact scanner extracted from a supplied Lumiverse checkout. The lockfile pins the development toolchain. Commit updated `dist/` with runtime source changes; the GitHub workflow checks types, tests and reproducible bundles with Bun 1.4.4. README artwork is separate from the runtime bundles.

The preview command writes a self-contained `KazzWare-preview.html` beside the repository. It uses the shipped frontend with sample story data and deterministic model/host fakes, without provider or Lumiverse requests. State lasts until the page reloads. The preview supports layout and interaction checks, not live-provider verification.

## Manual server installation

Extract a supplied runtime ZIP's `kazzware` directory into the Lumiverse server's configured data directory under `extensions/`, so the manifest is at `data/extensions/kazzware/spindle.json` (or the equivalent custom data path). Use **Import local** in the extension manager, review the requested permissions and enable KazzWare. The package includes prebuilt files and needs no dependency-install step. Install on the machine running Lumiverse, even if you use a phone browser to access it.

A GitHub installation needs the tracked `dist/` files. Keep them rather than relying on Lumiverse's generic auto-build. The server needs Git credentials when a repository is private.

## Reference

- [Architecture](ARCHITECTURE.md): runtime boundaries, storage, prompts and feature behavior.
- [Verification](VERIFICATION.md): tested environment, checks and live smoke tests.
- [Lumiverse research](LUMIVERSE-RESEARCH.md): source references and SDK assumptions.
- [Artwork](../assets/README.md): original supplied mascot assets and font license.
- [README graphics](../assets/readme/README.md): generated title prompts and provenance.

Kazz's voice is the `PERSONA` system prompt in `src/service.ts`. It is shared by model requests, with task instructions preserving source voice in edits and factual continuity output. The backend is `src/backend.ts`; frontend setup and teardown are in `src/frontend.ts`.
