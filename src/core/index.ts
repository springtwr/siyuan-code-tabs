import {getActiveEditor, Plugin, Setting} from "siyuan";
import {deleteBlock, insertBlock, pushErrMsg, pushMsg, putFile, setBlockAttrs, sql, updateBlock} from "@/api";
import logger from "@/utils/logger";
import {CUSTOM_ATTR, TAB_SEPARATOR, CONFIG_JSON, settingIconMain, HTML_BLOCK_STYLE} from "@/assets/constants";
import {TabParser} from "@/modules/parser/TabParser";
import {TabRenderer} from "@/modules/renderer/TabRenderer";
import {ThemeManager} from "@/modules/theme/ThemeManager";
import {getCodeFromAttribute, TabManager} from "@/modules/tab-manager/TabManager";
import {encodeSource, stripInvisibleChars} from "@/utils/encoding";
import {fetchFileFromUrlSimple, loadJsonFromFile} from "@/utils/network";
import {compareConfig, getSelectedElements, getSiyuanConfig, syncSiyuanConfig} from "@/utils/dom";
import {debounce} from "@/utils/common";

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
        style.innerHTML = HTML_BLOCK_STYLE;
        document.head.appendChild(style);

        TabManager.initGlobalFunctions(this.i18n);

        // 添加设置项
        this.setting = new Setting({
            confirmCallback: () => {}
        });
        const allTabsToCodeElement = document.createElement("button");
        allTabsToCodeElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        allTabsToCodeElement.textContent = `${this.i18n.allTabsToCodeBtn}`;
        allTabsToCodeElement.addEventListener("click", () => {
            this.allTabsToCode();
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
                this.codeToTabsBatch(blockList);
            }
        });
        this.addCommand({
            langKey: "tabToCode",
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
                this.tabToCodeBatch(blockList);
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
                const blockList: HTMLElement[] = [];
                for (const item of detail.blockElements as HTMLElement[]) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        blockList.push(item);
                    }
                }
                this.codeToTabsBatch(blockList);
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
                this.tabToCodeBatch(blockList);
            }
        })
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
    }

    private reloadActivateDocument() {
        const activeEditor = getActiveEditor(true);
        if (activeEditor) {
            logger.info("刷新页面");
            activeEditor.reload(true);
        }
    }

    private async codeToTabsBatch(blockList: HTMLElement[]) {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${this.i18n.noCodeBlockToConvert}`);
            return {"success": 0, "failure": 0};
        }

        // ===== 分类所有块 =====
        const toProcess: { block: HTMLElement; id: string; codeText: string }[] = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            const id = block.dataset.nodeId;
            const contentEl = block.querySelector<HTMLElement>('[contenteditable="true"]');

            // 情况1：数据异常（应视为“无效”，可能算失败或警告）
            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: 'unknown', reason: msg });
                logger.warn(`codeToTabs: ${msg}`);
                continue;
            }
            if (!contentEl) {
                const msg = "未找到 contenteditable 元素";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`codeToTabs: ${msg} (nodeId: ${id})`);
                continue;
            }

            // 情况2：内容不符合格式（正常跳过）
            let codeText = stripInvisibleChars(contentEl.textContent || '');
            const checkResult = TabParser.checkCodeText(codeText, this.i18n);
            if (!checkResult.result) {
                const msg = "代码块不符合 Tab 格式";
                skipped.push({ nodeId: id, reason: msg });
                logger.info(`codeToTabs: ${msg}，跳过 (nodeId: ${id})`);
                continue;
            }

            // 情况3：有效，加入处理队列
            toProcess.push({ block, id, codeText });
        }

        const codeToTabsMessages = {
            completed: this.i18n.allCodeToTabsCompleted,
            failed: this.i18n.allCodeToTabsCompletedFailed,
            invalidBlocks: this.i18n.invalidBlocks,
            noItems: this.i18n.noCodeBlockToConvert,
            skippedDueToFormat: this.i18n.skippedBlocks
        };

        // ===== 如果没有需要处理的项 =====
        if (toProcess.length === 0) {
            return this.resultCounter(codeToTabsMessages, [], [], skipped, invalid);
        }

        // ===== 对有效块执行异步更新 =====
        logger.info(`开始转换 ${toProcess.length} 个代码块为 Tabs`);
        const results = await Promise.allSettled(
            toProcess.map(({ id, codeText }) => {
                const htmlBlock = TabRenderer.createHtmlBlock(
                    TabParser.checkCodeText(codeText, this.i18n).code!,
                    this.i18n.toggleToCode
                );
                return this.update('dom', htmlBlock, id, codeText);
            })
        );

        // ===== 统计并提示 =====
        const stats = this.resultCounter(
            codeToTabsMessages,
            toProcess.map(x => ({ id: x.id })), // 只需 id 用于关联错误
            results,
            skipped,
            invalid
        );
        // 所有任务（无论成败）都已结束，可安全执行文档刷新
        if (stats.success > 0) {
            this.reloadActivateDocument();
        }

        return stats;

    }

    private async update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        const new_block = await insertBlock(dataType, data, "", id, "");
        const new_id = new_block[0].doOperations[0].id;
        logger.info(`插入新块, id ${new_id}`);
        // 使用 Base64 编码保存源码
        const encodedCodeText = encodeSource(codeText);
        await setBlockAttrs(new_id, {[`${CUSTOM_ATTR}`]: encodedCodeText});
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
        
        this.codeToTabsBatch(codeBlocks);
    }

    private resultCounter(
        messages: { completed: string; failed: string; invalidBlocks: string; skippedDueToFormat: string; noItems: string; },
        toProcess: Array<{ id: string }>,            // 真正尝试转换的项
        results: PromiseSettledResult<any>[],          // 对应 toProcess 的异步结果
        skipped: { nodeId: string; reason: string }[],   // 因格式跳过的项
        invalid: { nodeId: string; reason: string }[]   // 因数据异常无法处理的项
    ): { success: number; failure: number; } {
        // === 1. 统计真正执行的结果 ===
        const success = results.filter(r => r.status === 'fulfilled').length;
        const executionFailures: { nodeId: string; error: unknown }[] = [];

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                executionFailures.push({
                    nodeId: toProcess[index].id,
                    error: result.reason
                });
            }
        });

        // === 2. 总失败数 = 执行失败 + 无效项（根据业务决定是否包含）
        const totalFailure = executionFailures.length + invalid.length;

        // === 3. 日志记录 ===

        executionFailures.forEach(({ nodeId, error }) => {
            logger.warn(`执行失败 - 节点 ${nodeId}: ${error}`);
        });

        invalid.forEach(({ nodeId, reason }) => {
            logger.warn(`数据无效 - 节点 ${nodeId}: ${reason}`);
        });

        skipped.forEach(({ nodeId, reason }) => {
            logger.info(`格式跳过 - 节点 ${nodeId}: ${reason}`);
        });

        logger.info(`转换完成：${success} 成功，${executionFailures.length} 执行失败，${invalid.length} 数据无效，${skipped.length} 格式跳过`);

        // === 4. 用户提示（pushMsg）===
        if (success > 0) {
            pushMsg(messages.completed.replace('{0}', String(success)));
        }

        if (executionFailures.length > 0) {
            pushMsg(messages.failed.replace('{0}', String(executionFailures.length)));
        }

        if (invalid.length > 0) {
            pushMsg(messages.invalidBlocks.replace('{0}', String(invalid.length)));
        }

        if (skipped.length > 0) {
            pushMsg(messages.skippedDueToFormat.replace('{0}', String(skipped.length)));
        }

        // 如果没有任何成功，且所有项都被跳过或无效
        if (success === 0 && (skipped.length + invalid.length) > 0) {
            pushMsg(messages.noItems);
        }

        return {
            success,
            failure: totalFailure
        };
    }

    private async tabToCodeBatch(blockList: any[]) {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${this.i18n.noTabsToConvert}`);
            return {"success": 0, "failure": 0};
        }
        logger.info(`开始转换 ${blockList.length} 个 Tabs 为代码块`);

        // ===== 分类所有块 =====
        const toProcess: { block: HTMLElement; id: string; codeText: string }[] = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList){
            let customAttribute = "";
            let id = "";
            // 用sql语句查询的结果使用block.ial,用Dom查询的结果使用block.attributes
            if (block.ial) {
                id = block.id;
                customAttribute = block.ial.match(/custom-plugin-code-tabs-sourcecode="([^"]*)"/)?.[1];
            } else {
                id = block.attributes["data-node-id"].value
                customAttribute = block.attributes[`${CUSTOM_ATTR}`].value;
            }
            const codeText = getCodeFromAttribute(id, customAttribute, this.i18n);

            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: 'unknown', reason: msg });
                logger.warn(`tabToCode: ${msg}`);
                continue;
            }
            if (!customAttribute) {
                const msg = "未找到插件自定义属性";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`tabToCode: ${msg} (nodeId: ${id})`);
                continue;
            }

            if (!codeText) {
                const msg = "未找到源码";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`tabToCode: ${msg} (nodeId: ${id})`);
                continue;
            }

            // 有效，加入处理队列
            toProcess.push({ block, id, codeText });
        }

        const tabsToCodeMessages = {
            completed: this.i18n.allTabsToCodeCompleted,
            failed: this.i18n.allTabsToCodeCompletedFailed,
            invalidBlocks: this.i18n.invalidBlocks,
            noItems: this.i18n.noTabsToConvert,
            skippedDueToFormat: this.i18n.skippedBlocks
        };
        // ===== 如果没有需要处理的项 =====
        if (toProcess.length === 0) {
            return this.resultCounter(tabsToCodeMessages, [], [], skipped, invalid);
        }


        // 并行执行所有转换（允许部分失败）
        const results = await Promise.allSettled(
            toProcess.map(({ id, codeText }) => {
                const flag = TAB_SEPARATOR;
                return updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, id).then(() => {
                    logger.info(`标签页转为代码块: id ${id}`);
                });
            })
        );
        
        // ===== 统计并提示 =====
        const stats = this.resultCounter(
            tabsToCodeMessages,
            toProcess.map(x => ({ id: x.id })), // 只需 id 用于关联错误
            results,
            skipped,
            invalid
        );

        return stats;
    }

    private async tabToCodeInDocument() {
        const currentDocument = getActiveEditor(true);
        const nodeList = currentDocument.protyle.contentElement.querySelectorAll<HTMLElement>(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
        const blockList = Array.from(nodeList);
        this.tabToCodeBatch(blockList);
    }

    private async allTabsToCode() {
        const blockList = await sql(`SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CUSTOM_ATTR}')`);
        this.tabToCodeBatch(blockList);
    }

    private async saveConfig() {
        syncSiyuanConfig(this.data);
        const file = new File([JSON.stringify(this.data)], 'config.json', {type: 'application/json'});
        await putFile(CONFIG_JSON, false, file);
    }


}