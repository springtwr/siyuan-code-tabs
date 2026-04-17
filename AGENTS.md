# siyuan-code-tabs 项目规范

**版本**: 2.1\
**更新日期**: 2026-04-17\
**适用范围**: 代码标签页插件的开发与维护\
**维护者**: springtwr 

---

## 1. 目标与原则

- **入口最小化**: `src/index.ts` 只负责生命周期协调、事件注册、配置加载与模块编排，不承载复杂业务逻辑。降低入口复杂度，便于定位问题。
- **单一职责**: 解析、渲染、主题适配、行号、数据转换等各自独立模块，互相通过明确的公开 API 交互。提高代码可测试性和可维护性。
- **可回收**: 所有事件监听、`MutationObserver`、全局变量必须在 `onunload` 中清理。避免内存泄漏，保证插件卸载干净。
- **统一风格**: 全仓采用 `eslint + prettier` 作为唯一格式与规范来源。减少代码风格争议，提高协作效率。
- **渐进增强**: 核心功能不依赖可选库（如 `hljs`），缺失时优雅降级。提高兼容性，避免运行时崩溃。
- **类型安全**: 使用 TypeScript 进行严格类型检查，禁止新增 `any`。提前发现类型错误，提高代码可靠性。

---

## 2. 目录职责

| 目录/文件 | 职责 | 约束 |
| --- | --- | --- |
| `src/index.ts` | 插件入口与生命周期调度 | 仅保留最小编排逻辑，不承载业务 |
| `src/modules/` | 业务模块集合 | 每个模块职责单一，通过 API 交互 |
| `src/api/` | 思源内置 API 封装 | 只做请求与类型约束，不掺业务逻辑 |
| `src/utils/` | 通用工具函数 | 纯函数/无副作用，除 `logger` 外不依赖 DOM |
| `src/types/` | 共享类型与接口定义 | 仅类型声明，无实现逻辑 |
| `src/constants/` | 常量、HTML 模板与静态配置 | 不放业务逻辑与 API |
| `public/asset/` | 打包静态资源 | CSS、图片、图标等，不包含代码 |
| `tests/` | 单元测试（Vitest） | 仅覆盖无需思源运行时的逻辑 |
| `docs/testing/` | 集成测试样例与手动回归清单 | 测试用文档与场景描述 |

---

## 3. 项目结构

