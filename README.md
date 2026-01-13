# Siyuan Code Tabs

[中文版](./README_zh_CN.md)

## Introduction

Siyuan plugin that allows you to put code in multiple languages under a set of tabs

## Known Issues

- Unable to adapt to all third-party themes.
- There must be at least one open document when changing theme or mode, otherwise the style of the code-tabs won't
  change with the theme, and you need to open a document and then change theme again.
- When exporting to markdown or html, all the code-tabs styles will be lost, only when exporting pdf or image can the
  code-tabs be displayed normally.
- The style of the code-tabs may appear abnormally when switching themes, then please try the following methods:
    - change appearance mode
    - change theme
    - Close document and reopen it
    - Try the above method again after restarting SiYuan Notes
- ***Only SiYuan 3.5.0 and above can be used normally***

## Tips

- 3.0.14 and above need to turn on `Allow execution of scripts within HTML blocks` in Settings -> Editor.
- Version 0.7.0 underwent major refactoring. Users who have extensively used this plugin before are advised to test thoroughly before updating to ensure no issues.
- **After updating the plugin, if there is a display exception, you can try toggling back to code-block and regenerating the code tabs**

## Example

1. Insert a code block in the SiYuan document as follows. Use `:::` as the beginning, followed by the `title | language | active` format.
   For example `::: title | language | active`, where `active` indicates that this tab is activated by default when the document is opened. If this flag is not added,
   the first tab is activated by default. The language parameter is optional, if omitted it will use the title as the default language for the code. [Example file](./asset/example.md)
    - When the language is `markdown-render`, [marked](https://github.com/markedjs/marked) will be used for rendering.
      Rendering [Katex formulas](https://katex.org)
      with [marked-katex-extension](https://github.com/UziTech/marked-katex-extension), Rendering code blocks
      with siyuan's built-in hljs.
   ```
   ::: this is c | c | active
   #include<stdio.h>
   int main(){
   printf("hello\n");
   return 0;
   }
   
   ::: python
   def hello_world():
   print("Hello World")
   ```

2. Click the block menu in the upper-left corner of the code-block -> Plugin -> `Block: code-block -> tabs`, you can also
   set a shortcut key for this function in Settings -> Keymap. The other two functions in the block menu perform batch conversion and restoration based on the current document.
   ![fig2](./asset/2.gif)

3. If you need to edit the code, you can click on "Toggle to code-block" in the upper-right corner of the tab. After
   editing, convert the code block back to code-tabs again.
   ![fig3](./asset/3.png)
4. You can copy the code in one click by clicking the copy button in the upper right corner(Copy plaintext only).  
   ![fig4](./asset/4.png)
5. If there are too many tabs, some of the tabs will be hidden, in the desktop application, you can put the mouse cursor
   on the tabs bar and use the mouse wheel to scroll through them, and in the mobile application, you can slide the tabs
   bar left and right to view them.
6. Demo.  
   ![fig5](./asset/demo.gif)
7. Due to the complexity of third-party themes, version 0.7.0 adds a custom configuration file that allows users to adapt themes themselves. The configuration file path is `SiYuan workspace/data/plugins/code-tabs/custom/theme-adaption.yaml`. You can adapt themes to your needs by following the examples and using developer tools. You can also submit a PR to this repository with your adapted theme, the repository's adaptation file path is `/public/asset/theme-adaption.yaml`

## Comment

- Essentially, this plugin was written with the help of Wenxin Yiyan and ChatGPT.
- This plugin was developed following the example of [obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)
- The version of SiYuan Notes at the time of testing: 3.5.0

## Changelog

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