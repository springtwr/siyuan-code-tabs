# siyuan-code-tabs 项目规范

## 核心原则

- **入口最小化**: `src/index.ts` 只做生命周期协调，不承载业务逻辑
- **单一职责**: 各模块独立，通过明确 API 交互
- **可回收**: 所有资源必须在 `onunload` 中清理
- **统一风格**: eslint + prettier 强制执行
- **渐进增强**: 核心功能不依赖可选库
- **类型安全**: 禁止新增 `any`

## 目录结构

```
src/
├── index.ts          # 入口与生命周期编排
├── core/             # 核心层：业务逻辑
├── services/         # 服务层：协调服务
├── api/              # 思源API封装
├── utils/            # 通用工具函数
├── types/            # 共享类型定义
└── constants/        # 常量与模板
```

## 详细规范参考

| 规范类型 | 文件位置 | 更新时机 |
| --- | --- | --- |
| 代码风格 | `docs/STYLE_GUIDE.md` | 代码格式变更时 |
| 生命周期 | `docs/LIFECYCLE.md` | 模块初始化变更时 |
| Git 提交 | `docs/COMMIT_GUIDE.md` | 提交规范变更时 |
| 测试指南 | `docs/TESTING_GUIDE.md` | 测试策略变更时 |
| i18n 规范 | `docs/I18N_GUIDE.md` | 新增文案时 |
| 错误处理 | `docs/ERROR_HANDLING.md` | 错误处理变更时 |
| 架构设计 | `docs/CODE_WIKI.md` | 架构调整时 |  

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式 |
| `pnpm build` | 生产构建 |
| `pnpm lint` | 代码风格检查 |
| `pnpm test` | 单元测试 |
| `pnpm check` | 完整检查 |

## 代码审查

每次更改代码后必须运行 `pnpm check` 检查是否有错误