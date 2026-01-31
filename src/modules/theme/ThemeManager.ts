import { putFile } from "@/api";
import logger from "@/utils/logger";
import {
    BACKGROUND_CSS,
    CODE_STYLE_CSS,
    CODE_TABS_DATA_ATTR,
    CUSTOM_ATTR,
    DATA_PATH,
    GITHUB_MARKDOWN_CSS,
    GITHUB_MARKDOWN_DARK_CSS,
    GITHUB_MARKDOWN_LIGHT_CSS,
    PLUGIN_PATH,
    THEME_ADAPTION_ASSET_YAML,
    THEME_ADAPTION_YAML,
} from "@/constants";
import { ThemePatch, ThemeStyle } from "@/modules/theme/types";
import { fetchFileFromUrl, fetchYamlFromUrl } from "@/utils/network";
import * as yaml from "js-yaml";
import { StyleProbe } from "./StyleProbe";

export type ThemeUpdateResult = {
    codeStyle: boolean;
    background: boolean;
    markdown: boolean;
    changed: boolean;
};

type ThemeUpdateOptions = {
    forceProbe?: boolean;
    update?: Partial<Pick<ThemeUpdateResult, "codeStyle" | "background" | "markdown">>;
};

/**
 * 主题样式生成与更新入口。
 * 副作用：写入样式文件、触发 DOM 更新。
 */
export class ThemeManager {
    private static lastCodeStyleHref?: string;
    private static lastMarkdownMode?: "light" | "dark";
    private static lastBackgroundHash?: string;
    private static cachedThemeConfig?: {
        version: string;
        themes: ThemePatch[];
    };
    private static lastThemeKey?: string;

