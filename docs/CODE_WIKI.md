# Code Wiki: siyuan-code-tabs

## 项目概述

`code-tabs` 是一个思源笔记(SiYuan)插件，允许用户将多种语言的代码组织成可切换的标签页形式。该插件支持代码块与标签页之间的双向转换、主题样式自适应、行号显示等功能。

### 核心特性

- **Tabbed code blocks**: 支持多语言代码块在同一容器中切换
- **Tab editor panel**: 可视化添加、删除、重命名标签页
- **Default tab setting**: 可设置默认打开的标签页
- **Batch operations**: 支持合并代码块、拆分标签页
- **Theme adaptation**: 自动适配思源笔记主题样式

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      CodeTabs Plugin                            │
│  ┌─────────────┐                                               │
│  │   index.ts  │  ← 插件入口，生命周期管理                       │
│  └──────┬──────┘                                               │
│         │                                                       │
│  ┌──────▼──────┬─────────────────────────────────────────────┐  │
│  │   Modules   │                                             │  │
│  │             │                                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  tabs/      │  │  theme/     │  │  settings/      │   │  │
│  │  │ - TabManager│  │ - Theme     │  │ - SettingsPanel │   │  │
│  │  │ - TabRender │  │   Manager   │  └─────────────────┘   │  │
│  │  │ - TabDataSvc│  │ - ThemeObs  │  ┌─────────────────┐   │  │
│  │  │ - TabTrans  │  │ - StyleProbe│  │  command/       │   │  │
│  │  │ - TabEditor │  └─────────────┘  │ - CommandManager│   │  │
│  │  └─────────────┘                   └─────────────────┘   │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  protyle/   │  │  editor/    │  │  line-number/   │   │  │
│  │  │ - Lifecycle │  │ - Refresh   │  │ - LineNumberMgr │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────▼──────┐                                               │
│  │    api/     │  ← 思源API封装                                │
│  │    utils/   │  ← 通用工具函数                               │
│  │    types/   │  ← 类型定义                                   │
│  │ constants/  │  ← 常量定义                                   │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 模块职责说明

| 模块 | 职责 | 文件位置 |
|------|------|----------|
| **Tabs** | 标签页核心逻辑 | `src/modules/tabs/` |
| **Theme** | 主题样式管理 | `src/modules/theme/` |
| **Settings** | 设置面板 | `src/modules/settings/` |
| **Command** | 命令注册 | `src/modules/command/` |
| **Protyle** | 编辑器生命周期 | `src/modules/protyle/` |
| **Editor** | 编辑器刷新 | `src/modules/editor/` |
| **LineNumber** | 行号管理 | `src/modules/line-number/` |

---

## 核心类型定义

### Tabs 数据结构

```typescript
// src/modules/tabs/types.ts

export type CodeTab = {
    title: string;        // 标签标题
    language: string;     // 代码语言
    code: string;         // 代码内容
    isActive: boolean;    // 是否为活动标签
};

export type TabDataItem = {
    title: string;        // 标签标题
    lang: string;         // 代码语言
    code: string;         // 代码内容
};

export type TabsData = {
    version: number;      // 数据版本号
    active: number;       // 默认活动标签索引
    tabs: TabDataItem[];  // 标签数组
};
```

### 主题样式类型

```typescript
// src/modules/theme/types.ts

export type ThemeStyle = {
    // 字体相关
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    color: string;
    
    // 边框与阴影
    border: string;
    borderLeft: string;
    borderRadius: string;
    boxShadow: string;
    
    // 内外边距
    blockPadding: string;
    blockMargin: string;
    
    // 背景色
    blockBg: string;
    protyleActionBg: string;
    hljsBg: string;
    
    // 代码高亮
    hljsPadding: string;
    hljsMargin: string;
    hljsBorderTop: string;
    hljsOverflowY: string;
    hljsMaxHeight: string;
    
    // 编辑区域
    editablePadding: string;
    
    // 头部区域
    protyleActionPosition: string;
    protyleActionBorderBottom: string;
};
```

---

## 核心模块详解

### 1. TabManager（标签页交互管理）

**职责**：管理标签页的交互逻辑，注册全局函数供HTML块调用。

**核心方法**：

| 方法 | 功能 | 参数 |
|------|------|------|
| `initGlobalFunctions` | 初始化全局交互函数 | `i18n`, `onReload` |
| `cleanup` | 清理资源 | - |

**全局函数暴露**（挂载到 `window.pluginCodeTabs`）：

