import { getActiveEditor, IObject } from "siyuan";
import { deleteBlock, insertBlock, pushMsg, setBlockAttrs, sql, updateBlock } from "@/api";
import { CUSTOM_ATTR, TAB_SEPARATOR } from "@/constants";
import { encodeSource, stripInvisibleChars } from "@/utils/encoding";
import logger from "@/utils/logger";
import { TabParser } from "./TabParser";
import { CodeTab } from "./types";
import { TabRenderer } from "./TabRenderer";
import { getCodeFromAttribute } from "./TabManager";

export type ConversionStats = { success: number; failure: number };

type ConversionMessages = {
    completed: string;
    failed: string;
    invalidBlocks: string;
    skippedDueToFormat: string;
    noItems: string;
};

export class TabConverter {
    private readonly i18n: IObject;
    private readonly onSuccess?: () => void;

    constructor(i18n: IObject, onSuccess?: () => void) {
        this.i18n = i18n;
        this.onSuccess = onSuccess;
    }

    async codeToTabsBatch(blockList: HTMLElement[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${this.i18n.noCodeBlockToConvert}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始代码块 -> 标签页 批量转换", { count: blockList.length });

        // ===== 分类所有块 =====
        const toProcess: { id: string; codeText: string; codeArr: CodeTab[] }[] = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            const id = block.dataset.nodeId;
            const contentEl = block.querySelector<HTMLElement>('[contenteditable="true"]');

            // 情况1：数据异常（应视为“无效”，可能算失败或警告）
            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: "unknown", reason: msg });
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
            let codeText = stripInvisibleChars(contentEl.textContent || "");
            const checkResult = TabParser.checkCodeText(codeText, this.i18n);
            if (!checkResult.result) {
                const msg = "代码块不符合 Tab 格式";
                skipped.push({ nodeId: id, reason: msg });
                logger.info(`codeToTabs: ${msg}，跳过 (nodeId: ${id})`);
                continue;
            }

