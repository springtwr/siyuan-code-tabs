# 插件生命周期指南

## 生命周期钩子

| 生命周期 | 触发时机 | 允许操作 | 禁止操作 |
| --- | --- | --- | --- |
| **onload** | 插件首次加载时 | 注册 eventBus、命令、设置项；注入全局样式；初始化全局函数 | 对文档内容做批量扫描/转换；依赖 `protyle` 布局 |
| **onLayoutReady** | Protyle 布局完成后 | DOM 扫描、主题样式同步、`MutationObserver`、行号刷新、顶部按钮挂载 | 重复注册事件与全局对象 |
| **onunload** | 插件卸载时 | 注销 eventBus、移除 `MutationObserver`、清理全局对象与定时器/RAF | 遗漏清理资源 |

## 初始化顺序

### onload阶段

1. 创建服务实例
   - `LifecycleService` - 生命周期管理
   - `ThemeService` - 主题协调
   - `ConfigService` - 配置管理
   - `CommandService` - 命令注册
   - `UIService` - UI入口管理
   - `SettingsService` - 设置面板
   - `DebugService` - 调试日志

2. 初始化核心模块
   - `TabsCore` - 标签页核心（注册全局函数）
   - `TransformCore` - 转换核心

### onLayoutReady阶段

1. `UIService.initTopBar()` - 挂载顶部按钮
2. `ConfigService.loadAndApply()` - 加载配置
3. `ThemeService.startObserving()` - 启动主题监听
4. `LifecycleService.register(eventBus)` - 注册Protyle事件
5. `LineNumberService.initEventListener()` - 初始化事件监听（tab-activated）
6. `LineNumberService.scanAll()` - 扫描行号

### onunload阶段

按相反顺序清理：
1. `LifecycleService.cleanup()` - 注销事件
2. `ThemeService.cleanup()` - 停止监听
3. `TabsCore.cleanup()` - 清理全局对象
4. `LineNumberService.cleanup()` - 清理行号与事件监听
5. `DebugService.cleanup()` - 清理日志
