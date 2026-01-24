import { getActiveEditor, IObject } from "siyuan";
import {
    deleteBlock,
    getBlockAttrs,
    insertBlock,
    pushErrMsg,
    pushMsg,
    setBlockAttrs,
    sql,
    updateBlock,
} from "@/api";
import { CUSTOM_ATTR, TAB_SEPARATOR } from "@/constants";
import {
    encodeSource,
    resolveCodeTextFromSqlBlock,
    stripInvisibleChars,
} from "@/utils/encoding";
import { t } from "@/utils/i18n";
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
type CodeToTabsProcessItem = { id: string; codeText: string; codeArr: CodeTab[] };

type BatchTask = {
    cancelled: boolean;
    update: (completed: number, total: number) => void;
    cancel: () => void;
    destroy: () => void;
};

type BatchResult = {
    results: PromiseSettledResult<unknown>[];
    cancelledCount: number;
};

export class TabConverter {
    private readonly i18n: IObject;
    private readonly onSuccess?: () => void;
    private currentTask?: BatchTask;
    private static readonly progressThreshold = 20;

    constructor(i18n: IObject, onSuccess?: () => void) {
        this.i18n = i18n;
        this.onSuccess = onSuccess;
    }

    async reorderTabsInBlock(nodeId: string, order: string[]): Promise<void> {
        if (!nodeId || order.length === 0) return;
        try {
            logger.debug("持久化排序开始", { nodeId, order });
            const attrs = await getBlockAttrs(nodeId);
            if (!attrs || !attrs[`${CUSTOM_ATTR}`]) {
                logger.warn("持久化排序失败：缺少自定义属性", { nodeId });
                pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
                return;
            }
            const codeText = getCodeFromAttribute(nodeId, attrs[`${CUSTOM_ATTR}`], this.i18n);
            if (!codeText) {
                logger.warn("持久化排序失败：未解析到源码", { nodeId });
                return;
            }
            const parsed = TabParser.checkCodeText(codeText, this.i18n, true);
            if (!parsed.result || parsed.code.length === 0) {
                logger.warn("持久化排序失败：源码解析失败", { nodeId });
                pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
                return;
            }

            const reordered = order
                .map((id) => parsed.code[Number(id)])
                .filter((item) => item !== undefined);
            if (reordered.length !== parsed.code.length) {
                logger.warn("持久化排序失败：顺序与源码数量不一致", {
                    nodeId,
                    order,
                    total: parsed.code.length,
                    mapped: reordered.length,
                });
                pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
                return;
            }
            logger.debug("持久化排序重排完成", { count: reordered.length });

            const newSyntax = TabParser.generateNewSyntax(reordered);
            const htmlBlock = TabRenderer.createProtyleHtml(
                reordered,
                t(this.i18n, "label.toggleToCode")
            );
            logger.debug("持久化排序生成 HTML 完成", { length: htmlBlock.length });
            await updateBlock("markdown", htmlBlock, nodeId);
            await setBlockAttrs(nodeId, { [`${CUSTOM_ATTR}`]: encodeSource(newSyntax) });
            logger.debug("持久化排序完成", { nodeId });
        } catch (error) {
            logger.warn("拖拽排序持久化失败", { error });
            pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
        }
    }

    cancelCurrentTask(): void {
        if (!this.currentTask) return;
        this.currentTask.cancel();
        this.currentTask.destroy();
        this.currentTask = undefined;
    }

    private formatProgress(completed: number, total: number): string {
        return t(this.i18n, "task.progress.detail")
            .replace("{0}", String(completed))
            .replace("{1}", String(total));
    }