```
src/
├── index.ts                    # 入口：生命周期、事件注册、模块编排
├── modules/
│   ├── tabs/
│   │   ├── LegacyTabParser.ts  # 语法解析/格式转换（纯逻辑）
│   │   ├── TabRenderer.ts      # 渲染 HTML（仅视图层）
│   │   ├── TabTransformManager.ts  # 批量转换/统计与 API 调用
│   │   ├── TabManager.ts       # tabs 交互与全局函数注册
│   │   ├── TabDataService.ts   # tabs 数据读写/迁移与校验
│   │   ├── TabEditor.ts        # tabs 编辑弹窗与交互编排
│   │   ├── TabListRenderer.ts  # 标签页列表渲染（纯视图）
│   │   ├── DragDropManager.ts  # 拖拽排序管理（桌面端+移动端）
│   │   ├── LanguageSuggest.ts  # 语言联想功能（独立组件）
│   │   ├── KeyboardNavigator.ts # 键盘导航管理（独立组件）
│   │   └── types.ts            # tabs 相关类型定义
│   ├── theme/
│   │   ├── ThemeManager.ts     # 主题/样式文件生成与更新
│   │   ├── ThemeObserver.ts    # 主题监听与样式更新编排
│   │   ├── StyleProbe.ts       # 主题样式采集
│   │   └── types.ts            # ThemeStyle/ThemePatch
│   ├── settings/
│   │   └── SettingsPanel.ts    # 设置面板构建与应用
│   ├── line-number/
│   │   └── LineNumberManager.ts # 行号管理
│   ├── developer/
│   │   ├── DevToggleManager.ts # 开发快捷开关
│   │   └── DebugLogManager.ts  # 调试日志开关与写入
│   ├── config/
│   │   └── ConfigManager.ts     # 配置加载/合并/保存编排
│   ├── command/
│   │   └── CommandManager.ts    # 命令注册与块菜单构建
│   ├── ui/
│   │   └── UiEntryManager.ts    # 顶部按钮与斜杠菜单入口
│   ├── protyle/
│   │   └── ProtyleLifecycleManager.ts # Protyle 事件注册与处理
│   └── editor/
│       └── EditorRefreshManager.ts # 编辑器刷新与溢出更新
├── api/
│   ├── request.ts              # request 基础方法（统一错误处理）
│   ├── block.ts notebook.ts file.ts attr.ts sql.ts
│   ├── notification.ts template.ts system.ts network.ts
│   └── index.ts                # re-export（统一导出入口）
├── utils/
│   ├── dom.ts encoding.ts common.ts logger.ts network.ts i18n.ts
│   └── env.ts                  # 环境检测工具（浏览器/移动端判断）
├── constants/
│   ├── index.ts                # 常量汇总导出
│   ├── keys.ts                 # 标识/分隔符等常量
│   ├── paths.ts                # 路径常量（插件目录、数据目录）
│   └── templates.ts            # HTML 模板与 SVG 常量
└── types/
    ├── index.ts                # 导出所有类型（便于外部引用）
    ├── siyuan.ts               # Siyuan 相关通用类型
    └── vite-env.d.ts           # 生产和开发环境相关
tests/
├── *.test.ts                   # 单元测试（集中管理，按模块命名）
└── __mocks__/                  # Mock 文件（如 mock window.siyuan）
docs/
├── testing/
│   ├── README.md               # 手动回归清单（按功能模块组织）
│   └── fixtures/sample.md      # 导入思源的样例文档
├── CODE_WIKI.md                # 重构文档与设计说明
└── API.md                      # 公共 API 文档（便于外部调用者参考）
```

---

## 4. 模块职责边界

### 4.1 Tabs 模块

| 模块 | 职责 | 禁止 |
| --- | --- | --- |
| `LegacyTabParser` | 语法解析与格式转换 | 不操作 DOM、不调用 API |
| `TabRenderer` | 生成 HTML 字符串 | 不访问 API、不读写存储 |
| `TabTransformManager` | 批量转换、统计与 API 调用 | 不直接处理生命周期与设置 UI |
| `TabManager` | tabs 交互与全局函数注册 | 不负责渲染与语法解析 |
| `TabDataService` | 数据编码/解码、迁移与校验 | 不负责 UI 与渲染 |
| `TabEditor` | 编辑弹窗与交互编排 | 不负责解析与渲染 |
| `TabListRenderer` | 标签页列表渲染 | 不处理交互逻辑 |
| `DragDropManager` | 拖拽排序管理 | 不处理数据持久化 |
| `LanguageSuggest` | 语言联想与键盘导航 | 不处理表单验证 |
| `KeyboardNavigator` | 键盘导航与 Tab 键处理 | 不处理鼠标交互 |

### 4.2 主题模块

| 模块 | 职责 | 禁止 |
| --- | --- | --- |
| `ThemeManager` | 主题样式生成与文件更新 | 不参与转换流程 |
| `ThemeObserver` | 主题监听与更新计划编排 | 不处理设置 UI |
| `StyleProbe` | 主题样式采集与分析 | 不修改 DOM |

### 4.3 模块交互关系

```
TabManager ──────> TabRenderer (渲染)
        ──────> TabDataService (数据)
        ──────> TabEditor (编辑)

TabEditor ──────> TabListRenderer (列表渲染)
        ──────> DragDropManager (拖拽)
        ──────> LanguageSuggest (语言联想)
        ──────> KeyboardNavigator (键盘)

ThemeObserver ──────> ThemeManager (样式更新)
            ──────> ConfigManager (配置)

ConfigManager ──────> 所有模块 (配置分发)
```

---

## 5. 插件生命周期约定

### 5.1 生命周期钩子

