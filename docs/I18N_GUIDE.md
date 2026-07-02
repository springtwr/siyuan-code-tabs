# i18n 国际化规范

## 基本规则

- **文件位置**: `public/i18n/zh-CN.json`、`public/i18n/en.json`，必须同时更新两份
- **格式**: 扁平 key，使用英文点号分隔（如 `"editor.add": "添加"`）
- **访问方式**: 统一通过 `src/utils/i18n.ts` 的 `t(i18n, key)`
- **新增文案**: 需同时更新两份 JSON，添加新 key 时同步中英文
- **动态内容**: 使用 `{0}`、`{1}` 作为占位符

## 文件结构示例

```json
{
  "common": {
    "ok": "确定",
    "cancel": "取消"
  },
  "editor": {
    "title": "编辑标签页",
    "add": "添加",
    "delete": "删除"
  }
}
```
