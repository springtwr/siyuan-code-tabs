import { getActiveEditor } from "siyuan";

import logger from "@/utils/logger";

type RefreshOverflow = (root?: HTMLElement | ShadowRoot) => void;

type EditorRefreshManagerOptions = {
    getActiveEditor?: (readOnly?: boolean) => { reload: (reset?: boolean) => void } | null;
    getRefreshOverflow?: () => RefreshOverflow | undefined;
};

export class EditorRefreshManager {
    private readonly getEditor: (readOnly?: boolean) => { reload: (reset?: boolean) => void } | null;
    private getRefreshOverflow: () => RefreshOverflow | undefined;

    constructor(options: EditorRefreshManagerOptions = {}) {
        this.getEditor = options.getActiveEditor ?? ((readOnly) => getActiveEditor(readOnly));
        this.getRefreshOverflow =
            options.getRefreshOverflow ??
            (() =>
                (window as typeof window & {
                    pluginCodeTabs?: { refreshOverflow?: RefreshOverflow };
                }).pluginCodeTabs?.refreshOverflow);
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
}
