import { getActiveEditor, Plugin, Setting, type IMenu } from "siyuan";
import { pushErrMsg, putFile } from "@/api";
import logger from "@/utils/logger";
import {
    CONFIG_JSON,
    CUSTOM_ATTR,
    DEBUG_LOG,
    HTML_BLOCK_STYLE,
    settingIconMain,
} from "@/constants";
import { TabConverter } from "@/modules/tabs/TabConverter";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { TabManager } from "@/modules/tabs/TabManager";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { DevToggleManager } from "@/modules/developer/DevToggleManager";
import { fetchFileFromUrlSimple, loadJsonFromFile } from "@/utils/network";
import { compareConfig, getSelectedElements, getSiyuanConfig, syncSiyuanConfig } from "@/utils/dom";
import { debounce } from "@/utils/common";
import { t } from "@/utils/i18n";

export default class CodeTabs extends Plugin {
    private readonly activeColorKey = "codeTabsActiveColor";
    private readonly defaultActiveColor = "#7f6df2";
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private tabConverter!: TabConverter;
    private themeObserver?: MutationObserver;
    private injectedStyleEl?: HTMLStyleElement;
    private activeColorInput?: HTMLInputElement;
    private logBuffer: string[] = [];
    private flushLogFile: () => void = () => {};
    private onLoadedProtyleStatic = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };
    private onLoadedProtyleDynamic = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        logger.info("插件加载开始");
        logger.setDebugEnabled(this.getDebugEnabled());
        this.initLogWriter();
        logger.info(
            '如需开启 debug，请在控制台运行：localStorage.setItem("code-tabs.debug", "true")'
        );

        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${t(this.i18n, "msg.notAllowHtmlBlockScript")}`).then();
        }

        // 注入全局样式，移除 html 块默认的 padding
        this.injectedStyleEl = document.createElement("style");
        this.injectedStyleEl.innerHTML = HTML_BLOCK_STYLE;
        document.head.appendChild(this.injectedStyleEl);

        TabManager.initGlobalFunctions(this.i18n, (nodeId, order) => {
            this.tabConverter.reorderTabsInBlock(nodeId, order);
        });
        logger.info("全局函数已注册");
        this.tabConverter = new TabConverter(this.i18n, () => this.reloadActivateDocument());
        this.ensureActiveColorSettings();
        this.applyActiveTabColors();

        // 添加设置项
        this.setting = new Setting({
            confirmCallback: () => {},
        });
        const allTabsToCodeElement = document.createElement("button");
        allTabsToCodeElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        allTabsToCodeElement.textContent = `${t(this.i18n, "setting.allTabsToCode.button")}`;
        allTabsToCodeElement.addEventListener("click", () => {
            this.tabConverter.allTabsToCode();
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.allTabsToCode.title")}`,
            description: `${t(this.i18n, "setting.allTabsToCode.desc")}`,
            actionElement: allTabsToCodeElement,
        });
        const allTabsToPlainCodeElement = document.createElement("button");
        allTabsToPlainCodeElement.className =
            "b3-button b3-button--outline fn__flex-center fn__size200";
        allTabsToPlainCodeElement.textContent = `${t(this.i18n, "setting.allTabsToPlainCode.button")}`;
        allTabsToPlainCodeElement.addEventListener("click", () => {
            this.tabConverter.allTabsToPlainCode();
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.allTabsToPlainCode.title")}`,
            description: `${t(this.i18n, "setting.allTabsToPlainCode.desc")}`,
            actionElement: allTabsToPlainCodeElement,
        });

        const activeColorWrapper = document.createElement("div");
        activeColorWrapper.className = "fn__flex fn__flex-center";
        activeColorWrapper.style.gap = "6px";
        activeColorWrapper.style.flexDirection = "column";
        activeColorWrapper.style.alignItems = "flex-end";

        const activeColorInput = document.createElement("input");
        activeColorInput.type = "color";
        activeColorInput.value = this.getActiveColorValue() ?? this.defaultActiveColor;
        activeColorInput.style.width = "200px";
        activeColorInput.style.height = "28px";
        activeColorInput.style.padding = "0";
        activeColorInput.style.border = "none";
        activeColorInput.style.borderRadius = "6px";
        activeColorInput.style.background = "transparent";
        activeColorInput.style.cursor = "pointer";
        this.activeColorInput = activeColorInput;

        const resetButton = document.createElement("button");
        resetButton.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        resetButton.textContent = `${t(this.i18n, "setting.activeColor.reset")}`;

        const applyColors = () => {
            this.applyActiveTabColors();
            this.saveConfig();
        };

        activeColorInput.addEventListener("input", () => {
            this.data[this.activeColorKey] = activeColorInput.value;
            applyColors();
        });
        resetButton.addEventListener("click", () => {
            this.data[this.activeColorKey] = "";
            activeColorInput.value = this.defaultActiveColor;
            applyColors();
        });

        activeColorWrapper.appendChild(activeColorInput);
        activeColorWrapper.appendChild(resetButton);
        this.setting.addItem({
            title: `${t(this.i18n, "setting.activeColor.title")}`,
            description: `${t(this.i18n, "setting.activeColor.desc")}`,
            actionElement: activeColorWrapper,
        });

        const debugToggle = document.createElement("input");
        debugToggle.type = "checkbox";
        debugToggle.className = "b3-switch";
        debugToggle.checked = this.getDebugEnabled();
        debugToggle.addEventListener("change", () => {
            this.setDebugEnabled(debugToggle.checked);
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.debug.title")}`,
            description: `${t(this.i18n, "setting.debug.desc")}`,
            actionElement: debugToggle,
        });

        // 注册快捷方式
        this.addCommand({
            langKey: t(this.i18n, "menu.block.codeToTabs"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabConverter.codeToTabsBatch(blockList);
            },
        });
        this.addCommand({
            langKey: t(this.i18n, "menu.block.tabToCode"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(
                    `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`
                );
                this.tabConverter.tabToCodeBatch(blockList);
            },
        });
        this.addCommand({
            langKey: t(this.i18n, "menu.more.tabsToPlainCode"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(
                    `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`
                );
                this.tabConverter.tabsToPlainCodeBlocksBatch(blockList);
            },
        });
        this.addCommand({
            langKey: t(this.i18n, "menu.more.mergeCodeBlocks"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabConverter.mergeCodeBlocksToTabSyntax(blockList);
            },
        });
        logger.info("命令与设置项注册完成");
    }

    async onLayoutReady() {
        logger.info("布局就绪，开始初始化");

        this.addTopBar({
            icon: settingIconMain,
            title: "code-tabs",
            position: "right",
            callback: () => {
                this.openSetting();
            },
        });

        syncSiyuanConfig(this.data);
        logger.info("同步思源配置完成", { configKeys: Object.keys(this.data) });

        const configFile = await fetchFileFromUrlSimple(
            CONFIG_JSON.replace("/data", ""),
            "config.json"
        );
        if (configFile === undefined || configFile.size === 0) {
            logger.info("未检测到配置文件，初始化样式文件");
            await ThemeManager.putStyleFile();
            await this.saveConfig();
            ThemeManager.updateAllTabsStyle();
        } else {
            const data = await loadJsonFromFile(configFile);
            this.mergeCustomConfig(data);
            this.ensureActiveColorSettings();
            this.applyActiveTabColors();
            if (this.activeColorInput) {
                const value = this.getActiveColorValue() ?? this.defaultActiveColor;
                this.activeColorInput.value = value;
            }
            const configFlag = compareConfig(data, this.data);
            if (!configFlag) {
                logger.info("检测到配置变更，重新生成样式文件");
                await ThemeManager.putStyleFile();
                await this.saveConfig();
                ThemeManager.updateAllTabsStyle();
            }
        }

        const html = document.documentElement;
        const head = document.head;
        const callback = (mutationsList: MutationRecord[]) => {
            const siyuanConfig = getSiyuanConfig();
            for (const mutation of mutationsList) {
                // 1. 检查思源基础配置是否有变动
                if (!compareConfig(siyuanConfig, this.data)) {
                    debounced();
                    break;
                }

                // 2. 检查 html 元素和 head 中主题相关的变动
                const isThemeLink = (node: Node) => {
                    return (
                        node instanceof HTMLLinkElement && node.href.includes("/appearance/themes/")
                    );
                };

                if (
                    mutation.target === document.documentElement &&
                    mutation.type === "attributes"
                ) {
                    // html 元素的任何属性变动 (如 data-theme-mode, savor-theme 等)
                    debounced();
                    break;
                }

                if (mutation.type === "childList") {
                    const nodes = [
                        ...Array.from(mutation.addedNodes as NodeList),
                        ...Array.from(mutation.removedNodes as NodeList),
                    ];
                    if (nodes.some((node: Node) => isThemeLink(node))) {
                        debounced();
                        break;
                    }
                } else if (mutation.type === "attributes") {
                    if (isThemeLink(mutation.target as Node)) {
                        debounced();
                        break;
                    }
                }
            }
        };

        const putFileHandler = () => {
            logger.info(t(this.i18n, "msg.codeStyleChange"));
            ThemeManager.putStyleFile().then(() => {
                syncSiyuanConfig(this.data);
                this.saveConfig();
                ThemeManager.updateAllTabsStyle();
                LineNumberManager.refreshAll();
            });
        };

        const debounced = debounce(putFileHandler, 500);
        this.themeObserver = new MutationObserver(callback);
        this.themeObserver.observe(html, { attributes: true, childList: false, subtree: false });
        this.themeObserver.observe(head, { attributes: true, childList: true, subtree: true });

        this.eventBus.on("loaded-protyle-static", this.onLoadedProtyleStatic);
        this.eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyleDynamic);
        LineNumberManager.scanAll();
        logger.info("行号扫描完成");
    }

    onunload() {
        this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
        this.eventBus.off("loaded-protyle-static", this.onLoadedProtyleStatic);
        this.eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyleDynamic);
        this.themeObserver?.disconnect();
        this.themeObserver = undefined;
        this.tabConverter?.cancelCurrentTask();
        LineNumberManager.cleanup();
        logger.setLogWriter(undefined);
        if (this.injectedStyleEl) {
            this.injectedStyleEl.remove();
            this.injectedStyleEl = undefined;
        }
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
        logger.info("插件卸载完成");
    }

    private blockIconEvent({ detail }: { detail: BlockIconEventDetail }) {
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.block.codeToTabs"),
            click: () => {
                const blockList: HTMLElement[] = [];
                for (const item of detail.blockElements as HTMLElement[]) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        blockList.push(item);
                    }
                }
                this.tabConverter.codeToTabsBatch(blockList);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.block.tabToCode"),
            click: () => {
                const blockList: HTMLElement[] = [];
                for (const item of detail.blockElements) {
                    const isCodeTab = (item as HTMLElement).hasAttribute(`${CUSTOM_ATTR}`);
                    if (isCodeTab && item.dataset?.type === "NodeHTMLBlock") {
                        blockList.push(item);
                    }
                }
                this.tabConverter.tabToCodeBatch(blockList);
            },
        });
        const submenuItems: IMenu[] = [
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.tabsToPlainCode"),
                click: () => {
                    const blockList: HTMLElement[] = [];
                    for (const item of detail.blockElements) {
                        const isCodeTab = (item as HTMLElement).hasAttribute(`${CUSTOM_ATTR}`);
                        if (isCodeTab && item.dataset?.type === "NodeHTMLBlock") {
                            blockList.push(item);
                        }
                    }
                    this.tabConverter.tabsToPlainCodeBlocksBatch(blockList);
                },
            },
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.mergeCodeBlocks"),
                click: () => {
                    const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                    this.tabConverter.mergeCodeBlocksToTabSyntax(blockList);
                },
            },
            {
                type: "separator" as const,
            },
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.codeToTabsInDocument"),
                click: () => {
                    this.tabConverter.codeToTabsInDocument();
                },
            },
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.tabToCodeInDocument"),
                click: () => {
                    this.tabConverter.tabToCodeInDocument();
                },
            },
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.tabsToPlainCodeInDocument"),
                click: () => {
                    this.tabConverter.tabsToPlainCodeInDocument();
                },
            },
        ];
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.title"),
            type: "submenu",
            submenu: submenuItems,
        });
        if (process.env.DEV_MODE === "true") {
            detail.menu.addItem({ type: "separator" });
            detail.menu.addItem({
                iconHTML: "",
                label: t(this.i18n, "menu.dev.title"),
                type: "readonly",
            });
            detail.menu.addItem({
                iconHTML: "",
                label: t(this.i18n, "menu.dev.toggleLineWrap"),
                click: () => {
                    DevToggleManager.toggleEditorSetting("codeLineWrap", this.data, () =>
                        this.reloadActivateDocument()
                    );
                },
            });
            detail.menu.addItem({
                iconHTML: "",
                label: t(this.i18n, "menu.dev.toggleLigatures"),
                click: () => {
                    DevToggleManager.toggleEditorSetting("codeLigatures", this.data, () =>
                        this.reloadActivateDocument()
                    );
                },
            });
            detail.menu.addItem({
                iconHTML: "",
                label: t(this.i18n, "menu.dev.toggleLineNumber"),
                click: () => {
                    DevToggleManager.toggleEditorSetting(
                        "codeSyntaxHighlightLineNum",
                        this.data,
                        () => this.reloadActivateDocument()
                    );
                },
            });
        }
    }

    private reloadActivateDocument() {
        const activeEditor = getActiveEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            // activeEditor.reload(true);
        }
    }

    private ensureActiveColorSettings(): void {
        if (!(this.activeColorKey in this.data)) {
            this.data[this.activeColorKey] = "";
        }
    }

    private getActiveColorValue(): string | undefined {
        const value = this.data[this.activeColorKey];
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private applyActiveTabColors(): void {
        const root = document.documentElement;
        const activeColor = this.getActiveColorValue();
        if (activeColor) {
            root.style.setProperty("--code-tabs-active-color", activeColor);
        } else {
            root.style.removeProperty("--code-tabs-active-color");
        }
    }

    private mergeCustomConfig(value: unknown): void {
        if (!this.isRecord(value)) return;
        const siyuanConfig = getSiyuanConfig();
        Object.keys(value).forEach((key) => {
            if (key in siyuanConfig) return;
            this.data[key] = value[key];
        });
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }

    private async saveConfig() {
        syncSiyuanConfig(this.data);
        const file = new File([JSON.stringify(this.data)], "config.json", {
            type: "application/json",
        });
        await putFile(CONFIG_JSON, false, file);
    }

    private initLogWriter() {
        const flush = debounce(() => {
            if (this.logBuffer.length === 0) return;
            const content = this.logBuffer.join("\n") + "\n";
            const file = new File([content], "debug.log", { type: "text/plain" });
            putFile(DEBUG_LOG, false, file).catch((error) => {
                console.error("write debug log failed", error);
            });
        }, 1000);
        this.flushLogFile = flush;
        logger.setLogWriter((line) => {
            this.logBuffer.push(line);
            if (this.logBuffer.length > 2000) {
                this.logBuffer.shift();
            }
            this.flushLogFile();
        });
    }

    private setDebugEnabled(enabled: boolean): void {
        try {
            localStorage.setItem("code-tabs.debug", enabled ? "true" : "false");
        } catch {
            logger.warn("无法写入 debug 配置");
        }
        logger.setDebugEnabled(enabled);
        logger.info("调试日志开关变更", { enabled });
    }

    private getDebugEnabled(): boolean {
        try {
            return localStorage.getItem("code-tabs.debug") === "true";
        } catch {
            return false;
        }
    }

    private handleProtyleLoaded(evt: unknown) {
        const detail = (
            evt as {
                detail?: {
                    protyle?: { contentElement?: HTMLElement };
                    element?: HTMLElement;
                };
            }
        )?.detail;
        LineNumberManager.scanProtyle(detail?.protyle?.contentElement || detail?.element);
    }
}

type BlockIconEventDetail = {
    menu: {
        addItem: (item: IMenu) => void;
    };
    blockElements: HTMLElement[];
};
