# Alpha 0.6.0 verification · 2026-10-27

## Confirmed locally

- Windows x64; Bun 1.4.4, Node 22.15.1, TypeScript 5.9.3, Spindle SDK 0.6.49. No new runtime dependencies; new `interceptor` permission for optional roleplay prompt context.
- `npm run check`: type checking, **69 tests / 347 assertions across eight files**, and both tracked ESM bundles passed. Backend: 56,559 bytes; frontend: 10,627,082 bytes, including original owner artwork and local font.
- The exact backend scanner from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepts the bundle without capability exemptions; its prohibited-call negative control passed.
- `git diff --check` passed. Preview rebuilt from the shipped frontend. Runtime/source ZIPs are packaged from tracked release files after commit.

New regressions cover distinct swipe selection, preserved originals/dates, stale-source rejection, full-swipe Undo conflicts and prepared-journal recovery; title counters, interval bounds, duplicate events, concurrent manual names and Undo; short editable notes, unknown dates, source invalidation, alternate-note restoration, manual annotations and cache deletion; spoiler eligibility, deferral, fulfillment, scene freshness and earlier edits; and prompt ownership, quiet calls, aborts, insertion order and regeneration cutoff.

Frontend tests exercise the real frontend/service with deterministic host/model fakes. They cover selection gating and merge Undo, timeline forms and injection opt-in, escaped future-event text, naming controls and Undo, and automatic summaries for completed replies, swipes and native edits. All earlier highlight, exact-range Undo, drag/position, chat switching, commentary, Gallery, assistant, notebook and isolation tests still pass.

## Rendered preview checks

Browser access worked for this release. The shipped frontend was exercised in the in-app browser at the default 1280×720 desktop viewport and responsive 390×844 and 320×700 viewports. Checked timeline navigation, expanded note fields, edited summary/time persistence, default-off injection, future-event assessment/status, two-swipe gating, merge/Undo changing and restoring native sample prose, and manual naming. Timeline/future-event containers showed no horizontal content overflow at narrow widths. The existing floating layout stays scrollable and keeps native chat visible around it.

The preview is sample-only and deterministic: no AI requests, Lumiverse API calls or production chat writes. Its manual handlers demonstrate layout and interaction; backend tests validate real automation counters and interception. This is not physical-touch-device or end-to-end live-provider evidence. Native integration, provider quality/latency and prompt effects still need a live smoke pass after installation.

## Live smoke test after update

1. Merge/update to 0.6.0, grant **Interceptor** for prompt injection, restart KazzWare and refresh Lumiverse. Existing work should remain. Select Kazz's connection.
2. Pick a message with multiple swipes, load the Editor merger and choose two or more. Try blank and explicit directions. Verify a new active swipe, preserved originals and Undo; confirm a newer manual edit blocks an old merge Undo.
3. Enable naming at 10 messages. Verify the first new message names the chat and the next ten distinct user/assistant messages trigger another title. Swipes/edits must not count. Try manual naming and Undo, including after a manual title change.
4. In Summary+, summarize a native message and fill ten gaps. Edit summary/date/time/place/people. Enable automatic capture, generate/navigate swipes and edit native text. Verify source changes, alternate-note restoration and manual annotations. Unknown dates stay unknown.
5. Enable timeline injection and inspect the prompt breakdown for **KazzWare · Summary+ / future beats**. Current notes should appear; stale/deleted sources should not. Regenerate an older message: its rejected summary and later facts must be absent. Disable injection and verify the block disappears when no future beat is eligible.
6. Add a future beat after two new messages. Enable assessment/injection. It must remain ineligible before the threshold, may be deferred afterward, and appears only as optional future intent when ready. Edit earlier history, pause or mark fulfilled: old readiness must not be injected. Changing the delay restarts counting.
7. Recheck native highlight release timing, selection editing/Undo, mascot/menu movement and anchoring, commentary and inline Gallery. Exercise physical phone touch/selection handles, keyboard viewport, virtualization, chat switching, reload and extension disable/re-enable.

## Constraints

- Automation requires an active frontend and per-chat opt-in. Each new summary is a provider call; eligible future events can cause an assessment after a reply. Stop/chat switching cancels unfinished work. Model extraction and timing need real-world evaluation.
- Summary+ stores 500 current and 500 alternate-source notes. Only the latest 80 matching notes, bounded to 18,000 serialized characters, enter the prompt. Future intent adds at most one 2,000-character event. Context size increases accordingly; this does not replace full history. Dates are in-story fields, not system timestamps.
- Spoiler delays are earliest opportunities, not deadlines. Fulfillment is marked manually. The roleplay model still decides if a ready beat fits the next user turn. Context outside Kazz's configured working window may be missed during assessment.
- Host writes lack atomic compare-and-swap; a narrow concurrent-write window remains after final reads. Undo protects ordinary later edits but is not a transaction against all concurrent external writers.
- Existing limits remain: 30 Gallery pages, 20 message-edit Undo records, ten Notebook summaries and 100 Kazz turns (latest 50 shown). Merge/title journals retain ten each. Jobs time out after ten minutes. Native selection supports uniquely mapped prose, not arbitrary rendered markup or separate message iframes.
