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
import { CODE_TAB_TITLE_ATTR, CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { resolveCodeTextFromSqlBlock, stripInvisibleChars } from "@/utils/encoding";
import { t } from "@/utils/i18n";
import logger from "@/utils/logger";
import { TabParser } from "./TabParser";
import { CodeTab, TabsData } from "./types";
import { TabRenderer } from "./TabRenderer";
import { TabDataManager } from "./TabDataManager";

export type ConversionStats = { success: number; failure: number };

type ConversionMessages = {
    completed: string;
    failed: string;
    invalidBlocks: string;
    skippedDueToFormat: string;
    noItems: string;
};
type CodeToTabsProcessItem = { id: string; codeArr: CodeTab[] };

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
            let data = TabDataManager.readFromAttrs(attrs);
            if (!data) {
                const legacy = TabDataManager.decodeLegacySourceFromAttrs(attrs);
                if (legacy) {
                    data = TabDataManager.migrateFromLegacy(legacy);
                }
            }
            if (!data) {
                logger.warn("持久化排序失败：缺少标签数据", { nodeId });
                pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
                return;
            }

            const reorderedTabs = order
                .map((id) => data?.tabs[Number(id)])
                .filter((item) => item !== undefined);
            if (reorderedTabs.length !== data.tabs.length) {
                logger.warn("持久化排序失败：顺序与数据数量不一致", {
                    nodeId,
                    order,
                    total: data.tabs.length,
                    mapped: reorderedTabs.length,
                });
                pushErrMsg(t(this.i18n, "msg.allTabsToCodeFailed"));
                return;
            }
            const newActive = order.findIndex((id) => Number(id) === data.active);
            data.tabs = reorderedTabs;
            data.active = newActive >= 0 ? newActive : 0;
            logger.debug("持久化排序重排完成", { count: reorderedTabs.length });

            const htmlBlock = await TabRenderer.createProtyleHtml(data);
            logger.debug("持久化排序生成 HTML 完成", { length: htmlBlock.length });
            await updateBlock("markdown", htmlBlock, nodeId);
            await TabDataManager.writeToBlock(nodeId, data);
            logger.debug("持久化排序完成", { nodeId });
            this.onSuccess?.();
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

            const codeText = stripInvisibleChars(contentEl.textContent || "");
            const checkResult = TabParser.checkCodeText(codeText);
            if (!checkResult.result) {
                const msg = "代码块不符合 Tab 格式";
                skipped.push({ nodeId: id, reason: msg });
                logger.info(`codeToTabs: ${msg}，跳过 (nodeId: ${id})`);
                continue;
            }
            toProcess.push({ id, codeArr: checkResult.code });
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

            const checkResult = TabParser.checkCodeText(codeText);
            if (!checkResult.result) {
                const msg = "代码块不符合 Tab 格式";
                skipped.push({ nodeId: id, reason: msg });
                logger.info(`codeToTabs(sql): ${msg}，跳过 (nodeId: ${id})`);
                continue;
            }
            toProcess.push({ id, codeArr: checkResult.code });
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

        logger.info("进入转换队列的代码块数量", { count: toProcess.length, label });
        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.codeToTabs"),
            toProcess,
            async ({ id, codeArr }) => {
                const data = TabDataManager.fromCodeTabs(codeArr);
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                await updateBlock("markdown", htmlBlock, id);
                await TabDataManager.writeToBlock(id, data);
            }
        );

        const stats = this.resultCounter(
            codeToTabsMessages,
            toProcess.map((x) => ({ id: x.id })),
            results,
            skipped,
            invalid
        );
        logger.info("代码块 -> 标签页 转换统计", { ...stats, label });

        if (stats.success > 0) {
            this.onSuccess?.();
        }

        return stats;
    }

    private extractTabsDataFromIal(ial: string): { dataRaw: string; legacyRaw: string } {
        const dataRaw = ial.match(new RegExp(`${CODE_TABS_DATA_ATTR}="([^"]*)"`, "i"))?.[1] ?? "";
        const legacyRaw = ial.match(/custom-plugin-code-tabs-sourcecode="([^"]*)"/)?.[1] ?? "";
        return { dataRaw, legacyRaw };
    }

    private async extractTabsData(block: TabBlock): Promise<{ id: string; data: TabsData | null }> {
        let id = "";
        let dataRaw = "";
        let legacyRaw = "";
        if ("ial" in block && typeof block.ial === "string") {
            id = block.id ?? "";
            const extracted = this.extractTabsDataFromIal(block.ial);
            dataRaw = extracted.dataRaw;
            legacyRaw = extracted.legacyRaw;
        } else {
            const domBlock = block as HTMLElement;
            id = domBlock.getAttribute("data-node-id") ?? "";
            dataRaw = domBlock.getAttribute(CODE_TABS_DATA_ATTR) ?? "";
            legacyRaw = domBlock.getAttribute(CUSTOM_ATTR) ?? "";
            if (!dataRaw && id) {
                const attrs = await getBlockAttrs(id);
                dataRaw = attrs?.[CODE_TABS_DATA_ATTR] ?? dataRaw;
                legacyRaw = attrs?.[CUSTOM_ATTR] ?? legacyRaw;
            }
        }

        if (!dataRaw && legacyRaw) {
            const legacy = TabDataManager.decodeLegacySourceFromAttrs({
                [CUSTOM_ATTR]: legacyRaw,
            });
            if (legacy) {
                const migrated = TabDataManager.migrateFromLegacy(legacy);
                return { id, data: migrated };
            }
        }
        if (!dataRaw) return { id, data: null };
        return { id, data: TabDataManager.decode(dataRaw) };
    }

    private async collectTabsDataBlocks(
        blockList: TabBlock[],
        context: string
    ): Promise<{
        toProcess: Array<{ id: string; data: TabsData }>;
        invalid: { nodeId: string; reason: string }[];
    }> {
        const toProcess: Array<{ id: string; data: TabsData }> = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            const { id, data } = await this.extractTabsData(block);
            if (!id) {
                const msg = "缺少 nodeId";
                invalid.push({ nodeId: "unknown", reason: msg });
                logger.warn(`${context}: ${msg}`);
                continue;
            }
            if (!data || data.tabs.length === 0) {
                const msg = "未找到标签数据";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`${context}: ${msg} (nodeId: ${id})`);
                continue;
            }
            const validation = TabDataManager.validate(data);
            if (!validation.ok) {
                const msg = "标签数据校验失败";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`${context}: ${msg} (nodeId: ${id})`, {
                    errors: validation.errors,
                });
                continue;
            }
            toProcess.push({ id, data });
        }

        return { toProcess, invalid };
    }

    async tabToCodeBatch(blockList: TabBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noTabsToConvert")}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始标签页 -> 代码块 批量转换", { count: blockList.length });

        const { toProcess, invalid } = await this.collectTabsDataBlocks(blockList, "tabToCode");
        const skipped: { nodeId: string; reason: string }[] = [];

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
            async ({ id, data }) => {
                await this.replaceWithPlainCodeBlocks(id, data.tabs);
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
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='html' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
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
            `SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
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

        const { toProcess, invalid } = await this.collectTabsDataBlocks(
            blockList,
            "tabsToPlainCode"
        );

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
            async ({ id, data }) => {
                await this.replaceWithPlainCodeBlocks(id, data.tabs);
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
                const titleAttr = block.getAttribute(CODE_TAB_TITLE_ATTR) ?? "";
                if (!id || !contentEl) return null;
                const codeText = stripInvisibleChars(contentEl.textContent || "").replace(
                    /\n+$/,
                    ""
                );
                return { id, codeText, languageRaw, titleAttr };
            })
            .filter(Boolean) as Array<{
            id: string;
            codeText: string;
            languageRaw: string;
            titleAttr: string;
        }>;

        if (blocks.length < 2) {
            pushMsg(`${t(this.i18n, "msg.mergeNeedMultipleBlocks")}`);
            return;
        }

        const codeArr: CodeTab[] = [];
        let hasTabSyntaxBlock = false;
        let fallbackIndex = 1;
        for (const item of blocks) {
            const parsed = TabParser.checkCodeText(item.codeText);
            if (parsed.result && parsed.code.length > 0) {
                codeArr.push(
                    ...parsed.code.map((tab) => ({
                        ...tab,
                        isActive: false,
                    }))
                );
                hasTabSyntaxBlock = true;
                continue;
            }
            const title = item.titleAttr ? item.titleAttr : `Tab${fallbackIndex}`;
            const language = item.languageRaw ? item.languageRaw : "plaintext";
            codeArr.push({ title, language, code: item.codeText, isActive: false });
            fallbackIndex += 1;
        }

        const data = TabDataManager.fromCodeTabs(codeArr);
        const targetId = blocks[0].id;
        const htmlBlock = await TabRenderer.createProtyleHtml(data);
        await updateBlock("markdown", htmlBlock, targetId);
        await TabDataManager.writeToBlock(targetId, data);
        const restIds = blocks.slice(1).map((item) => item.id);
        await Promise.all(restIds.map((id) => deleteBlock(id)));
        logger.info("合并代码块为标签页完成", { count: blocks.length });
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
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='html' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
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
            `SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
        )) as SqlBlock[];
        logger.info("全局标签页 -> 多个标准代码块 查询完成", { count: blockList.length });
        this.tabsToPlainCodeBlocksBatch(blockList);
    }

    private async replaceWithPlainCodeBlocks(
        id: string,
        tabs: Array<{ title: string; lang: string; code: string }>
    ): Promise<void> {
        let previousId = id;
        for (const tab of tabs) {
            const markdown = this.buildCodeBlock(tab.code, tab.lang);
            const result = await insertBlock("markdown", markdown, "", previousId, "");
            const newId = result[0].doOperations[0].id;
            if (this.shouldPersistTitle(tab.title)) {
                await setBlockAttrs(newId, { [CODE_TAB_TITLE_ATTR]: tab.title });
            }
            previousId = newId;
        }
        await deleteBlock(id);
        logger.info("标签页已拆分为标准代码块", { id, count: tabs.length });
    }

    private shouldPersistTitle(title: string): boolean {
        const trimmed = title.trim();
        if (!trimmed) return false;
        return !/^tab\d+$/i.test(trimmed);
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
