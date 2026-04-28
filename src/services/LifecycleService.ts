import { getActiveEditor } from "siyuan";

import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import logger from "@/utils/logger";

type RefreshOverflow = (root?: HTMLElement | ShadowRoot) => void;

type LifecycleServiceOptions = {
    getActiveEditor?: (readOnly?: boolean) => { reload: (reset?: boolean) => void } | null;
    getRefreshOverflow?: () => RefreshOverflow | undefined;
};

/**
 * 生命周期服务
 * 合并编辑器刷新和Protyle事件监听功能
 */
export class LifecycleService {
    private readonly getEditor: (
        readOnly?: boolean
    ) => { reload: (reset?: boolean) => void } | null;
    private getRefreshOverflow: () => RefreshOverflow | undefined;
    private readonly onLoadedProtyle = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    constructor(options: LifecycleServiceOptions = {}) {
        this.getEditor = options.getActiveEditor ?? ((readOnly) => getActiveEditor(readOnly));
        this.getRefreshOverflow =
            options.getRefreshOverflow ??
            (() =>
                (
                    window as typeof window & {
                        pluginCodeTabs?: { refreshOverflow?: RefreshOverflow };
                    }
                ).pluginCodeTabs?.refreshOverflow);
    }

    setRefreshOverflowProvider(provider: () => RefreshOverflow | undefined): void {
        this.getRefreshOverflow = provider;
    }

    reloadActiveDocument(): void {
        const activeEditor = this.getEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            activeEditor.reload(true);
        }
    }

    refreshOverflow(root?: HTMLElement | ShadowRoot): void {
        const refresh = this.getRefreshOverflow();
        if (refresh) {
            refresh(root);
        }
    }

    register(eventBus: { on: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    unregister(eventBus: { off: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    private handleProtyleLoaded(evt: unknown): void {
        const detail = (
            evt as {
                detail?: {
                    protyle?: {
                        wysiwyg?: { element?: HTMLElement };
                    };
                    element?: HTMLElement;
                };
            }
        )?.detail;
        const root = detail?.protyle?.wysiwyg?.element || detail?.element;
        LineNumberManager.scanProtyle(root);
        this.refreshOverflow(root);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.refreshOverflow(root);
            });
        });
    }

    cleanup(): void {
        // 清理逻辑（如有需要）
    }
}
