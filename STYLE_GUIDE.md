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

- __Filter chips (`.filter-option`)__
  - Neutral until active; active uses Apple-like segmented pill
  - Active style: `background: var(--bg-primary); border: 1px solid var(--border-color); box-shadow: inset 0 1px 0 var(--shadow-light), 0 1px 2px var(--shadow-dark)`

- __Notes list__
  - Cards (`.note-item`) use inset light border, soft hover lift, hidden delete until hover
  - Title truncation, 2-line preview via `-webkit-line-clamp`

- __Buttons__
  - Primary actions (New Note, Save):
    - Background: `var(--accent-primary)`; text: white (enforced)
    - Neutral glow: default `0 1px 2px var(--shadow-dark), inset 0 1px 0 var(--shadow-light)`
    - Hover: `background: var(--accent-secondary)` with `0 2px 8px var(--shadow-dark)`
  - Icon buttons use neutral surfaces; hover to secondary/background

## Dark Mode

- Dark tokens defined under `@media (prefers-color-scheme: dark)`.
- Do not hardcode alternate colors; derive from variables only.

## Accessibility

- Use `:focus-visible` on interactive elements.
- Maintain sufficient contrast; enforce white text on accent backgrounds.
- Tooltips on small indicators (e.g., page badge) for clarity.

## Do / Don’t

- __Do__ use color-mix with `--accent-*` for shadows/glows.
- __Do__ keep truncation with `min-width: 0` on flex items as needed.
- __Don’t__ hardcode brand blues; avoid layout shifts on hover (bolding).

## Changelog Highlights

- Tightened header/search spacing for compact top area.
- Replaced hardcoded blue glows on New Note with accent-derived shadows.
- Removed copy-to-clipboard button next to URL (kept clean header).
