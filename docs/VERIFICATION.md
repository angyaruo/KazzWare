# Alpha 0.7.1 verification · 2026-10-27

## Confirmed locally

- Windows x64; Bun 1.4.4, Node 22.15.1, TypeScript 5.9.3, Spindle SDK 0.6.49. No new dependencies or permissions in this release.
- `npm run check`: type checking, **73 tests / 389 assertions across eight files**, and both tracked ESM bundles passed. Backend: 57,399 bytes; frontend: 15,370,481 bytes, including original owner artwork and local font.
- The backend is unchanged from 0.7.0. The exact backend scanner from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepts the bundle without capability exemptions; its prohibited-call negative control passed.
- `git diff --check` passed. Preview rebuilt from the shipped frontend. Runtime/source ZIPs are packaged from tracked release files after commit.

This is a presentation update; no new tests mirror the generated decoration. The existing suite covers all nine Home destinations, Commentary/Chat names/Swipes controls, native picking, mobile docking/desktop restoration, commentary settings/counters and expiry.

Frontend tests exercise the real frontend/service with deterministic host/model fakes. All earlier swipe merge/Undo, title conflict protection, Summary+/future-beat injection, highlight timing, exact-range Undo, drag/position, chat switching, Gallery, assistant, notebook and isolation tests still pass.

## Rendered preview checks

The shipped frontend was exercised in the in-app browser at 1280×720 desktop and responsive 390×844 and 320×700 viewports. Home showed all nine destinations, the header, connection shortcut and footer without internal scrolling at both portrait phone widths. Checked damaged frame rendering, texture behind live labels, red hover/focus treatment, small-screen Editor and Commentary readability, sample editing/Undo and direct feature navigation. Tools retain scrolling; short viewports use a Home scrolling fallback. Original transparent Kazz art and the existing mobile peeker remain unchanged.

The preview is sample-only and deterministic: no AI requests, Lumiverse API calls or production chat writes. Its manual handlers demonstrate layout and interaction; backend tests validate real automation counters and interception. This is not physical-touch-device or end-to-end live-provider evidence. Native integration, provider quality/latency and prompt effects still need a live smoke pass after installation.

## Live smoke test after update

1. Merge/update to 0.7.1, restart KazzWare and refresh Lumiverse. Confirm the version and existing saved data. No additional permissions should appear when upgrading from 0.7.0. Select Kazz's connection if needed.
2. Check all nine Home buttons, red hover/press feedback, keyboard focus, text contrast over different chat backgrounds and reduced-motion settings. On a physical phone, drag the peeker to either edge, open/close tools, rotate the screen and open the keyboard. Toggle back to the round launcher in Settings and verify menu anchoring.
3. Open Commentary from Home. Try interval 2, each bubble size, a short timed bubble and Until closed. Verify skipped/duplicate events do not replace the current bubble, unseen swipes advance the interval once, and disabling/chat switching clears the bubble. Try Chat names from Home: first-message naming, 10-message updates, manual naming and Undo; swipes/edits must not advance its count.
4. Open Swipes from Home, pick a native message and choose two or more replies. Try blank and explicit directions. Verify a new active swipe, preserved originals and Undo; confirm a newer manual edit blocks an old merge Undo.
5. In Summary+, summarize a native message and fill ten gaps. Edit summary/date/time/place/people. Enable automatic capture, generate/navigate swipes and edit native text. Verify source changes, alternate-note restoration and manual annotations. Unknown dates stay unknown.
6. Enable timeline injection and inspect the prompt breakdown for **KazzWare · Summary+ / future beats** (requires Interceptor permission). Current notes should appear; stale/deleted sources should not. Regenerate an older message: its rejected summary and later facts must be absent. Disable injection and verify the block disappears when no future beat is eligible.
7. Add a future beat after two new messages. Enable assessment/injection. It must remain ineligible before the threshold, may be deferred afterward, and appears only as optional future intent when ready. Edit earlier history, pause or mark fulfilled: old readiness must not be injected. Changing the delay restarts counting.
8. Recheck native highlight release timing, selection editing/Undo, inline Gallery, touch selection handles, virtualization, reload and extension disable/re-enable.

## Constraints

- Automation requires an active frontend and per-chat opt-in. Each new summary is a provider call; eligible future events can cause an assessment after a reply. Stop/chat switching cancels unfinished work. Model extraction and timing need real-world evaluation.
- Summary+ stores 500 current and 500 alternate-source notes. Only the latest 80 matching notes, bounded to 18,000 serialized characters, enter the prompt. Future intent adds at most one 2,000-character event. Context size increases accordingly; this does not replace full history. Dates are in-story fields, not system timestamps.
- Spoiler delays are earliest opportunities, not deadlines. Fulfillment is marked manually. The roleplay model still decides if a ready beat fits the next user turn. Context outside Kazz's configured working window may be missed during assessment.
- Host writes lack atomic compare-and-swap; a narrow concurrent-write window remains after final reads. Undo protects ordinary later edits but is not a transaction against all concurrent external writers.
- Existing limits remain: 30 Gallery pages, 20 message-edit Undo records, ten Notebook summaries and 100 Kazz turns (latest 50 shown). Merge/title journals retain ten each. Jobs time out after ten minutes. Native selection supports uniquely mapped prose, not arbitrary rendered markup or separate message iframes.
