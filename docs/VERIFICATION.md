# Alpha 0.5.0 verification · 2026-10-27

## Confirmed locally

- Windows x64; Bun 1.4.4, Node 22.15.1, TypeScript 5.9.3, Spindle SDK 0.6.49. No new dependencies or permissions.
- `npm run check`: type check, **53 tests / 261 assertions across seven files**, and both tracked ESM bundles passed. Backend: 35,367 bytes; frontend: 10,608,825 bytes, including original owner artwork and local font.
- Exact backend scanner from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepts the bundle without capability exemptions; its prohibited-call negative control also passed.
- `git diff --check` passed. Preview and runtime/source packages rebuilt from the release code.

New interaction regressions hold a native selection open through multiple changes and verify no popup or message lookup until release; keyboard changes restart the settling delay and pointer cancellation leaves it closed. Menu tests move the mascot, open/navigate/close/reopen, verify anchoring and unchanged mascot coordinates, and simulate a host whose size/show operations reset coordinates and whose position reads are stale. Existing mouse/touch drag, host UI scale, click suppression, highlight scope/Undo, stale source and chat-switch tests remain covered.

Commentary tests cover default-off migration for older state, opt-in UI saving, native message/completed-generation/swipe events, duplicate events and dismiss behavior, no menu opening or chat writes, selected connection, line limits, deduplication across clients, stale swipes and newer messages, failed-event consumption, disabling during a provider call, and chat-switch cancellation. Existing assistant, notebook, Gallery, auth/session, durable Undo and payload-size tests still pass. Tests use the real frontend/service and deterministic host/model fakes, not a live provider.

## Preview and browser limits

`scripts/preview.ts` builds a self-contained sample-data preview of the actual frontend bundle. Enable commentary in Settings and save, close the menu, then use **Sample swipe** to see a deterministic speech bubble. Native highlighting, immediate sample edits/Undo, menu/mascot movement and inline Gallery remain interactive. No provider calls or production chat writes occur.

Browser access reports **Local browser use is disabled in Work settings** in this session. In accordance with the owner's earlier fallback instruction, this release was checked through code and the local preview build; it has **not** received a new rendered browser or physical phone pass. Prior 0.4.0 preview checks at 1280×900, 390×844 and 320×700 are historical evidence only. The owner has tested 0.4.0 in Lumiverse and reported the selection timing and position bugs addressed here.

## Live smoke test after update

1. Merge/update to 0.5.0 and refresh. Drag Kazz to several positions; open the menu, change tabs, close and reopen. It should appear beside the clicked mascot and leave his position intact. Check both viewport edges and host UI scaling.
2. Hold the mouse down while extending a native highlight: no popup. Release and wait briefly: the prompt appears. Repeat with keyboard selection and physical phone long-press/selection handles, then apply an edit and Undo.
3. Choose Kazz's connection. Enable **Let Kazz comment from his widget** in Settings and save. Close the menu; send a user message, receive a reply and generate/navigate to a new swipe. Expect one brief aside near Kazz; dismiss it or wait 14 seconds. Drag while it is visible and check its tail/viewport placement.
4. Disable commentary while a request is pending, or switch chats. A late response must not appear. Quiet Kazz requests and message edits must not recursively trigger commentary. Repeated delivery or revisiting the same consumed swipe must not make another provider call.
5. Verify Gallery intervals/attachments and immediate edits/Undo still work; check reload, extension disable/re-enable, physical touch, keyboard viewport and native virtualization.

## Constraints

- Commentary requires an active frontend and the per-chat toggle. It tracks the latest message; newer arrivals supersede delayed reactions. A completed response while the menu is open stays hidden with the mascot and still expires after 14 seconds. Dialogue may wrap on small screens; content is bounded to 18 words and 160 Unicode characters. Provider style/latency still needs real-world testing.
- The latest 1000 message/swipe/content fingerprints are consumed before model generation, including failed calls, to prevent duplicate billing. Disabling cancels this frontend's pending commentary requests. Stored pages, turns and roleplay remain unchanged by commentary.
- Native selections support unique literal prose plus browser whitespace normalization. Stripped Markdown/HTML, repeated text and text inside separate message iframes may require a smaller/different selection. Headers, inputs, controls and cross-message selections are excluded.
- Host writes lack atomic compare-and-swap; a narrow concurrent-write window remains after the final read. Exact preservation outside a selected range is deterministic, while narrative instructions depend on the model.
- Gallery keeps 30 pages; Undo keeps 20 edits; Notebook keeps 10 summaries; assistant storage keeps 100 turns (latest 50 shown). Full summaries cap source at 1,000,000 characters and single-message edits at 100,000. Jobs time out after ten minutes. Interrupted lorebook creation can leave a partial book.
