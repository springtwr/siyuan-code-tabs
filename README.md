# Siyuan Code Tabs

[中文版](./README_zh_CN.md)

A SiYuan plugin that organizes multi-language code into clean, switchable tabs.

## Features

- Tabbed code blocks with quick editing
- Tab editor panel: add, remove, rename, change language, and edit code
- Set a default tab and copy current tab code
- Batch actions: merge code blocks, split tabs into code blocks (block/document/global)
- Theme adaptation support

## Compatibility

- **Requires SiYuan 3.5.0+**
- Enable: Settings -> Editor -> `Allow execution of scripts within HTML blocks`

## Quick Start

1. Insert a default tab block via slash menu `Tabs` / `tab` / `bq`
2. Or select multiple code blocks and use block menu `Block: merge selected code blocks`
3. Click **Edit** in the top-right corner of the tab block

## Usage

1. **Edit tabs**
   - Update title, language, and code
   - Add/remove tabs
   - `markdown-render` uses SiYuan’s Lute renderer, supporting KaTeX / Mermaid / Graphviz / PlantUML / ABC
2. **Set default**
   - Click **Set default** to make the current tab the default
3. **Copy**
   - Click **Copy** to copy the current tab’s code
4. **More actions (block menu)**
   - `Block: merge selected code blocks`
   - `Block: split tabs into code blocks`
   - `Document: split tabs into code blocks`
5. **Settings panel (global)**
   - `Split all code-tabs into code blocks` (for recovery when deprecating the plugin)
   - `Migrate legacy tabs` (upgrade legacy tabs to the new version)

## Theme Adaptation

- If styles look wrong, try:
  - Switching appearance mode / theme
  - Closing and reopening documents
  - Restarting SiYuan
- Customize theme adaptation:
  - Path: `SiYuan workspace/data/plugins/code-tabs/custom/theme-adaption.yaml`
  - Reference: `/public/asset/theme-adaption.yaml`

## Data Notes

- Raw tab data is stored as Base64 in custom block attributes
- Data can be recovered as long as attributes remain

## Known Issues

- Not guaranteed to fit all third-party themes
- Styles are lost when exporting to markdown / HTML
- PDF/image exports keep styles but tabs are not switchable

## Demo

![slash](./images/demo_slash.png)

![Preview](./images/demo_preview.png)

![Edit](./images/demo_edit.png)

## Notes

- Built with AI assistance
- Inspired by [obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)
- Tested with SiYuan 3.5.3

## Changelog

### v1.1.2

- Fixed an issue where submenus in the block menu would disappear

### v1.1.1

- Fixed a text error in the plugin's shortcut settings

### v1.1.0

- Added “Tabs → standard code blocks” split (block/document/global entries)
- Added “Merge selected code blocks” into tab-syntax code blocks
- Added “More [code-tabs]” submenu to organize block menu actions

### v1.0.0

- Refactored theme style collection and application; theme switching no longer requires at least one open document
- Added line number display and styling; code tabs now show line numbers when enabled in code blocks
- Adapted code block scrollbars for some themes
- Partial style adjustments and optimizations

### v0.8.0

- Synchronized `Code block ligature` and `Code block wraps` settings
- Added `markdown-render` type tab; switch between `markdown` / `markdown-render` to control markdown rendering
- Partial style adjustments and optimizations

### v0.7.0

- **Major update: Syntax format change** - Changed from old `tab:::title:::active` and `lang:::language` syntax to new `::: title | language | active`
- Compatibility with old syntax; converting back to code blocks updates old syntax to the new format
- Added theme adaptation file for third-party themes
- Implemented bidirectional batch conversion between code blocks and code tabs
- Changed source storage to Base64 encoding
- Updated dependencies; code highlighting now uses SiYuan’s built-in hljs
- Added settings entry; moved global conversion from block menu to settings panel
- Optimized theme change detection; fixed DOM refresh issues
- Fixed inconsistent width between tabs and code blocks
- Fixed angle bracket loss issue

### v0.6.2

- Fix missing line breaks when toggling back to code blocks
- Adjust spacing between tags and code in some themes

### v0.6.1

- Adjust the minimum width of the tag

### v0.6.0

- Copy button can now copy markdown
- Swipe left/right to view tabs on mobile
- Fixed copy button not working when using docker
- Optimized tab styles

### v0.5.0

- Optimized display and adapted more themes
- Fixed docker display anomalies caused by CORS
- Fixed padding being too small

### v0.4.2

- Support for docker

### v0.4.1

- Checks if “Allow execution of scripts within HTML blocks” is enabled on load

### v0.4.0

- Fixed angle bracket escaping
- Limited tab title length and added horizontal scrollbar for many tabs
- Adjusted font size for plaintext and markdown code blocks

### v0.3.0

- Optimized CSS display
- Adapted code-tabs to support more themes
- Added default active tab on document open
- Fixed a few bugs
