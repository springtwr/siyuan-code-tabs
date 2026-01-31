# siyuan-code-tabs 项目规范

## 1. 目标与原则

- 入口最小化：`src/index.ts` 只负责生命周期协调、事件注册、配置加载与模块编排，不承载复杂业务逻辑。
- 单一职责：解析、渲染、主题适配、行号、数据转换等各自独立模块，互相通过明确的公开 API 交互。
- 可回收：所有事件监听、`MutationObserver`、全局变量都必须在 `onunload` 中清理。
- 统一风格：全仓采用 `eslint + prettier` 作为唯一格式与规范来源。

## 2. 目录职责（基于当前结构的约定）

- `src/index.ts`：插件入口与生命周期调度（仅保留最小编排逻辑）。
- `src/modules/`：业务模块（解析、渲染、主题、行号、交互、设置、调试、配置、命令、UI、Protyle 生命周期、编辑器刷新）。
- `src/api/`：思源内置 API 封装（只做请求与类型约束，不掺业务逻辑）。
- `src/utils/`：通用工具（纯函数/无副作用，除 `logger` 外尽量不依赖 DOM 与全局对象）。
- `src/types/`：共享类型与接口定义。
- `src/constants/`：常量、HTML 模板与静态配置定义（不放业务逻辑与 API）。
- `public/asset/`：打包静态资源（CSS、图片、示例）。
- `tests/`：单元测试（Vitest），仅覆盖无需思源运行时的逻辑。
- `docs/testing/`：集成测试样例与手动回归清单。

## 3. 当前项目结构

```
src/
  index.ts                  # 入口：生命周期、事件注册、调用各模块
  modules/
    tabs/
      TabParser.ts          # 语法解析/格式转换（纯逻辑）
      TabRenderer.ts        # 渲染 HTML（仅视图层）
      TabConverter.ts       # 批量转换/统计与 API 调用
      TabManager.ts         # tabs 交互与全局函数注册
      TabDataManager.ts     # tabs 数据读写/迁移与校验
      TabEditor.ts          # tabs 编辑弹窗与交互
      types.ts              # codeTab 等与 tabs 相关类型
    theme/
      ThemeManager.ts       # 主题/样式文件生成与更新
      ThemeObserver.ts      # 主题监听与样式更新编排
      StyleProbe.ts         # 主题样式采集（原 StyleProtyle）
      types.ts              # ThemeStyle/ThemePatch
    settings/
      SettingsPanel.ts      # 设置面板构建与应用
    line-number/
      LineNumberManager.ts  # 行号管理
    developer/
      DevToggleManager.ts   # 开发快捷开关
      DebugLogManager.ts    # 调试日志开关与写入
    config/
      ConfigManager.ts      # 配置加载/合并/保存编排
    command/
      CommandManager.ts     # 命令注册与块菜单构建
    ui/
      UiEntryManager.ts     # 顶部按钮与斜杠菜单入口
    protyle/
      ProtyleLifecycleManager.ts # Protyle 事件注册与处理
    editor/
      EditorRefreshManager.ts # 编辑器刷新与溢出更新
  api/
    request.ts              # request 基础方法
    block.ts notebook.ts file.ts attr.ts sql.ts
    notification.ts template.ts system.ts network.ts
    index.ts                # re-export
  utils/
    dom.ts encoding.ts common.ts logger.ts network.ts
  constants/
    index.ts                # 常量汇总导出
    keys.ts                 # 标识/分隔符等常量
    paths.ts                # 路径常量
    templates.ts            # HTML 模板与 SVG 常量
  types/
    index.ts                # 导出所有类型
    siyuan.ts               # Siyuan 相关通用类型
    vite-env.d.ts           # 生产和开发环境相关
tests/
  *.test.ts                 # 单元测试（集中管理）
docs/
  testing/
    README.md               # 手动回归清单
    fixtures/sample.md      # 导入思源的样例文档
```

## 4. 模块职责边界

- `TabParser`：仅处理语法解析与格式转换，不操作 DOM、API。
- `TabRenderer`：仅生成 HTML 字符串，不访问 API、不读写存储。
- `TabConverter`：负责批量转换、统计与 API 调用，不直接处理生命周期与设置 UI。
- `TabManager`：管理 tabs 交互（`window.pluginCodeTabs`）与用户交互逻辑，不负责渲染与语法解析。
- `TabDataManager`：负责 tabs 数据编码/解码、迁移与校验，不负责 UI 与渲染。
- `TabEditor`：负责 tabs 编辑 UI 与交互，不负责解析与渲染。
- `ThemeManager/StyleProbe`：只处理主题样式、CSS 生成与更新，不参与转换流程。
- `ThemeObserver`：只负责主题监听与样式更新计划编排，不处理设置 UI 与业务转换。
- `LineNumberManager`：只负责行号显示与刷新，不关心转换逻辑。
- `SettingsPanel`：只负责设置 UI 构建与应用，不处理转换与主题监听。
- `DebugLogManager`：只负责 debug 开关与日志写入，不参与业务逻辑。
- `DevToggleManager`：只负责开发环境下的编辑器配置切换。
- `ConfigManager`：只负责配置加载/合并/保存与样式更新触发，不处理 UI 与主题监听细节。
- `CommandManager`：只负责命令注册与块菜单构建，不处理渲染与解析。
- `UiEntryManager`：只负责顶部按钮与斜杠菜单入口，不处理转换与主题逻辑。
- `ProtyleLifecycleManager`：只负责 Protyle 事件注册与处理，不处理转换与 UI 入口。
- `EditorRefreshManager`：只负责编辑器刷新与溢出更新，不处理生命周期与 UI。
- `api`：严格一函数对应一个 API，禁止夹带业务逻辑。
- `utils`：纯工具函数；若依赖 `window`/DOM，需明确标注为“浏览器环境”用途。
- `logger`：支持 debug/info/warn/error；debug 可通过设置开关并写入 `debug.log`。

