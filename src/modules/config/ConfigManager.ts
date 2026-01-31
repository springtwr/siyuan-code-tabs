import { putFile } from "@/api";
import { CONFIG_JSON } from "@/constants";
import { compareConfig, getSiyuanConfig, syncSiyuanConfig } from "@/utils/dom";
import { fetchFileFromUrlSimple, loadJsonFromFile } from "@/utils/network";
import logger from "@/utils/logger";

/**
 * 配置加载、合并与保存的编排入口。
 */
export type ConfigManagerOptions = {
    data: Record<string, unknown>;
    onApplyThemeStyles: () => Promise<unknown>;
    onAfterLoad: () => void;
};

const CONFIG_VERSION_KEY = "configVersion";
const CURRENT_CONFIG_VERSION = 1;
const DEPRECATED_CONFIG_KEYS: string[] = [];

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function mergeCustomConfig(
    target: Record<string, unknown>,
    value: unknown,
    reserved: Record<string, unknown>
): void {
    if (!isRecord(value)) return;
    Object.keys(value).forEach((key) => {
        if (key in reserved) return;
        target[key] = value[key];
    });
}

export function buildConfigPayload(data: Record<string, unknown>): string {
    const payload = {
        ...data,
        [CONFIG_VERSION_KEY]: CURRENT_CONFIG_VERSION,
    };
    return JSON.stringify(payload);
}

function cleanupDeprecatedKeys(target: Record<string, unknown>): void {
    if (DEPRECATED_CONFIG_KEYS.length === 0) return;
    DEPRECATED_CONFIG_KEYS.forEach((key) => {
        if (key in target) {
            delete target[key];
        }
    });
}

/**
 * 负责插件配置文件的加载与写入。
 * 副作用：写入配置文件、触发主题样式更新。
 */
export class ConfigManager {
    private readonly data: Record<string, unknown>;
    private readonly onApplyThemeStyles: () => Promise<unknown>;
    private readonly onAfterLoad: () => void;

    constructor(options: ConfigManagerOptions) {
        this.data = options.data;
        this.onApplyThemeStyles = options.onApplyThemeStyles;
        this.onAfterLoad = options.onAfterLoad;
    }

    /**
     * 加载配置并触发必要的样式更新。
     */
    async loadAndApply(): Promise<void> {
        const configFile = await fetchFileFromUrlSimple(
            CONFIG_JSON.replace("/data", ""),
            "config.json"
        );
        if (configFile === undefined || configFile.size === 0) {
            logger.info("未检测到配置文件，初始化样式文件");
            await this.onApplyThemeStyles();
            return;
        }
        const data = await loadJsonFromFile(configFile);
        mergeCustomConfig(this.data, data, getSiyuanConfig());
        this.data[CONFIG_VERSION_KEY] = CURRENT_CONFIG_VERSION;
        cleanupDeprecatedKeys(this.data);
        this.onAfterLoad();
        const configFlag = compareConfig(data, this.data);
        if (!configFlag) {
            logger.info("检测到配置变更，重新生成样式文件");
            await this.onApplyThemeStyles();
        }
    }

    /**
     * 写入配置文件（含版本号）。
     */
    async saveConfig(): Promise<void> {
        syncSiyuanConfig(this.data);
        const file = new File([buildConfigPayload(this.data)], "config.json", {
            type: "application/json",
        });
        await putFile(CONFIG_JSON, false, file);
    }
}
