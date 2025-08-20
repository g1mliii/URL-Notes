## Platform & UX Decisions

- __Popup-first UX__
  - `manifest.json` uses `action.default_popup: popup/popup.html`. The toolbar icon always opens the popup.
  - No Side Panel usage to maintain compatibility across Chrome and Brave.

- __Ads Placement Policy__
  - Ads are displayed only inside the extension UI (`popup/popup.html`) within `#adContainer` using `extension/lib/ads.js`.
  - Do not inject ads into content pages or overlays to comply with Chrome Web Store policies.

- __Link Opening & Highlighting Policy__
  - Use retry-based `chrome.tabs.sendMessage` to trigger highlights; do not rely on `tabs.onUpdated` or any handshake wait.
  - When opening a new tab from an editor link, append a `#:~:text=` fragment when possible to encourage native highlight.
  - Content script (`extension/content/content.js`) owns robust retries and a MutationObserver to catch late DOM loads.

- __“This Page” Filtering__
  - Group notes by normalized page identity (ignore hash/fragments; strip common tracking params; lowercase host without `www.`; remove trailing slash).
  - Implementation detail: `normalizePageKey(url)` in `popup/popup.js` used in `render()` and post-delete refresh when `filterMode === 'page'`.

## Phase 1 Completion Note

- Phase 1 (Core Extension) complete: polished popup UI, domain/url filtering, improved highlighting, and ad container in place.

### Phase 1 UI Outcomes (Aug 20, 2025)
- __Onboarding panel (inline)__: Lives inside Settings as `#onboardingPanel` iframe; panel and iframe must fit exactly within the popup with no internal scrollbars. Container `overflow: hidden`; iframe `width/height: 100%`, `border: 0`, `overflow: hidden`.
- __Header truncation rules__: Domain should remain fully readable when possible; only the URL is allowed to truncate with ellipsis. Keep right-side reserved space minimal so text isn’t prematurely cut. Use `min-width: 0` on flex children.
- __Compact header tweaks__: Slightly reduced paddings and icon sizes in compact mode for tighter vertical space.
- __Keyboard shortcuts__: Open Popup = Alt+E; New Note = Alt+N (default). Display hints compactly in header.
- __Help tooltip__: Header Help icon shows a concise tooltip of quick tips/hidden features.

## Next-phase Design Considerations

- Gated premium mode removes ads in the popup when authenticated premium (Phase 2).
- Ensure backup/export/import UI copy is concise and accessible.
- Keep contrast high in light mode (esp. sliders, previews) and enforce focus-visible outlines.

## Architecture & Code Ownership (Popup)

- __Popup orchestrator (`extension/popup/popup.js`)__
  - Acts as the coordinator: initializes modules, wires events, routes actions, and manages view state (`all|site|page`).
  - Does not perform DOM rendering of notes, inline confirmations, or editor transformations.
  - May read/write high-level UI state (active view, search query, collapse state) and delegate work to modules.

- __Notes module (`extension/popup/modules/notes.js`)__
  - Owns grouping, sorting, and rendering of notes, including domain headers and note cards.
  - Owns per-note and per-domain destructive UX: two-tap delete for notes, inline confirm for domain bulk delete.
  - Exposes imperative APIs consumed by `popup.js` (e.g., `renderAllNotes`, `renderSiteNotes`, `renderPageNotes`, `attachNoteEventHandlers`).

- __Editor module (`extension/popup/modules/editor.js`)__
  - Owns editor lifecycle: open/close, content HTML↔markdown transforms, caret utilities, paste/link handlers, draft persistence.
  - All editor-related calls must go through `EditorManager`. No editor helpers in `popup.js`.

- __Settings module (`extension/popup/modules/settings.js`)__
  - Owns settings UI, font preferences, and applies font styles to rendered note elements when requested.

- __Storage module (`extension/popup/modules/storage.js`)__
  - Owns data access for notes, versions, and domain/page filtering queries. No DOM knowledge.

- __Theming module (`extension/popup/modules/theming.js`)__
  - Owns theme toggling, accent application, and token management. No business logic.