## 5. 插件生命周期约定

- `onload`
  - 允许：注册 eventBus、命令、设置项；注入必要的全局样式；初始化全局函数。
  - 禁止：对文档内容做批量扫描/转换；依赖 `protyle` 已完成布局。
- `onLayoutReady`
  - 允许：DOM 扫描、主题样式同步、`MutationObserver`、行号刷新、顶部按钮挂载。
  - 禁止：重复注册事件与全局对象。
- `onunload`
  - 必须：注销 eventBus、移除 `MutationObserver`、清理 `window.pluginCodeTabs` 与定时器/RAF。

## 6. 命名与文件规范

- 目录：统一 `kebab-case`（如 `line-number`、`tab-manager`）。
- 文件：
  - 导出类/单例：`PascalCase.ts`（如 `TabManager.ts`）。
  - 导出函数集合：`camelCase.ts`（如 `dom.ts`）。
- 变量/函数：`camelCase`；常量：`UPPER_SNAKE_CASE`。
- 类型/接口：`PascalCase`；保留已有 `IRes*` 命名用于 API 响应。
- 命名避免拼写错误（如 `StyleProtyle` → `StyleProbe` 或 `ProtyleStyleProbe`）。

## 7. 代码风格（eslint + prettier）

- 以 `eslint` 规范代码质量、`prettier` 统一格式；`eslint-config-prettier` 禁止规则冲突。
- 建议配置（后续落地）：`tabWidth: 4`，`singleQuote: false`，`semi: true`。
- import 顺序：第三方 → `@/` 别名 → 相对路径；组间空行。
- 禁止新增 `any`（必要时使用 `unknown` 并显式收敛）。

## 8. 测试与调试

- 单元测试：`vitest`，测试文件集中放在 `tests/`。
- 集成测试：使用 `docs/testing/` 中的样例文档与回归清单。
- Debug 开关：插件设置中提供“调试日志”，开启后写入 `data/plugins/code-tabs/debug.log`。
- 提交前检查：必须运行 `pnpm check`（同时执行 tsc、lint、test），确保全部通过再提交。
- 代码改动后必须运行 `pnpm check`，确保无误后再交付。
- 规范维护：每次项目结构或重大变更时必须同步更新本文件。
- 提交信息风格：使用中文。第一行概述本次提交内容，后续用要点分条说明改动细节。

## 9. 注释规范

### 9.1 目标与原则

- 目标：解释“为什么/边界/副作用/风险”，避免重复代码。
- 先拆函数再注释：复杂逻辑优先拆分，注释只补充“为什么”。
- 注释必须可维护：逻辑变更时同步更新注释。

### 9.2 必须写注释的场景

- 生命周期钩子中的非直观逻辑（`onload/onLayoutReady/onunload`）。
- 跨模块调用与协作点（tabs/theme/line-number 等）。
- 异步副作用（API/DOM/定时器/事件监听/Observer）。
- 兼容与降级逻辑（旧数据格式、`hljs` 缺失等）。
- 复杂条件分支与关键用户行为变更。

### 9.3 不需要写注释的场景

- 命名已清晰的简单逻辑、纯映射、简单判断。
- 显而易见的赋值或调用（禁止“把 A 赋给 B”类注释）。

### 9.4 注释位置与格式

- 模块/类/函数使用 JSDoc，说明用途、输入/输出、副作用。
- 关键分支用行内或块注释，说明原因与约束。
- 需要指明风险或不确定性的，使用 “注意/风险/兼容” 开头。

### 9.5 注释风格

- 简短准确、中文为主、尽量不超过 2 行，超过用块注释。
- 不要解释“做了什么”，只解释“为什么这样做/避免什么问题”。

### 9.6 模板

函数/方法（JSDoc）：
```
/**
 * {简要说明}
 *
 * {为什么/边界/副作用}
 * @param {type} name {说明}
 * @returns {type} {说明}
 */
```

模块/类说明：
```
/**
 * {模块/类用途}
 * {关键边界/约束或副作用}
 */
```

异步副作用：
```
// 副作用：{例如插入 DOM/触发 API/注册监听}
```

兼容/降级逻辑：
```
// 兼容：{旧格式/缺失库} -> {处理策略}
```

复杂分支说明：
```
// 原因：{为何要走此分支}
```

## 10. i18n 规范

- 语言文件：`public/i18n/zh_CN.json`、`public/i18n/en_US.json`，使用扁平 key。
- 访问方式：统一通过 `src/utils/i18n.ts` 的 `t(i18n, key)`。
- 新增文案需同时更新两份 JSON，并确保 key 使用正确。
