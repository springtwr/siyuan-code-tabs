import { putFile } from "@/api";
import logger from "@/utils/logger";
import {
    BACKGROUND_CSS,
    CODE_STYLE_CSS,
    CUSTOM_ATTR,
    GITHUB_MARKDOWN_CSS,
    GITHUB_MARKDOWN_DARK_CSS,
    GITHUB_MARKDOWN_LIGHT_CSS,
    THEME_ADAPTION_ASSET_YAML,
    THEME_ADAPTION_YAML,
} from "@/constants";
import { ThemePatch, ThemeStyle } from "@/modules/theme/types";
import { fetchFileFromUrl, fetchYamlFromUrl } from "@/utils/network";
import * as yaml from "js-yaml";
import { StyleProbe } from "./StyleProbe";

export class ThemeManager {
    static async putStyleFile() {
        logger.info("开始生成主题样式文件");
        // 配置代码样式文件
        const codeStyle = document.querySelector("link#protyleHljsStyle")?.getAttribute("href");
        if (!codeStyle) {
            logger.warn("未找到代码样式链接，跳过 code-style.css 更新");
        } else {
            const fileCodeStyle = await fetchFileFromUrl(codeStyle, "code-style.css");
            await putFile(CODE_STYLE_CSS, false, fileCodeStyle);
        }

        // 获取当前主题 ID
        const html = document.documentElement;
        const mode = html.getAttribute("data-theme-mode"); // "light" or "dark"
        const currentThemeId =
            mode === "dark"
                ? html.getAttribute("data-dark-theme")
                : html.getAttribute("data-light-theme");

        // 加载外部主题适配配置
        const themePatches = await this.loadThemeConfig();
        const patch = themePatches.find((p: ThemePatch) => p.id === currentThemeId);

        // 获取代码块换行和连字设置
        const codeLigatures =
            window.siyuan.config.editor.codeLigatures === true ? "normal" : "none";
        const codeLineWrap = window.siyuan.config.editor.codeLineWrap === true ? "pre-wrap" : "pre";

        let style: ThemeStyle;
        let extraCss = patch?.extraCss || "";

        if (patch && patch.fullStyle) {
            // 如果有完整补丁，直接使用，跳过 getCodeBlockStyle
            logger.info(`使用外部主题适配: ${patch.name}`);
            style = patch.fullStyle;
        } else {
            // 否则回退到自动采集逻辑
            style = StyleProbe.getFullStyle();
        }

        const cssContent = `
.tabs-container {
  font-size: ${style.fontSize};
  line-height: ${style.lineHeight};
  color: ${style.color};
  border: ${style.border}; 
  border-left: ${style.borderLeft}; 
  border-radius: ${style.borderRadius};
  box-shadow: ${style.boxShadow};
  padding: ${style.blockPadding};
  margin: ${style.blockMargin};
  background-color: ${style.blockBg};
}
.tabs-outer {
  position: ${style.protyleActionPosition} !important;
  border-bottom: ${style.protyleActionBorderBottom};
}
.tabs {
  background-color: ${style.protyleActionBg};
}
.tab-toggle {
  background-color: ${style.protyleActionBg};
}
.tab-contents > .hljs { 
  padding: ${style.hljsPadding};
  margin: ${style.hljsMargin};
  border-top: ${style.hljsBorderTop};
  background-color: ${style.hljsBg}; 
  font-family: ${style.fontFamily};
  ${style.hljsOverflowY ? `overflow-y: ${style.hljsOverflowY};` : ""}
  ${style.hljsOverflowY && style.hljsMaxHeight ? `max-height: ${style.hljsMaxHeight};` : ""}
}
.hljs > :is(.code, .markdown-body) {
  padding: ${style.editablePadding};
}
.hljs > .code {
  font-variant-ligatures: ${codeLigatures};
  white-space: ${codeLineWrap} !important;
}
${extraCss}
`;
        const blob = new Blob([cssContent], { type: "text/css" });
        const fileBackgroundStyle = new File([blob], "styles.css", { type: "text/css" });
        await putFile(BACKGROUND_CSS, false, fileBackgroundStyle);
        // 配置代码中markdown的样式文件
        if (mode === "dark") {
            const darkModeFile = await fetchFileFromUrl(
                GITHUB_MARKDOWN_DARK_CSS,
                "github-markdown.css"
            );
            await putFile(GITHUB_MARKDOWN_CSS, false, darkModeFile);
        } else {
            const lightModeFile = await fetchFileFromUrl(
                GITHUB_MARKDOWN_LIGHT_CSS,
                "github-markdown.css"
            );
            await putFile(GITHUB_MARKDOWN_CSS, false, lightModeFile);
        }
        logger.info("主题样式文件生成完成");
    }

