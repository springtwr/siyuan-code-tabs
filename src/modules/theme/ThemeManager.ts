import {deleteBlock, insertBlock, pushErrMsg, putFile} from "@/api";
import logger from "@/utils/logger";
import {CUSTOM_ATTR, CODE_STYLE_CSS, BACKGROUND_CSS, GITHUB_MARKDOWN_CSS, GITHUB_MARKDOWN_DARK_CSS, GITHUB_MARKDOWN_LIGHT_CSS, THEME_ADAPTION_YAML, THEME_ADAPTION_ASSET_YAML} from "@/assets/constants";
import {ThemePatch, ThemeStyle} from "@/assets/theme-adaption";
import {fetchFileFromUrl, fetchYamlFromUrl} from "@/utils/network";
import * as yaml from "js-yaml";

export class ThemeManager {
    static async putStyleFile(plugin: any) {
        // 配置代码样式文件
        const codeStyle = document.querySelector('link#protyleHljsStyle')?.getAttribute('href');
        const fileCodeStyle = await fetchFileFromUrl(codeStyle, 'code-style.css');
        await putFile(CODE_STYLE_CSS, false, fileCodeStyle);

        // 获取当前主题 ID
        const html = document.documentElement;
        const mode = html.getAttribute('data-theme-mode'); // "light" or "dark"
        const currentThemeId = mode === 'dark'
            ? html.getAttribute('data-dark-theme')
            : html.getAttribute('data-light-theme');

        // 加载外部主题适配配置
        const themePatches = await this.loadThemeConfig();
        const patch = themePatches.find((p: ThemePatch) => p.id === currentThemeId);

        let style: ThemeStyle;
        let extraCss = patch?.extraCss || "";

        if (patch && patch.fullStyle) {
            // 如果有完整补丁，直接使用，跳过 getCodeBlockStyle
            logger.info(`使用外部主题适配: ${patch.name}`);
            style = patch.fullStyle;
        } else {
            // 否则回退到自动采集逻辑
            style = await this.getCodeBlockStyle(plugin.i18n);
        }

        const cssContent = `
.tabs-container {
  border: ${style.border}; 
  border-radius: ${style.borderRadius};
  box-shadow: ${style.boxShadow};
  padding: ${style.blockPadding};
  margin: ${style.blockMargin};
  background-color: ${style.blockBg};
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
  background-color: ${style.hljsBg}; 
  font-family: ${style.fontFamily};
}
.hljs > div:is(.markdown-body, .code) {
  padding: ${style.editablePadding};
  margin: ${style.editableMargin};
  background-color: ${style.editableBg};
}
${extraCss}
`;
        const blob = new Blob([cssContent], {type: 'text/css'});
        const fileBackgroundStyle = new File([blob], 'styles.css', {type: 'text/css'});
        await putFile(BACKGROUND_CSS, false, fileBackgroundStyle);
        // 配置代码中markdown的样式文件
        if (mode === 'dark') {
            const darkModeFile = await fetchFileFromUrl(GITHUB_MARKDOWN_DARK_CSS, 'github-markdown.css');
            await putFile(GITHUB_MARKDOWN_CSS, false, darkModeFile);
        } else {
            const lightModeFile = await fetchFileFromUrl(GITHUB_MARKDOWN_LIGHT_CSS, 'github-markdown.css');
            await putFile(GITHUB_MARKDOWN_CSS, false, lightModeFile);
        }
    }

