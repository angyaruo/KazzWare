# KazzWare

A chat-bound companion extension for Lumiverse, built around Kazz: a foul-mouthed mascot who helps edit roleplay, investigate chat history, maintain story notes, and run an optional fictional fandom.

## Approved behavior

- Message reform preserves the current narrative moment unless the user requests plot advancement.
- The de-slopifier repairs user-defined banned words and phrases coherently.
- Selection edits change only the selected source range.
- Successful requested edits apply immediately, with conflict-aware Undo. Routine edits do not require a preview-and-approve step.
- A separate Kazz conversation supports chat search, summaries, lorebook work, and related assistance.
- Peanut Gallery is opt-in and produces interactive fictional pages at a configurable message interval.
- The user chooses Kazz's model connection; working state follows the active chat.

## First alpha · 0.1.0

The implementation and prebuilt bundles are included. Automated tests cover the backend and the real frontend handlers using a simulated host. A live Lumiverse install, real model response quality, and physical mobile-device behavior still need validation. See [verification](docs/VERIFICATION.md) for the exact checks and remaining limits.

Kazz floats in the active chat. Tap him or the input-bar KazzWare action to open the menu. On desktop, drag the mascot or the menu header; on narrow screens, the menu uses a fullscreen surface while the mascot remains floating. The three supplied Kazz illustrations switch between idle, attentive and working states.

| Section | What it does |
| --- | --- |
| Editor | Choose a message or use its **Send to Kazz** action. Enter a direction, then **Edit now**. Successful edits apply immediately. |
| Selection editing | Select source text in the editor, or highlight chat text and send that message to Kazz. Ambiguous rendered highlights fall back to selecting the exact source. Only that source range is replaced. |
| De-slop | Save a literal phrase list, choose whole-word boundaries, scan, and rewrite coherently. A result containing banned wording is rejected. |
| Chat | A separate per-chat conversation. Search all messages, read older messages, inspect app reference data, request edits, summaries, or a lorebook. |
| Gallery | Opt in, choose an interval and forum/thread/wiki format. Generate fictional fandom pages, like posts, and leave persistent comments. |
| Notebook | Create rolling full-chat summaries and lorebooks. New lorebooks are attached only to the current chat. |
| Settings | Pick Kazz's saved connection, working-context length, gallery settings and mascot size. Settings are per chat. |

Undo is in Editor and retains the latest 20 Kazz message edits across reloads. It checks the message and active swipe before restoring anything. A manual change made afterward blocks Undo so it cannot overwrite your newer wording. A write-ahead recovery record is saved before every edit. Lorebook creation is managed through Lumiverse's lorebook editor, not the message Undo journal.

## Install

Requires **Lumiverse 1.2.5+**, its required **Bun 1.4.4+** runtime, and a configured model connection. No additional runtime packages or provider credentials belong in this extension.

**From GitHub, once the implementation branch has been pushed:** in Lumiverse's extension manager, install `https://github.com/angyaruo/KazzWare` and select the implementation branch `feat/kazzware-companion` until it is merged. The repository is private; Lumiverse's server must have Git credentials that can read it. The source checkout must include the tracked `dist/` files. Do not delete those files and rely on Lumiverse's generic auto-build: KazzWare's custom build embeds the mascot assets.

**From the supplied runtime ZIP:** extract its `kazzware` folder into the Lumiverse server's configured data directory under `extensions/`, so the manifest is at `data/extensions/kazzware/spindle.json` (or the equivalent custom data path). Use **Import local** in the extension manager, review the requested permissions and enable KazzWare. The runtime package contains prebuilt files and no dependency-install step. This operation is performed on the machine running Lumiverse, not merely the phone browser viewing it.

Open a chat, open KazzWare → Settings, select a connection and save. Peanut Gallery starts disabled. Message editing, summary creation and gallery generation spend tokens through your selected provider; long summaries may use several calls.

## Data and scope

Kazz history, settings, summaries, gallery pages and Undo records use Spindle's per-user storage, partitioned by chat. Kazz's conversation and the fandom never become roleplay messages. The chosen provider receives relevant story context and the requested work; credentials are handled by Lumiverse, and Kazz's context tools expose only connection names, IDs, models and providers.

The assistant can read character cards, personas, presets, lorebooks, databanks and current-chat memories on demand. Its writes are restricted to current-chat message edits, Kazz's own notebook/gallery/history, and new lorebooks attached to the current chat. It does not rewrite other chats or shared cards/presets/personas. Denied permissions are enforced by Lumiverse and may make the corresponding feature unavailable.

Peanut Gallery generates structured fictional content and renders complete HTML documents with three maintained layouts. The only executable page code is KazzWare's like/comment controller, inside the host sandbox. Model text cannot supply scripts. Comments persist locally; they do not post to Reddit, Twitter, or any external site. Automatic fandom replies to comments and unrestricted model-authored layouts are not part of this alpha.

## Develop

```sh
npm ci --ignore-scripts
bun run typecheck
bun test
bun run build
# Optional: check against the actual scanner in a Lumiverse checkout
bun scripts/check-host.ts /path/to/Lumiverse
```

The lockfile pins the development toolchain. There are no runtime dependencies. `src/backend.ts` runs in Spindle's backend runtime; `src/frontend.ts` exports the frontend setup/teardown. `scripts/build.ts` embeds the original PNGs into the frontend bundle. Commit updated `dist/` with every source change. The GitHub workflow checks types, tests and reproducible bundles with Bun 1.4.4.

See [architecture](docs/ARCHITECTURE.md), [research](docs/LUMIVERSE-RESEARCH.md), and [art provenance](assets/README.md). Independent, unofficial project designed to interoperate with Lumiverse; implementation is original and does not copy Mousey's code. No redistribution license is granted by this repository yet.
