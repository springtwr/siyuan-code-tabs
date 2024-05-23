``````
tab:::这是c语言
lang:::c
#include<stdio.h>
int main(){
    printf("hello world\n");
    return 0;
}

tab:::java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}

tab:::python
def hello_world():
    print("Hello World")

tab:::这是html
lang:::html
<html>
    <head>
        <title>test</title>
    </head>
    <body>
        <h1> this is a test </h1>
    </body>
</html>

tab:::这是markdown
lang:::markdown
# 标题1
## 标题2 
这是**粗体**，这是*斜体*，这是行内代码`code`， 这是行内公式 $a=\sqrt{b^2+c^2}$，这是~~删除线~~，这是[链接](https://github.com)。  
下面是分割线，注意前面要有空行  

---

- 我是无序列表
    - 我是它孩子
- 我是它弟弟

1. 我是有序列表
    1. 我是它孩子
2. 我是它弟弟

下面是公式块，注意前面要有空行 
 
$$
c = \pm\sqrt{a^2 + b^2}
$$
不支持代码块高亮

```c
#include<stdio.h>
int main(){
    print("hello\n");
    return 0;
}
``` 
``````