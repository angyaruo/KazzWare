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

## Alpha · 0.6.0

The implementation and prebuilt bundles are included. The UI is a transparent collage: Kazz, a speech bubble, crooked action tiles and input strips float directly over the chat. Work tools have their own readable surfaces; no outer panel encloses the companion. Automated tests cover the backend and real frontend handlers; the shipped frontend also has an interactive sample preview. Live model response quality and physical mobile-device behavior still need validation. See [verification](docs/VERIFICATION.md) for exact checks and remaining limits.

Kazz floats in the active chat. Tap him or the input-bar KazzWare action to open the menu beside his current position. Opening, navigating or closing it preserves his position. The menu is 80% of its previous scale. On desktop and phones, drag the mascot freely; drag the open menu by the KAZZWARE label or its large Kazz artwork. The title and launcher also accept arrow keys (Shift for larger steps). The menu remains a floating, scrollable surface on narrow screens. The curled Kazz illustration is the launcher; opening the menu hides it while the larger companion is on screen. The four new supplied poses appear in the launcher, home, chat and idle Gallery.

| Section | What it does |
| --- | --- |
| Editor | **Follow view** selects the mounted message nearest the middle of the visible chat after scrolling settles. **Pick from chat** hides the controls so you can tap a native message; Escape or Cancel pick returns without changing it. A manual pick, native highlight or edit direction pins the target. Enter a direction, then **Edit now**. Successful edits apply immediately. |
| Selection editing | Highlight prose directly in a native message, even with the menu closed. After release and a 160 ms settling delay, a small prompt offers a direction field, **Edit selection**, **More options**, and Close. Quick edits expose Undo immediately. More options carries the highlight and direction into Editor. No duplicated source box or message dropdown. Ambiguous or formatting-altered highlights are rejected; select a smaller plain-text passage. They never become whole-message edits. |
| De-slop | Save a literal phrase list, choose whole-word boundaries, scan, and rewrite coherently. A result containing banned wording is rejected. |
| Chat | A separate per-chat conversation. Search all messages, read older messages, inspect app reference data, request edits, summaries, or a lorebook. |
| Gallery | Opt in, choose an interval and forum/thread/wiki format. Each saved page gets a collapsible entry beneath its triggering native message. Open it there, like posts, and leave persistent comments without opening the menu. The Gallery tab keeps the saved-page archive; pausing hides inline entries while preserving the archive. |
| Notebook | Create rolling full-chat summaries and lorebooks. New lorebooks are attached only to the current chat. |
| Swipe merger | In Editor, open **Swipe merger**, then load the native target’s swipes. Choose at least two. Add a direction or leave it blank to let Kazz combine the strongest compatible parts. The result becomes a new active swipe; originals remain. Undo checks all swipe contents, dates and the active selection before restoring them. |
| Automatic chat namer | In Settings, enable **Automatically name this chat**, choose **10–50 new messages** (default 20), and save. Names on the next new message, then at that interval; swipes and edits do not advance the counter. **Name chat now** and the latest ten title Undo records are also available. Enabled automation may replace existing titles. |
| Summary+ | Pick a native message and summarize it, or **Fill next 10 gaps** in an existing chat. The timeline has compact two-line previews; open a card to edit its summary, in-story date/time, place and people, refresh it, or find its native source. Automatic capture and roleplay-prompt injection are separate, default-off controls. Unknown dates remain unknown. Changed/deleted sources are excluded from injection. |
| Spoilers ahead | At the future end of Summary+, add a desired event or mention. Choose **Let Kazz decide** or **After N new messages**. Enable assessment/injection, then let new assistant replies trigger checks or use **Assess the scene now**. Kazz selects at most one natural next beat and can defer it. Pause, edit or mark an event **fulfilled** once it happens. Future intentions are injected separately from established history. |
| Commentary | Opt in under Settings → Let Kazz comment from his widget, then save. One short aside reacts to a new user/assistant message or unseen completed swipe. It appears beside the closed mascot for 14 seconds, follows him when dragged, and has a dismiss button. Uses Kazz’s selected connection; no chat writes or Gallery counts. Duplicate events/revisited identical swipes do not spend again. |
| Settings | Pick Kazz's saved connection, working-context length, gallery settings and mascot size. Settings are per chat. |

The current edit target is named in the menu and outlined in the native chat. Following runs while Kazz is open; it does not scroll the chat or select unloaded history. Click the pinned toggle to resume following (this clears the old direction/range), or use the native **Send to Kazz** action. A generation in progress cannot switch targets.

Quick selection edits show an Undo button in their prompt; the full history is in Editor and retains the latest 20 Kazz message edits across reloads. It checks the message and active swipe before restoring anything. A manual change made afterward blocks Undo so it cannot overwrite your newer wording. A write-ahead recovery record is saved before every edit. Lorebook creation is managed through Lumiverse's lorebook editor, not the message Undo journal.

