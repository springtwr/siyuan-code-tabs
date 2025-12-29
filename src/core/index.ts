import { Plugin, getActiveEditor } from "siyuan";
import { getBlockAttrs, setBlockAttrs, pushErrMsg, putFile, insertBlock, deleteBlock } from "@/api";
import logger from "@/utils/logger";
import { customAttr, newLineFlag } from "@/assets/constants";
import { TabParser } from "@/modules/parser/TabParser";
import { TabRenderer } from "@/modules/renderer/TabRenderer";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { TabManager } from "@/modules/tab-manager/TabManager";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        this.eventBus.on("switch-protyle", (event) => {
            this.fixAllTabsInDocument(event.detail.protyle.element);
        });
        logger.info("loading code-tabs");

        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${this.i18n.notAllowHtmlBlockScript}`).then();
        }

        TabManager.initGlobalFunctions();

        this.addCommand({
            langKey: "codeToTabs",
            hotkey: "",
            callback: () => {
                const selection = document.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer.parentNode?.parentNode as any;
                    const editElement = currentNode?.querySelector('[contenteditable="true"]');
                    if (editElement && currentNode.dataset?.type === "NodeCodeBlock") {
                        this.convertToTabs(currentNode);
                    }
                }
            }
        });
    }

    async onLayoutReady() {
        logger.info("layout ready");
        this.syncSiyuanConfig();

        const configFile = await this.fetchFileFromUrl('/plugins/code-tabs/config.json', 'config.json');
        if (configFile === undefined || configFile.size === 0) {
            await ThemeManager.putStyleFile(this);
            await this.saveConfig();
            ThemeManager.updateAllTabsStyle();
        } else {
            const data = await this.loadDataFromFile(configFile);
            const configFlag = this.compareConfig(data, this.data);
            if (!configFlag) {
                await ThemeManager.putStyleFile(this);
                await this.saveConfig();
                ThemeManager.updateAllTabsStyle();
            }
        }

        const html = document.documentElement;
        const head = document.head;
        const callback = (mutationsList: any) => {
            const siyuanConfig = this.getSiyuanConfig();
            for (let mutation of mutationsList) {
                // 1. 检查思源基础配置是否有变动
                if (!this.compareConfig(siyuanConfig, this.data)) {
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

        const debounce = <T extends Function>(func: T, wait: number) => {
            let timeout: any = null;
            return function (...args: any) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        const putFileHandler = () => {
            logger.info(this.i18n.codeStyleChange);
            ThemeManager.putStyleFile(this).then(() => {
                this.syncSiyuanConfig();
                this.saveConfig();
                ThemeManager.updateAllTabsStyle();
            });
        }

        const debounced = debounce(putFileHandler, 500);
        const observer = new MutationObserver(callback);
        observer.observe(html, { attributes: true, childList: false, subtree: false });
        observer.observe(head, { attributes: true, childList: true, subtree: true });
    }

    private blockIconEvent({ detail }: any) {
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabs, click: () => {
                for (const item of detail.blockElements) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        this.convertToTabs(item);
                    }
                }
            }
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.fixAllTabs, click: () => {
                this.fixAllTabsInDocument();
            },
        });
    }

    private fixAllTabsInDocument(element: HTMLElement | Document = document) {
        element.querySelectorAll(`[data-type="NodeHTMLBlock"][${customAttr}]`).forEach(node => {
            const nodeId = (node as HTMLElement).dataset.nodeId;
            getBlockAttrs(nodeId).then(res => {
                if (!res) return;
                let codeText = res[`${customAttr}`].replace(new RegExp(newLineFlag, 'g'), '\n');
                if (!/[\r\n]+/.test(codeText)) {
                    codeText = node.getAttribute(`${customAttr}`).replace(/\u200b/g, '\n');
                }
                const codeArr = TabParser.checkCodeText(codeText, this.i18n);
                if (codeArr.result) {
                    // const htmlBlock = TabRenderer.createHtmlBlock(codeArr.code, this.i18n.toggleToCode);
                    // this.update('dom', htmlBlock, nodeId, codeText);
                } else {
                    pushErrMsg(`${this.i18n.fixAllTabsErrMsg}: ${nodeId}`).then();
                }
            });
        });
    }

    private async convertToTabs(item: any) {
        const id = item.dataset.nodeId;
        const codeText = item.querySelector('[contenteditable="true"]').textContent.replace(/\u200d/g, '').replace(/\u200b/g, '');
        const checkResult = TabParser.checkCodeText(codeText, this.i18n);
        if (checkResult.result) {
            const htmlBlock = TabRenderer.createHtmlBlock(checkResult.code, this.i18n.toggleToCode);
            this.update('dom', htmlBlock, id, codeText);
        }
    }

    private async update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        const new_block = await insertBlock(dataType, data, "", id, "");
        logger.info(`插入新块, id ${id}`);
        const new_id = new_block[0].doOperations[0].id;
        codeText = codeText.replace(/[\r\n]/g, `${newLineFlag}`);
        await setBlockAttrs(new_id, { [`${customAttr}`]: codeText });
        deleteBlock(id).then(() => {
            logger.info("delete code-block");
            const activeEditor = getActiveEditor(true);
            if (activeEditor) {
                activeEditor.reload(true);
            }
        });
    }

    private async loadDataFromFile(file: File): Promise<any> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    resolve(JSON.parse(reader.result as string));
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    private getSiyuanConfig() {
        return {
            fontSize: window.siyuan.config.editor.fontSize,
            mode: window.siyuan.config.appearance.mode,
            themeLight: window.siyuan.config.appearance.themeLight,
            themeDark: window.siyuan.config.appearance.themeDark,
            codeBlockThemeLight: window.siyuan.config.appearance.codeBlockThemeLight,
            codeBlockThemeDark: window.siyuan.config.appearance.codeBlockThemeDark
        }
    }

    private syncSiyuanConfig() {
        const properties = this.getSiyuanConfig();
        Object.keys(properties).forEach(key => {
            Object.defineProperty(this.data, key, {
                value: properties[key],
                writable: true,
                enumerable: true
            });
        });
    }

    private async saveConfig() {
        this.syncSiyuanConfig();
        const file = new File([JSON.stringify(this.data)], 'config.json', { type: 'application/json' });
        await putFile('/data/plugins/code-tabs/config.json', false, file);
    }

    private compareConfig(pluginConfig: any, siyuanConfig: any) {
        const pluginKeys = Object.keys(pluginConfig);
        const siyuanKeys = Object.keys(siyuanConfig);
        if (pluginKeys.length !== siyuanKeys.length) return false;
        for (const key of siyuanKeys) {
            if (pluginConfig[key] !== siyuanConfig[key]) return false;
        }
        return true;
    }

    private async fetchFileFromUrl(route: string, fileName: string): Promise<File> {
        try {
            const baseUrl = document.querySelector('base#baseURL')?.getAttribute('href');
            const url = baseUrl + route;
            const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
            if (!response.ok) return undefined;
            const blob = await response.blob();
            return new File([blob], fileName, { type: blob.type });
        } catch (e) {
            return undefined;
        }
    }
}