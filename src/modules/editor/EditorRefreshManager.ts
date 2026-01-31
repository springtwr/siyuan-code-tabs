import { getActiveEditor } from "siyuan";

import logger from "@/utils/logger";

/**
 * 编辑器刷新能力的薄封装，避免上层直接耦合 Siyuan Editor 实例。
 */
type RefreshOverflow = (root?: HTMLElement | ShadowRoot) => void;

type EditorRefreshManagerOptions = {
    getActiveEditor?: (readOnly?: boolean) => { reload: (reset?: boolean) => void } | null;
    getRefreshOverflow?: () => RefreshOverflow | undefined;
};

/**
 * 负责触发编辑器刷新与溢出重算。
 * 副作用：调用编辑器 reload / 触发 DOM 渲染刷新。
 */
export class EditorRefreshManager {
    private readonly getEditor: (
        readOnly?: boolean
    ) => { reload: (reset?: boolean) => void } | null;
    private getRefreshOverflow: () => RefreshOverflow | undefined;

    constructor(options: EditorRefreshManagerOptions = {}) {
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

    /**
     * 注入刷新回调，避免模块之间的强引用。
     * @param provider 回调提供器
     * @returns void
     */
    setRefreshOverflowProvider(provider: () => RefreshOverflow | undefined): void {
        this.getRefreshOverflow = provider;
    }

    /**
     * 刷新当前文档（重建渲染）。
     * @returns void
     */
    reloadActiveDocument(): void {
        const activeEditor = this.getEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            activeEditor.reload(true);
        }
    }

    /**
     * 刷新 overflow 与行号等依赖布局的计算。
     * @param root 可选的根节点
     * @returns void
     */
    refreshOverflow(root?: HTMLElement | ShadowRoot): void {
        const refresh = this.getRefreshOverflow();
        if (refresh) {
            refresh(root);
        }
    }
}
