示例文档（用于 code-tabs 手动回归）

---

## 新语法示例

```tab
::: JavaScript | javascript | active
console.log("hello");

::: Python | python
print("hello")
```

## 多标签示例（滚动）

```tab
::: Tab-1 | js | active
console.log("tab1")

::: Tab-2 | js
console.log("tab2")

::: Tab-3 | js
console.log("tab3")

::: Tab-4 | js
console.log("tab4")

::: Tab-5 | js
console.log("tab5")

::: Tab-6 | js
console.log("tab6")

::: Tab-7 | js
console.log("tab7")

::: Tab-8 | js
console.log("tab8")
```

## 旧语法示例（兼容）

```tab
tab::: JS
lang::: js
console.log("legacy")

tab::: Python
lang::: python
print("legacy")
```

## Markdown 渲染示例

```tab
::: markdown-render | markdown-render
# Title
- item 1
- item 2
```

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
