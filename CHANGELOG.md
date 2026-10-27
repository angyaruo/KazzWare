# Changelog


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
