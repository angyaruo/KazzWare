# Alpha 0.4.0 verification · 2026-10-27

## Confirmed locally

- Windows x64; Bun 1.4.4, Node 22.15.1, TypeScript 5.9.3, Spindle SDK 0.6.49. No new dependencies or permissions.
- Type check and build passed. Both tracked ESM bundles rebuilt; original owner PNGs and the local font remain embedded.
- **45 tests, 0 failures**, 200 assertions across seven files. Tests exercise the real frontend/service with deterministic host and model fakes.
- Exact backend scanner extracted from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepts the bundle without capability exemptions; its prohibited-call negative control also passed.
- `git diff --check` passed.

New coverage includes native highlighting with the menu closed; immediate selection-only edits and prompt Undo; More options transferring the native range; CRLF and Unicode preservation; repeated and formatting-altered highlights failing closed; duplicate visible text with different source whitespace; late highlight responses after dismissal/chat changes; stale source rejection without a model call; retiring a changed/consumed highlight rather than widening it; cross-message selection invalidation; smaller floating mobile placement; mouse/touch pointer movement and capture; host UI scale; drag-click suppression and cancellation; inline injection identity, bounded reaction messages, frame replacement and teardown; and the Gallery context/attachment cutoff when newer replies arrive during generation. Existing HTTP startup, follow-view races, native picking, edit/Undo conflicts, durable journal, cancellation, authorization, assistant, notebook, sandbox and payload-size regressions remain covered.

## Browser preview checks

The rebuilt frontend is loaded through `scripts/preview.ts` in Chromium with a native-chat fixture and real sandboxed iframe documents. All story/model results are local sample data; no provider or production chat requests are made. The fixture reproduces the host wrapper hierarchy, public message APIs and injection identity preservation.

At 1280×900 and 390×844, verified that the open menu has the matching 0.8 transform and physical widget size (416×688 desktop; approximately 299×656 phone), remains floating, and can be dragged by its title. Dragged the mascot independently at both sizes and verified it did not open the menu after the drag. These are real browser pointer gestures at desktop/phone viewport widths, not physical touchscreen tests. The controller's touch-pointer path is also covered in automated tests.

Highlighted native prose with the menu closed; filled the anchored prompt; applied a deterministic replacement; verified exact surrounding text and Undo. On the phone layout, the prompt remains within the viewport, and More options transfers the highlight and direction into Editor with no source-text textarea. Opened Gallery directly beneath a message while the Kazz menu stayed closed, liked a post and submitted a sample comment, and verified both survived the iframe refresh. A subsequent 320×700 check covers the narrow layout. The inspected browser log contained no warnings or errors. After a usage interruption, browser access became disabled; the final stale-highlight and cross-message safeguards were verified by the automated suite and a rebuilt preview, without another browser run.

## Live integration still to verify

The owner confirmed 0.3.0's floating layout in Lumiverse. Version 0.4.0 has not been installed in the running instance during this task. Physical phone touch selection/handles, keyboard viewport changes, real provider responses, host message virtualization and a production update cycle remain live smoke tests. Local tests simulate the documented injection replay contract; they do not substitute for a running host.

1. Merge/update to 0.4.0 and refresh. Confirm the version in Extensions. Drag the mascot and open menu on desktop and a phone; release without opening an unintended menu. Scroll the menu body normally.
2. Highlight prose in a native message with Kazz closed. Type a direction, apply and Undo. Verify source outside the highlight is unchanged. Try More options; a whole-message edit requires explicitly clearing the highlight. Ambiguous/formatting-altered selections should ask for a smaller passage, never silently widen scope.
3. Change the source/swipe before submitting a captured highlight; verify it refuses the stale edit. Change chats during generation and verify no result leaks into the other chat. Check native pick and Follow view still pin correctly.
4. Enable Gallery at interval 2. Two normal assistant replies should create an entry beneath the second. Expand, like, comment, scroll away/back, reload, and verify persistence. Newer replies during generation must not move the entry. Pause Gallery: inline entries disappear, saved pages remain in its archive.
5. Check physical phone dragging, keyboard visibility, long-press selection and selection handles, popup positioning, inner iframe scrolling, and close/reopen. Disable/re-enable KazzWare and verify old prompts, injections and listeners are gone.

## Known constraints

- Native selections support unique literal prose plus browser whitespace normalization. A selection crossing stripped Markdown/HTML or repeated text may need a smaller highlight. Headers, inputs, message controls and cross-message selections are excluded. Text inside a separate message iframe is outside the parent document's selection API.
- Host writes lack atomic compare-and-swap; a narrow concurrent-write window remains after the final read. Models can violate narrative instructions; exact preservation outside a selected range is deterministic.
- Gallery keeps 30 pages; Undo keeps 20 message edits. Evicted Gallery pages lose their inline entries. Pausing hides inline entries without deleting saved pages. A failed automatic Gallery consumes its interval to avoid duplicate billing; Fresh drama retries manually.
- Automation requires an active frontend. Pages use three trusted layouts with local likes/comments; no external social posts, arbitrary model scripts or automatic fandom comment replies.
- Notebook retains 10 summaries, assistant storage 100 turns (latest 50 shown). Full summaries cap source at 1,000,000 characters; single-message edits at 100,000. Jobs time out after ten minutes. Lorebook creation may leave a partial book if interrupted.