- __Utils module (`extension/popup/modules/utils.js`)__
  - Stateless helpers only (formatting, normalization like `normalizePageKey`, etc.).

### Do / Don’t (Popup architecture)

- __Do__ keep `popup.js` free of rendering and editor helpers; use modules’ exported APIs.
- __Do__ centralize destructive UI patterns inside `notes.js` and reuse them across views.
- __Don’t__ duplicate functions already provided by modules (e.g., `createNoteElement`, `groupNotesByDomain`, `handleTwoTapDelete`, `buildContentHtml`). If a temporary duplicate exists during refactor, mark it with `// TODO: duplicated – route via <Module>` and prefer the module implementation at call sites.
- __Don’t__ bind event listeners multiple times; let `popup.js` own initial wiring and delegate to modules for per-item handlers.

# URL Notes – Style Guide

## Design Tokens

- __Colors (CSS variables in `:root`)__
  - `--bg-primary`: main container background (glass, light/dark variants)
  - `--bg-secondary`, `--bg-tertiary`, `--bg-overlay`
  - `--text-primary`, `--text-secondary`, `--text-tertiary`
  - `--accent-primary`, `--accent-secondary` (the only source of accent color)
  - `--border-color`, `--shadow-light`, `--shadow-dark`
  - `--backdrop-blur`, `--gradient-bg`

- __Typography__
  - System font stack: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial
  - Base font-size: 14px; titles 16–17px; small meta 11–12px

- __Radii__
  - App container: 20px
  - Buttons/cards: 10–14px (consistent rounding)

- __Elevation & Glows__
  - Prefer neutral elevation (Apple-like):
    - Default: `0 1px 2px var(--shadow-dark), inset 0 1px 0 var(--shadow-light)`
    - Hover: `0 2px 8px var(--shadow-dark), inset 0 1px 0 var(--shadow-light)`
  - Avoid colored outer glows for primary buttons.

- __Focus__
  - Use `:focus-visible` outlines synced to accent: `outline: 2px solid var(--accent-primary); outline-offset: 2px;`

## Components

- __Header (`.header`)__
  - Padding: `12px 16px` (compact, iOS-like)
  - `.header-content` bottom margin: `4px` to minimize gap before search
  - Favicon bubble `32x32`, `border-radius: 10px`, `object-fit: cover`

- __Site details__
  - `.site-domain`: 16px, semibold, single-line ellipsis
  - `.site-url`: 12px, secondary text, single-line ellipsis

- __Search__
  - Container padding: `8px 16px 8px 16px`
  - Input height: 40px; left icon absolutely positioned
  - Clear button appears conditionally
  - Placeholder text is contextual:
    - All Notes: "Search All Notes"
    - This Site: "Search This Site"
    - This Page: "Search This Page"

- __Filter chips (`.filter-option`)__
  - Neutral until active; active uses Apple-like segmented pill
  - Active style: `background: var(--bg-primary); border: 1px solid var(--border-color); box-shadow: inset 0 1px 0 var(--shadow-light), 0 1px 2px var(--shadow-dark)`

- __Notes list__
  - Cards (`.note-item`) use inset light border, soft hover lift, hidden delete until hover
  - Title truncation, 2-line preview via `-webkit-line-clamp`
  - Compact mode in Site/Page views via `:root[data-view="site|page"]` reduces paddings, title size, preview gap, and tag spacing.
  - Alignment rules:
    - Date is absolutely pinned to the far right and shares the same right inset as tag chips (e.g., `right: 6px`), so the date’s right edge aligns with the tag box edge.
    - Tag chips render only on the right as overlays; never render tags on the left.
    - Trash/delete icon sits to the left of the date with a tight gap; reserve minimal space in `.note-header-right` so icons never overlap the date.
    - Domain delete button is smaller, pinned top-right of the domain header above tags; domain tags appear below and do not overlap the button.

- __Buttons__
  - Primary actions (New Note, Save):
    - Background: `var(--accent-primary)`; text: white (enforced)
    - Neutral glow: default `0 1px 2px var(--shadow-dark), inset 0 1px 0 var(--shadow-light)`
    - Hover: `background: var(--accent-secondary)` with `0 2px 8px var(--shadow-dark)`
  - Icon buttons use neutral surfaces; hover to secondary/background

