``````
tab:::这是c语言
lang:::c
#include<stdio.h>
int main(){
   printf("hello\n");
   return 0;
}

tab:::这是c++
lang:::cpp
#include <iostream>
using namespace std;
int main()
{
    cout << "Hello, world!" << endl;
    return 0;
}

tab:::python
def hello_world():
   print("Hello World")

tab:::这是java
lang:::java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}

tab:::markdown:::active
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

tab:::这是go
lang:::go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

tab:::这是c#
lang:::c#
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

tab:::rust
fn main() {
    println!("Hello World!");
}

tab:::typescript
function greeter(person) {
    return "Hello, " + person;
}

let user = "Jane User";

document.body.innerHTML = greeter(user);

tab:::fortran
program hello
  ! This is a comment line; it is ignored by the compiler
  print *, 'Hello, World!'
end program hello

tab:::这是php
lang:::php
<!DOCTYPE html>
<html>
<body>

<?php
echo "Hello World!";
?>

</body>
</html>
``````