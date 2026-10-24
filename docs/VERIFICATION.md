# Alpha 0.1.1 verification · 2026-10-24

## Confirmed locally

- Windows x64, Bun **1.4.4** (`38afee6c8`), Node 22.15.1, TypeScript 5.9.3.
- `tsc --noEmit`: passed against `lumiverse-spindle-types` 0.6.49.
- `bun test`: **28 passed, 0 failed**, 103 assertions, five test files.
- HTTP startup regression: with browser crypto and `randomUUID` explicitly unavailable, the original 0.1.0 frontend failed before creating a widget with `TypeError: crypto.randomUUID is not a function`. The fixed frontend passes startup, mascot and input-bar opening, message-action selection, unique request IDs, chat-binding changes, no-chat hiding, and teardown. jsdom does not enforce secure-context restrictions itself, so the test removes the API explicitly.
- `bun scripts/build.ts`: generated backend/frontend ESM bundles; PNGs are embedded and no runtime imports remain.
- `bun scripts/check-host.ts <checkout>`: the exact scanner extracted from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepted the backend, with no declared capability exemptions. The harness also checks a known-prohibited Bun filesystem call to ensure the scanner is active.
- `npm audit --omit=dev --audit-level=high`: zero production dependency vulnerabilities; this extension has no production dependencies.

The tests exercise the real service and frontend code with fake Spindle APIs and deterministic model responses. They cover immediate selection edits; exact surrounding text; UTF-16 and Windows newline offsets; stale edits and swipe changes; manual writes while a model is running; conflict-aware Undo; journal failures before/after a host mutation; chat switching; cancellation; replayed request IDs; user/session isolation; explicit connection routing; credentials excluded from model/UI connection data; gallery opt-in and event deduplication across clients; persistent comments; model markup escaping and trusted iframe interactions; chunked summaries and lorebook metadata preservation; assistant search; settings; mobile surface selection; teardown; and bounded routine UI payloads.

## Not yet verified in a running Lumiverse instance

The user installed 0.1.0 successfully but reported no frontend UI when opening Lumiverse over a plain HTTP network address; the startup regression above reproduces that failure. Version 0.1.1 has not yet been verified in their running instance. No real provider calls, successful visual browser rendering, physical iPhone/Android gestures, or real host reload/update cycle were performed by the automated checks. The API contract, emitted bundles and host scanner have been checked, but those checks do not replace a live smoke test. Treat 0.1.1 as an alpha for validation on a disposable/test chat first.

The GitHub workflow is configured to rerun type checks, tests, builds and a tracked-bundle diff on pushes/PRs. Its result is separate from the local evidence above; do not infer a green CI run from this file.

## Live smoke test

1. Install/update the prebuilt extension, grant its declared permissions and enable it. Refresh the browser and confirm version 0.1.1 in the extension manager. Open a test chat over a plain HTTP network address as well as HTTPS/localhost; verify Kazz appears only while a chat is active and opens from the mascot, input-bar action, and message action.
2. Choose a saved connection in KazzWare Settings. Reform a message, Undo it, then repeat with a Markdown/Unicode selection. Verify the source outside the selection is byte-for-byte unchanged.
3. Start an edit and switch chats before it completes. The old result must not alter either chat. Start another edit, manually change the source before completion, and verify it refuses the stale write.
4. Make a Kazz edit, then a manual edit. Verify Undo refuses to overwrite the manual revision. Reload the page and verify the journal and notebook persist.
5. Configure a slop list and scan a message. Test a successful rewrite and a model response that retains a banned phrase; only the successful result should apply.
6. Ask Kazz to find a line in old history, then create a summary and a lorebook. Verify the new book's entries and current-chat attachment in Lumiverse.
7. Enable Gallery with interval 2. Two normal replies should produce one page; regenerations/swipes should not count. Like and comment, reload, and verify persistence. Open a second browser tab to check deduplication.
8. On a phone, test menu scrolling, keyboard opening, raw-text selection, the iframe's own scrolling, and closing the fullscreen menu. On desktop, test dragging the mascot and menu header.
9. Disable/re-enable KazzWare and update it from a fresh source checkout. Verify old widgets/subscriptions are gone and the current prebuilt files load.

## Known constraints

- Host message writes lack atomic compare-and-swap. A very narrow concurrent write window remains after the final read.
- Models can violate narrative instructions or summarize imperfectly. Outside-selection preservation is deterministic; semantic plot preservation is not.
- The notebook retains 10 summaries, gallery 30 pages, assistant storage 100 turns, and Undo 20 edits. The UI shows the last 50 assistant turns with excerpts for very long turns. Summaries and gallery documents are loaded in full on demand.
- Full summaries are limited to 1,000,000 source characters; a job stops after 10 minutes. Single-message editing is limited to 100,000 characters. Model responses and resource results are bounded.
- A failed automatic gallery generation consumes its interval to prevent duplicate calls; use Fresh drama to retry. Automation runs while a chat frontend is connected.
- Lorebook creation can leave a partially completed book if interrupted. Its ID is retained for recovery; creation is not in the message Undo journal.
- Gallery pages use three trusted layouts and local interactions. Model-authored executable HTML, automatic fandom replies to comments, cross-chat writes and global assistant control are outside this alpha.
