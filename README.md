
# Siyuan Code Tabs

[中文版](./README_zh_CN.md)
## Introduction
Siyuan plugin that allows you to put code in multiple languages under a set of tabs

## Known Issues
- Every time the document is closed, the tab will automatically jump to the first tab.
- Code highlighting is not supported in markdown, and clicking the copy button will only copy plaintext.
- There must be at least one open document when changing theme or mode, otherwise the style of the code-tabs won't change with the theme, and you need to open a document and then change theme again.  
- The background color of the code-tabs will not change until the currently open document is closed and reopened after changing the theme or mode.  
- When exporting to markdown or html, all the code-tabs styles will be lost, only when exporting pdf or image can the code-tabs be displayed normally.  

## Tips
- 3.0.14 and above need to turn on `Allow execution of scripts within HTML blocks` in Settings -> Editor.
- v0.2.0 is not compatible with previous versions and the writing format has changed, previously generated code-tabs need to be modified or deleted

## Example
1. Insert a code block in the SiYuan document as follows. Enter the title after `tab:::`, and the language after `lang:::`. If "lang:::language" is omitted, the title is used as the default language for the code. [Example file](./asset/example.md)
   - When the language is `markdown`, [marked](https://github.com/markedjs/marked) will be used for rendering, and [marked-katex-extension](https://github.com/UziTech/marked-katex-extension) will be used to render [Katex](https://katex.org). Code block highlighting is not currently supported within markdown.
   ```
   tab:::this is c
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

2. Click the block menu in the upper-left corner of the code-block -> Plugin -> Convert code-block to tabs
   ![fig2-1](./asset/2-1.png)
   ![fig2-2](./asset/2-2.png)
   ![fig2-3](./asset/2-3.png)

3. If you need to edit the code, you can click on "Toggle to code-block" in the upper-right corner of the tab. After editing, convert the code block back to code-tabs again.
   ![fig3](./asset/3.png)
4. You can copy the code in one click by clicking the copy button in the upper right corner  
   ![fig4](./asset/4.png)

## Comment
- Essentially, this plugin was written with the help of Wenxin Yiyan  and ChatGPT. If no serious bugs arise, the update frequency should be quite low.
- This plugin was developed following the example of [obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)