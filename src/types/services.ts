/**
 * 服务层接口定义
 */

/**
 * 生命周期接口
 */
export interface ILifecycle {
    init(): void;
    cleanup(): void;
}

/**
 * 事件总线接口
 */
export interface IEventBus {
    on(name: string, callback: (evt: unknown) => void): void;
    off(name: string, callback: (evt: unknown) => void): void;
}

/**
 * 编辑器刷新服务接口
 */
export interface IEditorRefreshService {
    reloadActiveDocument(): void;
    refreshOverflow(root?: HTMLElement | ShadowRoot): void;
    setRefreshOverflowProvider(
        provider: () => ((root?: HTMLElement | ShadowRoot) => void) | undefined
    ): void;
}

/**
 * Protyle生命周期服务接口
 */
export interface IProtyleLifecycleService {
    register(eventBus: IEventBus): void;
    unregister(eventBus: IEventBus): void;
}

/**
 * LifecycleService依赖配置
 */
export interface LifecycleServiceDeps {
    editorRefreshService: IEditorRefreshService;
    protyleLifecycleService: IProtyleLifecycleService;
}

/**
 * 生命周期服务接口
 * 协调编辑器刷新和Protyle事件监听
 */
export interface ILifecycleService extends ILifecycle {
    refreshActiveDocument(): void;
    refreshOverflow(root?: HTMLElement | ShadowRoot): void;
    setRefreshOverflowProvider(
        provider: () => ((root?: HTMLElement | ShadowRoot) => void) | undefined
    ): void;
    registerEventListeners(eventBus: IEventBus): void;
    unregisterEventListeners(eventBus: IEventBus): void;
}

/**
 * 主题更新计划
 */
export interface ThemeUpdatePlan {
    codeStyle: boolean;
    background: boolean;
    markdown: boolean;
    lineNumbers: boolean;
    forceProbe: boolean;
}

/**
 * 主题服务接口
 * 协调主题生成、监听和样式探测
 */
export interface IThemeService extends ILifecycle {
    startObserving(): void;
    stopObserving(): void;
    applyThemeStyles(plan?: ThemeUpdatePlan): void;
}