```typescript
const pluginCodeTabs = {
    codeBlockStyle: StyleProbe,      // 样式探针
    openTag: (evt) => { ... },       // 切换标签
    copyCode: async (evt) => { ... }, // 复制代码
    setDefault: async (evt) => { ... }, // 设置默认标签
    editTab: async (evt) => { ... }, // 打开编辑面板
    refreshEcharts: async (evt) => { ... }, // 刷新图表
    refreshOverflow: (root) => { ... }, // 刷新溢出状态
};
```

**位置**：`src/modules/tabs/TabManager.ts`

---

### 2. TabRenderer（HTML渲染器）

**职责**：生成标签页的HTML结构，处理代码高亮与第三方库渲染。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `createProtyleHtml` | 生成完整的tabs HTML块 |
| `ensureLibraryLoaded` | 确保第三方库已加载 |
| `renderMarkdown` | Markdown内容二次渲染 |
| `renderMath` | KaTeX公式渲染 |
| `renderMermaid` | Mermaid图表渲染 |
| `renderCode` | 代码高亮渲染 |
| `renderAbc` | ABC五线谱渲染 |
| `renderPlantUML` | PlantUML渲染 |
| `renderGraphviz` | Graphviz渲染 |

**支持的第三方库**：
- `hljs` - 代码高亮
- `katex` - 数学公式
- `mermaid` - 流程图
- `ABCJS` - 五线谱
- `plantumlEncoder` - UML图
- `Viz` - Graphviz图

**位置**：`src/modules/tabs/TabRenderer.ts`

---

### 3. TabDataService（数据服务）

**职责**：处理tabs数据的编码、解码、校验与迁移。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `encode` | 编码TabsData为Base64字符串 |
| `decode` | 解码Base64字符串为TabsData |
| `validate` | 校验数据结构 |
| `normalize` | 规范化数据 |
| `clone` | 深拷贝数据 |
| `createDefaultData` | 创建默认数据 |
| `fromCodeTabs` | 从CodeTab数组创建数据 |
| `readFromElement` | 从DOM元素读取 |
| `readFromAttrs` | 从属性读取 |
| `readFromBlock` | 从块读取 |
| `writeToBlock` | 写入块属性 |
| `upgradeFromLegacy` | 从旧版语法升级 |

**数据存储格式**：
- 使用Base64编码存储在块属性 `custom-code-tabs-data` 中
- 数据结构包含版本号，支持向后兼容

**位置**：`src/modules/tabs/TabDataService.ts`

---

### 4. TabTransformManager（批量转换）

**职责**：处理代码块与标签页之间的批量转换操作。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `codeToTabsBatch` | 批量将代码块转为标签页 |
| `codeToTabsInDocument` | 当前文档代码块转标签页 |
| `tabsToCodeBlocksBatch` | 批量将标签页拆分为代码块 |
| `tabsToCodeBlocksInDocument` | 当前文档标签页拆分 |
| `allTabsToCodeBlocks` | 全局拆分所有标签页 |
| `mergeCodeBlocksToTabSyntax` | 合并多个代码块 |
| `newTabs` | 创建新的标签页块 |
| `countLegacyTabs` | 统计旧版标签页数量 |
| `upgradeLegacyTabs` | 升级旧版标签页 |
| `cancelCurrentTask` | 取消当前批量任务 |

**转换流程**：
1. 收集待处理块
2. 解析/验证数据
3. 执行转换
4. 显示进度与结果

**位置**：`src/modules/tabs/TabTransformManager.ts`

---

### 5. TabEditor（编辑面板）

**职责**：提供标签页的可视化编辑界面。

**功能特性**：
- 添加/删除标签页
- 编辑标题、语言、代码内容
- 设置默认标签页
- 拖拽排序标签页
- 语言输入联想

**位置**：`src/modules/tabs/TabEditor.ts`

---

### 6. ThemeManager（主题管理）

**职责**：生成并管理主题样式文件。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `putStyleFile` | 生成样式文件 |
| `invalidateStyleProbe` | 清理样式缓存 |
| `updateAllTabsStyle` | 刷新现有tabs样式 |

**生成的样式文件**：
- `code-style.css` - 代码高亮样式
- `background.css` - 背景与布局样式
- `github-markdown.css` - Markdown渲染样式

**位置**：`src/modules/theme/ThemeManager.ts`

---

### 7. ThemeObserver（主题监听）

**职责**：监听主题变更并触发样式更新。

**监听的变更类型**：

| 变更类型 | 触发更新 |
|----------|----------|
| `theme-mode` | background + codeStyle + markdown |
| `theme-light` | background + codeStyle |
| `theme-dark` | background + codeStyle |
| `theme-link` | background (强制重采样) |
| `code-style-link` | codeStyle |
| `html-attrs` | background |

**配置变更映射**：

