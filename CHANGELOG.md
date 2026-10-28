# Changelog

## 0.7.1 — Damaged terminal interface

- Recreate the supplied interface reference with scalable screen housings: chipped red edges, cable loops, scanlines, surface grain, barcodes, warning symbols and small hardware LEDs. Keep Editor, Chat and Commentary on distressed off-white panels, with the other tools on dark screens.
- Preserve the nine working Home destinations around the original Kazz artwork. Increase label/icon size, add a local live date/time on Home, and keep the active chat name in tool headers. Keep the connection shortcut visible after setup.
- Carry red accents into readable tool surfaces without placing grunge over form text. Keep keyboard focus, drag handles, mobile peeking, transparent gaps, short-viewport scrolling and reduced-motion support.
- Use local SVG/CSS only, with no added image downloads, dependencies, permissions or storage changes. Rebuild the tracked frontend and sample preview; retain all existing behavior tests.

## 0.7.0 — Compact glass UI and mobile peeker

- Replace the large, text-heavy home tiles with nine compact icon-and-label buttons around Kazz. Use charcoal/silver smoked glass, red hover/focus/press glow and readable work surfaces. Keep transparent gaps and a scroll-free home at checked portrait phone sizes.
- Put Commentary, Chat names and Swipes directly on Home. Give automation controls styled switches, sliders and segmented choices; keep connection/setup preferences in Settings.
- Add commentary frequency (every 1–50 unique new messages/swipes), bubble sizes and duration (3–120 seconds or Until closed). Defaults preserve existing behavior. Skipped events retain the current bubble; duplicate events never advance the counter or trigger another provider call.
- Use the supplied peeking pose as a smaller mobile launcher that docks to either edge when released. Preserve desktop placement separately, keep menu anchoring, and offer the round phone launcher in Settings. Add the supplied cover art as the input-bar icon.
- Migrate existing settings within storage version 1; add no permissions or dependencies. Extend deterministic coverage, rebuild tracked bundles and update the interactive preview.

## 0.6.0 — Swipes, titles, Summary+ and future beats

- Add the Editor swipe merger: inspect alternate replies, choose two or more, and provide optional direction. Append a new active swipe without removing originals. Keep ten durable, conflict-aware merge Undo records.
- Add per-chat automatic naming, off by default, with a 10–50 new-message interval, manual naming and ten title Undo records. Duplicate events, swipes and edits do not advance the title counter.
- Add Summary+: editable message-level summaries with in-story dates, times, locations and people; a scrollable timeline; native-source navigation; manual ten-message backfill; separate default-off automatic capture and prompt-injection controls. Preserve manual notes for unchanged sources and cache alternate notes for revisited swipes.
- Add Spoilers ahead to the future end of the timeline. Store optional message thresholds, assess whether one beat fits the scene, and inject ready intentions separately from established facts. Events can be paused, edited, deleted or marked fulfilled. Earlier history edits and newer assistant replies invalidate old readiness.
- Add the public `interceptor` permission for optional prompt context. The read-only hook scopes access to the authenticated chat/user, excludes stale notes and rejected/future history during regeneration, skips quiet calls, and makes no provider calls. No new runtime dependencies.
- Extend deterministic backend/frontend regression coverage and the interactive preview. Preserve existing immediate editing/Undo, selection timing, floating placement and commentary.

## 0.5.0 — Selection timing, widget placement and commentary

- Native highlight controls now wait until pointer release and 160 ms of selection stability. Keyboard/mobile handle changes restart the delay; cancelled gestures and chat changes retire pending prompts.
- Fresh menu openings anchor beside the current mascot position and clamp to the viewport. Retain extension-driven coordinates across host resize/show updates, and skip redundant mascot resizing during menu renders.
- Add per-chat opt-in commentary in Settings (off for new and existing chats). Completed messages and unseen swipes produce one brief, plain-text Kazz aside beside his closed widget. The bubble follows dragging, dismisses with × and expires after 14 seconds; no menu is opened or roleplay text written.
- Bound commentary to 18 words / 160 Unicode characters. Check the current message/swipe before and after generation, deduplicate provider calls across host events/tabs, and cancel pending commentary when disabled or changing chat. Quiet calls and Kazz's edits do not recursively trigger commentary.
- Extend the local preview with a Sample swipe button. No new permissions or dependencies; existing chat state migrates within storage version 1.



