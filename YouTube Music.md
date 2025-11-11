---
title: "YouTube Music"
source: "https://music.youtube.com/"
author:
  - "[[YouTube Music]]"
published:
created: 2025-10-29
description: "With the YouTube Music app, enjoy over 100 million songs at your fingertips, plus albums, playlists, remixes, music videos, live performances, covers, and hard-to-find music you can’t get anywhere else."
tags:
  - "clippings"
---
![](https://www.youtube.com/watch?v=embed)


3. Add rel="noopener" to external links (Security)
Prevents security vulnerability when opening external sites

4. Add loading states with aria-busy (Accessibility)
Screen readers announce when content is loading

5. Add spellcheck="true" to note editor (UX)
Browser spell-check for note content

6. Add inputmode attributes (Mobile UX)
Better mobile keyboard for email/search inputs

7. Add meta theme-color (Polish)
Extension matches system theme in browser chrome

8. Add prefers-reduced-motion support (Accessibility)


Implementation Plan: Single Note Export with "Open in App"
Overview
Add dropdown to single note export button with multiple format options and direct app integration for Obsidian.

Phase 1: UI Changes 
1.1 Convert Export Button to Dropdown while maintaing xss security and our gpu acceleration.
Change single export button to button group (main button + dropdown trigger)
Add dropdown menu with 4 options:
Download as TXT (current default)
Download as Markdown
Open in Obsidian
open in notion
1.2 Add Dropdown Styling
Reuse existing liquid glass themes and deisng with rounded buttons and sytles.
Position menu below button, aligned right
Add hover states and transitions
1.3 Add Obsidian Setting
Add "Obsidian Vault Name" input field in Settings panel
Include helper text explaining it's for "Open in Obsidian" feature
Save value to storage on change
Phase 2: JavaScript Logic
2.1 Update Event Handlers
Main export button: Default to TXT download
Dropdown trigger: Toggle menu visibility
Menu options: Call export function with selected format we can use logic from export format class to export but with the current text of the note.
Close dropdown after selection
Accept format parameter (txt, markdown, obsidian, notion)
Route to appropriate handler based on format
Keep existing validation (check if note exists)
2.4 Add Obsidian Integration (NEW)
Check if vault name is set in settings
If not set: Show warning, auto-open settings
Convert note to Obsidian format (reuse existing converter)
Check content length (URI limit ~1500 chars)
If too long: Fallback to file download
If OK: Construct Obsidian URI and open in new window
Show success toast
2.6 Settings Integration
Load saved vault name on settings panel open
Save vault name to storage on input change
Show confirmation toast on save
Phase 3: Code Reuse
What's Reused (95%):
All format conversion methods (toTXT, toMarkdown, toObsidian)
exportToFormat() routing logic
convertContentForFormat() for content transformation
File download blob creation and trigger
Storage API (chrome.storage.local for main, browserAPI for Firefox/Edge)
What's New (5%):
Dropdown UI HTML/CSS
openInObsidian() function with URI construction
Vault name setting UI and save logic
Event handlers for dropdown interactions
Features Delivered
Download as TXT - Current behavior (default)
Download as Markdown - New format option
Open in Obsidian - Direct app integration via URI protocol
Limitations & Fallbacks
Obsidian URI length limit: Notes >1500 chars fallback to file download
Obsidian must be installed: No way to detect, user gets error if not installed
Vault name required: User must configure once in settings
Main extension uses chrome.storage.local
Firefox/Edge versions use browserAPI.storage.local
When porting features between versions, update storage API calls accordingly
