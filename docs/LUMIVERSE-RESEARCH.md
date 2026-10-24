# Lumiverse extension research

Research date: **24 October 2026**. Purpose: establish a reliable technical foundation before choosing or implementing an extension. This is a documentation and source study, not a running-instance test or a complete security audit.

## 1. What to build against

Lumiverse's extension framework is **Spindle**. An extension is a separate repository with a `spindle.json` manifest, an optional backend entry, an optional frontend entry, and optionally a separate frontend widget entry for native popout windows. The backend receives a host-provided `spindle` API; the frontend exports `setup(ctx)` and uses a host-provided context. This is substantially more capable than inserting JavaScript into a chat page: it provides generation hooks, data access, persistence, native UI controls, editor integrations, media facilities, and lifecycle management.

The safest starting point for our eventual design is the public Spindle contract plus the capabilities actually advertised by the target installation. Importing Lumiverse's internal React components, Zustand store, database, service modules, or private desktop bridge would couple the extension to implementation details. Reading those internals is useful for understanding behavior and testing assumptions; it does not make them supported extension APIs.

Sources: [developer docs](https://docs.lumiverse.chat/), [official repository](https://github.com/prolix-oc/Lumiverse), [quick start](https://docs.lumiverse.chat/getting-started/quick-start/), [frontend API](https://docs.lumiverse.chat/frontend-api/).

## 2. Version baseline and research coverage

| Item | Reviewed snapshot |
| --- | --- |
| Main source | `3d74148383dded2b379f204532cf375b52bcd201` |
| Main commit | 2026-10-24; Windows pubsub backpressure fix |
| Main backend/frontend manifests | Both `1.2.5` |
| Main Spindle SDK | `lumiverse-spindle-types` **0.6.49**, pinned by both applications |
| Staging source | `0ea5bc0c9bb36e8ce6cbe534eda5f7122f758207` |
| Staging Spindle SDK | **0.6.59** |
| npm latest observed | **0.6.59** |
| Required host runtime on main | Bun **>=1.4.4**, package manager `bun@1.4.4` |
| Desktop manifest on main | **0.3.1**, separately versioned from core |

I inventoried all **90 main developer-documentation pages**, reviewed their API families and examples, compared the **six additional staging pages** and changed contracts, inspected the published 0.6.49 declarations, and traced the important behaviors through backend and frontend source. I also reviewed repository structure, package manifests and lockfiles, recent commits, releases, contribution guidance, and relevant open issues/PRs. UI research here means reading the public UI contracts and their implementation; it does not mean visually exercising a running desktop, browser, or phone installation.

The distinction between main, staging, published types, and live documentation matters. Some live documentation describes APIs ahead of the reviewed main source, and even the main source exposes some features beyond its pinned type declarations. Installing a newer type package does not install a newer host implementation. Read backend/frontend version information, commit metadata when available, the host capability map, and the optional method itself; then fail gracefully when the feature is absent.

The companion **reference index** links every documentation page and lists all direct JavaScript dependencies. The **JSON inventory** records both branch snapshots, JavaScript and Rust dependency declarations, lockfile package records and dependency edges, source URLs, lockfile hashes, permissions, UI mount points, and relevant test paths. Versions declared with a range are distinguished from locked resolutions; these records are not a vulnerability assessment or a claim that every platform-specific package is installed.

Sources: [main snapshot](https://github.com/prolix-oc/Lumiverse/commit/3d74148383dded2b379f204532cf375b52bcd201), [staging snapshot](https://github.com/prolix-oc/Lumiverse/commit/0ea5bc0c9bb36e8ce6cbe534eda5f7122f758207), [version API](https://docs.lumiverse.chat/backend-api/version/), [SDK repository](https://github.com/prolix-oc/lumiverse-spindle-types), [published SDK metadata](https://registry.npmjs.org/lumiverse-spindle-types/latest).

## 3. Host architecture and dependencies

| Layer | Main implementation | Consequence for an extension |
| --- | --- | --- |
| Backend | TypeScript/ESM on Bun; Hono HTTP routes | Bundle backend code for Bun; use the host facade for privileged operations. |
| Persistent state | `bun:sqlite`, migrations, prepared queries, WAL | No direct extension database access; use scoped storage and domain APIs. |
| Authentication | Better Auth 1.7.2; account and ownership checks | Explicitly preserve user scope, especially on multi-user installations. |
| Realtime | Native WebSocket endpoint `/api/ws` and host EventBus | Subscribe through Spindle, filter events, dispose listeners, recover after reconnect. |
| Frontend | React 19.2.6 range, Zustand 5, React Router 7, Vite 8.2.2 | Host UI state is reactive and may remount; avoid assumptions about persistent DOM. |
| Rendering | Markdown, DOMPurify, virtualized message lists, CSS modules/theme variables | Use supported insertion/render APIs and scoped styling. |
| Editors | CodeMirror 6, Loom editor, host component mounts | Reuse first-party controls instead of duplicating editor internals. |
| Retrieval | LanceDB 0.37.1, Apache Arrow 18.1.0, optional Milvus integration | Query through memory/world-book APIs; preserve embedding compatibility. |
| Media | Sharp, optional FFmpeg, browser and native media integrations | Capability and configuration checks are required; native availability varies. |
| Desktop/mobile | Tauri 2/Rust, PWA and additional native clients | A browser feature is not automatically a native feature, or vice versa. |

Backend dependencies also cover tokenizers, MCP, OAuth, archive/compression support, document extraction, telemetry interfaces, and SFTP. Frontend dependencies cover drag and drop, icons, motion, localization, cropping, fuzzy search, PWA caching, and editor tooling. The complete declarations are in the reference index; the lockfiles are the authority for the resolved dependency graph.

An extension does **not** need to copy that application stack. A conventional extension can begin with TypeScript tooling, matching Spindle declarations, Bun bundling, and whatever small libraries its actual feature requires. `ctx.components` renders host-owned React components without requiring the extension to install its own React copy. Add extension dependencies only after checking bundle size, browser/Bun compatibility, static-scanner compatibility, and whether installation requires scripts that Lumiverse will not run.

Source map: `src/routes` handles HTTP; `src/services` owns business logic and prompt assembly; `src/db` owns schema/migrations; `src/llm` owns provider dispatch; `src/macros` owns macro evaluation; `src/spindle` owns extension installation, transports, runtime and host authorization. Frontend integration lives primarily in `frontend/src/lib/spindle`, with actual rendering and application state elsewhere in `frontend/src`. Native host behavior lives in the desktop/mobile trees and is an additional compatibility layer.

Sources: [backend manifest](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/package.json), [frontend manifest](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/frontend/package.json), [desktop manifest](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/desktop/src-tauri/Cargo.toml).

## 4. Packaging, installation, and lifecycle

The manifest identifies the extension, version, author, repository, permissions, and entry paths. Identifiers follow the lowercase letter/digit/underscore convention and should remain stable because they scope registrations and data. Conventional entries are `src/backend.ts` → `dist/backend.js`, `src/frontend.ts` → `dist/frontend.js`, and optionally `src/widget.ts` → `dist/widget.js`. Include only the surfaces the feature needs and follow the precise manifest schema rather than treating descriptive documentation as a validator.

The installer is more specific than a generic “clone and run build” workflow. Main detects prebuilt output when files under `dist` are tracked in Git. Prebuilt extensions without runtime dependencies can skip installation; those with runtime, optional, or peer dependencies receive a production install. Source builds install dependencies with `bun install --ignore-scripts`; the host then auto-builds the conventional entries when their output is missing. A custom `build` script, postinstall step, child-process entry, asset pipeline, or unusual output structure should therefore be packaged deliberately, normally with current prebuilt distribution files.

The host scans backend output for prohibited capabilities before running it. A library that works in an ordinary Bun program may fail this scan because of filesystem, subprocess, database, network, dynamic-import, or other prohibited code. Test the actual shipped bundle, not just its TypeScript sources. Keep source and prebuilt output synchronized in each release, and exercise a clean Git-based installation and an update from the prior version.

Backend startup and frontend setup are separate. There is no useful guarantee that the UI is ready when backend initialization runs, and registration order between different extensions should not be treated as a dependency system. If frontend preparation is asynchronous, call `ctx.deferReady()` before setup returns and call `ctx.ready()` once handlers are ready; avoid waiting for a response that itself depends on that readiness. Cleanup must release event listeners, timers, mounts, processes, streams, and subscriptions when disabled, reloaded, superseded by another browser tab, or torn down.

Sources: [manifest](https://docs.lumiverse.chat/getting-started/manifest/), [lifecycle](https://docs.lumiverse.chat/lifecycle/), [installer implementation](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/spindle/manager.service.ts#L1217).

## 5. Runtime, permissions, and ownership

The current default backend runtime is a **separate Bun process per extension**. Legacy worker mode remains available; sandbox mode uses macOS Seatbelt where available and falls back to process mode on Linux/Windows. The source itself describes runtime patching as cooperative protection, so process separation should not be advertised as a complete hostile-code sandbox. Windows uses a different transport path, and the recent Bun/runtime/backpressure changes make the minimum runtime version relevant.

Permissions and scanner capabilities are separate mechanisms. Manifest `permissions` request runtime authorization for host functions; `requested_capabilities` relax specific static-scanner checks such as dynamic-code or base64-decoding detection. They do not authorize arbitrary filesystem access, process spawning, direct database access, or bypassing the host's user checks. The permission catalog and actual privileged subset are recorded separately in the inventory because the overview table is not complete.

Declared permissions may be denied or revoked while the extension is running. Nonprivileged permissions are normally granted by the manager's first-enable/reconciliation flow, with source-specific exceptions; privileged permissions require explicit approval. Check current grants, subscribe to changes, handle `PERMISSION_DENIED`, and remove or disable dependent UI when access disappears. Some denied registrations report a denial and become no-ops, whereas request/response calls fail, so a successful setup function alone does not prove registration succeeded.

Operator-scoped extensions must deliberately select a user for user-owned operations. User-scoped installations are bound to their owner. Backend-to-frontend sends without a user target can broadcast broadly, so sensitive replies should preserve user and, where supported, frontend-session targeting; a missing/stale session must not silently become a broadcast. Session identifiers are routing information rather than authentication credentials.

Use `spindle.storage`/user storage for extension state and `spindle.enclave` for secrets. The enclave is encrypted and scoped; model connection APIs expose safe configuration views rather than raw provider credentials. The supported network interface is `spindle.cors`, subject to its permission and request validation; private/loopback integrations are a supported use case, so its policy must not be misrepresented as a universal private-IP block. Managed sandboxed iframes have a different isolation model from ordinary extension-owned DOM and communicate through a host bridge.

Sources: [runtime](https://docs.lumiverse.chat/getting-started/runtime/), [permissions](https://docs.lumiverse.chat/getting-started/permissions/), [capabilities](https://docs.lumiverse.chat/getting-started/capabilities/), [cooperative runtime guards](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/spindle/worker-runtime-sandbox.ts), [privileged set](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/spindle/manager.service.ts#L878).

## 6. UI integration and rendering

| Need | Suitable host surface | Important constraint |
| --- | --- | --- |
| Persistent settings/tool interface | Drawer tab | General drawer registration does not require broad app manipulation. |
| Small chat action | Input-bar action or command | Keep registration and callbacks scoped; dispose them. |
| Floating or docked workspace | Float/dock APIs | Requires `ui_panels`; mobile docks may become bottom sheets. |
| Character/preset workflow | Editor tabs and preset toolbar | Domain permissions and host editor save semantics apply. |
| Deep application placement | Published mount points/portals | Uses broader permissions; slot availability depends on current UI. |
| Native styling | `ctx.components` and theme variables | Mount only inside extension-owned registered roots. |
| Message-specific content | DOM helper, tag interceptors, display resolver | Virtualization, streaming, swipes and remounts must be handled. |
| Native detached tool | Widget registration and optional widget bundle | Separate WebView/context; main-window assumptions do not transfer. |

The main source publishes 59 canonical mount-point names and five legacy aliases. These cover chat headers, streams, composer, message actions, landing areas, drawers, editors, settings, lorebooks, Loom and other workspaces. Catalog membership is not a guarantee that a particular slot is presently mounted or that every registration helper accepts it. Registration limits also exist: examples include eight drawer tabs or input actions per extension, four floating widgets, two docks per edge, and two stacked modals.

Shared controls include text/numeric inputs, text areas, switches, checkboxes, ranges, selects, multiselects, model selectors, folder controls, badges, spinners, collapsibles, pagination, close controls, and the Loom block editor. Retain their handles, update through the supported methods, and destroy them before replacing their container. Mounts require ownership of the target root; a detached subtree has only a narrow same-task attachment allowance. Preset editor integration uses the host's serialization/save machinery and scoped metadata helpers rather than blindly overwriting the preset.

Style with `--lumiverse-*` variables and locally scoped rules. Layout must tolerate UI scaling, actual container size, narrow screens, themes, keyboard changes, and native popouts. Use the geometry API when mixing rendered coordinates and layout coordinates. Broad global selectors, private component class names, and body-wide MutationObservers are brittle integration points.

The message list is virtualized: a valid message can exist in the chat while its DOM element does not. Supported injections can be replayed as an item remounts; call the helper's uninject operation to remove the replay registration, since calling `.remove()` on the current element is insufficient. Message tag interceptors, HTML islands, and display resolvers are different mechanisms: tag masking can affect streaming presentation; styled islands use Shadow DOM; a display owner assumes responsibility for its rendered result and failure behavior. Message previews render bounded stored-message content through the host and are not a general arbitrary-HTML surface.

Sources: [UI placement](https://docs.lumiverse.chat/frontend-api/ui-placement/), [shared components](https://docs.lumiverse.chat/frontend-api/shared-components/), [scaling](https://docs.lumiverse.chat/frontend-api/ui-scaling/), [DOM helper](https://docs.lumiverse.chat/frontend-api/dom-helper/), [display resolver](https://docs.lumiverse.chat/frontend-api/display-resolver/), [mount catalog](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/frontend/src/lib/spindle/mount-points.ts).

## 7. Generation, prompt assembly, and tools

The host has several distinct intervention points. Context handlers run before prompt assembly, world-info interceptors participate before activation, macro interceptors handle eligible template evaluation, and pre-generation interceptors receive the assembled provider-facing messages. These points are not interchangeable, and their permissions differ: the reviewed host gates context handlers with `context_handler`, pre-generation interceptors with `interceptor`, macro interceptors with `macro_interceptor`, and world-info interceptors with `generation`.

Prefer the narrowest hook that can implement the feature. Preserve roles, multimodal parts, tool calls, and provenance when rewriting messages. Parameter changes returned by an interceptor require `generation_parameters`; otherwise the host strips those changes. Request overrides take precedence over interceptor parameters, which take precedence over preset values. Ordinary hook failures can pass through; explicitly required interception capabilities change failure handling, so silent fallback is not appropriate for a feature that promises mandatory processing.

Raw, quiet, and batch generation are direct provider helpers and do not reproduce the complete normal chat pipeline. Quiet generation uses connection/preset settings but does not automatically expand macros or run the host's usual assembly/context/interceptor chain. The general `spindle.assemble` API evaluates a bounded Loom graph without committing state and avoids recursively invoking those hooks; `generate.dryRun` inspects full assembly without actually calling the model. A design that needs the user's normal chat behavior must choose the appropriate entry point rather than assuming these calls are equivalent.

Streaming helpers provide token/reasoning/completion events and support cancellation. Tie each operation to an AbortSignal and clean up when the user cancels, changes chat, or unloads the extension. Timeout budgets differ by hook: defaults are commonly ten seconds, pre-generation timeout is configurable within bounds, and context handlers have their own bounded timeout. Cancellation does not roll back side effects that have already been accepted.

Tools and Council integrations have their own registration/invocation contracts. Macros can be pushed as cached values or resolved through callbacks; callback latency and mutation semantics matter during prompt evaluation. Respect core macro precedence, use extension namespaces, mark volatile data appropriately, and keep noncommitting evaluation free from writes. Core also contains provider-broker and MCP extension facades that are less fully covered by the prose docs: registration permissions are per provider kind, while MCP profile management has separate read/connect and creation grants with credential-redacted responses.

Sources: [generation](https://docs.lumiverse.chat/backend-api/generation/), [interceptors](https://docs.lumiverse.chat/backend-api/interceptors/), [context handlers](https://docs.lumiverse.chat/backend-api/context-handlers/), [macros](https://docs.lumiverse.chat/backend-api/macros/), [host gates](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/spindle/worker-host.ts), [MCP facade](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/spindle/worker-host-mcp-api.ts).

## 8. Data, persistence, and concurrency

| Domain | Design rule |
| --- | --- |
| Chats versus messages | `spindle.chats` manages chat records; `spindle.chat` exposes message mutation. Their permissions differ. Do not infer a create-chat method from a generic “CRUD” heading. |
| Swipes and edits | Active swipe content is authoritative. Preserve swipe metadata and handle edit/swipe events; content edits may also update retrieval indexes. |
| Character extensions | Namespace metadata. Top-level merge behavior does not imply a recursive merge of the extension's nested object. |
| Presets/Loom | Respect cache revisions, profile overrides, localized block operations, and the live editor bridge. |
| Variables | Distinguish evaluation-local, chat-persistent, and user-global values. Do not assume swipe/branch changes automatically roll back custom state. |
| Runtime snapshot | Epoch/sequence revisions help resynchronize; they are not a durable event log or a general compare-and-swap token. |
| World books | Attachment scope and activation mode matter; semantic use requires embedding configuration and indexing. |
| Memories | Cortex entities/relations, chat-memory retrieval, salience, consolidation and vaults are separate concepts. Keep embedding model/dimensions compatible and allow asynchronous indexing. |
| Regex/content processing | Prompt, persisted response, and display transformations have different effects. Render-only transformations must not accidentally become stored edits. |
| Cross-extension RPC | Registration policy controls delegated access. An omitted narrow policy can inherit the owner's broader grants; declare requirements deliberately. |

State keys should include the appropriate installation/user/chat/message/swipe scope, with a schema version and migration strategy where persistence is involved. Correlate asynchronous requests and ignore stale results after chat or session changes. Invalidate caches on relevant edits, swipes, deletions, permission changes, reconnects and generation termination. Message/render handlers may run repeatedly, so writes and expensive work need explicit deduplication rather than assuming one callback per message.

Message visibility deserves a specific regression test. The chat-mutation documentation says hiding a message does not exclude it from prompts, but the reviewed main prompt-assembly code explicitly skips `extra.hidden === true` in multiple history paths. Treat the source-observed behavior as the current implementation and verify the intended target installation before using hidden messages as any kind of scratchpad or model-visible state.

Sources: [chat mutation](https://docs.lumiverse.chat/backend-api/chat-mutation/), [presets](https://docs.lumiverse.chat/backend-api/presets/), [runtime state](https://docs.lumiverse.chat/backend-api/runtime-state/), [memories](https://docs.lumiverse.chat/backend-api/memories/), [shared RPC](https://docs.lumiverse.chat/backend-api/shared-rpc-pool/), [hidden-history source](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/src/services/prompt-assembly.service.ts#L3351).

## 9. Files, external services, and native features

Use the file/upload APIs for large payloads instead of moving huge base64 strings through ordinary frontend/backend messages. The documentation specifies a 4 MB WebSocket message cap, separate chunk limits for different transfer APIs, and expiring staged references. Keep transfers user/installation scoped, support cancellation and progress, and persist an asset only when the feature requires persistence. Archive support has its own streaming, quota and integrity rules.

Image generation depends on host-configured connections and provider capabilities; discover those dynamically. Image assets, image generation, and media processing have distinct permissions and return contracts. FFmpeg-dependent media operations require a working host FFmpeg facility and may return transient output rather than automatically creating a stored asset. OAuth should use the host callback/state/PKCE flow and encrypted token storage; web search depends on the host's configured service rather than an assumed universal search endpoint.

Speech-to-text, native system-audio analysis, screen capture, recording and push notifications are conditional facilities. The main speech API offers browser/native/provider-dependent behavior and microphone interaction requirements. System-audio analysis exposes levels/spectrum rather than raw captured audio, while screen-capture APIs use scoped opaque assets and OS/client controls. Browser, PWA and desktop support differ, and some desktop capture paths are unavailable on Linux. These features need explicit capability discovery and device testing if our extension uses them.

Native floating widgets have independent frontend contexts; registration identity, state synchronization, size changes and return-to-main-window behavior need attention. Backend child processes are supervised Bun JavaScript entries with a narrow messaging/heartbeat contract rather than unrestricted copies of `spindle`; frontend “processes” are supervised logical controllers, not separate browser OS processes. Both facilities require stop/timeout cleanup and should be introduced only when the feature warrants the added lifecycle complexity.

Sources: [file transfers](https://docs.lumiverse.chat/backend-api/file-transfers/), [uploads](https://docs.lumiverse.chat/frontend-api/file-uploads/), [image generation](https://docs.lumiverse.chat/backend-api/image-generation/), [media](https://docs.lumiverse.chat/backend-api/media/), [desktop capture](https://docs.lumiverse.chat/getting-started/desktop-capture/), [system audio](https://docs.lumiverse.chat/frontend-api/system-audio/), [backend processes](https://docs.lumiverse.chat/backend-api/backend-processes/).

## 10. Staging features to keep separate

| Staging feature | Relevant compatibility boundary |
| --- | --- |
| Backend embeddings | `embeddings-v1`; `embeddings` permission; bounded batches and input sizes; model/dimension consistency. |
| Composer API | `composer-v1`; inspect/edit/focus draft; sending requires generation permission and follows real composer context. |
| Connection kinds | `connection-kinds-v1`; safe summaries across LLM/image/TTS/STT/embedding/decision connections; async behavior differs by kind. |
| Text-to-speech API | `text-to-speech-v1`; speaking/stopping uses media authorization; message speech and transient text speech persist differently. |
| Expanded speech recognition | `speech-to-text-options-v1`; newer options such as keywords/word timing are provider-dependent. |
| Expanded host actions | New host-surface action coverage; some related host functionality already exists on main. |
| Active preset resolution | Chat/persona/character/connection/default bindings and effective overrides must be resolved rather than guessing a global preset. |
| Decision images | `decision-images-v1`; conditional model/provider support, image access and dimensional/payload limits. |
| Android notifications | Native enrollment, local transport and operator-configured FCM; not a universal hosted relay. |

These are observations of the reviewed staging commit, not promises that a user's installed release supports them. The reference index links the new pages directly to that commit. If an eventual feature needs one of them, choose an explicit minimum supported host/capability and a useful unavailable-state UI before implementation.

Source: [staging developer documentation](https://github.com/prolix-oc/Lumiverse/tree/0ea5bc0c9bb36e8ce6cbe534eda5f7122f758207/developer-docs/docs).

## 11. Documentation/source discrepancies worth remembering

| Topic | Research finding | Practical response |
| --- | --- | --- |
| Runtime terminology | Older wording centers workers; the current default is process mode. | Design and debug against the actual transport/runtime. |
| Permission overview | The overview omits some names present in types/source, including macro interception and newer provider/MCP surfaces. | Check the exact API implementation and current grants. |
| Hook permissions | A generalized documentation statement conflicts with distinct gates in the host. | Request the specific hook permission; do not request generation as a substitute. |
| Event access | Broad “free events” wording does not cover every event; generation lifecycle/stream events are gated. | Treat subscriptions as potentially permission-dependent. |
| Hidden messages | Prose says retained in prompts; main assembly paths skip them. | Regression-test history construction for the target version. |
| Build lifecycle | Source installation does not execute arbitrary extension build/postinstall scripts. | Ship required custom outputs and test a clean install. |
| SDK/live docs | Main pins 0.6.49 while staging/npm expose newer APIs; source and declarations also have smaller mismatches. | Pin types and feature-detect the host. |
| API naming | Introductory prose sometimes uses descriptive aliases such as secure-enclave/CORS-proxy names. | Use the actual `spindle.enclave` and `spindle.cors` members. |

Open issues and PRs were treated as signals of active work rather than implemented functionality. Extension dock sizing, local MCP configuration and platform startup constraints are relevant areas to recheck if our feature touches them. The snapshot hashes above keep these research conclusions reproducible even as main moves.

## 12. Development and verification approach for the eventual extension

First map the actual feature to its UI surface, backend operations, data ownership, and minimum capabilities. Then specify the frontend/backend message protocol, persistence schema, permissions and cancellation behavior before adding dependencies. Build a narrow vertical slice that installs through Lumiverse's real extension manager, and expand only after it survives reload, disable/re-enable and clean installation.

The meaningful verification matrix will include denied/revoked permissions; user/session isolation; chat changes and stale async replies; reconnect and duplicate delivery; edits/swipes/deletions; streaming cancellation; mount/unmount and virtualization; dark/light themes and UI scaling; and update/migration behavior. Add native or provider-specific testing only for features we actually use. Prompt-changing features should inspect dry-run/breakdown output and test ordering, hidden messages, parameter precedence and failure behavior.

The repository includes substantial Spindle contract and regression coverage; the JSON inventory links those tests so we can use existing contracts as evidence. If a core change becomes necessary, the repository asks for PRs against staging and relevant backend/frontend checks, with UI/browser/mobile verification appropriate to the change. Its contribution guide also requires a human live-environment audit before an LLM-assisted upstream PR. An extension-only project should have its own targeted tests rather than inheriting the entire host's build pipeline. See the [reviewed contribution guide](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/CONTRIBUTING.md).

No application tests, provider calls, extension installations, or device checks were run during this research. The locally available Bun executable reports 1.4.3, below the reviewed host's required 1.4.4; it was used only for a standalone metadata-reading script, not to launch Lumiverse. A suitable runtime and a separate test instance will be needed when implementation begins.

## 13. Distribution constraint

The repository uses the custom **Lumiverse Community License 2.2**, described by the license itself as source-available. Section 2.2 expressly addresses separate community extensions: it permits their distribution under their own qualifying terms, with conditions concerning source availability, separation from core code, free access/noncommercial distribution, and clear unofficial identity. It also restricts using “Lumiverse” in the extension's own name; uncoupled voluntary donations are specifically distinguished from paid access/features/support. This is relevant to eventual naming and release planning, and the exact section should be checked when publishing.

Source: [license §2.2 at the reviewed commit](https://github.com/prolix-oc/Lumiverse/blob/3d74148383dded2b379f204532cf375b52bcd201/LICENSE.md#22-community-extensions-and-integrations).

## 14. What remains feature-dependent

The research establishes the platform model, public integration options, dependency boundaries and known compatibility traps. The extension idea will determine which small subset we actually use: UI-only versus backend work, ordinary chat actions versus generation interception, persistent versus transient state, single-user versus operator scope, and browser versus native requirements. No framework choice beyond the host's Spindle contract, no broad permission set, and no optional service dependency needs to be committed before that feature is defined.

Companion deliverables: **Lumiverse-reference-index.md** for browsing the docs/dependency declarations, and **Lumiverse-reference-inventory.json** for machine-readable versions, manifests, lock graphs, permissions and source locations.
