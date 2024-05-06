
# Siyuan Code Tabs

[English](./README.md)
## 简介
这个思源插件允许你将多种语言的代码放在一组标签页下

## 使用示例
1. 先在思源文档中插入一个代码块，内容及形式如下所示
```
tab:c
#include<stdio.h>
int main(){
    printf("hello world\n");
    return 0;
}
tab:java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
tab:python
print("hello world")
```
![图1](./asset/1.png)
2. 鼠标点击代码块左上角的块菜单 -> 插件 -> 将代码块转换为标签页，效果如下
![图2-1](./asset/2-1.png)
![图2-2](./asset/2-2.png)
![图2-3](./asset/2-3.png)
![图2-4](./asset/2-4.png)

3. 若需要编辑代码，可点击标签页右上角的 **切回代码块**，编辑完成之后再次将代码块转换为标签页即可
![图3](./asset/3.png)