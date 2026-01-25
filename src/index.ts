import { getActiveEditor, Plugin, Setting, type IMenu } from "siyuan";
import { pushErrMsg, putFile } from "@/api";
import logger from "@/utils/logger";
import { CONFIG_JSON, CUSTOM_ATTR, DEBUG_LOG, CODE_TABS_STYLE, settingIconMain } from "@/constants";
import { TabConverter } from "@/modules/tabs/TabConverter";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { TabManager } from "@/modules/tabs/TabManager";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { DevToggleManager } from "@/modules/developer/DevToggleManager";
import { StyleProbe } from "@/modules/theme/StyleProbe";
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
    private onLoadedProtyle = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    async onload() {
        this.registerBlockIconEvent();
        this.initLogging();
        this.checkHtmlBlockScriptPermission();

        this.ensureInjectedStyle();

        this.initTabModules();

        this.initSettings();
        this.registerCommands();
        logger.info("命令与设置项注册完成");
    }

    async onLayoutReady() {
        logger.info("布局就绪，开始初始化");

        this.initTopBar();

        syncSiyuanConfig(this.data);
        logger.info("同步思源配置完成", { configKeys: Object.keys(this.data) });

        await this.loadConfigAndApplyTheme();
        this.initThemeObserver();

        this.registerProtyleEvents();
        LineNumberManager.scanAll();
        logger.info("行号扫描完成");
    }

    onunload() {
        this.unregisterBlockIconEvent();
        this.unregisterProtyleEvents();
        this.themeObserver?.disconnect();
        this.themeObserver = undefined;
        this.tabConverter?.cancelCurrentTask();
        LineNumberManager.cleanup();
        StyleProbe.cleanup();
        logger.setLogWriter(undefined);
        this.removeInjectedStyle();
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
        logger.info("插件卸载完成");
    }

    private blockIconEvent({ detail }: { detail: BlockIconEventDetail }) {
        this.buildBlockMenu(detail);
        this.buildMoreMenu(detail);
        this.buildDevMenu(detail);
    }

    private initLogging(): void {
        logger.info("插件加载开始");
        logger.setDebugEnabled(this.getDebugEnabled());
        this.initLogWriter();
        logger.info(
            '如需开启 debug，请在控制台运行：localStorage.setItem("code-tabs.debug", "true")'
        );
    }

    private checkHtmlBlockScriptPermission(): void {
        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${t(this.i18n, "msg.notAllowHtmlBlockScript")}`).then();
        }
    }

    private registerBlockIconEvent(): void {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
    }

    private unregisterBlockIconEvent(): void {
        this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
    }

    private initTopBar(): void {
        this.addTopBar({
            icon: settingIconMain,
            title: "code-tabs",
            position: "right",
            callback: () => {
                this.openSetting();
            },
        });
    }

    private registerProtyleEvents(): void {
        this.eventBus.on("loaded-protyle-static", this.onLoadedProtyle);
        this.eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    private unregisterProtyleEvents(): void {
        this.eventBus.off("loaded-protyle-static", this.onLoadedProtyle);
        this.eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyle);
    }

    private reloadActivateDocument() {
        const activeEditor = getActiveEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            activeEditor.reload(true);
        }
    }

    private initTabModules(): void {
        TabManager.initGlobalFunctions(
            this.i18n,
            (nodeId, order) => {
                this.tabConverter.reorderTabsInBlock(nodeId, order);
            },
            () => this.reloadActivateDocument()
        );
        logger.info("全局函数已注册");
        this.tabConverter = new TabConverter(this.i18n, () => this.reloadActivateDocument());
        this.ensureActiveColorSettings();
        this.applyActiveTabColors();
    }

    private async loadConfigAndApplyTheme(): Promise<void> {
        const configFile = await fetchFileFromUrlSimple(
            CONFIG_JSON.replace("/data", ""),
            "config.json"
        );
        if (configFile === undefined || configFile.size === 0) {
            logger.info("未检测到配置文件，初始化样式文件");
            await this.applyThemeStyles();
            return;
        }
        const data = await loadJsonFromFile(configFile);
        this.mergeCustomConfig(data);
        this.ensureActiveColorSettings();
        this.applyActiveTabColors();
        this.syncActiveColorInputValue();
        const configFlag = compareConfig(data, this.data);
        if (!configFlag) {
            logger.info("检测到配置变更，重新生成样式文件");
            await this.applyThemeStyles();
        }
    }

    private initThemeObserver(): void {
        const html = document.documentElement;
        const head = document.head;
        const putFileHandler = () => {
            logger.info(t(this.i18n, "msg.codeStyleChange"));
            this.applyThemeStyles().then(() => {
                LineNumberManager.refreshAll();
            });
        };
        const debounced = debounce(putFileHandler, 500);
        const callback = (mutationsList: MutationRecord[]) => {
            this.handleThemeMutations(mutationsList, debounced);
        };
        this.themeObserver = new MutationObserver(callback);
        this.themeObserver.observe(html, { attributes: true, childList: false, subtree: false });
        this.themeObserver.observe(head, { attributes: true, childList: true, subtree: true });
    }

    private handleThemeMutations(mutationsList: MutationRecord[], onChange: () => void): void {
        const siyuanConfig = getSiyuanConfig();
        for (const mutation of mutationsList) {
            // 1. 检查思源基础配置是否有变动
            if (!compareConfig(siyuanConfig, this.data)) {
                onChange();
                break;
            }

            if (this.isThemeLinkMutation(mutation)) {
                onChange();
                break;
            }
        }
    }

    private isThemeLinkMutation(mutation: MutationRecord): boolean {
        if (mutation.target === document.documentElement && mutation.type === "attributes") {
            // html 元素的任何属性变动 (如 data-theme-mode, savor-theme 等)
            return true;
        }

        const isThemeLink = (node: Node) => {
            return node instanceof HTMLLinkElement && node.href.includes("/appearance/themes/");
        };

        if (mutation.type === "childList") {
            const nodes = [
                ...Array.from(mutation.addedNodes as NodeList),
                ...Array.from(mutation.removedNodes as NodeList),
            ];
            return nodes.some((node: Node) => isThemeLink(node));
        }

        if (mutation.type === "attributes") {
            return isThemeLink(mutation.target as Node);
        }

        return false;
    }

    private async applyThemeStyles(): Promise<void> {
        await ThemeManager.putStyleFile();
        syncSiyuanConfig(this.data);
        await this.saveConfig();
        ThemeManager.updateAllTabsStyle();
    }

    private initSettings(): void {
        this.setting = new Setting({
            confirmCallback: () => {},
        });

        this.setting.addItem({
            title: `${t(this.i18n, "setting.allTabsToCode.title")}`,
            description: `${t(this.i18n, "setting.allTabsToCode.desc")}`,
            actionElement: this.createSettingButton("setting.allTabsToCode.button", () => {
                this.tabConverter.allTabsToCode();
            }),
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.allTabsToPlainCode.title")}`,
            description: `${t(this.i18n, "setting.allTabsToPlainCode.desc")}`,
            actionElement: this.createSettingButton("setting.allTabsToPlainCode.button", () => {
                this.tabConverter.allTabsToPlainCode();
            }),
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.activeColor.title")}`,
            description: `${t(this.i18n, "setting.activeColor.desc")}`,
            actionElement: this.buildActiveColorSetting(),
        });
        this.setting.addItem({
            title: `${t(this.i18n, "setting.debug.title")}`,
            description: `${t(this.i18n, "setting.debug.desc")}`,
            actionElement: this.buildDebugToggle(),
        });
    }

    private createSettingButton(textKey: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        button.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        button.textContent = `${t(this.i18n, textKey)}`;
        button.addEventListener("click", onClick);
        return button;
    }

    private buildActiveColorSetting(): HTMLDivElement {
        const activeColorWrapper = document.createElement("div");
        activeColorWrapper.className = "fn__flex fn__flex-center code-tabs__setting-color";

        const activeColorInput = document.createElement("input");
        activeColorInput.type = "color";
        activeColorInput.value = this.getActiveColorValue() ?? this.defaultActiveColor;
        activeColorInput.className = "code-tabs__setting-color-input";
        this.activeColorInput = activeColorInput;

        const resetButton = this.createSettingButton("setting.activeColor.reset", () => {
            this.data[this.activeColorKey] = "";
            activeColorInput.value = this.defaultActiveColor;
            this.applyActiveTabColors();
            this.saveConfig();
        });

        const applyColors = () => {
            this.applyActiveTabColors();
            this.saveConfig();
        };

        activeColorInput.addEventListener("input", () => {
            this.data[this.activeColorKey] = activeColorInput.value;
            applyColors();
        });

        activeColorWrapper.appendChild(activeColorInput);
        activeColorWrapper.appendChild(resetButton);
        return activeColorWrapper;
    }

    private buildDebugToggle(): HTMLInputElement {
        const debugToggle = document.createElement("input");
        debugToggle.type = "checkbox";
        debugToggle.className = "b3-switch";
        debugToggle.checked = this.getDebugEnabled();
        debugToggle.addEventListener("change", () => {
            this.setDebugEnabled(debugToggle.checked);
        });
        return debugToggle;
    }

    private registerCommands(): void {
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
    }

    private collectBlockElements(
        detail: BlockIconEventDetail,
        predicate: (item: HTMLElement) => boolean
    ): HTMLElement[] {
        const blockList: HTMLElement[] = [];
        for (const item of detail.blockElements) {
            const element = item as HTMLElement;
            if (predicate(element)) {
                blockList.push(element);
            }
        }
        return blockList;
    }

    private buildBlockMenu(detail: BlockIconEventDetail): void {
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.block.codeToTabs"),
            click: () => {
                const blockList = this.collectBlockElements(detail, (item) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    return !!editElement && item.dataset?.type === "NodeCodeBlock";
                });
                this.tabConverter.codeToTabsBatch(blockList);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.block.tabToCode"),
            click: () => {
                const blockList = this.collectBlockElements(detail, (item) => {
                    return (
                        item.hasAttribute(`${CUSTOM_ATTR}`) &&
                        item.dataset?.type === "NodeHTMLBlock"
                    );
                });
                this.tabConverter.tabToCodeBatch(blockList);
            },
        });
    }

    private buildMoreMenu(detail: BlockIconEventDetail): void {
        const submenuItems: IMenu[] = [
            {
                iconHTML: "",
                label: t(this.i18n, "menu.more.tabsToPlainCode"),
                click: () => {
                    const blockList = this.collectBlockElements(detail, (item) => {
                        return (
                            item.hasAttribute(`${CUSTOM_ATTR}`) &&
                            item.dataset?.type === "NodeHTMLBlock"
                        );
                    });
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
    }

    private buildDevMenu(detail: BlockIconEventDetail): void {
        if (process.env.DEV_MODE !== "true") {
            return;
        }
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
                DevToggleManager.toggleEditorSetting("codeSyntaxHighlightLineNum", this.data, () =>
                    this.reloadActivateDocument()
                );
            },
        });
    }

    private ensureActiveColorSettings(): void {
        if (!(this.activeColorKey in this.data)) {
            this.data[this.activeColorKey] = "";
        }
    }

    private syncActiveColorInputValue(): void {
        if (this.activeColorInput) {
            const value = this.getActiveColorValue() ?? this.defaultActiveColor;
            this.activeColorInput.value = value;
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

    private ensureInjectedStyle(): void {
        // 注入全局样式，标记为插件样式
        const existingStyle = document.getElementById("code-tabs-style");
        this.injectedStyleEl =
            existingStyle instanceof HTMLStyleElement
                ? existingStyle
                : document.createElement("style");
        this.injectedStyleEl.id = "code-tabs-style";
        this.injectedStyleEl.innerHTML = CODE_TABS_STYLE;
        if (!this.injectedStyleEl.parentElement) {
            document.head.appendChild(this.injectedStyleEl);
        }
    }

    private removeInjectedStyle(): void {
        if (this.injectedStyleEl) {
            this.injectedStyleEl.remove();
            this.injectedStyleEl = undefined;
        }
    }
}

type BlockIconEventDetail = {
    menu: {
        addItem: (item: IMenu) => void;
    };
    blockElements: HTMLElement[];
};
