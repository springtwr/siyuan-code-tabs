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

### v2.0.3

- Fixed undo not working after inserting spaces with Tab in the editor panel
- Fixed CSS variable injection polluting the html element

### v2.0.2

- Fixed mobile IME popping up when switching tabs or opening the editor panel
- Fixed mobile language suggestions not responding to taps
- Fixed commands showing "undefine" in the terminal
- Added icons to the block menu

### v2.0.1

- Fixed an issue where block menu actions could select all tabs instead of only the selected range

### v2.0.0

- Major upgrade: no longer uses code blocks as an intermediate format
- Added an editor panel to add or remove tabs directly

For the full history, see [CHANGELOG.md](CHANGELOG.md).