    private createProgressTask(taskLabel: string, total: number): BatchTask | null {
        if (!document.body || total < TabConverter.progressThreshold) {
            return null;
        }
        if (this.currentTask) {
            this.currentTask.cancel();
            this.currentTask.destroy();
            this.currentTask = undefined;
        }

        const container = document.createElement("div");
        container.className = "code-tabs__task";

        const titleEl = document.createElement("div");
        titleEl.textContent = "code-tabs";
        titleEl.className = "code-tabs__task-title";

        const labelEl = document.createElement("div");
        labelEl.textContent = taskLabel;
        labelEl.className = "code-tabs__task-text";

        const progressEl = document.createElement("div");
        progressEl.textContent = this.formatProgress(0, total);
        progressEl.className = "code-tabs__task-text";

        const cancelButton = document.createElement("button");
        cancelButton.className = "b3-button b3-button--outline fn__flex-center";
        cancelButton.textContent = t(this.i18n, "task.progress.cancel");

        container.appendChild(titleEl);
        container.appendChild(labelEl);
        container.appendChild(progressEl);
        container.appendChild(cancelButton);
        document.body.appendChild(container);

        const task: BatchTask = {
            cancelled: false,
            update: (completed, totalCount) => {
                progressEl.textContent = this.formatProgress(completed, totalCount);
            },
            cancel: () => {
                task.cancelled = true;
                cancelButton.disabled = true;
            },
            destroy: () => {
                cancelButton.removeEventListener("click", task.cancel);
                container.remove();
            },
        };

        cancelButton.addEventListener("click", task.cancel);
        this.currentTask = task;
        return task;
    }

    private async runBatch<T>(
        title: string,
        items: T[],
        handler: (item: T) => Promise<void>
    ): Promise<BatchResult> {
        const total = items.length;
        const task = this.createProgressTask(title, total);
        if (task) {
            task.update(0, total);
        }
        const results: PromiseSettledResult<unknown>[] = [];
        for (const item of items) {
            if (task?.cancelled) break;
            try {
                await handler(item);
                results.push({ status: "fulfilled", value: undefined });
            } catch (error) {
                results.push({ status: "rejected", reason: error });
            } finally {
                if (task) {
                    task.update(results.length, total);
                }
            }
        }

        const cancelledCount = total - results.length;
        if (cancelledCount > 0) {
            pushMsg(
                t(this.i18n, "msg.batchCancelled")
                    .replace("{0}", String(results.length))
                    .replace("{1}", String(total))
            );
        }

        task?.destroy();
        if (this.currentTask === task) {
            this.currentTask = undefined;
        }
        return { results, cancelledCount };
    }

    async codeToTabsBatch(blockList: HTMLElement[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noCodeBlockToConvert")}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始代码块 -> 标签页 批量转换", { count: blockList.length });

        const { toProcess, skipped, invalid } = this.collectCodeBlocksFromDom(blockList);
        return this.runCodeToTabsBatch(toProcess, skipped, invalid, "代码块 -> 标签页");
    }

    async codeToTabsBatchBySql(blockList: SqlBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noCodeBlockToConvert")}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始代码块 -> 标签页 批量转换（SQL）", { count: blockList.length });

