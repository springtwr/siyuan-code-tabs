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
import { isDevMode } from "@/utils/env";

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
    private lastLineNumberEnabled?: boolean;

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
        this.lastLineNumberEnabled = LineNumberManager.isEnabled();
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
        const debounced = debounce((plan: StyleUpdatePlan, persistConfig: boolean) => {
            this.applyStylePlan(plan, persistConfig);
        }, 500);
        const callback = (mutationsList: MutationRecord[]) => {
            this.handleThemeMutations(mutationsList, debounced);
        };
        this.themeObserver = new MutationObserver(callback);
        this.themeObserver.observe(html, { attributes: true, childList: false, subtree: false });
        this.themeObserver.observe(head, { attributes: true, childList: true, subtree: true });
    }

    private handleThemeMutations(
        mutationsList: MutationRecord[],
        onPlan: (plan: StyleUpdatePlan, persistConfig: boolean) => void
    ): void {
        const configChanges = this.getSiyuanConfigChanges();
        if (configChanges.keys.length > 0) {
            const plan = this.buildPlanFromConfigChanges(configChanges.keys);
            logger.info("检测到思源配置变更", {
                keys: configChanges.keys,
                labels: configChanges.labels,
                plan: this.describePlan(plan),
            });
            onPlan(plan, true);
            return;
        }

        for (const mutation of mutationsList) {
            const reason = this.getThemeMutationReason(mutation);
            if (reason) {
                const plan = this.buildPlanFromMutation(reason);
                logger.info("检测到主题相关变更", {
                    reason,
                    plan: this.describePlan(plan),
                    detail: this.describeMutation(mutation),
                });
                onPlan(plan, false);
                break;
            }
        }
    }

    private getThemeMutationReason(
        mutation: MutationRecord
    ):
        | "theme-mode"
        | "theme-light"
        | "theme-dark"
        | "html-attrs"
        | "theme-link"
        | "code-style-link"
        | null {
        if (mutation.target === document.documentElement && mutation.type === "attributes") {
            const attr = mutation.attributeName;
            if (attr === "data-theme-mode") return "theme-mode";
            if (attr === "data-light-theme") return "theme-light";
            if (attr === "data-dark-theme") return "theme-dark";
            // 其它 html 属性变动
            return "html-attrs";
        }

        const getLinkType = (node: Node): "theme-link" | "code-style-link" | null => {
            if (!(node instanceof HTMLLinkElement)) return null;
            if (node.id === "protyleHljsStyle") return "code-style-link";
            if (node.href.includes("/appearance/themes/")) return "theme-link";
            return null;
        };

        if (mutation.type === "childList") {
            const nodes = [
                ...Array.from(mutation.addedNodes as NodeList),
                ...Array.from(mutation.removedNodes as NodeList),
            ];
            for (const node of nodes) {
                const linkType = getLinkType(node);
                if (linkType) return linkType;
            }
            return null;
        }

        if (mutation.type === "attributes") {
            const linkType = getLinkType(mutation.target as Node);
            return linkType;
        }

        return null;
    }

    private getSiyuanConfigChanges(): { keys: string[]; labels: string[] } {
        const current = getSiyuanConfig();
        const changes: string[] = [];
        Object.keys(current).forEach((key) => {
            if (this.data[key] !== current[key]) {
                changes.push(key);
            }
        });
        const labels = changes.map((key) => this.mapConfigKeyToLabel(key));
        return { keys: changes, labels };
    }

    private mapConfigKeyToLabel(key: string): string {
        switch (key) {
            case "fontSize":
                return "字体大小";
            case "codeLigatures":
                return "代码连字";
            case "codeLineWrap":
                return "代码换行";
            case "codeSyntaxHighlightLineNum":
                return "代码行号";
            case "mode":
                return "主题模式";
            case "themeLight":
                return "浅色主题";
            case "themeDark":
                return "深色主题";
            case "codeBlockThemeLight":
                return "浅色代码主题";
            case "codeBlockThemeDark":
                return "深色代码主题";
            default:
                return key;
        }
    }

    private buildPlanFromConfigChanges(keys: string[]): StyleUpdatePlan {
        const plan: StyleUpdatePlan = {
            codeStyle: false,
            background: false,
            markdown: false,
            lineNumbers: false,
            forceProbe: false,
        };
        keys.forEach((key) => {
            switch (key) {
                case "fontSize":
                    plan.background = true;
                    plan.lineNumbers = true;
                    plan.forceProbe = true;
                    break;
                case "codeLigatures":
                    plan.background = true;
                    break;
                case "codeLineWrap":
                    plan.background = true;
                    plan.lineNumbers = true;
                    break;
                case "codeSyntaxHighlightLineNum":
                    plan.lineNumbers = true;
                    break;
                case "mode":
                    plan.background = true;
                    plan.codeStyle = true;
                    plan.markdown = true;
                    break;
                case "themeLight":
                case "themeDark":
                    plan.background = true;
                    plan.codeStyle = true;
                    break;
                case "codeBlockThemeLight":
                case "codeBlockThemeDark":
                    plan.codeStyle = true;
                    break;
                default:
                    plan.background = true;
                    break;
            }
        });
        return plan;
    }

    private buildPlanFromMutation(reason: string): StyleUpdatePlan {
        const plan: StyleUpdatePlan = {
            codeStyle: false,
            background: false,
            markdown: false,
            lineNumbers: false,
            forceProbe: false,
        };
        switch (reason) {
            case "theme-mode":
                plan.background = true;
                plan.codeStyle = true;
                plan.markdown = true;
                break;
            case "theme-light":
            case "theme-dark":
                plan.background = true;
                plan.codeStyle = true;
                break;
            case "theme-link":
                plan.background = true;
                plan.forceProbe = true;
                break;
            case "code-style-link":
                plan.codeStyle = true;
                break;
            default:
                plan.background = true;
                break;
        }
        return plan;
    }

    private describePlan(plan: StyleUpdatePlan): string[] {
        const result: string[] = [];
        if (plan.background) result.push("background.css");
        if (plan.codeStyle) result.push("code-style.css");
        if (plan.markdown) result.push("github-markdown.css");
        if (plan.lineNumbers) result.push("line-numbers");
        if (plan.forceProbe) result.push("force-probe");
        return result.length > 0 ? result : ["no-op"];
    }

    private applyStylePlan(plan: StyleUpdatePlan, persistConfig: boolean): void {
        const shouldUpdateTheme = plan.background || plan.codeStyle || plan.markdown;
        if (shouldUpdateTheme) {
            logger.info(t(this.i18n, "msg.codeStyleChange"), {
                plan: this.describePlan(plan),
            });
            this.applyThemeStyles(plan).then(() => {
                if (plan.lineNumbers) {
                    this.refreshLineNumbersIfNeeded();
                }
            });
            return;
        }

        if (persistConfig) {
            syncSiyuanConfig(this.data);
            this.saveConfig();
        }
        if (plan.lineNumbers) {
            this.refreshLineNumbersIfNeeded();
        }
    }

    private describeMutation(mutation: MutationRecord): Record<string, unknown> {
        if (mutation.type === "attributes") {
            return {
                type: mutation.type,
                attribute: mutation.attributeName,
                target: mutation.target instanceof Element ? mutation.target.tagName : "unknown",
            };
        }
        if (mutation.type === "childList") {
            const summary = (nodes: NodeList): string[] =>
                Array.from(nodes).map((node) => {
                    if (node instanceof HTMLLinkElement) {
                        return `link#${node.id || "unknown"}:${node.href}`;
                    }
                    return node.nodeName;
                });
            return {
                type: mutation.type,
                added: summary(mutation.addedNodes),
                removed: summary(mutation.removedNodes),
            };
        }
        return { type: mutation.type };
    }

    private refreshLineNumbersIfNeeded(): void {
        const enabled = LineNumberManager.isEnabled();
        if (this.lastLineNumberEnabled === undefined) {
            this.lastLineNumberEnabled = enabled;
        }
        if (enabled) {
            LineNumberManager.refreshAll();
        } else if (this.lastLineNumberEnabled) {
            LineNumberManager.cleanup();
        }
        this.lastLineNumberEnabled = enabled;
    }

    private async applyThemeStyles(plan?: StyleUpdatePlan): Promise<boolean> {
        const result = await ThemeManager.putStyleFile({
            forceProbe: plan?.forceProbe,
            update: plan
                ? {
                      background: plan.background,
                      codeStyle: plan.codeStyle,
                      markdown: plan.markdown,
                  }
                : undefined,
        });
        syncSiyuanConfig(this.data);
        await this.saveConfig();
        if (result.changed) {
            ThemeManager.updateAllTabsStyle(result);
        }
        return result.changed;
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
        if (!isDevMode()) {
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

type StyleUpdatePlan = {
    codeStyle: boolean;
    background: boolean;
    markdown: boolean;
    lineNumbers: boolean;
    forceProbe: boolean;
};

type BlockIconEventDetail = {
    menu: {
        addItem: (item: IMenu) => void;
    };
    blockElements: HTMLElement[];
};
