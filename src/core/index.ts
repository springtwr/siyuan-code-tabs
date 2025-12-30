import {getActiveEditor, Plugin} from "siyuan";
import {deleteBlock, insertBlock, pushErrMsg, pushMsg, putFile, setBlockAttrs, sql, updateBlock} from "@/api";
import logger from "@/utils/logger";
import {customAttr} from "@/assets/constants";
import {TabParser} from "@/modules/parser/TabParser";
import {TabRenderer} from "@/modules/renderer/TabRenderer";
import {ThemeManager} from "@/modules/theme/ThemeManager";
import {getCodeFromAttribute, TabManager} from "@/modules/tab-manager/TabManager";
import {encodeSource, stripInvisibleChars} from "@/utils/encoding";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        logger.info("loading code-tabs");

        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${this.i18n.notAllowHtmlBlockScript}`).then();
        }

        // 注入全局样式，移除 html 块默认的 padding
        const style = document.createElement('style');
        style.innerHTML = `div[data-type="NodeHTMLBlock"][${customAttr}] { padding: 0 !important; }`;
        document.head.appendChild(style);

        TabManager.initGlobalFunctions(this.i18n);

        this.addCommand({
            langKey: "codeToTabs",
            hotkey: "",
            editorCallback: () => {
                const selection = document.getSelection();
                if (!selection || selection.rangeCount === 0) {
                    logger.info("没有选中的代码块");
                    pushMsg(`${this.i18n.noSelectedCodeBlock}`);
                }

                const range = selection.getRangeAt(0);
                let startEl: Element | null = null;

                if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                    startEl = range.startContainer as Element;
                } else {
                    // 如果是 Text、Comment 等节点，取其父元素
                    startEl = range.startContainer.parentElement;
                }

                // 现在 startEl 要么是 Element，要么是 null
                const currentNode = startEl?.closest<HTMLElement>('[data-type]');

                if (currentNode && currentNode.dataset.type === 'NodeCodeBlock') {
                    const editElement = currentNode.querySelector('[contenteditable="true"]');
                    if (editElement) {
                        this.codeToTabs(currentNode).then(() => this.reloadActivateDocument());
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
        observer.observe(html, {attributes: true, childList: false, subtree: false});
        observer.observe(head, {attributes: true, childList: true, subtree: true});
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabs, click: () => {
                for (const item of detail.blockElements) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        this.codeToTabs(item).then(() => this.reloadActivateDocument());
                    }
                }
            }
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabsInDocument, click: () => {
                this.codeToTabsInDocument();
            },
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.tabToCodeInDocument, click: () => {
                this.tabToCodeInDocument();
            },
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.allTabsToCode, click: () => {
                this.allTabsToCode();
            },
        });
    }

    private reloadActivateDocument() {
        const activeEditor = getActiveEditor(true);
        if (activeEditor) {
            activeEditor.reload(true);
        }
    }

    private async codeToTabs(item: HTMLElement) {
        const id = item.dataset.nodeId;
        const contentEl = item.querySelector<HTMLElement>('[contenteditable="true"]');
        // 防御性检查
        if (!id) {
            logger.warn(`codeToTabs: 节点缺少 nodeId: &{item}`);
            return;
        }
        if (!contentEl) {
            logger.warn(`codeToTabs: 未找到 contenteditable 元素 (nodeId: ${id})`);
            return;
        }

        // 获取并清理文本
        let codeText = contentEl.textContent || '';
        codeText = stripInvisibleChars(codeText);

        // 检查是否符合 Tab 格式
        const checkResult = TabParser.checkCodeText(codeText, this.i18n);
        if (!checkResult.result) {
            logger.info(`codeToTabs: 代码块不符合 Tab 格式, 跳过 (nodeId: ${id})`)
            return; // 不符合，跳过
        }

        // 渲染并更新 DOM
        const htmlBlock = TabRenderer.createHtmlBlock(checkResult.code, this.i18n.toggleToCode);
        await this.update('dom', htmlBlock, id, codeText);
    }

    private async update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        const new_block = await insertBlock(dataType, data, "", id, "");
        const new_id = new_block[0].doOperations[0].id;
        logger.info(`插入新块, id ${new_id}`);
        // 使用 Base64 编码保存源码
        const encodedCodeText = encodeSource(codeText);
        await setBlockAttrs(new_id, {[`${customAttr}`]: encodedCodeText});
        await deleteBlock(id)
        logger.info(`删除旧的代码块, id ${id}`);
    }

    private async codeToTabsInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        const nodeList = currentDocument.protyle.contentElement.querySelectorAll<HTMLElement>('[data-type="NodeCodeBlock"]');
        const codeBlocks = Array.from(nodeList);

        if (codeBlocks.length === 0) {
            return;
        }

        logger.info(`开始转换 ${codeBlocks.length} 个代码块为 Tabs`);
        // 并行执行所有转换（允许部分失败）
        const results = await Promise.allSettled(
            codeBlocks.map(node => this.codeToTabs(node))
        );
        this.resultCounter(results, codeBlocks);

        // 所有任务（无论成败）都已结束，可安全执行文档刷新
        this.reloadActivateDocument();
    }

    private resultCounter(results: PromiseSettledResult<void>[], blockList: any[]) {
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results
            .map((result, index) =>
                result.status === 'rejected'
                    ? {nodeId: blockList[index]?.dataset.nodeId || 'unknown', error: result.reason}
                    : null
            )
            .filter((item): item is { nodeId: string; error: unknown } => item !== null);

        logger.info(`转换完成：${successes} 成功，${failures.length} 失败`);

        if (failures.length > 0) {
            failures.forEach(({nodeId, error}) => {
                logger.warn(`节点 ${nodeId} 转换失败: ${error}`);
            });
        }
        return {"success": successes, "failure": failures.length}
    }

    private async tabToCode(blockList: any[]) {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${this.i18n.noTabsToConvert}`);
            return {"success": 0, "failure": 0};
        }
        logger.info(`开始转换 ${blockList.length} 个 Tabs 为代码块`);
        // 并行执行所有转换（允许部分失败）
        const results = await Promise.allSettled(
            blockList.map(block => {
                let customAttribute = "";
                let block_id = "";
                // 用sql语句查询的结果使用block.ial,用Dom查询的结果使用block.attributes
                if (block.ial) {
                    block_id = block.id;
                    customAttribute = block.ial.match(/custom-plugin-code-tabs-sourcecode="([^"]*)"/)?.[1];
                } else {
                    block_id = block.attributes["data-node-id"].value
                    customAttribute = block.attributes["custom-plugin-code-tabs-sourcecode"].value;
                }
                const codeText = getCodeFromAttribute(block_id, customAttribute, this.i18n);
                const flag = "```````````````````````````";
                updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, block_id).then(() => {
                    logger.info('标签页转为代码块');
                });
            })
        );
        return this.resultCounter(results, blockList);
    }

    private async tabToCodeInDocument() {
        const currentDocument = getActiveEditor(true);
        const nodeList = currentDocument.protyle.contentElement.querySelectorAll<HTMLElement>(`[data-type="NodeHTMLBlock"][${customAttr}]`);
        const blockList = Array.from(nodeList);
        this.tabToCodeBatch(blockList);
    }

    private async allTabsToCode() {
        const blockList = await sql(`SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name='${customAttr}')`);
        this.tabToCodeBatch(blockList);
    }

    private async tabToCodeBatch(blockList: any[]) {
        const counter = await this.tabToCode(blockList);
        if (counter.success == 0) {
            pushMsg(`${this.i18n.noTabsToConvert}`);
        } else {
            pushMsg(`${this.i18n.allTabsToCodeCompleted}: ${counter.success}`);
            pushMsg(`${this.i18n.allTabsToCodeCompletedFailed}: ${counter.failure}`);
        }
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
        const file = new File([JSON.stringify(this.data)], 'config.json', {type: 'application/json'});
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
            const response = await fetch(url, {headers: {'Cache-Control': 'no-cache'}});
            if (!response.ok) return undefined;
            const blob = await response.blob();
            return new File([blob], fileName, {type: blob.type});
        } catch (e) {
            return undefined;
        }
    }
}