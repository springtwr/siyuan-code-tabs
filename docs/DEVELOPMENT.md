# 开发者维护指南

本文件用于帮助新维护者快速理解项目结构、调试方式与常用命令。

## 项目结构概览

- `src/index.ts`：插件入口与生命周期调度，尽量只保留编排逻辑。
- `src/modules/`：核心业务模块（tabs、theme、line-number 等）。
- `src/api/`：思源内置 API 的薄封装，不承载业务逻辑。
- `src/utils/`：通用工具函数与日志。
- `src/constants/`：常量与模板。
- `src/types/`：共享类型定义。
- `tests/`：单元测试（Vitest），仅覆盖无需思源运行时的逻辑。
- `docs/testing/`：集成测试样例与手动回归清单。

## 常用命令

- 开发构建（watch）：`pnpm dev`
- 打包构建：`pnpm build`
- 代码检查：`pnpm lint`
- 代码格式化：`pnpm format`
- 单元测试：`pnpm test`
- 提交前检查（必须）：`pnpm check`

## 调试与日志

- 插件设置中提供“调试日志”开关，开启后会输出 debug 日志。
- debug 日志会写入 `data/plugins/code-tabs/debug.log`。
- 日志统一由 `src/utils/logger.ts` 管理，新增日志请使用统一接口。
- 开发模式下会为 代码块换行/代码块连字/代码块显示行号 注册块菜单选项，方便调试。
- 只在开发环境中生效的相关逻辑集中在 `src/modules/developer/`。

## i18n 规范

- 语言文件：`public/i18n/zh_CN.json`、`public/i18n/en_US.json`，使用**扁平 key**（例如 `menu.block.codeToTabs`）。
- 访问方式：统一通过 `src/utils/i18n.ts` 的 `t(i18n, key)`。
- 新增文案需同时更新两份 JSON，并在调用处使用正确 key。

## 生命周期注意事项

- `onload` 只做初始化与注册，不做批量扫描或重计算。
- `onLayoutReady` 才进行 DOM 扫描、主题同步、行号刷新等操作。
- `onunload` 必须清理事件监听、`MutationObserver` 与全局对象。

## 测试建议

- 纯逻辑优先写单元测试（放在 `tests/`）。
- 需要思源运行时的功能请补充到 `docs/testing/README.md` 的手动回归清单。
- `docs/testing/fixtures/sample.md` 用于快速导入示例文档。

## 贡献与变更

- 目录命名统一 `kebab-case`。
- 新模块需要明确职责边界，并补充相应的测试或手动回归步骤。
- 避免在 `src/index.ts` 堆积业务逻辑。

## 重大变更记录（面向维护者）

- **v2.x.x 起不再使用“tab 语法代码块”作为中转**  
  标签页在 HTML 块状态下完成编辑与交互，旧的“切回代码块”入口已移除。
- **历史数据格式**
  1. v0.7.0 之前：使用 `tab:::` 语法，明文存储在 `custom-plugin-code-tabs-sourcecode` 属性中，换行被替换为 `⤵↩`。
  2. v0.7.0 起：使用 `:::` 语法，内容 Base64 编码后仍存储在 `custom-plugin-code-tabs-sourcecode` 中。
  3. v2.x：主要数据存储在 `custom-code-tabs-data`，旧属性仅用于兼容读取。