| 生命周期 | 触发时机 | 允许操作 | 禁止操作 |
| --- | --- | --- | --- |
| **onload** | 插件首次加载时 | 注册 eventBus、命令、设置项；注入全局样式；初始化全局函数 | 对文档内容做批量扫描/转换；依赖 `protyle` 布局 |
| **onLayoutReady** | Protyle 布局完成后 | DOM 扫描、主题样式同步、`MutationObserver`、行号刷新、顶部按钮挂载 | 重复注册事件与全局对象 |
| **onunload** | 插件卸载时 | 注销 eventBus、移除 `MutationObserver`、清理全局对象与定时器/RAF | 遗漏清理资源 |

### 5.2 初始化顺序（onLayoutReady 中）

1. `ConfigManager.init()` - 加载配置
2. `ThemeObserver.start()` - 启动主题监听
3. `LineNumberManager.init()` - 初始化行号
4. `UiEntryManager.init()` - 挂载顶部按钮
5. `ProtyleLifecycleManager.init()` - 注册 Protyle 事件

---

## 6. 命名与文件规范

### 6.1 文件命名

- **目录**: `kebab-case`（如 `line-number`、`tab-manager`）
- **类/单例文件**: `PascalCase.ts`（如 `TabManager.ts`、`DragDropManager.ts`）
- **函数集合文件**: `camelCase.ts`（如 `dom.ts`、`encoding.ts`）
- **类型定义文件**: `types.ts`（模块内）或 `PascalCase.ts`（如 `theme/types.ts`）

### 6.2 代码命名

- **变量/函数**: `camelCase`（如 `updateCurrentTab`、`renderList`）
- **常量**: `UPPER_SNAKE_CASE`（如 `CODE_TABS_ICONS`、`STORAGE_KEY`）
- **类型/接口**: `PascalCase`（如 `TabDataItem`、`ThemeStyle`）
- **API 响应类型**: `IRes*`（保留历史命名，如 `IResBlock`、`IResNotebook`）
- **私有成员**: `_camelCase`（类内私有属性，如 `_dragIndex`、`_activeIndex`）

### 6.3 命名最佳实践

- **语义化**: 变量/函数名应表达"做什么"而非"怎么做"
- **避免缩写**: 除非是广泛认可的缩写（如 `API`、`URL`、`DOM`）
- **保持一致**: 相同概念使用相同命名（如统一使用 `tab` 而非 `tabItem`/`tabData`）
- **英文为主**: 变量、函数、类型使用英文命名
- **中文注释**: 注释使用中文，便于团队理解

---

## 7. 代码风格

- **格式工具**: `eslint` 规范代码质量 + `prettier` 统一格式，提交前必须运行 `pnpm lint`
- **缩进**: `tabWidth: 4`，使用 4 空格缩进
- **引号**: `singleQuote: false`，使用双引号 `"`
- **分号**: `semi: true`，语句末尾必须加分号
- **import 顺序**: 第三方 → `@/` 别名 → 相对路径；组间空行
- **类型约束**: 禁止新增 `any`，必要时使用 `unknown` 并显式收敛

### 7.1 Import 顺序示例

```typescript
// 1. 第三方依赖
import { Dialog, type IObject } from "siyuan";

// 2. @/ 别名（按字母顺序）
import { pushErrMsg } from "@/api";
import { CODE_TABS_ICONS } from "@/constants";
import { isMobileBackend } from "@/utils/env";
import { t } from "@/utils/i18n";

// 3. 相对路径（按字母顺序）
import { TabDataService } from "./TabDataService";
import { TabListRenderer } from "./TabListRenderer";
import type { TabsData } from "./types";
```

### 7.2 代码组织

```typescript
// 类结构顺序
class Example {
    // 1. 静态属性
    private static readonly MAX_COUNT = 10;

    // 2. 实例属性
    private _items: string[] = [];
    private _activeIndex = 0;

    // 3. 构造函数
    constructor() {
        this.init();
    }

    // 4. 公共方法（按功能分组）
    public add(item: string): void {}
    public remove(index: number): void {}
    public get(index: number): string | undefined {}

    // 5. 私有方法（按调用顺序）
    private init(): void {}
    private validate(item: string): boolean {}
    private updateUI(): void {}
}
```

