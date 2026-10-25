# Changelog

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
