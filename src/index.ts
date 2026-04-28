import { Plugin, Setting } from "siyuan";
import "./index.scss";
import { pushErrMsg, pushMsg } from "@/api";
import logger from "@/utils/logger";
import {
    ICON_MAIN,
    LEGACY_CHECK_VERSION_KEY,
    LEGACY_COUNT_KEY,
    LEGACY_EXISTS_KEY,
    PLUGIN_VERSION,
} from "@/constants";
import { TransformCore } from "@/core/TransformCore";
import { TabsCore } from "@/core/TabsCore";
import { LineNumberService } from "@/services/LineNumberService";
import { DebugService } from "@/services/DebugService";
import { LifecycleService } from "@/services/LifecycleService";
import { ThemeService } from "@/services/ThemeService";
import { SettingsService } from "@/services/SettingsService";
import { ConfigService } from "@/services/ConfigService";
import { CommandService, type BlockIconEventDetail } from "@/services/CommandService";
import { UIService } from "@/services/UIService";
import { syncSiyuanConfig } from "@/utils/dom";
import { t } from "@/utils/i18n";
import { delay } from "@/utils/common";

/**
 * 插件入口与生命周期编排。
 * 只做模块装配与事件注册。
 */
export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private tabTransformManager!: TransformCore;
    private lifecycleService!: LifecycleService;
    private themeService!: ThemeService;
    private settingsService!: SettingsService;
    private debugService!: DebugService;
    private configService!: ConfigService;
    private commandService!: CommandService;
    private uiService!: UIService;

    /**
     * onload 阶段：注册事件与基础模块。
     * @returns Promise<void>
     */
    async onload() {
        this.registerBlockIconEvent();
        this.registerIcons();
        this.debugService = new DebugService();
        this.initServices();
        this.initLogging();
        this.checkHtmlBlockScriptPermission();

        this.initTabModules();
        this.initManagers();
        this.uiService.registerSlashMenu();

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

        this.uiService.initTopBar();

        syncSiyuanConfig(this.data);
        logger.info("同步思源配置完成", { configKeys: Object.keys(this.data) });

        await this.loadConfigAndApplyTheme();
        await this.checkLegacyTabsPrompt();
        this.themeService.startObserving();

        this.registerProtyleEvents();
        LineNumberService.initEventListener();
        LineNumberService.scanAll();
        logger.info("行号扫描完成");
    }

    /**
     * 插件卸载：必须清理监听与全局对象。
     * @returns void
     */
    onunload() {
        this.unregisterBlockIconEvent();
        this.unregisterProtyleEvents();
        this.themeService.cleanup();
        this.lifecycleService.cleanup();
        this.tabTransformManager?.cancelCurrentTask();
        LineNumberService.cleanup();
        TabsCore.cleanup();
        this.debugService?.cleanup();
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
        logger.info("插件卸载完成");
    }

    private blockIconEvent({ detail }: { detail: BlockIconEventDetail }) {
        this.commandService.handleBlockIconEvent(detail);
    }

    private initLogging(): void {
        logger.info("插件加载开始");
        this.debugService.init();
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

    private registerIcons(): void {
        this.addIcons(ICON_MAIN);
    }

    private registerProtyleEvents(): void {
        this.lifecycleService.register(this.eventBus);
    }

    private unregisterProtyleEvents(): void {
        this.lifecycleService.unregister(this.eventBus);
    }

    private initServices(): void {
        this.lifecycleService = new LifecycleService();
        this.themeService = new ThemeService({
            data: this.data,
            i18n: this.i18n,
            onSaveConfig: () => this.configService.saveConfig(),
        });
        this.themeService.init();
    }

    private initTabModules(): void {
        const pluginApi = TabsCore.initGlobalFunctions(
            this.i18n,
            () => this.lifecycleService.reloadActiveDocument(),
            this.data,
            () => this.configService.saveConfig()
        );
        this.lifecycleService.setRefreshOverflowProvider(() => pluginApi.refreshOverflow);
        logger.info("全局函数已注册");
        this.tabTransformManager = new TransformCore(this.i18n, () =>
            this.lifecycleService.reloadActiveDocument()
        );
    }

    private initManagers(): void {
        this.settingsService = new SettingsService({
            i18n: this.i18n,
            data: this.data,
            onAllTabsToCodeBlocks: () => this.tabTransformManager.allTabsToCodeBlocks(),
            onUpgradeLegacyTabs: () => this.upgradeLegacyTabs(),
            onSaveConfig: () => this.configService.saveConfig(),
            buildDebugToggle: () => this.debugService.createToggle(),
        });
        this.settingsService.ensureSettings();
        this.settingsService.applySettings();
        this.commandService = new CommandService({
            i18n: this.i18n,
            data: this.data,
            tabTransformManager: this.tabTransformManager,
            onReload: () => this.lifecycleService.reloadActiveDocument(),
            addCommand: (command) => this.addCommand(command),
        });
        this.uiService = new UIService({
            i18n: this.i18n,
            addTopBar: (options) => this.addTopBar(options),
            openSetting: () => this.openSetting(),
            protyleSlash: this.protyleSlash,
            onReload: () => this.lifecycleService.reloadActiveDocument(),
        });
        this.configService = new ConfigService({
            data: this.data,
            onApplyThemeStyles: async () => this.themeService.applyThemeStyles(),
            onAfterLoad: () => {
                this.settingsService.ensureSettings();
                this.settingsService.applySettings();
                this.settingsService.syncInputs();
            },
        });
    }

    private async loadConfigAndApplyTheme(): Promise<void> {
        await this.configService.loadAndApply();
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
        const legacyCount = await this.tabTransformManager.countLegacyTabs();
        this.data[LEGACY_CHECK_VERSION_KEY] = PLUGIN_VERSION;
        this.data[LEGACY_EXISTS_KEY] = legacyCount > 0;
        this.data[LEGACY_COUNT_KEY] = legacyCount;
        if (legacyCount > 0) {
            const message = t(this.i18n, "msg.legacyTabsDetected")
                .replace("{0}", String(legacyCount))
                .replace("{1}", this.displayName || "code-tabs");
            pushMsg(message, 12000);
        }
        await this.configService.saveConfig();
    }

    /**
     * 执行旧版标签页升级并刷新缓存状态。
     * @returns Promise<void>
     */
    private async upgradeLegacyTabs(): Promise<void> {
        await this.tabTransformManager.upgradeLegacyTabs();
        const remaining = await this.waitForLegacyCount(3, 300);
        logger.debug(`升级完成，剩余 ${remaining} 个旧版标签页`);
        this.data[LEGACY_EXISTS_KEY] = remaining > 0;
        logger.debug(`重置 LEGACY_EXISTS_KEY 为 ${this.data[LEGACY_EXISTS_KEY]}`);
        this.data[LEGACY_COUNT_KEY] = remaining;
        logger.debug(`重置 LEGACY_COUNT_KEY 为 ${this.data[LEGACY_COUNT_KEY]}`);
        this.data[LEGACY_CHECK_VERSION_KEY] = PLUGIN_VERSION;
        await this.configService.saveConfig();
    }

    /**
     * 重试查询旧版标签页数量，规避异步更新延迟。
     * @param retries 最大重试次数
     * @param delayMs 重试间隔
     * @returns 剩余旧版标签页数量
     */
    private async waitForLegacyCount(retries: number, delayMs: number): Promise<number> {
        let remaining = await this.tabTransformManager.countLegacyTabs();
        logger.debug(`升级后第1次查询旧版标签页数量，剩余 ${remaining} 个`);
        if (remaining === 0) return 0;
        for (let attempt = 0; attempt < retries; attempt += 1) {
            await delay(delayMs);
            remaining = await this.tabTransformManager.countLegacyTabs();
            logger.debug(`升级后第${attempt + 1}次重试查询旧版标签页数量，剩余 ${remaining} 个`);
            if (remaining === 0) return 0;
        }
        return remaining;
    }

    private initSettings(): void {
        this.setting = new Setting({
            confirmCallback: () => {},
        });
        this.settingsService.init(this.setting);
    }

    private registerCommands(): void {
        this.commandService.registerCommands();
    }
}
