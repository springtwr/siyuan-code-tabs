
# Siyuan Code Tabs

[中文版](./README_zh_CN.md)
## Introduction
Siyuan plugin that allows you to put code in multiple languages under a set of tabs

## Known Issues
- Unable to adapt to all third-party themes.
- There must be at least one open document when changing theme or mode, otherwise the style of the code-tabs won't change with the theme, and you need to open a document and then change theme again.
- When exporting to markdown or html, all the code-tabs styles will be lost, only when exporting pdf or image can the code-tabs be displayed normally.  
- In rare cases, the style of code-tabs may not change with the theme and mode. In such cases, please try this:
  - change mode
  - change theme
  - Close document and reopen it
  - Try the above method again after restarting SiYuan Notes
- ***When the code contains angle brackets, an error is displayed. Please wait for Siyuan to release a new version to fix the issue of escaping HTML content. Currently, only Siyuan 3.0.14 can be used normally. For details, see [issue](https://github.com/siyuan-note/siyuan/issues/11499)***

## Tips
- 3.0.14 and above need to turn on `Allow execution of scripts within HTML blocks` in Settings -> Editor.
- v0.2.0 is not compatible with previous versions and the writing format has changed, previously generated code-tabs need to be  deleted.
- The code of v0.3.0 has been changed significantly, you need to  click ***Any block*** upper left corner of the block menu -> Plugins -> Fix all code-tabs in opened documents before it works properly.
- Since version 0.3.0, all functions have basically achieved the expected goals (temporarily not considering the implementation of the `Code block line number`). Future updates will mainly focus on bug fixes and style optimizations.

## Example
1. Insert a code block in the SiYuan document as follows. Enter the title after `tab:::`, and then add `:::active` to indicate that this tab is activated by default when the document is opened. If this flag(`:::active`) is not added, the first tab is activated by default. Enter the language after `lang:::`. If "lang:::language" is omitted, the title is used as the default language for the code. [Example file](./asset/example.md)
   - When the language is `markdown`, [marked](https://github.com/markedjs/marked) will be used for rendering. Rendering [Katex formulas](https://katex.org) with [marked-katex-extension](https://github.com/UziTech/marked-katex-extension), Rendering code blocks with [marked-highlight](https://github.com/markedjs/marked-highlight).
   ```
   tab:::this is c:::active
   lang:::c
   #include<stdio.h>
   int main(){
   printf("hello\n");
   return 0;
   }
   
   tab:::this is python
   lang:::python
   def hello_world():
   print("Hello World")
   ```

2. Click the block menu in the upper-left corner of the code-block -> Plugin -> Convert code-block to tabs, you can also set a shortcut key for this function in Settings -> Keymap.
   ![fig2-1](./asset/2-1.png)
   ![fig2-2](./asset/2-2.png)
   ![fig2-3](./asset/2-3.png)

3. If you need to edit the code, you can click on "Toggle to code-block" in the upper-right corner of the tab. After editing, convert the code block back to code-tabs again.
   ![fig3](./asset/3.png)
4. You can copy the code in one click by clicking the copy button in the upper right corner(Copy plaintext only).  
   ![fig4](./asset/4.png)

## Comment
- Essentially, this plugin was written with the help of Wenxin Yiyan  and ChatGPT.  
- This plugin was developed following the example of [obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)

## Changelog
### v0.3.0
- Optimize CSS display effects.
- Adapt the code-tabs to support more themes.
- Now you can specify the default active tab when the document is opened.
- Fixed a few bugs.