---

## 8. 测试与调试

| 类型 | 工具/位置 | 说明 | 覆盖率要求 |
| --- | --- | --- | --- |
| 单元测试 | `vitest` + `tests/*.test.ts` | 覆盖无需思源运行时的逻辑 | ≥ 80%（核心模块） |
| 集成测试 | `docs/testing/` | 样例文档与回归清单 | 手动验证 |
| Debug 日志 | 设置面板开关 | 开启后写入 `data/plugins/code-tabs/debug.log` | 开发阶段使用 |
| 提交前检查 | `pnpm check` | 同时执行 tsc、lint、test | 必须全部通过 |

### 8.1 测试文件命名规范

- **测试文件**: `{模块名}.test.ts`（如 `TabDataService.test.ts`）
- **Mock 文件**: `__mocks__/{模块名}.ts`（如 `__mocks__/siyuan.ts`）
- **测试套件**: 使用 `describe("{模块名}", ...)`（如 `describe("TabDataService", ...)`）

### 8.2 测试最佳实践

```typescript
// 测试套件结构
describe("TabDataService", () => {
    // 每个测试用例描述要清晰
    it("should validate empty title as invalid", () => {
        const result = TabDataService.validate({
            version: 2,
            active: 0,
            tabs: [{ title: "", lang: "plaintext", code: "test" }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors).toContain("tab.0.title.empty");
    });

    // 使用 describe 分组相关测试
    describe("encode/decode", () => {
        it("should encode and decode data correctly", () => {
            const data = TabDataService.createDefaultData();
            const encoded = TabDataService.encode(data);
            const decoded = TabDataService.decode(encoded);
            expect(decoded).toEqual(data);
        });
    });
});
```

---

## 9. Git 提交规范

### 9.1 格式

```
<类型>(<范围>): <简短描述>

<正文（可选，说明变更背景和原因）>

<尾部（可选，关联 Issue 或破坏性变更）>
```

**注意**:
- 提交信息中英文间应该用空格隔开
- 正文每行使用无序列表格式 `-`，避免使用空格或制表符

### 9.2 类型定义

| 类型 | 说明 | 使用场景 |
| --- | --- | --- |
| `feat` | 新功能 | 添加新功能、新模块、新 API |
| `fix` | Bug 修复 | 修复已知问题、修复测试失败 |
| `docs` | 文档变更 | 更新 README、AGENTS.md、API 文档 |
| `style` | 代码格式调整 | 不影响功能的格式化、lint 修复 |
| `refactor` | 重构 | 代码结构调整、无功能变更 |
| `perf` | 性能优化 | 性能改进、减少内存占用 |
| `test` | 测试相关 | 添加测试、修复测试 |
| `chore` | 构建/工具变更 | 更新依赖、配置文件、CI/CD |

### 9.3 示例

```
feat(tabs): 添加拖拽排序功能
fix(theme): 修复暗色主题样式冲突
docs(readme): 更新安装步骤
refactor(utils): 简化日期格式化
perf(renderer): 优化 HTML 生成性能
test(tabs): 添加 TabDataService 测试用例
chore(deps): 更新 vitest 到 4.0
```

---

## 10. 注释规范

### 10.1 目标

解释**为什么/边界/副作用/风险**，避免重复代码。

### 10.2 必须写注释的场景

- **生命周期钩子**: 非直观的初始化逻辑（如 `onLayoutReady` 中的异步操作）
- **跨模块调用**: 模块间的协作点（如 `TabManager` 调用 `TabRenderer`）
- **异步副作用**: API/DOM/定时器/事件监听（如 `MutationObserver` 注册）
- **兼容降级**: 旧数据格式或缺失库处理（如 `hljs` 缺失时的降级逻辑）
- **复杂分支**: 关键用户行为变更（如条件判断超过 3 个分支）

### 10.3 模板