## 0.4.0 · 2026-10-27

- Scale the open companion composition to 80%. Keep it floating on phones instead of forcing fullscreen.
- Own mouse/touch dragging with pointer capture, a movement threshold and click suppression. Disable native mascot-image dragging; support the title and large artwork as menu drag handles, plus arrow-key movement.
- Remove the source-text textarea and recent-message dropdown. Highlight native chat prose to open a compact direction prompt with immediate selection-only editing, Undo, More options and Close.
- Preserve exact source/swipe snapshots across focus changes. Literal unique highlights and browser whitespace normalization are supported; ambiguous or formatting-altered highlights fail closed. Chat changes, dismissal and late replies cannot restore a stale prompt.
- Add collapsible Peanut Gallery entries beneath their triggering native messages through Spindle's replayable injection API. Likes/comments stay in the existing sandbox and storage; pausing hides entries without deleting saved pages.
- Pin the automatic Gallery context and attachment to the triggering reply before generation, including when newer replies arrive mid-call. Manual Fresh drama anchors to the latest message at generation start.
- Keep existing permissions and storage format. Rebuild both tracked bundles; update the sample preview and regression coverage.

## 0.3.0 — 2026-10-26

Replace the outer window with a transparent companion composition based on the owner’s sketches: Kazz in the center, a speech bubble, separate crooked action tiles, and a quick input strip. Chat puts the leaning pose above the input and floating dialogue strips. Add the four new unmodified PNGs; use the curled pose for the launcher and hide the duplicate launcher while the menu is open. Scope click-through styling to this panel’s host wrappers.

Follow view chooses the mounted native message closest to the reading line after scrolling settles, respecting clipped scroll containers. Manual picks, source selection and edit directions pin the target. Pick from chat temporarily tucks the menu away and consumes the chosen native click. Keep the recent-message list and Send to Kazz action. Clear stale targets, suppress late selection replies, lock changes while a job runs, and remove markers/listeners on teardown.

Expand the isolated preview with a scrollable sample native chat and add regression coverage for scrolling, pinning, native picks, cancellation, delayed replies, chat switches and clipped/virtualized messages. No permissions, backend behavior, stored-data format or runtime dependencies change.

## 0.2.0 — 2026-10-24

Rebuild the UI around Kazz's friendly-malware persona: a chrome utility frame, red warning labels, oversized condensed type, crooked shortcut windows, ice-blue and off-white stickers, a larger mascot illustration, and a labeled floating Kazz. Restyle every tool and all three fandom layouts. Keep all seven navigation buttons visible, reset scrolling when changing tabs, and retain mobile fullscreen behavior, keyboard focus indicators, and reduced-motion support.

Bundle Barlow Condensed with its SIL Open Font License; no external font requests. Include a self-contained interactive preview using the shipped frontend with sample data and no AI/Lumiverse connection.

Fix Peanut Gallery comment posting in Lumiverse's scripts-only sandbox: the Post comment button now calls the trusted message bridge directly instead of relying on blocked native form submission. Existing immediate edits, Undo, HTTP startup support, permissions, and stored data remain compatible.

## 0.1.1 — 2026-10-24

Fix frontend startup when Lumiverse is opened through a plain HTTP network address. Version 0.1.0 called the secure-context-only `crypto.randomUUID()` before registering the mascot, menu, or message action. Frontend correlation IDs now use `crypto.getRandomValues()`, which is available over HTTP. No permissions or stored data change.

The frontend regression harness now uses browser crypto instead of Bun's crypto. A new test explicitly removes `randomUUID`, reproduces the original crash, and verifies startup, mascot/menu interaction, message selection, request IDs, chat switching, and teardown after the fix. Rebuilt the shipped frontend and updated installation instructions to use `main`.

## 0.1.0 — 2026-10-24

First alpha: chat-bound floating Kazz mascot and responsive menu; immediate message reform and exact selection editing; persistent conflict-aware Undo; configurable literal de-slop checks and coherent model rewriting; a separate assistant conversation with bounded tools; full-chat summaries and new attached lorebooks; opt-in fictional fandom pages with persistent likes/comments; explicit connection selection; cancellation and stale-result isolation; prebuilt bundles and automated regression checks.

This release has local contract-test and scanner coverage. Live Lumiverse/provider/device validation remains pending.
