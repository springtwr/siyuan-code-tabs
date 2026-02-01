import { Plugin, Setting } from "siyuan";
import { pushErrMsg, pushMsg } from "@/api";
import logger from "@/utils/logger";
import {
    CODE_TABS_STYLE,
    LEGACY_CHECK_VERSION_KEY,
    LEGACY_COUNT_KEY,
    LEGACY_EXISTS_KEY,
    PLUGIN_VERSION,
} from "@/constants";
import { TabConverter } from "@/modules/tabs/TabConverter";
import { TabManager } from "@/modules/tabs/TabManager";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { DebugLogManager } from "@/modules/developer/DebugLogManager";
import { EditorRefreshManager } from "@/modules/editor/EditorRefreshManager";
import { StyleProbe } from "@/modules/theme/StyleProbe";
import { ThemeObserver } from "@/modules/theme/ThemeObserver";
import { SettingsPanel } from "@/modules/settings/SettingsPanel";
import { ConfigManager } from "@/modules/config/ConfigManager";
import { CommandManager, type BlockIconEventDetail } from "@/modules/command/CommandManager";
import { ProtyleLifecycleManager } from "@/modules/protyle/ProtyleLifecycleManager";
import { UiEntryManager } from "@/modules/ui/UiEntryManager";
import { syncSiyuanConfig } from "@/utils/dom";
import { t } from "@/utils/i18n";
import { delay } from "@/utils/common";

/**
 * 插件入口与生命周期编排。
 * 只做模块装配与事件注册。
 */
