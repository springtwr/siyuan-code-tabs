import { getActiveEditor, Plugin, Setting, type IMenu } from "siyuan";
import { pushErrMsg, updateBlock } from "@/api";
import logger from "@/utils/logger";
import {
    CODE_TABS_DATA_ATTR,
    CUSTOM_ATTR,
    CODE_TABS_STYLE,
    settingIconMain,
} from "@/constants";
import { TabConverter } from "@/modules/tabs/TabConverter";
import { TabManager } from "@/modules/tabs/TabManager";
import { TabDataManager } from "@/modules/tabs/TabDataManager";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { DevToggleManager } from "@/modules/developer/DevToggleManager";
import { DebugLogManager } from "@/modules/developer/DebugLogManager";
import { StyleProbe } from "@/modules/theme/StyleProbe";
import { ThemeObserver } from "@/modules/theme/ThemeObserver";
import { SettingsPanel } from "@/modules/settings/SettingsPanel";
import { ConfigManager } from "@/modules/config/ConfigManager";
import { getSelectedElements, syncSiyuanConfig } from "@/utils/dom";
import { t } from "@/utils/i18n";
import { isDevMode } from "@/utils/env";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private tabConverter!: TabConverter;
    private themeObserver!: ThemeObserver;
    private settingsPanel!: SettingsPanel;
    private debugLogManager!: DebugLogManager;
    private configManager!: ConfigManager;
    private injectedStyleEl?: HTMLStyleElement;
    private onLoadedProtyle = (evt: unknown) => {
        this.handleProtyleLoaded(evt);
    };

    async onload() {
        this.registerBlockIconEvent();
        this.debugLogManager = new DebugLogManager();
        this.initLogging();
        this.checkHtmlBlockScriptPermission();

        this.ensureInjectedStyle();

        this.initTabModules();
        this.initManagers();
        this.registerSlashMenu();

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
        this.themeObserver.start();

        this.registerProtyleEvents();
        LineNumberManager.scanAll();
        logger.info("行号扫描完成");
    }

    onunload() {
        this.unregisterBlockIconEvent();
        this.unregisterProtyleEvents();
        this.themeObserver?.stop();
        this.tabConverter?.cancelCurrentTask();
        LineNumberManager.cleanup();
        StyleProbe.cleanup();
        this.debugLogManager?.cleanup();
        this.removeInjectedStyle();
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
        logger.info("插件卸载完成");
    }

    private blockIconEvent({ detail }: { detail: BlockIconEventDetail }) {
        this.buildBlockMenu(detail);
        this.buildDevMenu(detail);
    }

    private initLogging(): void {
        logger.info("插件加载开始");
        this.debugLogManager.init();
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

    private registerSlashMenu(): void {
        const slashIcon = settingIconMain.replace(
            "<svg",
            '<svg class="b3-list-item__graphic"'
        );
        this.protyleSlash.push({
            filter: ["bq", "tabs", "标签页"],
            html: `<div class="b3-list-item__first">${slashIcon}<span class="b3-list-item__text">${t(
                this.i18n,
                "slash.tabs"
            )}</span></div>`,
            id: "code-tabs",
            callback: async (_protyle, nodeElement) => {
                const data = TabDataManager.createDefaultData();
                const htmlBlock = TabRenderer.createProtyleHtml(data);
                const targetId = nodeElement?.dataset?.nodeId ?? "";
                if (targetId) {
                    await updateBlock("markdown", htmlBlock, targetId);
                    await TabDataManager.writeToBlock(targetId, data);
                    this.reloadActivateDocument();
                    return;
                }
                pushErrMsg(t(this.i18n, "msg.noTargetBlock"));
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
        TabManager.initGlobalFunctions(this.i18n, () => this.reloadActivateDocument());
        logger.info("全局函数已注册");
        this.tabConverter = new TabConverter(this.i18n, () => this.reloadActivateDocument());
    }

    private initManagers(): void {
        this.settingsPanel = new SettingsPanel({
            i18n: this.i18n,
            data: this.data,
            onAllTabsToPlainCode: () => this.tabConverter.allTabsToPlainCode(),
            onSaveConfig: () => this.configManager.saveConfig(),
            buildDebugToggle: () => this.debugLogManager.createToggle(),
        });
        this.settingsPanel.ensureSettings();
        this.settingsPanel.applySettings();
        this.themeObserver = new ThemeObserver({
            data: this.data,
            i18n: this.i18n,
            onSaveConfig: () => this.configManager.saveConfig(),
        });
        this.configManager = new ConfigManager({
            data: this.data,
            onApplyThemeStyles: () => this.themeObserver.applyThemeStyles(),
            onAfterLoad: () => {
                this.settingsPanel.ensureSettings();
                this.settingsPanel.applySettings();
                this.settingsPanel.syncInputs();
            },
        });
    }

    private async loadConfigAndApplyTheme(): Promise<void> {
        await this.configManager.loadAndApply();
    }

    private initSettings(): void {
        this.setting = new Setting({
            confirmCallback: () => {},
        });
        this.settingsPanel.init(this.setting);
    }

    private registerCommands(): void {
        this.addCommand({
            langKey: t(this.i18n, "menu.more.tabsToPlainCode"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(
                    `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}], [data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}]`
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
            label: t(this.i18n, "menu.more.mergeCodeBlocks"),
            click: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabConverter.mergeCodeBlocksToTabSyntax(blockList);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.tabsToPlainCode"),
            click: () => {
                const blockList = this.collectBlockElements(detail, (item) => {
                    return (
                        (item.hasAttribute(`${CUSTOM_ATTR}`) ||
                            item.hasAttribute(`${CODE_TABS_DATA_ATTR}`)) &&
                        item.dataset?.type === "NodeHTMLBlock"
                    );
                });
                this.tabConverter.tabsToPlainCodeBlocksBatch(blockList);
            },
        });
        detail.menu.addItem({ type: "separator" });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.tabsToPlainCodeInDocument"),
            click: () => {
                this.tabConverter.tabsToPlainCodeInDocument();
            },
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

    private handleProtyleLoaded(evt: unknown) {
        const detail = (
            evt as {
                detail?: {
                    protyle?: { contentElement?: HTMLElement };
                    element?: HTMLElement;
                };
            }
        )?.detail;
        const root = detail?.protyle?.contentElement || detail?.element;
        LineNumberManager.scanProtyle(root);
        const refreshOverflow = (window as typeof window & {
            pluginCodeTabs?: { refreshOverflow?: (root?: HTMLElement | ShadowRoot) => void };
        }).pluginCodeTabs?.refreshOverflow;
        if (refreshOverflow) {
            refreshOverflow(root);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    refreshOverflow(root);
                });
            });
        }
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