        const { toProcess, skipped, invalid } = this.collectCodeBlocksFromSql(blockList);
        return this.runCodeToTabsBatch(toProcess, skipped, invalid, "代码块 -> 标签页（SQL）");
    }

    async codeToTabsInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return;
        const rootId =
            (currentDocument as { protyle?: { block?: { rootID?: string; rootId?: string } } })
                ?.protyle?.block?.rootID ??
            (currentDocument as { protyle?: { block?: { rootId?: string } } })?.protyle?.block
                ?.rootId;
        if (!rootId) {
            logger.warn("当前文档代码块 -> 标签页 失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return;
        }
        logger.info("当前文档代码块 -> 标签页 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='c'`
        )) as SqlBlock[];
        logger.info("当前文档代码块 -> 标签页 查询完成", {
            count: blockList.length,
            rootId,
        });
        this.codeToTabsBatchBySql(blockList);
    }

    private collectCodeBlocksFromDom(blockList: HTMLElement[]): {
        toProcess: CodeToTabsProcessItem[];
        skipped: { nodeId: string; reason: string }[];
        invalid: { nodeId: string; reason: string }[];
    } {
        const toProcess: CodeToTabsProcessItem[] = [];
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
            toProcess.push({ id, codeText, codeArr: checkResult.code });
        }

        return { toProcess, skipped, invalid };
    }

    private collectCodeBlocksFromSql(blockList: SqlBlock[]): {
        toProcess: CodeToTabsProcessItem[];
        skipped: { nodeId: string; reason: string }[];
        invalid: { nodeId: string; reason: string }[];
    } {
        const toProcess: CodeToTabsProcessItem[] = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            const id = block.id ?? "";
            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: "unknown", reason: msg });
                logger.warn(`codeToTabs(sql): ${msg}`);
                continue;
            }

            const codeText = resolveCodeTextFromSqlBlock(block);
            if (!codeText) {
                const msg = "未找到代码内容";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`codeToTabs(sql): ${msg} (nodeId: ${id})`);
                continue;
            }

            const checkResult = TabParser.checkCodeText(codeText, this.i18n);
            if (!checkResult.result) {
                const msg = "代码块不符合 Tab 格式";
                skipped.push({ nodeId: id, reason: msg });
                logger.info(`codeToTabs(sql): ${msg}，跳过 (nodeId: ${id})`);
                continue;
            }
            toProcess.push({ id, codeText, codeArr: checkResult.code });
        }

        return { toProcess, skipped, invalid };
    }

    private async runCodeToTabsBatch(
        toProcess: CodeToTabsProcessItem[],
        skipped: { nodeId: string; reason: string }[],
        invalid: { nodeId: string; reason: string }[],
        label: string
    ): Promise<ConversionStats> {
        const codeToTabsMessages = {
            completed: t(this.i18n, "msg.allCodeToTabsCompleted"),
            failed: t(this.i18n, "msg.allCodeToTabsCompletedFailed"),
            invalidBlocks: t(this.i18n, "msg.invalidBlocks"),
            noItems: t(this.i18n, "msg.noCodeBlockToConvert"),
            skippedDueToFormat: t(this.i18n, "msg.skippedBlocks"),
        };

        if (toProcess.length === 0) {
            return this.resultCounter(codeToTabsMessages, [], [], skipped, invalid);
        }

        logger.info("进入转换队列的代码块数量（SQL）", { count: toProcess.length });
        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.codeToTabs"),
            toProcess,
            async ({ id, codeText, codeArr }) => {
                const htmlBlock = TabRenderer.createProtyleHtml(
                    codeArr,
                    t(this.i18n, "label.toggleToCode")
                );
                await this.update("markdown", htmlBlock, id, codeText);
            }
        );

        const stats = this.resultCounter(
            codeToTabsMessages,
            toProcess.map((x) => ({ id: x.id })),
            results,
            skipped,
            invalid
        );
        logger.info("代码块 -> 标签页 转换统计（SQL）", stats);

        if (stats.success > 0) {
            this.onSuccess?.();
        }

        return stats;
    }

    async codeToTabsInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return;
        const rootId =
            (currentDocument as { protyle?: { block?: { rootID?: string; rootId?: string } } })
                ?.protyle?.block?.rootID ??
            (currentDocument as { protyle?: { block?: { rootId?: string } } })?.protyle?.block
                ?.rootId;
        if (!rootId) {
            logger.warn("当前文档代码块 -> 标签页 失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return;
        }
        logger.info("当前文档代码块 -> 标签页 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='c'`
        )) as SqlBlock[];
        logger.info("当前文档代码块 -> 标签页 查询完成", {
            count: blockList.length,
            rootId,
        });
        this.codeToTabsBatchBySql(blockList);
    }

    async tabToCodeBatch(blockList: TabBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noTabsToConvert")}`);
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
            completed: t(this.i18n, "msg.allTabsToCodeCompleted"),
            failed: t(this.i18n, "msg.allTabsToCodeCompletedFailed"),
            invalidBlocks: t(this.i18n, "msg.invalidBlocks"),
            noItems: t(this.i18n, "msg.noTabsToConvert"),
            skippedDueToFormat: t(this.i18n, "msg.skippedBlocks"),
        };
        // ===== 如果没有需要处理的项 =====
        if (toProcess.length === 0) {
            return this.resultCounter(tabsToCodeMessages, [], [], skipped, invalid);
        }

        // 并行执行所有转换（允许部分失败）
        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.tabsToCode"),
            toProcess,
            async ({ id, codeText }) => {
                const flag = TAB_SEPARATOR;
                await updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, id);
                logger.info(`标签页转为代码块: id ${id}`);
            }
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
        const rootId =
            (currentDocument as { protyle?: { block?: { rootID?: string; rootId?: string } } })
                ?.protyle?.block?.rootID ??
            (currentDocument as { protyle?: { block?: { rootId?: string } } })?.protyle?.block
                ?.rootId;
        if (!rootId) {
            logger.warn("当前文档标签页 -> 代码块 失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return;
        }
        logger.info("当前文档标签页 -> 代码块 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='html' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CUSTOM_ATTR}')`
        )) as SqlBlock[];
        logger.info("当前文档标签页 -> 代码块 查询完成", {
            count: blockList.length,
            rootId,
        });
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

    async tabsToPlainCodeBlocksBatch(blockList: TabBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noTabsToSplit")}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始标签页 -> 多个标准代码块 批量转换", { count: blockList.length });

        const toProcess: { id: string; codeArr: CodeTab[] }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            let customAttribute = "";
            let id = "";
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
                logger.warn(`tabsToPlainCode: ${msg}`);
                continue;
            }
            if (!customAttribute) {
                const msg = "未找到插件自定义属性";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`tabsToPlainCode: ${msg} (nodeId: ${id})`);
                continue;
            }
            if (!codeText) {
                const msg = "未找到源码";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`tabsToPlainCode: ${msg} (nodeId: ${id})`);
                continue;
            }

            const parseResult = TabParser.checkCodeText(codeText, this.i18n);
            if (!parseResult.result || parseResult.code.length === 0) {
                const msg = "源码解析失败";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`tabsToPlainCode: ${msg} (nodeId: ${id})`);
                continue;
            }

            toProcess.push({ id, codeArr: parseResult.code });
        }

        if (toProcess.length === 0) {
            if (invalid.length > 0) {
                pushMsg(
                    `${t(this.i18n, "msg.invalidBlocks").replace("{0}", invalid.length.toString())}`
                );
            }
            return { success: 0, failure: invalid.length };
        }

        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.tabsToPlainCode"),
            toProcess,
            async ({ id, codeArr }) => {
                await this.replaceWithPlainCodeBlocks(id, codeArr);
            }
        );

        const success = results.filter((r) => r.status === "fulfilled").length;
        const failure = results.length - success;
        if (success > 0) {
            pushMsg(
                `${t(this.i18n, "msg.tabsToPlainCodeCompleted").replace("{0}", success.toString())}`
            );
        }
        if (failure > 0) {
            pushMsg(
                `${t(this.i18n, "msg.tabsToPlainCodeFailed").replace("{0}", failure.toString())}`
            );
        }
        logger.info("标签页 -> 多个标准代码块 转换统计", { success, failure });
        return { success, failure };
    }

    async mergeCodeBlocksToTabSyntax(blockList: HTMLElement[]): Promise<void> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noCodeBlockToMerge")}`);
            return;
        }
        if (blockList.length < 2) {
            pushMsg(`${t(this.i18n, "msg.mergeNeedMultipleBlocks")}`);
            return;
        }

        const blocks = blockList
            .map((block) => {
                const id = block.dataset.nodeId ?? "";
                const contentEl = block.querySelector<HTMLElement>('[contenteditable="true"]');
                const languageEl = block.querySelector<HTMLElement>(".protyle-action__language");
                const languageRaw = languageEl?.textContent?.trim() ?? "";
                if (!id || !contentEl) return null;
                const codeText = stripInvisibleChars(contentEl.textContent || "");
                return { id, codeText, languageRaw };
            })
            .filter(Boolean) as Array<{ id: string; codeText: string; languageRaw: string }>;

        if (blocks.length < 2) {
            pushMsg(`${t(this.i18n, "msg.mergeNeedMultipleBlocks")}`);
            return;
        }

        const codeArr: CodeTab[] = [];
        let hasTabSyntaxBlock = false;
        let fallbackIndex = 1;
        for (const item of blocks) {
            const parsed = TabParser.checkCodeText(item.codeText, this.i18n, true);
            if (parsed.result && parsed.code.length > 0) {
                codeArr.push(...parsed.code);
                hasTabSyntaxBlock = true;
                continue;
            }
            const title = item.languageRaw ? item.languageRaw : `Tab${fallbackIndex}`;
            const language = item.languageRaw ? item.languageRaw : "plaintext";
            codeArr.push({ title, language, code: item.codeText, isActive: false });
            fallbackIndex += 1;
        }

        const codeText = TabParser.generateNewSyntax(codeArr).trim();
        const flag = TAB_SEPARATOR;
        const targetId = blocks[0].id;
        await updateBlock("markdown", `${flag}tab\n${codeText}\n${flag}`, targetId);
        const restIds = blocks.slice(1).map((item) => item.id);
        await Promise.all(restIds.map((id) => deleteBlock(id)));
        logger.info("合并代码块为 tab 语法代码块完成", { count: blocks.length });
        if (hasTabSyntaxBlock) {
            pushMsg(`${t(this.i18n, "msg.mergeContainsTabSyntax")}`).then();
        }
        pushMsg(
            `${t(this.i18n, "msg.mergeCodeBlocksCompleted").replace(
                "{0}",
                blocks.length.toString()
            )}`
        );
    }

    async tabsToPlainCodeInDocument(): Promise<void> {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return;
        const rootId =
            (currentDocument as { protyle?: { block?: { rootID?: string; rootId?: string } } })
                ?.protyle?.block?.rootID ??
            (currentDocument as { protyle?: { block?: { rootId?: string } } })?.protyle?.block
                ?.rootId;
        if (!rootId) {
            logger.warn("当前文档标签页 -> 多个标准代码块 失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return;
        }
        logger.info("当前文档标签页 -> 多个标准代码块 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='html' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CUSTOM_ATTR}')`
        )) as SqlBlock[];
        logger.info("当前文档标签页 -> 多个标准代码块 查询完成", {
            count: blockList.length,
            rootId,
        });
        this.tabsToPlainCodeBlocksBatch(blockList);
    }

    async allTabsToPlainCode(): Promise<void> {
        logger.info("全局标签页 -> 多个标准代码块 查询开始");
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CUSTOM_ATTR}')`
        )) as SqlBlock[];
        logger.info("全局标签页 -> 多个标准代码块 查询完成", { count: blockList.length });
        this.tabsToPlainCodeBlocksBatch(blockList);
    }

    private async update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        await updateBlock(dataType, data, id);
        logger.info(`更新块, id ${id}`);
        // 使用 Base64 编码保存源码
        const encodedCodeText = encodeSource(codeText);
        await setBlockAttrs(id, { [`${CUSTOM_ATTR}`]: encodedCodeText });
    }


    private async replaceWithPlainCodeBlocks(id: string, codeArr: CodeTab[]): Promise<void> {
        let previousId = id;
        for (const tab of codeArr) {
            const markdown = this.buildCodeBlock(tab.code, tab.language);
            const result = await insertBlock("markdown", markdown, "", previousId, "");
            const newId = result[0].doOperations[0].id;
            previousId = newId;
        }
        await deleteBlock(id);
        logger.info("标签页已拆分为标准代码块", { id, count: codeArr.length });
    }

    private buildCodeBlock(code: string, language: string): string {
        const fence = this.resolveFence(code);
        const lang = language && language !== "plaintext" ? language : "";
        return `${fence}${lang ? lang : ""}\n${code}\n${fence}`;
    }

    private resolveFence(code: string): string {
        let maxRun = 0;
        let current = 0;
        for (const ch of code) {
            if (ch === "`") {
                current += 1;
                if (current > maxRun) maxRun = current;
            } else {
                current = 0;
            }
        }
        const length = Math.max(3, maxRun + 1);
        return "`".repeat(length);
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
    content?: string;
    markdown?: string;
};

type TabBlock = HTMLElement | SqlBlock;