| 配置键 | 触发更新 |
|--------|----------|
| `fontSize` | background + lineNumbers (强制重采样) |
| `codeLigatures` | background |
| `codeLineWrap` | background + lineNumbers |
| `codeSyntaxHighlightLineNum` | lineNumbers |
| `mode` | background + codeStyle + markdown |
| `themeLight` / `themeDark` | background + codeStyle |
| `codeBlockThemeLight` / `codeBlockThemeDark` | codeStyle |

**位置**：`src/modules/theme/ThemeObserver.ts`

---

### 8. ConfigManager（配置管理）

**职责**：管理插件配置的加载、合并与保存。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `loadAndApply` | 加载配置并应用样式 |
| `saveConfig` | 保存配置到文件 |

**配置存储**：
- 文件路径：`data/plugins/code-tabs/custom/config.json`
- 包含配置版本号，支持版本升级
- 自动清理废弃的配置键

**位置**：`src/modules/config/ConfigManager.ts`

---

## 插件生命周期

### onload 阶段

```typescript
async onload() {
    // 1. 注册事件
    this.registerBlockIconEvent();
    
    // 2. 注册图标
    this.registerIcons();
    
    // 3. 初始化模块
    this.debugLogManager = new DebugLogManager();
    this.editorRefreshManager = new EditorRefreshManager();
    
    // 4. 初始化Tabs模块
    this.initTabModules();
    
    // 5. 初始化管理器
    this.initManagers();
    
    // 6. 注册斜杠菜单
    this.uiEntryManager.registerSlashMenu();
    
    // 7. 初始化设置
    this.initSettings();
    
    // 8. 注册命令
    this.registerCommands();
}
```

### onLayoutReady 阶段

```typescript
async onLayoutReady() {
    // 1. 初始化顶部按钮
    this.uiEntryManager.initTopBar();
    
    // 2. 同步思源配置
    syncSiyuanConfig(this.data);
    
    // 3. 加载配置并应用主题
    await this.loadConfigAndApplyTheme();
    
    // 4. 检查旧版标签页并提示升级
    await this.checkLegacyTabsPrompt();
    
    // 5. 启动主题监听
    this.themeObserver.start();
    
    // 6. 注册Protyle事件
    this.registerProtyleEvents();
    
    // 7. 扫描行号
    LineNumberManager.scanAll();
}
```

### onunload 阶段

```typescript
onunload() {
    // 清理所有资源
    this.unregisterBlockIconEvent();
    this.unregisterProtyleEvents();
    this.themeObserver?.stop();
    this.tabTransformManager?.cancelCurrentTask();
    LineNumberManager.cleanup();
    TabManager.cleanup();
    StyleProbe.cleanup();
    this.debugLogManager?.cleanup();
    
    // 删除全局对象
    if (window.pluginCodeTabs) {
        delete window.pluginCodeTabs;
    }
}
```

---

## API 封装层

`src/api/` 目录包含思源API的封装，每个文件对应一类API：

| 文件 | API分类 |
|------|---------|
| `request.ts` | 基础请求方法 |
| `block.ts` | 块操作API |
| `file.ts` | 文件操作API |
| `attr.ts` | 属性操作API |
| `sql.ts` | SQL查询API |
| `notebook.ts` | 笔记本API |
| `notification.ts` | 通知API |
| `template.ts` | 模板API |
| `system.ts` | 系统API |
| `network.ts` | 网络API |

**设计原则**：
- 严格一函数对应一个API
- 只做请求与类型约束
- 不掺杂业务逻辑

---

## 工具函数

`src/utils/` 目录包含通用工具函数：

| 文件 | 功能 |
|------|------|
| `common.ts` | 通用工具函数（防抖、延迟等） |
| `dom.ts` | DOM操作工具 |
| `encoding.ts` | Base64编码解码 |
| `env.ts` | 环境检测（移动端判断等） |
| `i18n.ts` | 国际化工具 |
| `logger.ts` | 日志工具 |
| `network.ts` | 网络请求工具 |

---

## 常量定义

`src/constants/` 目录包含项目常量：

| 文件 | 内容 |
|------|------|
| `keys.ts` | 属性键名、标识常量 |
| `paths.ts` | 文件路径常量 |
| `templates.ts` | HTML模板与SVG图标 |
| `index.ts` | 常量汇总导出 |

---

## 数据存储机制

### 属性存储

Tabs数据通过块属性存储：

```typescript
// 新版数据格式
CODE_TABS_DATA_ATTR = "custom-code-tabs-data"

// 旧版数据格式（已废弃）
CUSTOM_ATTR = "custom"
```

### 数据编码流程

```
TabsData → JSON.stringify → Base64.encode → 存储到块属性
```

