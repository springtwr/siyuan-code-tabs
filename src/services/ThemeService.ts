import type { IThemeService, ThemeUpdatePlan } from "@/types/services";
import { ThemeObserver } from "./ThemeObserver";
import { StyleProbe } from "./StyleProbe";
import logger from "@/utils/logger";

/**
 * 主题服务
 * 协调主题生成、监听和样式探测，提供统一的主题管理接口
 */
export class ThemeService implements IThemeService {
    private themeObserver: ThemeObserver | null = null;
    private readonly config: {
        data: Record<string, unknown>;
        i18n: Record<string, string>;
        onSaveConfig: () => Promise<void>;
    };

    constructor(config: {
        data: Record<string, unknown>;
        i18n: Record<string, string>;
        onSaveConfig: () => Promise<void>;
    }) {
        this.config = config;
    }

    init(): void {
        logger.info("ThemeService 初始化");
    }

    cleanup(): void {
        logger.info("ThemeService 清理");
        this.stopObserving();
        StyleProbe.cleanup();
    }

    startObserving(): void {
        if (this.themeObserver) {
            logger.warn("ThemeService: 已在监听，跳过重复启动");
            return;
        }

        this.themeObserver = new ThemeObserver({
            data: this.config.data,
            i18n: this.config.i18n,
            onSaveConfig: this.config.onSaveConfig,
        });
        this.themeObserver.start();
        logger.debug("ThemeService: 主题监听已启动");
    }

    stopObserving(): void {
        if (this.themeObserver) {
            this.themeObserver.stop();
            this.themeObserver = null;
            logger.debug("ThemeService: 主题监听已停止");
        }
    }

    applyThemeStyles(plan?: ThemeUpdatePlan): void {
        if (this.themeObserver) {
            this.themeObserver.applyThemeStyles(plan);
        } else {
            logger.warn("ThemeService: themeObserver未初始化，无法应用样式");
        }
    }
}
