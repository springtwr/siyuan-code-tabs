````
::: 这是c语言 | c
#include<stdio.h>
int main(){
   printf("hello\n");
   return 0;
}

::: 这是c++ | cpp
#include <iostream>
using namespace std;
int main()
{
    cout << "Hello, world!" << endl;
    return 0;
}

:::python
def hello_world():
   print("Hello World")

:::这是java|java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}

:::markdown|active
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
支持代码块高亮

```c
#include<stdio.h>
int main(){
    print("hello\n");
    return 0;
}
```

:::渲染markdown|markdown-render
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

::: 这是go | go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

:::这是c# | c#
using System;
namespace HelloWorldApplication
{
    class HelloWorld
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Hello World!");
            Console.ReadKey();
        }
    }
}

:::rust
fn main() {
    println!("Hello World!");
}

:::typescript
function greeter(person) {
    return "Hello, " + person;
}

let user = "Jane User";

document.body.innerHTML = greeter(user);

:::fortran
program hello
  ! This is a comment line; it is ignored by the compiler
  print *, 'Hello, World!'
end program hello

:::这是php|php
<!DOCTYPE html>
<html>
<body>

<?php
echo "Hello World!";
?>

</body>
</html>
````
