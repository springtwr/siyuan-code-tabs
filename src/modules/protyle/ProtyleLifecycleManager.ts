import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

type RefreshOverflow = (root?: HTMLElement | ShadowRoot) => void;

type ProtyleLifecycleManagerOptions = {
    onRefreshOverflow?: RefreshOverflow;
};

export class ProtyleLifecycleManager {
    private readonly onRefreshOverflow?: RefreshOverflow;
    private readonly onLoadedProtyle = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    constructor(options: ProtyleLifecycleManagerOptions = {}) {
        this.onRefreshOverflow = options.onRefreshOverflow;
    }

    register(eventBus: { on: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    unregister(eventBus: { off: (name: string, callback: (evt: unknown) => void) => void }): void {
        eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
        eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    handleProtyleLoaded(evt: unknown): void {
        const detail = (
            evt as {
                detail?: {
                    protyle?: { contentElement?: HTMLElement };
                    element?: HTMLElement;
                };
            }
        )?.detail;
        const root = detail?.protyle?.contentElement || detail?.element;
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