    /**
     * 生成并写入样式文件（代码高亮、背景与 markdown）。
     * @param options 更新选项
     * @returns 更新结果
     */
    static async putStyleFile(options: ThemeUpdateOptions = {}): Promise<ThemeUpdateResult> {
        logger.info("开始生成主题样式文件");
        const update = {
            codeStyle: true,
            background: true,
            markdown: true,
            ...options.update,
        };
        const result: ThemeUpdateResult = {
            codeStyle: false,
            background: false,
            markdown: false,
            changed: false,
        };
        // 配置代码样式文件
        if (update.codeStyle) {
            const codeStyle = document.querySelector("link#protyleHljsStyle")?.getAttribute("href");
            if (!codeStyle) {
                logger.warn("未找到代码样式链接，跳过 code-style.css 更新");
                this.lastCodeStyleHref = undefined;
            } else if (codeStyle === this.lastCodeStyleHref) {
                logger.debug("code-style.css 未变化，跳过更新");
            } else {
                const fileCodeStyle = await fetchFileFromUrl(codeStyle, "code-style.css");
                if (fileCodeStyle) {
                    await putFile(CODE_STYLE_CSS, false, fileCodeStyle);
                    this.lastCodeStyleHref = codeStyle;
                    result.codeStyle = true;
                    result.changed = true;
                } else {
                    logger.warn("获取 code-style.css 失败，跳过更新");
                }
            }
        }

        // 获取当前主题 ID
        const html = document.documentElement;
        const mode = html.getAttribute("data-theme-mode") === "dark" ? "dark" : "light";

        if (update.background) {
            const currentThemeId =
                mode === "dark"
                    ? html.getAttribute("data-dark-theme")
                    : html.getAttribute("data-light-theme");
            const themeKey = `${mode}:${currentThemeId || ""}`;

            // 加载外部主题适配配置
            const themePatches = await this.loadThemeConfig();
            const patch = themePatches.find((p: ThemePatch) => p.id === currentThemeId);

            // 获取代码块换行和连字设置
            const codeLigatures =
                window.siyuan.config.editor.codeLigatures === true ? "normal" : "none";
            const codeLineWrap =
                window.siyuan.config.editor.codeLineWrap === true ? "pre-wrap" : "pre";

            let style: ThemeStyle;
            let extraCss = patch?.extraCss || "";

            if (patch && patch.fullStyle) {
                // 如果有完整补丁，直接使用，跳过 getCodeBlockStyle
                logger.info(`使用外部主题适配: ${patch.name}`);
                style = patch.fullStyle;
            } else if (!options.forceProbe && this.lastThemeKey === themeKey) {
                style = StyleProbe.getCachedStyle();
            } else {
                // 否则回退到自动采集逻辑
                style = StyleProbe.getFullStyle();
                this.lastThemeKey = themeKey;
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
            const backgroundHash = this.hashString(cssContent);
            if (backgroundHash !== this.lastBackgroundHash) {
                const blob = new Blob([cssContent], { type: "text/css" });
                const fileBackgroundStyle = new File([blob], "styles.css", { type: "text/css" });
                await putFile(BACKGROUND_CSS, false, fileBackgroundStyle);
                this.lastBackgroundHash = backgroundHash;
                result.background = true;
                result.changed = true;
            } else {
                logger.debug("background.css 未变化，跳过更新");
            }
        }
        // 配置代码中markdown的样式文件
        if (update.markdown) {
            if (mode !== this.lastMarkdownMode) {
                const markdownCssUrl =
                    mode === "dark" ? GITHUB_MARKDOWN_DARK_CSS : GITHUB_MARKDOWN_LIGHT_CSS;
                const markdownFile = await fetchFileFromUrl(markdownCssUrl, "github-markdown.css");
                if (markdownFile) {
                    await putFile(GITHUB_MARKDOWN_CSS, false, markdownFile);
                    this.lastMarkdownMode = mode;
                    result.markdown = true;
                    result.changed = true;
                } else {
                    logger.warn("获取 markdown 样式失败，跳过更新");
                }
            } else {
                logger.debug("markdown 样式未变化，跳过更新");
            }
        }
        logger.info("主题样式文件生成完成", { changed: result.changed });
        return result;
    }

    /**
     * 清理缓存，强制下次重新采样主题样式。
     * @returns void
     */
    static invalidateStyleProbe(): void {
        this.lastThemeKey = undefined;
        StyleProbe.resetCachedStyle();
    }

    /**
     * 按需触发现有 tabs 的样式刷新。
     * @param changes 变更结果
     * @returns void
     */
    static updateAllTabsStyle(changes?: ThemeUpdateResult) {
        if (changes && !changes.changed) {
            return;
        }
        const nodes = document.querySelectorAll(
            `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}], [data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}]`
        );
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
                const pathname = url.pathname;
                if (
                    changes &&
                    !this.shouldUpdateLink(pathname, {
                        codeStyle: changes.codeStyle,
                        background: changes.background,
                        markdown: changes.markdown,
                    })
                ) {
                    return;
                }
                url.searchParams.set("t", currentTime);
                link.href = url.pathname + url.search;
            });
        });
    }

    private static shouldUpdateLink(
        pathname: string,
        changes: Pick<ThemeUpdateResult, "codeStyle" | "background" | "markdown">
    ): boolean {
        if (pathname.endsWith(CODE_STYLE_CSS.replace(DATA_PATH, PLUGIN_PATH))) {
            return changes.codeStyle;
        }
        if (pathname.endsWith(BACKGROUND_CSS.replace(DATA_PATH, PLUGIN_PATH))) {
            return changes.background;
        }
        if (pathname.endsWith(GITHUB_MARKDOWN_CSS.replace(DATA_PATH, PLUGIN_PATH))) {
            return changes.markdown;
        }
        return false;
    }

    /**
     * 用于判定样式内容是否变化（减少写文件次数）。
     * @param input 输入字符串
     * @returns hash 字符串
     */
    private static hashString(input: string): string {
        let hash = 2166136261;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16);
    }

    /**
     * 加载外部主题适配配置（YAML）。
     * @returns 主题补丁列表
     */
    private static async loadThemeConfig(): Promise<ThemePatch[]> {
        const fetchPath = THEME_ADAPTION_YAML.replace("/data", "");
        const storagePath = THEME_ADAPTION_YAML;
        const defaultAssetPath = THEME_ADAPTION_ASSET_YAML;

        if (this.cachedThemeConfig) {
            return this.cachedThemeConfig.themes;
        }

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
                this.cachedThemeConfig = newConfig;
                return newConfig.themes;
            }

            logger.info("配置版本一致,使用用户主题配置");
            this.cachedThemeConfig = {
                version: userResult.config.version,
                themes: userThemes,
            };
            return userThemes;
        }

        if (userResult.invalid) {
            logger.warn("用户主题配置格式不正确，使用默认配置");
        }

        logger.info("首次安装,初始化主题配置文件...");
        await this.saveYamlThemeConfig(defaultConfig, storagePath);
        logger.info("已初始化用户主题配置");
        this.cachedThemeConfig = {
            version: defaultConfig.version,
            themes: defaultConfig.themes,
        };
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