            // 情况3：有效，加入处理队列
            toProcess.push({ id, codeText, codeArr: checkResult.code });
        }

        const codeToTabsMessages = {
            completed: this.i18n.allCodeToTabsCompleted,
            failed: this.i18n.allCodeToTabsCompletedFailed,
            invalidBlocks: this.i18n.invalidBlocks,
            noItems: this.i18n.noCodeBlockToConvert,
            skippedDueToFormat: this.i18n.skippedBlocks,
        };

        // ===== 如果没有需要处理的项 =====
        if (toProcess.length === 0) {
            return this.resultCounter(codeToTabsMessages, [], [], skipped, invalid);
        }

        // ===== 对有效块执行异步更新 =====
        logger.info("进入转换队列的代码块数量", { count: toProcess.length });
        const results = await Promise.allSettled(
            toProcess.map(({ id, codeText, codeArr }) => {
                const htmlBlock = TabRenderer.createHtmlBlock(codeArr, this.i18n.toggleToCode);
                return this.update("dom", htmlBlock, id, codeText);
            })
        );

        // ===== 统计并提示 =====
        const stats = this.resultCounter(
            codeToTabsMessages,
            toProcess.map((x) => ({ id: x.id })), // 只需 id 用于关联错误
            results,
            skipped,
            invalid
        );
        logger.info("代码块 -> 标签页 转换统计", stats);

        if (stats.success > 0) {
            this.onSuccess?.();
        }

        return stats;
    }

    async codeToTabsInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return;
        const nodeList = currentDocument.protyle.contentElement.querySelectorAll<HTMLElement>(
            '[data-type="NodeCodeBlock"]'
        );
        const codeBlocks = Array.from(nodeList);

        if (codeBlocks.length === 0) {
            return;
        }

        logger.info("当前文档代码块 -> 标签页", { count: codeBlocks.length });
        this.codeToTabsBatch(codeBlocks);
    }

    async tabToCodeBatch(blockList: TabBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${this.i18n.noTabsToConvert}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始标签页 -> 代码块 批量转换", { count: blockList.length });

        // ===== 分类所有块 =====
        const toProcess: { id: string; codeText: string }[] = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            let customAttribute = "";
            let id = "";
            // 用sql语句查询的结果使用block.ial,用Dom查询的结果使用block.attributes
            if ("ial" in block && typeof block.ial === "string") {
                id = block.id ?? "";
                customAttribute = block.ial.match(
                    /custom-plugin-code-tabs-sourcecode="([^"]*)"/
                )?.[1];
            } else {
                const domBlock = block as HTMLElement;
                id = domBlock.getAttribute("data-node-id") ?? "";
                customAttribute = domBlock.getAttribute(CUSTOM_ATTR) ?? "";
            }
            const codeText = getCodeFromAttribute(id, customAttribute, this.i18n);

            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: "unknown", reason: msg });
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
            toProcess.push({ id, codeText });
        }

        const tabsToCodeMessages = {
            completed: this.i18n.allTabsToCodeCompleted,
            failed: this.i18n.allTabsToCodeCompletedFailed,
            invalidBlocks: this.i18n.invalidBlocks,
            noItems: this.i18n.noTabsToConvert,
            skippedDueToFormat: this.i18n.skippedBlocks,
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
            toProcess.map((x) => ({ id: x.id })), // 只需 id 用于关联错误
            results,
            skipped,
            invalid
        );
        logger.info("标签页 -> 代码块 转换统计", stats);

        return stats;
    }

    async tabToCodeInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return;
        const nodeList = currentDocument.protyle.contentElement.querySelectorAll<HTMLElement>(
            `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`
        );
        const blockList = Array.from(nodeList);
        logger.info("当前文档标签页 -> 代码块", { count: blockList.length });
        this.tabToCodeBatch(blockList);
    }

    async allTabsToCode(): Promise<void> {
        logger.info("全局标签页 -> 代码块 查询开始");
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CUSTOM_ATTR}')`
        )) as SqlBlock[];
        logger.info("全局标签页 -> 代码块 查询完成", { count: blockList.length });
        this.tabToCodeBatch(blockList);
    }

    private async update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        const new_block = await insertBlock(dataType, data, "", id, "");
        const new_id = new_block[0].doOperations[0].id;
        logger.info(`插入新块, id ${new_id}`);
        // 使用 Base64 编码保存源码
        const encodedCodeText = encodeSource(codeText);
        await setBlockAttrs(new_id, { [`${CUSTOM_ATTR}`]: encodedCodeText });
        await deleteBlock(id);
        logger.info(`删除旧的代码块, id ${id}`);
    }

    private resultCounter(
        messages: ConversionMessages,
        toProcess: Array<{ id: string }>,
        results: PromiseSettledResult<unknown>[],
        skipped: { nodeId: string; reason: string }[],
        invalid: { nodeId: string; reason: string }[]
    ): ConversionStats {
        // === 1. 统计真正执行的结果 ===
        const success = results.filter((r) => r.status === "fulfilled").length;
        const executionFailures: { nodeId: string; error: unknown }[] = [];

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                executionFailures.push({
                    nodeId: toProcess[index].id,
                    error: result.reason,
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

        logger.info("转换完成", {
            success,
            executionFailures: executionFailures.length,
            invalid: invalid.length,
            skipped: skipped.length,
        });

        // === 4. 用户提示（pushMsg）===
        if (success > 0) {
            pushMsg(messages.completed.replace("{0}", String(success)));
        }

        if (executionFailures.length > 0) {
            pushMsg(messages.failed.replace("{0}", String(executionFailures.length)));
        }

        if (invalid.length > 0) {
            pushMsg(messages.invalidBlocks.replace("{0}", String(invalid.length)));
        }

        if (skipped.length > 0) {
            pushMsg(messages.skippedDueToFormat.replace("{0}", String(skipped.length)));
        }

        // 如果没有任何成功，且所有项都被跳过或无效
        if (success === 0 && skipped.length + invalid.length > 0) {
            pushMsg(messages.noItems);
        }

        return {
            success,
            failure: totalFailure,
        };
    }
}

type SqlBlock = {
    ial?: string;
    id?: string;
};

type TabBlock = HTMLElement | SqlBlock;
