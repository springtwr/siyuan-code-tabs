# Siyuan Code Tabs

[中文版](./README_zh_CN.md)

## Introduction

Siyuan plugin that allows you to put code in multiple languages under a set of tabs

## Known Issues

- Unable to adapt to all third-party themes.
- When exporting to markdown or html, all the code-tabs styles will be lost, only when exporting pdf or image can the
  code-tabs be displayed normally.
- The style of the code-tabs may appear abnormally when switching themes, then please try the following methods:
  - change appearance mode
  - change theme
  - Close document and reopen it
  - Try the above method again after restarting SiYuan Notes
- **_Only SiYuan 3.5.0 and above can be used normally_**

## Tips

- Please enable `Allow execution of scripts within HTML blocks` in Settings -> Editor.
- All raw tab data is stored as Base64 in custom attributes. As long as the attributes remain, data can be recovered even if the UI breaks.
- v2.0.0 provides a tab editor panel and removes “Toggle to code-block”. Please use the **Edit** button.

## Usage

1. Insert a default tab block via the slash menu `Tabs`/`tab`/`bq`, or select multiple code blocks and use “Block: merge selected code blocks”.
2. Click the **Edit** button to modify tab title, language, and code. You can also add/remove tabs.
   - When the language is `markdown-render`, SiYuan’s built-in Lute handles markdown and supports KaTeX / Mermaid / Graphviz / PlantUML / ECharts / Flowchart / Mindmap / ABC.
3. Click **Set default** to make the current tab the default.
4. Click **Copy** to copy the current tab’s code.
5. More block menu actions are available:
   - `Block: merge selected code blocks`: merge multiple code blocks into tabs
   - `Block: split tabs into code blocks`: split a tab block into multiple code blocks
   - `Document: split tabs into code blocks`: split all tabs in the current document
6. The settings panel provides a global entry: `Split all code-tabs into standard code blocks` (for recovering when deprecating the plugin).
7. The settings panel provides a legacy migration entry: `Migrate legacy tabs` (migrate `custom-plugin-code-tabs-sourcecode` to the new format).
8. If there are too many tabs, some will be hidden. Use the “More” tab to view them.
9. Demo.  
   ![fig5](./images/demo.gif)
10. Due to the complexity of third-party themes, version 0.7.0 adds a custom configuration file for theme adaptation. The config file path is `SiYuan workspace/data/plugins/code-tabs/custom/theme-adaption.yaml`. Follow the examples and use developer tools to adapt themes. You can also submit a PR; the repo adaptation file path is `/public/asset/theme-adaption.yaml`.

## Comment

- Essentially, this plugin was written with the help of Wenxin Yiyan and ChatGPT.
- This plugin was developed following the example of [obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)
- The version of SiYuan Notes at the time of testing: 3.5.3

## Changelog

### v1.1.2

- Fixed an issue where submenus in the block menu would disappear

### v1.1.1

- Fixed a text error in the plugin's shortcut settings.

### v1.1.0

- Added “Tabs → standard code blocks” split (block/document/global entries)
- Added “Merge selected code blocks” into tab-syntax code blocks
- Added “More [code-tabs]” submenu to organize block menu actions

### v1.0.0

- Refactored theme style collection and application; theme switching no longer requires at least one open document.
- Added line number display and styling; code tabs now show line numbers when enabled in code blocks.
- Adapted code block scrollbars for some themes.
- Partial style adjustments and optimizations.

### v0.8.0

- Synchronized `Code block ligature` and `Code block wraps` settings
- Added `markdown-render` type tab, now you can control whether markdown is rendered in the tab by switching between `markdown` / `markdown-render` languages
- Partial style adjustments and optimizations

### v0.7.0

- **Major update: Syntax format change** - Changed from the old `tab:::title:::active` and `lang:::language` syntax to the new `::: title | language | active` syntax
- Compatibility with old syntax, when reverting from code tabs back to code blocks it will automatically update the old syntax format to the new syntax format
- Added theme adaptation file, allowing users to adapt third-party themes themselves
- Implemented bidirectional batch conversion functionality between code blocks and code tabs
- Modified source code storage method, changed to Base64 encoding for storing source code
- Updated dependencies, code highlighting now uses siyuan's built-in hljs
- Added settings item, moved global conversion functionality from block menu to settings panel
- Optimized theme change detection method, fixed DOM refresh issues
- Fixed the issue of inconsistent width between tabs and code blocks
- Fixed angle bracket loss issue

### v0.6.2

- Fix missing line breaks when "Toggle to code-block".
- Adjust spacing between tags and code in some themes.

### v0.6.1

- Adjust the minimum width of the tag.

### v0.6.0

- Copy button can now copy markdown.
- Swipe left or right to view tags when there are too many tags on mobile.
- Fixed the problem that the copy button doesn't work when using docker.
- Optimize tag style.

### v0.5.0

- Optimize the display effect and adapt more themes.
- Fix display anomalies when using docker that may be caused by CORS issues.
- Fix padding being too small.

### v0.4.2

- Support for docker.

### v0.4.1

- The plugin checks if the Allow execution of scripts within HTML blocks is turned on when it loads.

### v0.4.0

- Fix the problem of escaping pointed brackets.
- Limit the length of tab title and add horizontal scroll bar automatically when there are too many tabs.
- Adjust the font size of plaintext and code blocks in markdown.

### v0.3.0

- Optimize CSS display effects.
- Adapt the code-tabs to support more themes.
- Now you can specify the default active tab when the document is opened.
- Fixed a few bugs.
