# 标签页新块化实施清单（草案）

> 目标：以 HTML 块 + 自定义属性实现“标签页块”，逐步摆脱代码块语法中转，同时保留兼容与可回退路径。
> 说明：此清单用于确认方案，不直接代表当下实施顺序；待细节确认后再执行。

## 已确认的关键决策

- 标签数据存放在 HTML 块自定义属性中，存储格式采用 **Base64(JSON)**（暂不设长度阈值）。
- 标签页 → 代码块：直接生成多个标准代码块。
- tabWidth 不是固定 px，而是“最大宽度 = N 个字”（建议以 `ch` 计算）。
- 新增 / 删除 / 排序必须在标签页状态下完成，不能依赖代码块中转。

## 一、数据模型与存储（基础层）

### 1.1 自定义属性结构（建议）

建议结构（版本化）：

```json
{
  "version": 2,
  "active": 0,
  "tabWidth": { "mode": "auto", "maxChars": 12 },
  "tabs": [{ "title": "Tab1", "lang": "plaintext", "code": "在这里输入代码" }]
}
```

说明：

- `version`：用于迁移与兼容。
- `active`：默认激活索引。
- `tabWidth`：
  - `mode`: `auto` | `max-chars`
  - `maxChars`: 数值（配合 CSS `max-width: ${n}ch`）。
- `tabs`：真正的内容数据。

### 1.2 自定义属性存储格式（定稿 + 备选对比）

问题点：

- 自定义属性过长可能污染 DOM；
- 思源自定义属性对特殊字符可能有约束；
- HTML 块内容已包含大量转义，属性层面需要更稳妥的编码。

候选方案对比：

1. **Base64(JSON)**（当前选择）
   - 优点：规避特殊字符、结构清晰、实现简单、与现有属性体系兼容
   - 缺点：体积膨胀、难以手工查看
   - 适合：当前阶段快速落地
2. **SQLite（或轻量数据库）**
   - 优点：容量大、可查询、可扩展（适合多块统一管理）
   - 缺点：需要额外 IO 与索引、同步复杂（块删除/撤销/复制需清理映射）
   - 风险：一致性难保证（尤其是跨文档复制、移动、导出/导入）
3. **JSON 直接写入**
   - 优点：可读性好
   - 缺点：转义与长度风险最大
4. **分片 + 多属性**
   - 优点：突破长度限制
   - 缺点：读写复杂、调试成本高

结论：

- 先采用 **Base64(JSON)**，避免引入数据库复杂度；
- 若后续出现超长需求，再评估“分片”或“落盘文件”。

### 1.3 数据读写入口

新增 `src/modules/tabs/TabDataManager.ts`：

- `readFromAttr(nodeId | element): TabsData | null`
- `writeToAttr(nodeId, TabsData)`
- `migrateFromLegacy(syntaxString): TabsData`
- `validate(data): { ok, errors }`

说明：
只处理数据结构与迁移，不做 DOM 与 UI。  
需要封装：编码/解码、长度校验、异常提示。

### 1.4 旧语法兼容（更详细）

识别来源优先级：

1. **新属性数据**（主路径）
2. **旧 HTML 块属性**（如 `custom-plugin-code-tabs-sourcecode`）
3. **旧语法文本**（`tab:::` / `lang:::`）
4. **新语法文本**（`::: title | lang | active`）

迁移流程：

- 解析任意旧来源 → 生成 `TabsData` → 写回新属性。
- 若检测到多 active，阻止生成并提示用户。
- 旧语法中 HTML 实体（如 `&lt;`）需还原后再入库。

回退策略：

- 保留“还原为代码块”入口，作为兼容与导出路径。

## 二、渲染与交互（展示层）

### 2.1 TabRenderer 只接收新结构

重构 `TabRenderer.createProtyleHtml(data)`：

- 只依赖 `TabsData`，不再读旧语法。
- `tabWidth` 输出 CSS 变量：
  - `--code-tabs-max-width: ${maxChars}ch`
- 保留现有颜色、图标与行号逻辑。

### 2.2 TabManager 统一入口

新增/改造方法：

- `getTabsDataFromNode(nodeId | element)`：先读属性，不存在则迁移。
- `updateTabsData(nodeId, data)`：更新属性 + 生成 HTML + updateBlock + 重载。

交互行为统一走 `updateTabsData`。

## 三、编辑器（当前必须实现新增/删除/排序）

### 3.1 编辑按钮

位置：默认按钮与复制按钮中间  
行为：

- 弹窗中显示标题、语言、代码三个字段。
- 支持新增 / 删除 / 排序（不改变 active）。

### 3.2 弹窗表单（单 tab 编辑 + 列表操作）

内容：

- 标题：输入框
- 语言：输入框（后续支持与思源一致的联想列表）
- 代码：多行文本框（默认展开）
- 标签列表：支持新增 / 删除 / 排序（可拖拽或上下移动按钮）

校验：

- 标题不可为空
- 代码不可为空

保存流程：

1. 读取 `TabsData` → 找到当前 tab
2. 更新 `title/lang/code`
3. `updateTabsData(nodeId, data)` → 重载

## 四、新建标签页块（斜杠菜单）

### 4.1 插入默认块

斜杠菜单新增 “标签页”（使用 `this.protyleSlash`）：
插入 HTML 块 + 默认数据：

- 标题：`Tab1/2/3...`
- 语言：`plaintext`
- 代码：`在这里输入代码`
- active：0
- tabWidth：auto + maxChars 默认值（12），上限 20

### 4.2 与设置/主题联动

插入后应自动应用：

- active color
- 主题样式
- 行号规则（若启用）

## 五、转换与还原（摆脱语法中转）

### 5.1 代码块 → 标签页

输入：一个或多个标准代码块  
输出：单个 HTML 块（TabsData）

规则：

- 每个代码块转为一个 tab
- 语言来自代码块语言
- 标题默认 `Tab1/2/3...` 或从代码块属性 `codeTabTitle` 读取（若存在）

### 5.2 标签页 → 代码块

直接生成多个标准代码块：

- 每个 tab → 一个代码块
- 语言 = tab.lang
- 内容 = tab.code
- 同时写入代码块属性 `codeTabTitle`，保存原标签标题

## 六、tabWidth（最大字数）方案

### 6.1 UI 与存储

设置方式（块级）：

- `auto`
- `max-chars` + 输入数值

### 6.2 渲染方式

在 `.tab-item` 上设置：

- `max-width: var(--code-tabs-max-width);`
- `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`

限制建议：

- 最小值：3（不低于 2~3 个字的体验底线）
- 最大值：20
- 默认：12（对应当前 `max-width: 12em` 的体验）

## 七、后续优化（非必须）

- 语言输入联想（与思源一致的匹配列表）
- 编辑器 UI 的可视化强化（左右布局或可折叠）
- 仅重渲染块的轻量刷新（减少全局重载）

## 八、测试与回归清单补充

新增单测（尽量纯逻辑）：

- `TabDataManager`：迁移/验证/读写
- `TabParser`：旧语法迁移保持

手动回归：

- 斜杠菜单插入空标签页
- 编辑当前 tab（标题/语言/代码）
- 新增 / 删除 / 排序
- 代码块 → 标签页（多块合并）
- 标签页 → 多代码块还原
- tabWidth 最大字数显示效果

## 九、风险与注意事项

- `updateBlock` 后仍需重载文档（现阶段保证稳定）
- 旧语法迁移必须可靠，否则老文档会失效
- tabWidth `ch` 在不同字体下宽度略有差异，但符合“按字宽估算”的需求
- 自定义属性长度需控管，否则可能污染 DOM 或写入失败