    static updateAllTabsStyle() {
        const nodes = document.querySelectorAll(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
        if (nodes.length === 0) return;
        logger.info("刷新标签页样式链接", { count: nodes.length });
        const currentTime = Date.now().toString();
        nodes.forEach((node) => {
            const shadowRoot = node.querySelector("protyle-html")?.shadowRoot;
            if (!shadowRoot) return;
            shadowRoot.querySelectorAll("link").forEach((link) => {
                const currentHref = link.href;
                if (!currentHref || !currentHref.includes("/plugins/code-tabs/")) return;
                const url = new URL(currentHref);
                url.searchParams.set("t", currentTime);
                link.href = url.pathname + url.search;
            });
        });
    }

    private static async loadThemeConfig(): Promise<ThemePatch[]> {
        const fetchPath = THEME_ADAPTION_YAML.replace("/data", "");
        const storagePath = THEME_ADAPTION_YAML;
        const defaultAssetPath = THEME_ADAPTION_ASSET_YAML;

        const defaultConfig = await this.loadDefaultThemeConfig(defaultAssetPath);
        if (!defaultConfig) return [];

        const userResult = await this.loadUserThemeConfig(fetchPath);
        if (userResult.config) {
            const userThemes = userResult.config.themes || [];
            const userVersion = userResult.config.version;

            if (!userVersion || userVersion !== defaultConfig.version) {
                logger.info(
                    `检测到版本变化: ${userVersion || "旧版本"} → ${defaultConfig.version}`
                );
                logger.info("自动合并新主题配置...");

                const mergedThemes = this.mergeThemeConfigs(userThemes, defaultConfig.themes);
                if (mergedThemes.hasChanges) {
                    logger.info("发现新主题,已合并到配置");
                }

                const newConfig = {
                    version: defaultConfig.version,
                    themes: mergedThemes.config,
                };
                await this.saveYamlThemeConfig(newConfig, storagePath);
                logger.info("已更新用户主题配置到最新版本");
                return mergedThemes.config;
            }

            logger.info("配置版本一致,使用用户主题配置");
            return userThemes;
        }

        if (userResult.invalid) {
            logger.warn("用户主题配置格式不正确，使用默认配置");
        }

        logger.info("首次安装,初始化主题配置文件...");
        await this.saveYamlThemeConfig(defaultConfig, storagePath);
        logger.info("已初始化用户主题配置");
        return defaultConfig.themes;
    }

    private static async loadDefaultThemeConfig(assetPath: string): Promise<ThemeConfig | null> {
        try {
            logger.info("尝试加载默认主题配置...");
            const defaultConfigRaw = await fetchYamlFromUrl(assetPath, "theme-adaption.yaml");
            if (!isThemeConfig(defaultConfigRaw)) {
                logger.error("默认主题配置格式不正确");
                return null;
            }
            logger.debug("默认主题配置已加载", {
                version: defaultConfigRaw.version,
                themeCount: defaultConfigRaw.themes.length,
            });
            return defaultConfigRaw;
        } catch (e) {
            logger.warn(`加载默认主题配置失败: ${e}`);
            return null;
        }
    }

    private static async loadUserThemeConfig(fetchPath: string): Promise<{
        config?: ThemeConfig;
        invalid?: boolean;
    }> {
        try {
            logger.info("尝试从数据目录加载用户主题配置...");
            const userConfigRaw = await fetchYamlFromUrl(fetchPath, "theme-adaption.yaml");
            if (isThemeConfig(userConfigRaw)) {
                logger.debug("用户主题配置已加载", {
                    version: userConfigRaw.version,
                    themeCount: userConfigRaw.themes.length,
                });
                return { config: userConfigRaw };
            }
            if (userConfigRaw) {
                return { invalid: true };
            }
        } catch {
            logger.info("未检测到用户配置文件");
        }
        return {};
    }

    /**
     * 智能合并配置
     * 保留用户自定义 + 添加新主题
     */
    private static mergeThemeConfigs(
        userThemes: ThemePatch[],
        defaultThemes: ThemePatch[]
    ): { config: ThemePatch[]; hasChanges: boolean } {
        const merged = new Map<string, ThemePatch>();
        let hasChanges = false;

        // 1. 添加所有用户配置
        userThemes.forEach((theme) => {
            merged.set(theme.id, theme);
        });

        // 2. 添加默认配置中的新主题
        defaultThemes.forEach((defaultTheme) => {
            if (!merged.has(defaultTheme.id)) {
                merged.set(defaultTheme.id, defaultTheme);
                hasChanges = true;
                logger.info(`新增主题: ${defaultTheme.name} (${defaultTheme.id})`);
            }
        });

        // 3. 按 id 排序
        const result = Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));

        return { config: result, hasChanges };
    }

    /**
     * 保存主题配置
     */
    private static async saveYamlThemeConfig(
        config: { version: string; themes: ThemePatch[] },
        path: string
    ) {
        const content = yaml.dump(config, { indent: 2 });
        const blob = new Blob([content], { type: "application/yaml" });
        const file = new File([blob], "theme-adaption.yaml", { type: "application/yaml" });
        await putFile(path, false, file);
    }
}

type ThemeConfig = {
    version: string;
    themes: ThemePatch[];
};

function isThemeConfig(value: unknown): value is ThemeConfig {
    if (typeof value !== "object" || value === null) return false;
    if (!("version" in value) || !("themes" in value)) return false;
    const config = value as { version?: unknown; themes?: unknown };
    return typeof config.version === "string" && Array.isArray(config.themes);
}
