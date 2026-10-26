# Alpha 0.3.0 verification · 2026-10-26

## Confirmed locally

- Windows x64, Bun **1.4.4** (`38afee6c8`), Node 22.15.1, TypeScript 5.9.3.
- `tsc --noEmit`: passed against `lumiverse-spindle-types` 0.6.49.
- `bun test`: **35 passed, 0 failed**, 144 assertions, six test files.
- HTTP startup regression: with browser crypto and `randomUUID` explicitly unavailable, the original 0.1.0 frontend failed before creating a widget with `TypeError: crypto.randomUUID is not a function`. The fixed frontend passes startup, mascot and input-bar opening, message-action selection, unique request IDs, chat-binding changes, no-chat hiding, and teardown. jsdom does not enforce secure-context restrictions itself, so the test removes the API explicitly.
- `bun scripts/build.ts`: generated backend/frontend ESM bundles; PNGs are embedded and no runtime imports remain.
- `bun scripts/check-host.ts <checkout>`: the exact scanner extracted from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepted the backend, with no declared capability exemptions. The harness also checks a known-prohibited Bun filesystem call to ensure the scanner is active.
- `npm audit --omit=dev --audit-level=high`: zero production dependency vulnerabilities; this extension has no production dependencies.

The tests exercise the real service and frontend code with fake Spindle APIs and deterministic model responses. They cover immediate selection edits; exact surrounding text; UTF-16 and Windows newline offsets; stale edits and swipe changes; manual writes while a model is running; conflict-aware Undo; journal failures before/after a host mutation; chat switching; cancellation; replayed request IDs; user/session isolation; explicit connection routing; credentials excluded from model/UI connection data; gallery opt-in and event deduplication across clients; persistent comments; model markup escaping and trusted iframe interactions; chunked summaries and lorebook metadata preservation; assistant search; settings; mobile surface selection; teardown; and bounded routine UI payloads.

## Browser preview checks

The owner confirmed the 0.2.0 interface appears in Lumiverse. For 0.3.0, the rebuilt frontend was loaded in Chromium using `scripts/preview.ts`, with sample data, real sandboxed gallery frames, and a scrollable native-chat fixture. The fixture reproduces the host's widget/content wrapper hierarchy and public message DOM methods. Desktop (1280×900), phone (390×844), and narrow phone (320×700) layouts were inspected; the compact layout has no horizontal document overflow.

Confirmed the transparent shell/body and non-intercepting outer wrappers, native input access through the surface, launcher close/reopen, home quick-message submission, and chat composition. Scrolling the sample native chat changed the followed target from message 1 to message 3. Typing a direction pinned message 3 while scrolling to the end; a deterministic sample edit changed only message 3 and Undo restored it. Pick from chat hid the menu, consumed a click on native action 2 without activating it, and opened message 2 in Editor. Checks use real browser clicks without force.

New automated tests cover scrolling and pinning through generation; native picking and Escape; marker/listener teardown; late responses after pinning and chat switches; immediate clearing of a replaced target; no-visible-message state; cancellation while an earlier follow reply remains pending; scrolling back past a slower response; ancestor clipping; detached and zero-size message nodes; and a message taller than its scrollport. Existing backend edit/Undo, isolation, sandbox and HTTP regressions remain in the suite.

## Not yet verified in a running Lumiverse instance

Version 0.3.0 has not yet been installed in the user's running instance. No real provider calls, physical iPhone/Android gestures, or live host drag/update cycle were performed for this version. The preview reproduces relevant host contracts; it is not a full Lumiverse instance. The wrapper-specific click-through CSS and native message targeting should receive a live integration check after updating. Real touch and on-screen-keyboard behavior remain unverified.

The GitHub workflow reruns type checks, tests, builds and a tracked-bundle diff on pushes/PRs. Its result is separate from the local evidence above; do not infer a green CI run from this file.

## Live smoke test

1. Install/update the prebuilt extension, grant its declared permissions and enable it. Refresh the browser and confirm version 0.3.0 in the extension manager. Open a test chat over a plain HTTP network address as well as HTTPS/localhost; verify Kazz appears only while a chat is active and opens from the mascot, input-bar action, and message action.
2. Scroll the native chat with Kazz open: the outlined target should follow the message near the middle of its visible scroll area. Type a direction and scroll again: the target must stay pinned. Test Pick from chat, its cancel button and Escape, and verify the chosen native action does not also fire. Then choose a saved connection in KazzWare Settings. Reform a message, Undo it, then repeat with a Markdown/Unicode selection. Verify the source outside the selection is byte-for-byte unchanged.
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
