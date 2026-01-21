示例文档（用于 code-tabs 手动回归）

---

## 新语法示例

```tab
::: Nothing
这只是个示例标签

::: c |active
// 这个标签没有指定语言，依靠 hljs 判断语言类型
// 这一行用来测试换行和连字符 --> 思源插件 code-tabs 允许你将多种语言的代码放在一组标签页下，为你的代码展示提供更优雅的解决方案。通过简洁的语法，你可以轻松创建带有标签页的代码块，支持多种编程语言。
#include<stdio.h>
int main(){
    printf("hello world\n");
    return 0;
}

::: 这是一个非常长的标题用来测试长标题
这个标签用来测试长标题时是否会自动缩略

::: 这是python|python
def hello_world():
    print("Hello, World!")

::: java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}

::: 这是javascript|javascript
console.log("Hello, World!");

::: 这是c++|cpp
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}

::: 这是c#|csharp
using System;
class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}

::: 这是php|php
<?php
echo "Hello, World!\n";
?>

::: 这是go|go
package main
import "fmt"
func main() {
    fmt.Println("Hello, World!")
}

::: 这是ruby|ruby
puts "Hello, World!"

::: 这是swift|swift
print("Hello, World!")

::: 这是kotlin|kotlin
fun main() {
    println("Hello, World!")
}

::: 这是rust|rust
fn main() {
    println!("Hello, World!");
}

::: 这是scala|scala
object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}

::: 这是r语言|r
print("Hello, World!")

::: 这是perl|perl
print "Hello, World!\n";

::: 这是haskell|haskell
main = putStrLn "Hello, World!"

::: 这是lua|lua
print("Hello, World!")

::: 这是dart|dart
void main() {
  print('Hello, World!');
}

::: 这是typescript|typescript
console.log("Hello, World!");

::: 这是objective-c|objectivec
#import <Foundation/Foundation.h>
int main() {
    @autoreleasepool {
        NSLog(@"Hello, World!");
    }
    return 0;
}
```

## 旧语法示例（兼容）

```tab
tab:::Nothing
这只是个示例标签

tab:::这是c语言:::active
lang:::c
// 这个标签没有指定语言，依靠 hljs 判断语言类型
// 这一行用来测试换行和连字符 --> 思源插件 code-tabs 允许你将多种语言的代码放在一组标签页下，为你的代码展示提供更优雅的解决方案。通过简洁的语法，你可以轻松创建带有标签页的代码块，支持多种编程语言。
#include<stdio.h>
int main(){
    printf("hello world\n");
    return 0;
}

tab:::这是一个非常长的标题用来测试长标题
这个标签用来测试长标题时是否会自动缩略

tab:::这是python
lang:::python
def hello_world():
    print("Hello, World!")

tab:::java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}

tab:::这是javascript
lang:::javascript
console.log("Hello, World!");

tab:::这是c++
lang:::cpp
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}

tab:::这是c#
lang:::csharp
using System;
class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}

tab:::这是php
lang:::php
<?php
echo "Hello, World!\n";
?>

tab:::这是go
lang:::go
package main
import "fmt"
func main() {
    fmt.Println("Hello, World!")
}

tab:::这是ruby
lang:::ruby
puts "Hello, World!"

tab:::这是swift
lang:::swift
print("Hello, World!")

tab:::这是kotlin
lang:::kotlin
fun main() {
    println("Hello, World!")
}

tab:::这是rust
lang:::rust
fn main() {
    println!("Hello, World!");
}

tab:::这是scala
lang:::scala
object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}

tab:::这是r语言
lang:::r
print("Hello, World!")

tab:::这是perl
lang:::perl
print "Hello, World!\n";

tab:::这是haskell
lang:::haskell
main = putStrLn "Hello, World!"

tab:::这是lua
lang:::lua
print("Hello, World!")

tab:::这是dart
lang:::dart
void main() {
  print('Hello, World!');
}

tab:::这是typescript
lang:::typescript
console.log("Hello, World!");

tab:::这是objective-c
lang:::objectivec
#import <Foundation/Foundation.h>
int main() {
    @autoreleasepool {
        NSLog(@"Hello, World!");
    }
    return 0;
}
```

## Markdown 渲染示例
`````tab
:::渲染|markdown-render

# 1. 标题 (1-6级)

# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

# 2. 强调 (粗体、斜体、)

_斜体_ 或 _斜体_
**粗体** 或 **粗体**
~~删除线~~
😂这是<em>html斜体</em>。这是**粗体**，这是*斜体*，这是行内代码`code`，这是~~删除线~~。 这是上标^2 2<sup>10</sup>, 这是下标~2 H<sub>2</sub>O

# 3. 列表

### 无序列表

- 项目一
- 项目二
  - 子项目 (缩进2格)

### 有序列表

1. 第一项
2. 第二项

# 4. 链接与图片

[百度](https://www.baidu.com)
![占位符](image.jpg)

# 5. 引用

> 这是一段引用
>
> > 嵌套引用

# 6. 代码

`行内代码`

### 代码块 (注意：这里直接使用三个反引号，没有转义)

```
print("这是一个代码块")

```

# 7. 表格

| 表头1   | 表头2   |
| ------- | ------- |
| 单元格1 | 单元格2 |
| 单元格3 | 单元格4 |

<table>
   <tr>
       <td>行1列1</td>
       <td colspan="2">合并两列</td>
   </tr>
   <tr>
       <td rowspan="2">合并两行</td>
       <td>行2列2</td>
       <td>行2列3</td>
   </tr>
   <tr>
       <td>行3列2</td>
       <td>行3列3</td>
   </tr>
</table>

# 8. 分割线

---

或

---

# 9. 任务列表

- [x] 已完成
- [ ] 待办

# 10. 脚注

这里是一个脚注例子[^1]

# 11. 公式

这是行内公式 $a=\sqrt{b^2+c^2}$
下面是公式块

$$
c = \pm\sqrt{a^2 + b^2}
$$

[^1]: 脚注内容。
`````

## 切回代码块示例

```tab
::: ToggleExample | js | active
const a = 1;
const b = 2;
console.log(a + b);
```

## 错误语法示例

```tab
:::
console.log("missing title")
```

```tab
::: MissingCode
```

```tab
::: OnlyTitle | js
```

```tab
NotATabsSyntax
console.log("should fail")
```

```tab
:::    
console.log("blank title")
```

```tab
::: Title | js

```

```tab
tab:::
lang::: js
console.log("missing legacy title")
```

```tab
tab::: LegacyNoLangValue
lang:::
console.log("missing lang value")
```

```tab
tab::: LegacyNoCode
lang::: js
```

```tab
tab::: LegacyNoLangLine
```
