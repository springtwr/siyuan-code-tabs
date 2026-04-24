# 测试与调试指南

## 测试类型

| 类型 | 工具/位置 | 说明 | 覆盖率要求 |
| --- | --- | --- | --- |
| 单元测试 | `vitest` + `tests/*.test.ts` | 覆盖无需思源运行时的逻辑 | ≥ 80%（核心模块） |
| 集成测试 | `docs/testing/` | 样例文档与回归清单 | 手动验证 |
| Debug 日志 | 设置面板开关 | 开启后写入 `data/plugins/code-tabs/debug.log` | 开发阶段使用 |
| 提交前检查 | `pnpm check` | 同时执行 tsc、lint、test | 必须全部通过 |

## 测试文件命名规范

- **测试文件**: `{模块名}.test.ts`（如 `TabDataService.test.ts`）
- **Mock 文件**: `__mocks__/{模块名}.ts`（如 `__mocks__/siyuan.ts`）
- **测试套件**: 使用 `describe("{模块名}", ...)`