export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private tabConverter!: TabConverter;
    private editorRefreshManager!: EditorRefreshManager;
    private themeObserver!: ThemeObserver;
    private settingsPanel!: SettingsPanel;
    private debugLogManager!: DebugLogManager;
    private configManager!: ConfigManager;
    private commandManager!: CommandManager;
    private protyleLifecycleManager!: ProtyleLifecycleManager;
    private uiEntryManager!: UiEntryManager;
    private injectedStyleEl?: HTMLStyleElement;

    /**
     * onload 阶段：注册事件与基础模块。
     * @returns Promise<void>
     */
    async onload() {
        this.registerBlockIconEvent();
        this.debugLogManager = new DebugLogManager();
        this.editorRefreshManager = new EditorRefreshManager();
        this.initLogging();
        this.checkHtmlBlockScriptPermission();

        this.ensureInjectedStyle();

        this.initTabModules();
        this.initManagers();
        this.uiEntryManager.registerSlashMenu();

        this.initSettings();
        this.registerCommands();
        logger.info("命令与设置项注册完成");
    }

    /**
     * onLayoutReady 阶段：DOM 扫描与主题样式同步。
     * @returns Promise<void>
     */
    async onLayoutReady() {
        logger.info("布局就绪，开始初始化");

        this.uiEntryManager.initTopBar();

        syncSiyuanConfig(this.data);
        logger.info("同步思源配置完成", { configKeys: Object.keys(this.data) });

        await this.loadConfigAndApplyTheme();
        await this.checkLegacyTabsPrompt();
        this.themeObserver.start();

        this.registerProtyleEvents();
        LineNumberManager.scanAll();
        logger.info("行号扫描完成");
    }

    /**
     * 插件卸载：必须清理监听与全局对象。
     * @returns void
     */
    onunload() {
        this.unregisterBlockIconEvent();
        this.unregisterProtyleEvents();
        this.themeObserver?.stop();
        this.tabConverter?.cancelCurrentTask();
        LineNumberManager.cleanup();
        TabManager.cleanup();
        StyleProbe.cleanup();
        this.debugLogManager?.cleanup();
        this.removeInjectedStyle();
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
        logger.info("插件卸载完成");
    }

    private blockIconEvent({ detail }: { detail: BlockIconEventDetail }) {
        this.commandManager.handleBlockIconEvent(detail);
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

    private registerProtyleEvents(): void {
        this.protyleLifecycleManager.register(this.eventBus);
    }

    private unregisterProtyleEvents(): void {
        this.protyleLifecycleManager.unregister(this.eventBus);
    }

    /**
     * 初始化 tabs 交互与转换模块。
     * @returns void
     */
    private initTabModules(): void {
        const pluginApi = TabManager.initGlobalFunctions(this.i18n, () =>
            this.editorRefreshManager.reloadActiveDocument()
        );
        this.editorRefreshManager.setRefreshOverflowProvider(() => pluginApi.refreshOverflow);
        logger.info("全局函数已注册");
        this.tabConverter = new TabConverter(this.i18n, () =>
            this.editorRefreshManager.reloadActiveDocument()
        );
    }

    /**
     * 初始化 UI、配置、命令等管理器。
     * @returns void
     */
    private initManagers(): void {
        this.settingsPanel = new SettingsPanel({
            i18n: this.i18n,
            data: this.data,
            onAllTabsToPlainCode: () => this.tabConverter.allTabsToPlainCode(),
            onUpgradeLegacyTabs: () => this.upgradeLegacyTabs(),
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
        this.commandManager = new CommandManager({
            i18n: this.i18n,
            data: this.data,
            tabConverter: this.tabConverter,
            onReload: () => this.editorRefreshManager.reloadActiveDocument(),
            addCommand: (command) => this.addCommand(command),
        });
        this.protyleLifecycleManager = new ProtyleLifecycleManager({
            onRefreshOverflow: (root) => this.editorRefreshManager.refreshOverflow(root),
        });
        this.uiEntryManager = new UiEntryManager({
            i18n: this.i18n,
            addTopBar: (options) => this.addTopBar(options),
            openSetting: () => this.openSetting(),
            protyleSlash: this.protyleSlash,
            onReload: () => this.editorRefreshManager.reloadActiveDocument(),
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

    /**
     * 每次版本首次运行检测旧版标签页并提示升级。
     * @returns Promise<void>
     */
    private async checkLegacyTabsPrompt(): Promise<void> {
        const lastCheckedVersion = String(this.data[LEGACY_CHECK_VERSION_KEY] ?? "");
        if (lastCheckedVersion === PLUGIN_VERSION) {
            if (this.data[LEGACY_EXISTS_KEY]) {
                const legacyCountStored = Number(this.data[LEGACY_COUNT_KEY] ?? 0);
                logger.debug(`存在 ${legacyCountStored} 个旧版标签页`);
                const count = Number.isFinite(legacyCountStored) ? legacyCountStored : 0;
                const message = t(this.i18n, "msg.legacyTabsDetected")
                    .replace("{0}", String(Math.max(count, 1)))
                    .replace("{1}", this.displayName || "code-tabs");
                pushMsg(message, 12000);
            }
            return;
        }
        const legacyCount = await this.tabConverter.countLegacyTabs();
        this.data[LEGACY_CHECK_VERSION_KEY] = PLUGIN_VERSION;
        this.data[LEGACY_EXISTS_KEY] = legacyCount > 0;
        this.data[LEGACY_COUNT_KEY] = legacyCount;
        if (legacyCount > 0) {
            const message = t(this.i18n, "msg.legacyTabsDetected")
                .replace("{0}", String(legacyCount))
                .replace("{1}", this.displayName || "code-tabs");
            pushMsg(message, 12000);
        }
        await this.configManager.saveConfig();
    }

    /**
     * 执行旧版标签页升级并刷新缓存状态。
     * @returns Promise<void>
     */
    private async upgradeLegacyTabs(): Promise<void> {
        await this.tabConverter.upgradeLegacyTabsAll();
        const remaining = await this.waitForLegacyCount(3, 300);
        logger.debug(`升级完成，剩余 ${remaining} 个旧版标签页`);
        this.data[LEGACY_EXISTS_KEY] = remaining > 0;
        logger.debug(`重置 LEGACY_EXISTS_KEY 为 ${this.data[LEGACY_EXISTS_KEY]}`);
        this.data[LEGACY_COUNT_KEY] = remaining;
        logger.debug(`重置 LEGACY_COUNT_KEY 为 ${this.data[LEGACY_COUNT_KEY]}`);
        this.data[LEGACY_CHECK_VERSION_KEY] = PLUGIN_VERSION;
        await this.configManager.saveConfig();
    }

    /**
     * 重试查询旧版标签页数量，规避异步更新延迟。
     * @param retries 最大重试次数
     * @param delayMs 重试间隔
     * @returns 剩余旧版标签页数量
     */
    private async waitForLegacyCount(retries: number, delayMs: number): Promise<number> {
        let remaining = await this.tabConverter.countLegacyTabs();
        logger.debug(`升级后第1次查询旧版标签页数量，剩余 ${remaining} 个`);
        if (remaining === 0) return 0;
        for (let attempt = 0; attempt < retries; attempt += 1) {
            await delay(delayMs);
            remaining = await this.tabConverter.countLegacyTabs();
            logger.debug(`升级后第${attempt + 1}次重试查询旧版标签页数量，剩余 ${remaining} 个`);
            if (remaining === 0) return 0;
        }
        return remaining;
    }

    private initSettings(): void {
        this.setting = new Setting({
            confirmCallback: () => {},
        });
        this.settingsPanel.init(this.setting);
    }

    private registerCommands(): void {
        this.commandManager.registerCommands();
    }

    /**
     * 注入插件样式标签，避免重复注入。
     * @returns void
     */
    private ensureInjectedStyle(): void {
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
