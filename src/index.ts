import {getActiveEditor, Plugin, Setting} from "siyuan";
import {pushErrMsg, putFile} from "@/api";
import logger from "@/utils/logger";
import {CONFIG_JSON, CUSTOM_ATTR, HTML_BLOCK_STYLE, settingIconMain} from "@/constants";
import {TabConverter} from "@/modules/tabs/TabConverter";
import {ThemeManager} from "@/modules/theme/ThemeManager";
import {TabManager} from "@/modules/tabs/TabManager";
import {LineNumberManager} from "@/modules/line-number/LineNumberManager";
import {fetchFileFromUrlSimple, loadJsonFromFile} from "@/utils/network";
import {compareConfig, getSelectedElements, getSiyuanConfig, syncSiyuanConfig} from "@/utils/dom";
import {debounce} from "@/utils/common";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private tabConverter!: TabConverter;
    private themeObserver?: MutationObserver;
    private injectedStyleEl?: HTMLStyleElement;
    private onLoadedProtyleStatic = (evt: any) => {
        const detail = evt?.detail;
        LineNumberManager.scanProtyle(detail?.protyle?.contentElement || detail?.element);
    };
    private onLoadedProtyleDynamic = (evt: any) => {
        const detail = evt?.detail;
        LineNumberManager.scanProtyle(detail?.protyle?.contentElement || detail?.element);
    };

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        logger.info("loading code-tabs");

        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${this.i18n.notAllowHtmlBlockScript}`).then();
        }

        // 注入全局样式，移除 html 块默认的 padding
        this.injectedStyleEl = document.createElement("style");
        this.injectedStyleEl.innerHTML = HTML_BLOCK_STYLE;
        document.head.appendChild(this.injectedStyleEl);

        TabManager.initGlobalFunctions(this.i18n);
        this.tabConverter = new TabConverter(this.i18n, () => this.reloadActivateDocument());

        // 添加设置项
        this.setting = new Setting({
            confirmCallback: () => {}
        });
        const allTabsToCodeElement = document.createElement("button");
        allTabsToCodeElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        allTabsToCodeElement.textContent = `${this.i18n.allTabsToCodeBtn}`;
        allTabsToCodeElement.addEventListener("click", () => {
            this.tabConverter.allTabsToCode();
        });
        this.setting.addItem({
            title: `${this.i18n.allTabsToCode}`,
            description: `${this.i18n.allTabsToCodeDes}`,
            actionElement: allTabsToCodeElement,
        });

        // 注册快捷方式
        this.addCommand({
            langKey: "codeToTabs",
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabConverter.codeToTabsBatch(blockList);
            }
        });
        this.addCommand({
            langKey: "tabToCode",
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
                this.tabConverter.tabToCodeBatch(blockList);
            }
        });
    }

    async onLayoutReady() {
        logger.info("layout ready");

        this.addTopBar({
            icon: settingIconMain,
            title: "code-tabs",
            position: "right",
            callback: () => {
                this.openSetting();
            }
        });

        syncSiyuanConfig(this.data);

        const configFile = await fetchFileFromUrlSimple(CONFIG_JSON.replace('/data', ''), 'config.json');
        if (configFile === undefined || configFile.size === 0) {
            await ThemeManager.putStyleFile();
            await this.saveConfig();
            ThemeManager.updateAllTabsStyle();
        } else {
            const data = await loadJsonFromFile(configFile);
            const configFlag = compareConfig(data, this.data);
            if (!configFlag) {
                await ThemeManager.putStyleFile();
                await this.saveConfig();
                ThemeManager.updateAllTabsStyle();
            }
        }

        const html = document.documentElement;
        const head = document.head;
        const callback = (mutationsList: any) => {
            const siyuanConfig = getSiyuanConfig();
            for (let mutation of mutationsList) {
                // 1. 检查思源基础配置是否有变动
                if (!compareConfig(siyuanConfig, this.data)) {
                    debounced();
                    break;
                }

                // 2. 检查 html 元素和 head 中主题相关的变动
                const isThemeLink = (node: Node) => {
                    return node instanceof HTMLLinkElement && node.href.includes('/appearance/themes/');
                };

                if (mutation.target === document.documentElement && mutation.type === 'attributes') {
                    // html 元素的任何属性变动 (如 data-theme-mode, savor-theme 等)
                    debounced();
                    break;
                }

                if (mutation.type === 'childList') {
                    const nodes = [...Array.from(mutation.addedNodes as NodeList), ...Array.from(mutation.removedNodes as NodeList)];
                    if (nodes.some((node: Node) => isThemeLink(node))) {
                        debounced();
                        break;
                    }
                } else if (mutation.type === 'attributes') {
                    if (isThemeLink(mutation.target as Node)) {
                        debounced();
                        break;
                    }
                }
            }
        };

        const putFileHandler = () => {
            logger.info(this.i18n.codeStyleChange);
            ThemeManager.putStyleFile().then(() => {
                syncSiyuanConfig(this.data);
                this.saveConfig();
                ThemeManager.updateAllTabsStyle();
                LineNumberManager.refreshAll();
            });
        }

        const debounced = debounce(putFileHandler, 500);
        this.themeObserver = new MutationObserver(callback);
        this.themeObserver.observe(html, {attributes: true, childList: false, subtree: false});
        this.themeObserver.observe(head, {attributes: true, childList: true, subtree: true});

        this.eventBus.on("loaded-protyle-static", this.onLoadedProtyleStatic);
        this.eventBus.on("loaded-protyle-dynamic", this.onLoadedProtyleDynamic);
        LineNumberManager.scanAll();
    }

    onunload() {
        this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
        this.eventBus.off("loaded-protyle-static", this.onLoadedProtyleStatic);
        this.eventBus.off("loaded-protyle-dynamic", this.onLoadedProtyleDynamic);
        this.themeObserver?.disconnect();
        this.themeObserver = undefined;
        if (this.injectedStyleEl) {
            this.injectedStyleEl.remove();
            this.injectedStyleEl = undefined;
        }
        if (window.pluginCodeTabs) {
            delete window.pluginCodeTabs;
        }
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabs, click: () => {
                const blockList: HTMLElement[] = [];
                for (const item of detail.blockElements as HTMLElement[]) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        blockList.push(item);
                    }
                }
                this.tabConverter.codeToTabsBatch(blockList);
            }
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.tabToCode, click: () => {
                const blockList: any[] = [];
                for (const item of detail.blockElements) {
                    const isCodeTab = (item as HTMLElement).hasAttribute(`${CUSTOM_ATTR}`);
                    if (isCodeTab && item.dataset?.type === "NodeHTMLBlock") {
                        blockList.push(item);
                    }
                }
                this.tabConverter.tabToCodeBatch(blockList);
            }
        })
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabsInDocument, click: () => {
                this.tabConverter.codeToTabsInDocument();
            },
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.tabToCodeInDocument, click: () => {
                this.tabConverter.tabToCodeInDocument();
            },
        });
    }

    private reloadActivateDocument() {
        const activeEditor = getActiveEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            activeEditor.reload(true);
        }
    }

    private async saveConfig() {
        syncSiyuanConfig(this.data);
        const file = new File([JSON.stringify(this.data)], 'config.json', {type: 'application/json'});
        await putFile(CONFIG_JSON, false, file);
    }


}
