
# Siyuan Code Tabs

[English](./README.md)
## 简介
这个思源插件允许你将多种语言的代码放在一组标签页下

## 已知错误
- ！！！目前不要在代码块中包含尖括号`<>`，否则会导致代码丢失，详情见[Issue #11321 · siyuan-note/siyuan](https://github.com/siyuan-note/siyuan/issues/11321)  

## 使用示例
**提示：思源3.0.12及以上版本需要在 设置 -> 编辑器 中打开 `允许执行HTML块内脚本`**
1. 先在思源文档中插入一个代码块，内容及形式如下所示，在`tab:`后输入代码语言，之后再输入代码
   ```
   tab:c
   #include<stdio.h>
   int main(){
     printf("hello world!\n");
     return 0;
   }

   tab:java
   public class HelloWorld {
     public static void main(String[] args) {
         System.out.println("Hello World!");
     }
   }
   
   tab:python
   print("hello world!")
   ```
   ![图1](./asset/1.png)
2. 鼠标点击代码块左上角的块菜单 -> 插件 -> 将代码块转换为标签页，效果如下
   ![图2-1](./asset/2-1.png)
   ![图2-2](./asset/2-2.png)

3. 若需要编辑代码，可点击标签页右上角的 **切回代码块**，编辑完成之后再次将代码块转换为标签页即可
   ![图3](./asset/3.png)

4. 还可以通过码块左上角的块菜单 -> 插件 -> 更新当前文档所有标签页 快速将文档中的代码块标签页样式更新为当前主题样式

## 备注
- 没怎么接触过前端技术，这个插件基本上是在文心一言和ChatGPT的帮助下写出来的，后续如果不出现严重bug的话更新频率应该会很低。
- 这个插件是仿照[obsidian-code-tab](https://github.com/lazyloong/obsidian-code-tab)写的