# KazzWare 0.7.3 verification · 2026-10-29

## Confirmed locally

- Windows x64; Bun 1.4.4, Node 22.15.1, TypeScript 5.9.3, Spindle SDK 0.6.49. No new dependencies, permissions or storage migration.
- `npm run check`: type checking, **77 tests / 424 assertions across eight files**, and both tracked ESM bundles passed. Backend: 58,598 bytes; frontend: 15,369,930 bytes, including original owner artwork and local font.
- The exact backend scanner from Lumiverse main `3d74148383dded2b379f204532cf375b52bcd201` accepts the rebuilt bundle without capability exemptions; its prohibited-call negative control passed.
- `git diff --check` passed. Preview rebuilt from the shipped frontend. Runtime/source ZIPs are packaged from tracked release files after commit.

New regression checks cover clearing only Kazz's conversation, preserving other chats and other saved state, subsequent model context omitting the old conversation, no provider call for reset, persistence failure, and reset queued behind a pending reply. UI coverage checks cancel/confirm, clearing the draft only on success, retiring confirmation on chat switch, and desktop/mobile position reset without adding widget instances or changing chat data.

The reported missing desktop widget was resolved on the affected installation after updating. This patch adds a position-reset convenience; it does not claim to reproduce or fix another startup problem. Host-hidden widgets remain controlled by Lumiverse's Extensions UI.

## Current preview checks

The actual frontend was exercised in the local deterministic preview at desktop and 390×844. New chat confirmation was readable, Keep chatting preserved both sample turns, Clear conversation opened the empty conversation state, and the phone body had no horizontal overflow. Reset widget position closed the menu and restored the 64×84 peeker within the viewport. The native story remained present. No provider calls or production chat changes were made.

Earlier functionality remains covered by the full suite. Historical rendered evidence below describes the unchanged core visual layout, not an additional live installation check for this patch.

## Retained 0.7.1 rendered preview evidence

The shipped frontend was exercised in the in-app browser at 1280×720 desktop and responsive 390×844 and 320×700 viewports. Home showed all nine destinations, the header, connection shortcut and footer without internal scrolling at both portrait phone widths; button text widths did not overflow at 320 pixels. All nine destinations opened at 320 pixels without horizontal overflow. Checked the notched silhouette, off-black glass fill and red idle edge. A hovered settings control showed its visible reflection, the 0.68-second sweep animation and full edge opacity (0.5 at rest); keyboard focus also triggered the sweep and retained a separate 2-pixel ring. At 700×390, Home used its scrolling fallback and the connection shortcut remained reachable. Tools retain scrolling. Original transparent Kazz art and the existing mobile peeker remain unchanged. Reduced-motion rules were inspected in source; physical touch remains a live smoke check.

The final fan arrangement was additionally checked at desktop and 320×700: all nine destinations opened, labels fit their untransformed boxes, and geometry calculated from the rendered transforms found no intersecting button rectangles. Home retained its 400×550 maximum footprint and fit without internal scrolling. Lower buttons use stronger rotations and move inward; tool headers remain level for reading. The glow/shine rules are unchanged from the glass checks above.

The preview is sample-only and deterministic: no AI requests, Lumiverse API calls or production chat writes. Its manual handlers demonstrate layout and interaction; backend tests validate real automation counters and interception. This is not physical-touch-device or end-to-end live-provider evidence. Native integration, provider quality/latency and prompt effects still need a live smoke pass after installation.

## Live smoke test after update

1. Merge/update to 0.7.3, restart KazzWare and refresh Lumiverse. Confirm existing data. Open Chat → New chat with Kazz: first cancel, then confirm. Check that only Kazz's conversation clears, that notes/settings/Undo remain, and that the reset survives reload. Try another roleplay and confirm its Kazz conversation is separate. Use Settings → Reset widget position on desktop and mobile; verify the menu closes and the companion returns on-screen. Use Lumiverse's Extensions UI for host-hidden widgets.
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
