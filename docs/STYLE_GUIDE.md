# 代码风格指南

## 命名规范

- **目录**: `kebab-case`（如 `line-number`）
- **类/单例文件**: `PascalCase.ts`（如 `TabManager.ts`）
- **函数集合文件**: `camelCase.ts`（如 `dom.ts`）
- **变量/函数**: `camelCase`（如 `updateCurrentTab`）
- **常量**: `UPPER_SNAKE_CASE`（如 `CODE_TABS_ICONS`）
- **类型/接口**: `PascalCase`（如 `TabDataItem`）
- **私有成员**: `_camelCase`（如 `_activeIndex`）

## 代码风格

- **格式工具**: eslint + prettier，提交前运行 `pnpm lint`
- **缩进**: 4 空格
- **引号**: 双引号 `"`
- **分号**: 必须加分号
- **import 顺序**: 第三方 → `@/` 别名 → 相对路径

## 类结构顺序

1. 静态属性
2. 实例属性
3. 构造函数
4. 公共方法（按功能分组）
5. 私有方法（按调用顺序）
