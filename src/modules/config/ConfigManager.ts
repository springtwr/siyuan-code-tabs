import { putFile } from "@/api";
import { CONFIG_JSON } from "@/constants";
import { compareConfig, getSiyuanConfig, syncSiyuanConfig } from "@/utils/dom";
import { fetchFileFromUrlSimple, loadJsonFromFile } from "@/utils/network";
import logger from "@/utils/logger";

export type ConfigManagerOptions = {
    data: Record<string, unknown>;
    onApplyThemeStyles: () => Promise<unknown>;
    onAfterLoad: () => void;
};

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
    return JSON.stringify(data);
}

export class ConfigManager {
    private readonly data: Record<string, unknown>;
    private readonly onApplyThemeStyles: () => Promise<unknown>;
    private readonly onAfterLoad: () => void;

    constructor(options: ConfigManagerOptions) {
        this.data = options.data;
        this.onApplyThemeStyles = options.onApplyThemeStyles;
        this.onAfterLoad = options.onAfterLoad;
    }

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
        this.onAfterLoad();
        const configFlag = compareConfig(data, this.data);
        if (!configFlag) {
            logger.info("检测到配置变更，重新生成样式文件");
            await this.onApplyThemeStyles();
        }
    }

    async saveConfig(): Promise<void> {
        syncSiyuanConfig(this.data);
        const file = new File([buildConfigPayload(this.data)], "config.json", {
            type: "application/json",
        });
        await putFile(CONFIG_JSON, false, file);
    }
}