```typescript
/**
 * {简要说明：做什么}
 *
 * {详细说明：为什么这样做/边界条件/副作用}
 * @param {type} name {参数说明}
 * @returns {type} {返回值说明}
 * @throws {ErrorType} {可能抛出的错误}
 */
public processData(data: TabsData): void {
    // 兼容：旧版本数据格式没有 version 字段
    if (!data.version) {
        data = TabDataService.upgradeFromLegacy(JSON.stringify(data));
    }
    // 副作用：触发数据变更事件
    this.emit("dataChange", data);
}
```

### 10.4 注释风格

- **简短准确**: 尽量不超过 2 行，超过用块注释
- **中文为主**: 团队沟通语言
- **不重复代码**: 只解释"为什么"，不解释"做什么"
- **及时更新**: 逻辑变更时同步更新注释

---

## 11. i18n 规范

- **文件位置**: `public/i18n/zh_CN.json`、`public/i18n/en_US.json`，必须同时更新两份
- **格式**: 扁平 key，使用英文点号分隔（如 `"editor.add": "添加"`）
- **访问方式**: 统一通过 `src/utils/i18n.ts` 的 `t(i18n, key)`（如 `t(i18n, "editor.add")`）
- **新增文案**: 需同时更新两份 JSON，添加新 key 时同步中英文
- **动态内容**: 使用 `{0}`、`{1}` 作为占位符（如 `"editor.confirm": "确定删除 {0} 吗？"`）

### 11.1 i18n 文件结构

```json
{
    "common": {
        "ok": "确定",
        "cancel": "取消"
    },
    "editor": {
        "title": "编辑标签页",
        "add": "添加",
        "delete": "删除",
        "confirmDelete": "确定删除标签页 {0} 吗？"
    }
}
```

---

## 12. 错误处理规范

### 12.1 错误分类

| 类型 | 处理方式 | 示例 |
| --- | --- | --- |
| 预期错误 | 显示用户友好提示 | 空标题、空代码校验失败 |
| 运行时错误 | 记录日志并优雅降级 | `hljs` 未加载 |
| API 错误 | 显示错误提示并记录日志 | 网络请求失败 |
| 致命错误 | 记录日志并通知用户 | 数据格式损坏 |

### 12.2 错误处理模式

```typescript
try {
    const data = await TabDataService.readFromBlock(nodeId);
    if (!data) {
        // 预期错误：数据不存在
        pushErrMsg(t(i18n, "error.noData"));
        return;
    }
    processData(data);
} catch (error) {
    // 运行时错误：记录日志并降级
    logger.error("Failed to read tab data", { nodeId, error });
    pushErrMsg(t(i18n, "error.loadFailed"));
}
```

---

## 13. 代码审查清单

- ✅ **测试通过**: `pnpm check` 全部通过（tsc + lint + test）
- ✅ **测试覆盖**: 新增代码有对应的单元测试，核心模块覆盖率 ≥ 80%
- ✅ **注释规范**: 注释解释"为什么"而非"做什么"
- ✅ **无冗余代码**: 无未使用的变量、导入和死代码
- ✅ **资源清理**: 事件监听、定时器、Observer 已正确清理
- ✅ **单一职责**: 模块/函数职责清晰，无过度耦合
- ✅ **命名规范**: 变量、函数、类型命名符合规范
- ✅ **i18n 同步**: 新增文案已同步更新中英文
- ✅ **文档更新**: 相关文档已同步更新（如适用）
- ✅ **类型安全**: 无新增 `any`，类型使用正确

---

## 附录：常用命令

| 命令 | 说明 | 何时使用 |
| --- | --- | --- |
| `pnpm dev` | 开发模式，监听文件变化 | 日常开发 |
| `pnpm build` | 生产构建 | 发布前 |
| `pnpm check` | 运行 tsc、lint、test | 提交代码前 |
| `pnpm lint` | 只运行 eslint | 检查代码风格 |
| `pnpm test` | 运行单元测试 | 验证功能正确性 |
| `pnpm test:watch` | 监听测试变化 | 测试驱动开发 |