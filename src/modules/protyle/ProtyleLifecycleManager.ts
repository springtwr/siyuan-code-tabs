import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

/**
 * Protyle 生命周期监听与布局后处理。
 */
type RefreshOverflow = (root?: HTMLElement | ShadowRoot) => void;

type ProtyleLifecycleManagerOptions = {
    onRefreshOverflow?: RefreshOverflow;
};

/**
 * 监听 protyle 加载事件，触发行号扫描与溢出刷新。
 * 副作用：扫描 DOM、触发渲染刷新。
 */
export class ProtyleLifecycleManager {
    private readonly onRefreshOverflow?: RefreshOverflow;
    private readonly onLoadedProtyle = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    constructor(options: ProtyleLifecycleManagerOptions = {}) {
        this.onRefreshOverflow = options.onRefreshOverflow;
    }

    /**
     * 注册 protyle 事件监听（需在 onunload 中注销）。
     */
    register(eventBus: { on: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    /**
     * 注销事件监听，避免重复触发与内存泄漏。
     */
    unregister(eventBus: { off: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    /**
     * protyle 加载完成后进行二次刷新，避免布局尚未稳定。
     */
    handleProtyleLoaded(evt: unknown): void {
        const detail = (
            evt as {
                detail?: {
                    protyle?: {
                        wysiwyg?: { element?: HTMLElement }
                    };
                    element?: HTMLElement;
                };
            }
        )?.detail;
        const root = detail?.protyle?.wysiwyg?.element || detail?.element;
        LineNumberManager.scanProtyle(root);
        if (!this.onRefreshOverflow) return;
        this.onRefreshOverflow(root);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.onRefreshOverflow?.(root);
            });
        });
    }
}
