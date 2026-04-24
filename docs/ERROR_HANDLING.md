# 错误处理规范

## 错误分类

| 类型 | 处理方式 | 示例 |
| --- | --- | --- |
| 预期错误 | 显示用户友好提示 | 空标题、空代码校验失败 |
| 运行时错误 | 记录日志并优雅降级 | `hljs` 未加载 |
| API 错误 | 显示错误提示并记录日志 | 网络请求失败 |
| 致命错误 | 记录日志并通知用户 | 数据格式损坏 |

## 错误处理模式

```typescript
try {
    const data = await TabDataService.readFromBlock(nodeId);
    if (!data) {
        pushErrMsg(t(i18n, "error.noData"));
        return;
    }
    processData(data);
} catch (error) {
    logger.error("Failed to read tab data", { nodeId, error });
    pushErrMsg(t(i18n, "error.loadFailed"));
}
```