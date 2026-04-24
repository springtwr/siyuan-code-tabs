# 插件生命周期指南

## 生命周期钩子

| 生命周期 | 触发时机 | 允许操作 | 禁止操作 |
| --- | --- | --- | --- |
| **onload** | 插件首次加载时 | 注册 eventBus、命令、设置项；注入全局样式；初始化全局函数 | 对文档内容做批量扫描/转换；依赖 `protyle` 布局 |
| **onLayoutReady** | Protyle 布局完成后 | DOM 扫描、主题样式同步、`MutationObserver`、行号刷新、顶部按钮挂载 | 重复注册事件与全局对象 |
| **onunload** | 插件卸载时 | 注销 eventBus、移除 `MutationObserver`、清理全局对象与定时器/RAF | 遗漏清理资源 |

## 初始化顺序（onLayoutReady 中）

1. `ConfigManager.init()` - 加载配置
2. `ThemeObserver.start()` - 启动主题监听
3. `LineNumberManager.init()` - 初始化行号
4. `UiEntryManager.init()` - 挂载顶部按钮
5. `ProtyleLifecycleManager.init()` - 注册 Protyle 事件