Summary+ retains 500 current notes and a bounded cache of 500 alternate-source notes, so returning to a previously summarized swipe can restore your edited note without spending again. Each newly summarized message uses a model call. Summaries are at most 300 characters and two newline-separated lines, with a two-line collapsed preview. The prompt receives at most 80 current notes, trimmed to 18,000 serialized characters; opening the preview in Lumiverse’s prompt inspector shows a **KazzWare · Summary+ / future beats** section. Notebook’s rolling full-chat summaries remain separate.

Spoiler delays count user and assistant messages after the event was saved; changing its delay starts counting again. A delay is an earliest opportunity, never a forced deadline. Assessment runs after assistant replies and relevant swipe/edit events while a frontend is open, using Kazz’s selected connection and working context. Mark fulfillment yourself; Kazz’s timing assessment is model judgment, not a guarantee. Scene changes invalidate old assessments, and the prompt still permits deferral if the next user turn changes the mood.

## Install

Requires **Lumiverse 1.2.5+**, its required **Bun 1.4.4+** runtime, and a configured model connection. No additional runtime packages or provider credentials belong in this extension.

**From GitHub:** in Lumiverse's extension manager, install `https://github.com/angyaruo/KazzWare` from the `main` branch. The repository is private; Lumiverse's server must have Git credentials that can read it. The source checkout must include the tracked `dist/` files. Do not delete those files and rely on Lumiverse's generic auto-build: KazzWare's custom build embeds the mascot assets.

**From the supplied runtime ZIP:** extract its `kazzware` folder into the Lumiverse server's configured data directory under `extensions/`, so the manifest is at `data/extensions/kazzware/spindle.json` (or the equivalent custom data path). Use **Import local** in the extension manager, review the requested permissions and enable KazzWare. The runtime package contains prebuilt files and no dependency-install step. This operation is performed on the machine running Lumiverse, not merely the phone browser viewing it.

Open a chat, open KazzWare → Settings, select a connection and save. Gallery, commentary, automatic naming, automatic timeline summaries and both injection controls start disabled. Generation uses your selected provider; long summaries may use several calls. Automatic features require an open, active KazzWare frontend.

**Updating:** once 0.6.0 is on your installed branch, update KazzWare in the extension manager, grant the new **Interceptor** permission if you want timeline/future-beat prompt injection, restart the extension and refresh the Lumiverse page. Confirm its card shows **0.6.0**. Existing data migrates without a reset. The HTTP startup fix from 0.1.1 is included. If Interceptor is denied, the other tools still work, but the roleplay prompt receives no Kazz timeline or future beats.

## Data and scope

Kazz history, settings, summaries, gallery pages and Undo records use Spindle's per-user storage, partitioned by chat. Kazz's conversation and the fandom never become roleplay messages. The chosen provider receives relevant story context and the requested work; credentials are handled by Lumiverse, and Kazz's context tools expose only connection names, IDs, models and providers.

The assistant can read character cards, personas, presets, lorebooks, databanks and current-chat memories on demand. Writes are restricted to current-chat messages/swipes and title, Kazz's own notes/gallery/history, and new lorebooks attached to that chat. Optional prompt injection uses the public interceptor API and does not modify the saved preset or native chat messages. It does not rewrite other chats or shared cards/presets/personas. Denied permissions are enforced by Lumiverse and may make the corresponding feature unavailable.

Peanut Gallery generates structured fictional content and renders complete HTML documents with three maintained layouts. The only executable page code is KazzWare's like/comment controller, inside the host sandbox. Model text cannot supply scripts. Comments persist locally; they do not post to Reddit, Twitter, or any external site. Automatic fandom replies to comments and unrestricted model-authored layouts are not part of this alpha.

## Develop

```sh
npm ci --ignore-scripts
bun run typecheck
bun test
bun run build
# Write a self-contained interactive preview beside the repository
bun run preview
# Optional: check against the actual scanner in a Lumiverse checkout
bun scripts/check-host.ts /path/to/Lumiverse
```

The lockfile pins the development toolchain. There are no runtime dependencies. `src/backend.ts` runs in Spindle's backend runtime; `src/frontend.ts` exports frontend setup/teardown. `scripts/build.ts` embeds the original PNGs and display font into the frontend bundle. Commit updated `dist/` with every source change. The GitHub workflow checks types, tests and reproducible bundles with Bun 1.4.4.

Open the generated `KazzWare-preview.html` in a browser to explore the actual shipped UI with sample story data. Changes last only until that page reloads; it never contacts Lumiverse or an AI provider. Its mock host supports visual and interaction checks, not backend verification.

See [architecture](docs/ARCHITECTURE.md), [research](docs/LUMIVERSE-RESEARCH.md), and [art provenance](assets/README.md). Independent, unofficial project designed to interoperate with Lumiverse; implementation is original and does not copy Mousey's code. No redistribution license is granted by this repository yet.
