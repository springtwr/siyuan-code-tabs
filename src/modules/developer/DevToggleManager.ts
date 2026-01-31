import logger from "@/utils/logger";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { syncSiyuanConfig } from "@/utils/dom";

type ToggleKey = "codeLineWrap" | "codeLigatures" | "codeSyntaxHighlightLineNum";

/**
 * 开发模式下快速切换编辑器配置。
 */
export class DevToggleManager {
    /**
     * 切换编辑器配置并触发相关样式刷新。
     */
    static toggleEditorSetting(
        key: ToggleKey,
        data: Record<string, unknown>,
        onReload: () => void
    ): void {
        const current = window.siyuan.config.editor[key] === true;
        const next = !current;
        window.siyuan.config.editor[key] = next;

        syncSiyuanConfig(data);
        ThemeManager.putStyleFile()
            .then((result) => {
                if (result.changed) {
                    ThemeManager.updateAllTabsStyle(result);
                }
                LineNumberManager.refreshAll();
                LineNumberManager.scanAll();
                onReload();
            })
            .catch((error) => {
                logger.warn("切换配置后刷新样式失败", { key, error });
            });
        logger.info("开发快捷键切换", { key, enabled: next });
    }
}