- __Settings panel (`.settings-panel`)__
  - Light mode: higher opacity for readability `rgba(255, 255, 255, 0.92)` with clear border/shadow.
  - Dark mode: use dark tokens; avoid lowering opacity excessively over complex backgrounds.
  - Rounded corners (12px), blurred backdrop, subtle drop shadow.
  - Storage & Backup actions live here.

- __Font Settings (in Settings panel)__
  - Font dropdown label is “Font” (no “family” wording). Default option label is “Default” (system stack).
  - Font size slider has visible track/thumb in light mode.
  - Live preview shows sample text and numeric value (e.g., `14px`).
  - Behavior: Changes do NOT apply to the editor while Settings is open; they apply when the panel closes.

## Dark Mode

- Dark tokens defined under `@media (prefers-color-scheme: dark)`.
- Do not hardcode alternate colors; derive from variables only.
- Settings menu uses higher opacity in dark to maintain contrast over complex backgrounds.

## Accessibility

- Use `:focus-visible` on interactive elements.
- Maintain sufficient contrast; enforce white text on accent backgrounds.
- Tooltips on small indicators (e.g., page badge) for clarity.

## UX Patterns

- __Destructive confirmations__
  - Notes: Two-tap on the same trash icon (no inline box). First tap arms visual `.confirm` state (~1.6s timeout), second tap deletes.
  - Domain: Bulk delete confirm renders inline inside the domain header’s `.domain-actions` container (keeps context, prevents layout jump).
  - Tooltips: On first tap, update button title to “Click again to delete”. Auto-disarm restores the original title.

- __Live refresh in All Notes__
  - Invalidate cached all-notes data on `chrome.storage.local` changes and re-render when `viewMode === 'all'`.
  - Force-refresh cache after save/delete when currently in All Notes.
  - Note cards are rendered as DOM nodes (not string HTML) so event handlers (delete) remain active.

- __Post-delete search behavior__
  - Keep the user’s query sticky while there are still results.
  - If a delete leaves zero results for the current query, automatically clear the search box and re-render.

## Do / Don’t

- __Do__ use color-mix with `--accent-*` for shadows/glows.
- __Do__ keep truncation with `min-width: 0` on flex items as needed.
- __Don’t__ hardcode brand blues; avoid layout shifts on hover (bolding).

## Changelog Highlights

- Tightened header/search spacing for compact top area.
- Replaced hardcoded blue glows on New Note with accent-derived shadows.
- Removed copy-to-clipboard button next to URL (kept clean header).
- Increased Settings panel opacity in light mode; clearer borders/shadows.
- Font controls moved back to Settings; added preview and numeric value; slider track/thumb visible in light mode.
- Behavior change: font changes apply on closing Settings, not live in the editor.
- Added two-tap delete on the same icon for notes (no inline box); All Notes live-refresh on storage changes.
 - Domain delete confirm kept inside domain header actions; All Notes per-note delete fixed by DOM-node rendering.
 - Compact note styles for Site/Page views via `data-view` attribute.
 - Dynamic search placeholder per view and conditional search clear after deletions.

- “This Page” filter now uses normalized URL comparison to include notes that point to the same page with different fragments or tracking params.
- Link highlight behavior reverted to stable retry-based flow (no `tabs.onUpdated` listener / no readiness handshake).

### Popup maintenance (Aug 18, later-later)

- __Dark mode contrast__: Ensure all popup text (inputs, headers, buttons, placeholders) uses light text on dark backgrounds. Avoid semi-transparent low-contrast text.
- __Settings initialization__: Initialize settings once during `init()` and have the gear button only call `openSettings()`. Avoid re-binding listeners on each open.
- __Export/Import listeners__: Keep export/import button listeners centralized in `setupEventListeners()` to prevent duplicates.
- __Font preference storage__: Use `chrome.storage.local` consistently for `editorFont` and `editorFontSize` (read/write).
- __CSS dedup__: Removed duplicated `.save-btn` rule block from `extension/popup/popup.css` to reduce redundancy.