### 数据读取流程

```
块属性 → Base64.decode → JSON.parse → TabsData
```

---

## 主题适配机制

### 样式采集流程

1. **自动探测**：通过 `StyleProbe` 从思源编辑器采集样式
2. **外部配置**：读取 `theme-adaption.yaml` 配置文件
3. **优先级**：外部配置 > 自动探测

### 主题配置文件

路径：`data/plugins/code-tabs/custom/theme-adaption.yaml`

```yaml
version: "1.0"
themes:
  - id: "theme-id"
    name: "主题名称"
    fullStyle:
      fontFamily: "monospace"
      fontSize: "14px"
      # ... 其他样式属性
    extraCss: |
      .custom-class { /* 额外CSS */ }
```

---

## 行号管理

### LineNumberManager

**职责**：管理代码行号的显示与刷新。

**核心方法**：

| 方法 | 功能 |
|------|------|
| `scanAll` | 扫描所有tabs并添加行号 |
| `refreshAll` | 刷新所有行号 |
| `refreshActive` | 刷新活动标签行号 |
| `cleanup` | 清理所有行号 |
| `isEnabled` | 检查是否启用行号 |

**位置**：`src/modules/line-number/LineNumberManager.ts`

---

## 开发与调试

### 启动命令

```bash
# 开发模式（监听文件变化）
pnpm dev

# 生产构建
pnpm build

# 构建并安装到思源
pnpm make-install

# 创建开发链接
pnpm make-link
```

### 调试日志

通过设置开启debug日志：

```javascript
localStorage.setItem("code-tabs.debug", "true")
```

日志文件路径：`data/plugins/code-tabs/debug.log`

### 测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 代码检查（tsc + lint + test）
pnpm check
```

---

## 依赖关系图

```
index.ts (入口)
    │
    ├── TabManager (交互管理)
    │       ├── TabDataService (数据服务)
    │       ├── TabRenderer (渲染)
    │       ├── TabEditor (编辑器)
    │       └── StyleProbe (样式探针)
    │
    ├── TabTransformManager (转换管理)
    │       ├── TabDataService
    │       └── TabRenderer
    │
    ├── ThemeObserver (主题监听)
    │       ├── ThemeManager (主题管理)
    │       │       └── StyleProbe
    │       └── LineNumberManager (行号管理)
    │
    ├── ConfigManager (配置管理)
    │       └── ThemeObserver
    │
    ├── SettingsPanel (设置面板)
    │       ├── TabTransformManager
    │       └── ConfigManager
    │
    ├── CommandManager (命令管理)
    │       └── TabTransformManager
    │
    ├── UiEntryManager (UI入口)
    │       ├── TabTransformManager
    │       └── TabDataService
    │
    └── ProtyleLifecycleManager (生命周期)
            └── EditorRefreshManager (编辑器刷新)
```

---

## 代码规范

### 命名规范

- 目录：`kebab-case`（如 `line-number`）
- 文件：
  - 导出类/单例：`PascalCase.ts`（如 `TabManager.ts`）
  - 导出函数集合：`camelCase.ts`（如 `dom.ts`）
- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类型/接口：`PascalCase`

### 注释规范

- 使用JSDoc格式
- 说明"为什么/边界/副作用/风险"
- 避免重复代码逻辑描述
- 跨模块调用必须注释说明

### ESLint + Prettier

项目使用 `eslint` 和 `prettier` 进行代码规范检查：

```bash
# 检查
pnpm lint

# 自动修复
pnpm lint:fix

# 格式化
pnpm format
```

---

## 版本历史

| 版本 | 主要变更 |
|------|----------|
| v2.1.2 | 修复插件首次启动时的无效ID参数错误 |
| v2.1.1 | 修复调用属性API时的节点错误 |
| v2.1.0 | 添加移动端"新建标签"菜单项 |
| v2.0.4 | 改进编辑器面板键盘交互、拖拽稳定性 |
| v2.0.3 | 修复Tab插入空格后撤销不工作、CSS变量污染 |
| v2.0.2 | 修复移动端IME问题、语言建议点击无响应 |
| v2.0.0 | 重大升级：不再使用代码块作为中间格式，添加编辑器面板 |

---

## 注意事项

1. **兼容性**：要求思源笔记 3.5.0+
2. **安全设置**：需在设置中开启"允许HTML块内执行脚本"
3. **主题适配**：若样式显示异常，尝试切换主题或重启思源
4. **数据恢复**：原始标签数据以Base64格式存储在块属性中，可恢复
5. **导出限制**：导出为Markdown/HTML时样式会丢失，PDF导出保留样式但标签不可切换