    static updateAllTabsStyle() {
        document.querySelectorAll(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`).forEach(node => {
            const shadowRoot = node.querySelector('protyle-html').shadowRoot;
            shadowRoot.querySelectorAll('link').forEach(link => {
                const currentHref = link.href;
                const currentTime = Date.now().toString();
                const url = new URL(currentHref);
                url.searchParams.set('t', currentTime);
                link.href = url.pathname + url.search;
            });
        });
    }

    private static async getCodeBlockStyle(i18n: any) {
        let protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
        let block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
        let i = 0;
        while (block == undefined || block.childElementCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
            protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
            block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
            i++;
            if (i > 6) break;
        }
        block = block?.lastChild as HTMLElement;
        const id = block?.dataset.nodeId;
        if (id === undefined) {
            pushErrMsg(i18n.errMsgGetBackground).then();
            return {
                blockBg: "rgb(248, 249, 250)",
                protyleActionBg: "transparent",
                hljsBg: "rgb(248, 249, 250)",
                editableBg: "rgb(248, 249, 250)",
                fontFamily: '"JetBrainsMono-Regular", mononoki, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                blockPadding: "2em 1em",
                hljsPadding: "0",
                editablePadding: "0",
                blockMargin: "1em, 0",
                hljsMargin: "0",
                editableMargin: "0",
                border: "none",
                boxShadow: "none",
                borderRadius: "6px"
            };
        }
        const result = await insertBlock("markdown", "\`\`\`python\nprint(\"code-tabs: temp block\")\n", '', id, '');
        const tempId = result[0].doOperations[0].id;
        const blockElement = document.querySelector(`[data-node-id="${tempId}"][data-type="NodeCodeBlock"]`);
        const protyleActionElement = blockElement.querySelector('.protyle-action');
        const hljsElement = blockElement.querySelector('.hljs');
        const editableElement = blockElement.querySelector('[contenteditable="true"]');

        const blockBg = window.getComputedStyle(blockElement).backgroundColor;
        const protyleActionBg = window.getComputedStyle(protyleActionElement).backgroundColor;
        const hljsBg = window.getComputedStyle(hljsElement).backgroundColor;
        const editableBg = window.getComputedStyle(editableElement).backgroundColor;

        const fontFamily = window.getComputedStyle(editableElement).fontFamily;
        let blockPadding = window.getComputedStyle(blockElement).padding;
        let hljsPadding = window.getComputedStyle(hljsElement).padding;
        const editablePadding = window.getComputedStyle(editableElement).padding;

        let [blockTop, blockRight, blockBottom, blockLeft] = this.parsePadding(blockPadding);
        let [hljsTop, hljsRight, hljsBottom, hljsLeft] = this.parsePadding(hljsPadding);
        const lineHeight = parseFloat(window.getComputedStyle(blockElement).lineHeight);
        blockTop = Math.max(blockTop, lineHeight + 4);
        blockPadding = `${blockTop}px ${blockRight}px ${blockBottom}px ${blockLeft}px`;
        hljsTop = hljsBottom == 0 ? 5 : hljsBottom;
        hljsPadding = `${hljsTop}px ${hljsRight}px ${hljsBottom}px ${hljsLeft}px`;

        const blockMargin = window.getComputedStyle(blockElement).margin;
        let hljsMargin = window.getComputedStyle(hljsElement).margin;
        let [hljsMarginTop, hljsMarginRight, hljsMarginBottom, hljsMarginLeft] = this.parsePadding(hljsMargin);
        hljsMarginTop = Math.max(0, hljsMarginTop);
        hljsMargin = `${hljsMarginTop}px ${hljsMarginRight}px ${hljsMarginBottom}px ${hljsMarginLeft}px`;
        const editableMargin = window.getComputedStyle(editableElement).margin;

        const border = window.getComputedStyle(blockElement).border;
        const boxShadow = window.getComputedStyle(blockElement).boxShadow;
        const borderRadius = window.getComputedStyle(blockElement).borderRadius;
        deleteBlock(tempId).then(() => logger.info("delete temp code-block"));

        return {
            blockBg: blockBg,
            protyleActionBg: protyleActionBg,
            hljsBg: hljsBg,
            editableBg: editableBg,
            fontFamily: fontFamily,
            blockPadding: blockPadding,
            hljsPadding: hljsPadding,
            editablePadding: editablePadding,
            blockMargin: blockMargin,
            hljsMargin: hljsMargin,
            editableMargin: editableMargin,
            border: border,
            boxShadow: boxShadow,
            borderRadius: borderRadius
        };
    }

    private static parsePadding(padding: string) {
        const paddings = padding.split(' ').map(value => parseInt(value, 10));
        let paddingTop, paddingRight, paddingBottom, paddingLeft;

        switch (paddings.length) {
            case 1:
                paddingTop = paddingRight = paddingBottom = paddingLeft = paddings[0];
                break;
            case 2:
                paddingTop = paddingBottom = paddings[0];
                paddingRight = paddingLeft = paddings[1];
                break;
            case 3:
                paddingTop = paddings[0];
                paddingRight = paddingLeft = paddings[1];
                paddingBottom = paddings[2];
                break;
            case 4:
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = paddings;
                break;
            default:
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = [0, 0, 0, 0];
        }
        return [paddingTop, paddingRight, paddingBottom, paddingLeft];
    }

    private static async loadThemeConfig(): Promise<ThemePatch[]> {
        const fetchPath = THEME_ADAPTION_YAML.replace('/data', '');
        const storagePath = THEME_ADAPTION_YAML;
        const defaultAssetPath = THEME_ADAPTION_ASSET_YAML;

        // 1. 加载默认配置 (获取最新版本和主题列表)
        let defaultConfig: { version: string, themes: ThemePatch[] } | null = null;
        try {
            logger.info("尝试加载默认主题配置...");
            defaultConfig = await fetchYamlFromUrl(defaultAssetPath, 'theme-adaption.yaml');
        } catch (e) {
            logger.warn(`加载默认主题配置失败: ${e}`);
            return [];
        }

        if (!defaultConfig) {
            logger.error("默认配置为空");
            return [];
        }

        // 2. 尝试加载用户配置
        try {
            logger.info("尝试从数据目录加载用户主题配置...");
            const userConfig = await fetchYamlFromUrl(fetchPath, 'theme-adaption.yaml');

            if (userConfig && userConfig.themes) {
                // 2.1 检查用户配置格式
                let userThemes: ThemePatch[] = userConfig.themes || [];
                let userVersion: string | undefined;

                userVersion = userConfig.version;

                // 2.2 版本检测:如果用户版本低于插件版本,进行合并
                if (!userVersion || userVersion !== defaultConfig.version) {
                    logger.info(`检测到版本变化: ${userVersion || '旧版本'} → ${defaultConfig.version}`);
                    logger.info("自动合并新主题配置...");

                    const mergedThemes = this.mergeThemeConfigs(userThemes, defaultConfig.themes);

                    if (mergedThemes.hasChanges) {
                        logger.info("发现新主题,已合并到配置");
                    }

                    // 保存合并后的配置 (更新版本号)
                    const newConfig = {
                        version: defaultConfig.version,
                        themes: mergedThemes.config
                    };
                    await this.saveYamlThemeConfig(newConfig, storagePath);
                    logger.info("已更新用户主题配置到最新版本");

                    return mergedThemes.config;
                }

                // 2.3 版本一致,直接使用用户配置
                logger.info("配置版本一致,使用用户主题配置");
                return userThemes;
            }
        } catch (e) {
            logger.info("未检测到用户配置文件");
        }

        // 3. 用户配置不存在,首次安装,初始化配置
        logger.info("首次安装,初始化主题配置文件...");
        await this.saveYamlThemeConfig(defaultConfig, storagePath);
        logger.info("已初始化用户主题配置");

        return defaultConfig.themes;
    }

    /**
     * 智能合并配置
     * 保留用户自定义 + 添加新主题
     */
    private static mergeThemeConfigs(
        userThemes: ThemePatch[],
        defaultThemes: ThemePatch[]
    ): { config: ThemePatch[], hasChanges: boolean } {
        const merged = new Map<string, ThemePatch>();
        let hasChanges = false;

        // 1. 添加所有用户配置
        userThemes.forEach(theme => {
            merged.set(theme.id, theme);
        });

        // 2. 添加默认配置中的新主题
        defaultThemes.forEach(defaultTheme => {
            if (!merged.has(defaultTheme.id)) {
                merged.set(defaultTheme.id, defaultTheme);
                hasChanges = true;
                logger.info(`新增主题: ${defaultTheme.name} (${defaultTheme.id})`);
            }
        });

        // 3. 按 id 排序
        const result = Array.from(merged.values())
            .sort((a, b) => a.id.localeCompare(b.id));

        return {config: result, hasChanges};
    }
    
    /**
     * 保存主题配置
     */
    private static async saveYamlThemeConfig(
        config: { version: string, themes: ThemePatch[] },
        path: string
    ) {
        const content = yaml.dump(config, { indent: 2 });
        const blob = new Blob([content], {type: 'application/yaml'});
        const file = new File([blob], 'theme-adaption.yaml', {type: 'application/yaml'});
        await putFile(path, false, file);
    }
}
