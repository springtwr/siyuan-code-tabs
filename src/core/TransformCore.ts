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
import {
    CODE_TAB_SOURCE_ATTR,
    CODE_TABS_DATA_ATTR,
    CODE_TABS_METADATA_ATTR,
    CUSTOM_ATTR,
} from "@/constants";
import { resolveCodeTextFromSqlBlock, stripCodeFence, stripInvisibleChars } from "@/utils/encoding";
import { t } from "@/utils/i18n";
import logger from "@/utils/logger";
import { LegacyTabParser } from "@/utils/LegacyTabParser";
import { CodeTab, CodeTabSource, TabsData } from "@/types/tabs";
import { TabRenderer } from "./TabRenderer";
import { TabData } from "./TabData";

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

/**
 * tabs 与代码块之间的批量转换入口。
 * 副作用：批量更新/删除块、写入属性。
 */
export class TransformCore {
    private readonly i18n: IObject;
    private readonly onSuccess?: () => void;
    private currentTask?: BatchTask;
    private static readonly progressThreshold = 20;

    constructor(i18n: IObject, onSuccess?: () => void) {
        this.i18n = i18n;
        this.onSuccess = onSuccess;
    }

    /**
     * 取消当前批量任务并销毁进度 UI。
     * @returns void
     */
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

    /**
     * 创建批量任务的进度 UI（数量较大时才显示）。
     * @param taskLabel 任务标题
     * @param total 总数
     * @param force 是否强制显示
     * @returns BatchTask 或 null
     */
    private createProgressTask(
        taskLabel: string,
        total: number,
        force: boolean = false
    ): BatchTask | null {
        if (!document.body || (!force && total < TransformCore.progressThreshold)) {
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
        handler: (item: T) => Promise<void>,
        options?: { forceProgress?: boolean }
    ): Promise<BatchResult> {
        const total = items.length;
        const task = this.createProgressTask(title, total, options?.forceProgress ?? false);
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

    /**
     * 批量将代码块转换为标签页（选区入口）。
     * @param blockList 代码块列表
     * @returns 转换统计
     */
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

    /**
     * 当前文档内的代码块转换入口（SQL 查询）。
     * @returns Promise<void>
     */
    async codeToTabsInDocument(): Promise<void> {
        const rootId = this.getActiveDocumentRootId();
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
            const checkResult = LegacyTabParser.parseTabSyntax(codeText);
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

            const checkResult = LegacyTabParser.parseTabSyntax(codeText);
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
                const data = TabData.fromCodeTabs(codeArr);
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                await updateBlock("markdown", htmlBlock, id);
                await TabData.writeFullToBlock(id, data, TabData.createMetadata());
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

    /**
     * 从 IAL 字符串中提取指定属性值。
     * @param ial IAL 字符串
     * @param attrName 属性名
     * @returns 属性值，未找到返回空字符串
     */
    private extractAttrFromIal(ial: string, attrName: string): string {
        return ial.match(new RegExp(`${attrName}="([^"]*)"`, "i"))?.[1] ?? "";
    }

    private async extractTabsData(block: TabBlock): Promise<{
        id: string;
        data: TabsData | null;
        metadataId: string;
    }> {
        let id: string;
        let dataRaw: string;
        let legacyRaw: string;
        let metadataRaw: string;
        if ("ial" in block && typeof block.ial === "string") {
            id = block.id ?? "";
            dataRaw = this.extractAttrFromIal(block.ial, CODE_TABS_DATA_ATTR);
            legacyRaw = this.extractAttrFromIal(block.ial, CUSTOM_ATTR);
            metadataRaw = this.extractAttrFromIal(block.ial, CODE_TABS_METADATA_ATTR);
        } else {
            const domBlock = block as HTMLElement;
            id = domBlock.getAttribute("data-node-id") ?? "";
            dataRaw = domBlock.getAttribute(CODE_TABS_DATA_ATTR) ?? "";
            legacyRaw = domBlock.getAttribute(CUSTOM_ATTR) ?? "";
            metadataRaw = domBlock.getAttribute(CODE_TABS_METADATA_ATTR) ?? "";
            if ((!dataRaw || !metadataRaw) && id) {
                const attrs = await getBlockAttrs(id);
                if (!dataRaw) dataRaw = attrs?.[CODE_TABS_DATA_ATTR] ?? "";
                if (!legacyRaw) legacyRaw = attrs?.[CUSTOM_ATTR] ?? "";
                if (!metadataRaw) metadataRaw = attrs?.[CODE_TABS_METADATA_ATTR] ?? "";
            }
        }

        if (!dataRaw && legacyRaw) {
            const legacy = TabData.decodeLegacySourceFromAttrs({
                [CUSTOM_ATTR]: legacyRaw,
            });
            if (legacy) {
                const upgraded = TabData.upgradeFromLegacy(legacy);
                return { id, data: upgraded, metadataId: "" };
            }
        }
        if (!dataRaw) return { id, data: null, metadataId: "" };
        return { id, data: TabData.decode(dataRaw), metadataId: TabData.decodeMetadata(metadataRaw)?.id ?? "" };
    }

    private async collectTabsDataBlocks(
        blockList: TabBlock[],
        context: string
    ): Promise<{
        toProcess: Array<{ id: string; data: TabsData; metadataId: string }>;
        invalid: { nodeId: string; reason: string }[];
    }> {
        const toProcess: Array<{ id: string; data: TabsData; metadataId: string }> = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        for (const block of blockList) {
            const { id, data, metadataId } = await this.extractTabsData(block);
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
            const validation = TabData.validate(data);
            if (!validation.ok) {
                const msg = "标签数据校验失败";
                invalid.push({ nodeId: id, reason: msg });
                logger.warn(`${context}: ${msg} (nodeId: ${id})`, {
                    errors: validation.errors,
                });
                continue;
            }
            // 元数据缺失时（旧块）生成新 id，保证拆分产物仍可被合并识别
            toProcess.push({
                id,
                data,
                metadataId: metadataId || TabData.createMetadata().id,
            });
        }

        return { toProcess, invalid };
    }

    /**
     * 批量将标签页拆分为代码块。
     * @param blockList 标签页块列表
     * @returns 转换统计
     */
    async tabsToCodeBlocksBatch(blockList: TabBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noTabsToSplit")}`);
            return { success: 0, failure: 0 };
        }
        logger.info("开始标签页 -> 多个代码块 批量转换", { count: blockList.length });

        const { toProcess, invalid } = await this.collectTabsDataBlocks(
            blockList,
            "tabsToCodeBlocks"
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
            t(this.i18n, "task.progress.tabsToCodeBlocks"),
            toProcess,
            async ({ id, data, metadataId }) => {
                await this.replaceWithCodeBlocks(id, data.tabs, metadataId, data.active);
            }
        );

        const success = results.filter((r) => r.status === "fulfilled").length;
        const failure = results.length - success;
        if (success > 0) {
            pushMsg(
                `${t(this.i18n, "msg.tabsToCodeBlocksCompleted").replace("{0}", success.toString())}`
            );
        }
        if (failure > 0) {
            pushMsg(
                `${t(this.i18n, "msg.tabsToCodeBlocksFailed").replace("{0}", failure.toString())}`
            );
        }
        logger.info("标签页 -> 多个代码块 转换统计", { success, failure });
        return { success, failure };
    }

    /**
     * 将目标块转换为标签页
     * @param targetId 目标块 ID
     * @returns Promise<void>
     */
    async newTabs(targetId: string): Promise<void> {
        if (!targetId) {
            pushErrMsg(t(this.i18n, "msg.noTargetBlock"));
            return;
        }

        if (!window.hljs) {
            await TabRenderer.ensureLibraryLoaded("hljs");
        }
        const data = TabData.createDefaultData();
        const htmlBlock = await TabRenderer.createProtyleHtml(data);
        await updateBlock("markdown", htmlBlock, targetId);
        await TabData.writeFullToBlock(targetId, data, TabData.createMetadata());
        return;
    }

    /**
     * 合并多个代码块为标签页（支持 tab 语法展开）。
     * @param blockList 代码块列表
     * @returns Promise<void>
     */
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
                // 标题与激活状态读拆分产物 source 属性（无 source 时标题回退为 Tab{n}）
                const sourceRaw = block.getAttribute(CODE_TAB_SOURCE_ATTR);
                const source = sourceRaw ? TabData.decodeTabSource(sourceRaw) : null;
                const titleAttr = source?.title ?? "";
                const sourceActive = source?.active === true;
                if (!id || !contentEl) return null;
                // 思源代码块 DOM 的 textContent 末尾自带一个换行伪影，
                // 仅去掉这一个，保留用户真实的末尾空行
                const codeText = stripInvisibleChars(contentEl.textContent || "").replace(
                    /\n$/,
                    ""
                );
                if (codeText.trim().length === 0) {
                    return { id, codeText, languageRaw, titleAttr, isActive: sourceActive, isEmpty: true };
                }
                return { id, codeText, languageRaw, titleAttr, isActive: sourceActive };
            })
            .filter(Boolean) as Array<{
            id: string;
            codeText: string;
            languageRaw: string;
            titleAttr: string;
            isActive: boolean;
            isEmpty?: boolean;
        }>;

        const emptyBlocks = blocks.filter((block) => block.isEmpty);
        const filteredBlocks = blocks.filter((block) => !block.isEmpty);
        if (emptyBlocks.length > 0) {
            pushMsg(
                `${t(this.i18n, "msg.mergeSkipEmptyBlocks").replace(
                    "{0}",
                    emptyBlocks.length.toString()
                )}`
            );
        }

        if (filteredBlocks.length === 0) {
            pushMsg(`${t(this.i18n, "msg.noCodeBlockToMerge")}`);
            return;
        }
        if (filteredBlocks.length < 2) {
            pushMsg(`${t(this.i18n, "msg.mergeNeedMultipleBlocks")}`);
            return;
        }

        const codeArr: CodeTab[] = [];
        let hasTabSyntaxBlock = false;
        let fallbackIndex = 1;
        for (const item of filteredBlocks) {
            const parsed = LegacyTabParser.parseTabSyntax(item.codeText);
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
            // 还原拆分时记录的激活状态（默认标签）
            codeArr.push({ title, language, code: item.codeText, isActive: item.isActive });
            fallbackIndex += 1;
        }

        const data = TabData.fromCodeTabs(codeArr);
        const targetId = filteredBlocks[0].id;
        const htmlBlock = await TabRenderer.createProtyleHtml(data);
        await updateBlock("markdown", htmlBlock, targetId);
        await TabData.writeFullToBlock(targetId, data, TabData.createMetadata());
        const restIds = filteredBlocks.slice(1).map((item) => item.id);
        await Promise.all(restIds.map((id) => deleteBlock(id)));
        logger.info("合并代码块为标签页完成", { count: filteredBlocks.length });
        if (hasTabSyntaxBlock) {
            pushMsg(`${t(this.i18n, "msg.mergeContainsTabSyntax")}`).then();
        }
        pushMsg(
            `${t(this.i18n, "msg.mergeCodeBlocksCompleted").replace(
                "{0}",
                filteredBlocks.length.toString()
            )}`
        );
    }

    /**
     * 获取当前活动文档的根块 ID。
     * @returns 根块 ID，失败返回空字符串
     */
    private getActiveDocumentRootId(): string {
        const currentDocument = getActiveEditor(true);
        if (!currentDocument) return "";
        return (
            (currentDocument as { protyle?: { block?: { rootID?: string; rootId?: string } } })
                ?.protyle?.block?.rootID ??
            (currentDocument as { protyle?: { block?: { rootId?: string } } })?.protyle?.block
                ?.rootId ??
            ""
        );
    }

    async tabsToCodeBlocksInDocument(): Promise<void> {
        const rootId = this.getActiveDocumentRootId();
        if (!rootId) {
            logger.warn("当前文档标签页 -> 多个代码块 失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return;
        }
        logger.info("当前文档标签页 -> 多个代码块 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='html' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
        )) as SqlBlock[];
        logger.info("当前文档标签页 -> 多个代码块 查询完成", {
            count: blockList.length,
            rootId,
        });
        this.tabsToCodeBlocksBatch(blockList);
    }

    /**
     * 当前文档：将被拆分的代码块按元数据 id 合并回标签页。
     * @returns 合并统计
     */
    async codeBlocksToTabsInDocument(): Promise<ConversionStats> {
        const rootId = this.getActiveDocumentRootId();
        if (!rootId) {
            logger.warn("当前文档代码块 -> 标签页 合并失败：缺少 rootId");
            pushErrMsg(t(this.i18n, "msg.noRootId"));
            return { success: 0, failure: 0 };
        }
        logger.info("当前文档拆分代码块 -> 标签页 查询开始", { rootId });
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE root_id='${rootId}' AND type='c' AND id IN (SELECT block_id FROM attributes AS a WHERE a.name='${CODE_TAB_SOURCE_ATTR}') ORDER BY sort`
        )) as SqlBlock[];
        logger.info("当前文档拆分代码块 -> 标签页 查询完成", {
            count: blockList.length,
            rootId,
        });
        return this.mergeGroupedCodeBlocks(blockList);
    }

    /**
     * 将带有同一分组属性的代码块合并为标签页，保留原元数据 id。
     * @param blockList 拆分产物代码块列表
     * @returns 合并统计
     */
    private async mergeGroupedCodeBlocks(blockList: SqlBlock[]): Promise<ConversionStats> {
        if (!blockList || blockList.length === 0) {
            // 文档级合并：无任何拆分产物时给出可操作的详细提示
            pushMsg(`${t(this.i18n, "msg.noSplitCodeBlocksToMerge")}`);
            return { success: 0, failure: 0 };
        }

        const groups = new Map<string, GroupedCodeBlock[]>();
        const invalid: { nodeId: string; reason: string }[] = [];
        for (const block of blockList) {
            const id = block.id ?? "";
            const ial = block.ial ?? "";
            const source = this.extractTabSourceFromIal(ial);
            if (!id || !source) {
                invalid.push({ nodeId: id || "unknown", reason: "缺少分组属性" });
                continue;
            }
            const codeText = this.extractCodeTextPreservingTrailing(block);
            if (!codeText || codeText.trim().length === 0) {
                invalid.push({ nodeId: id, reason: "代码块内容为空" });
                continue;
            }
            const language = this.extractLanguageFromMarkdown(block.markdown ?? "");
            const list = groups.get(source.id);
            if (list) {
                list.push({
                    id,
                    order: source.order,
                    active: source.active === true,
                    title: source.title ?? "",
                    language,
                    code: codeText,
                });
            } else {
                groups.set(source.id, [
                    {
                        id,
                        order: source.order,
                        active: source.active === true,
                        title: source.title ?? "",
                        language,
                        code: codeText,
                    },
                ]);
            }
        }

        const toProcess = Array.from(groups.entries()).map(([group, items]) => ({
            group,
            items: items.sort((a, b) => {
                if (!Number.isFinite(a.order) && !Number.isFinite(b.order)) return 0;
                if (!Number.isFinite(a.order)) return 1;
                if (!Number.isFinite(b.order)) return -1;
                return a.order - b.order;
            }),
        }));

        if (toProcess.length === 0) {
            if (invalid.length > 0) {
                pushMsg(
                    `${t(this.i18n, "msg.invalidBlocks").replace("{0}", invalid.length.toString())}`
                );
            }
            return { success: 0, failure: invalid.length };
        }

        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.codeBlocksToTabs"),
            toProcess,
            async ({ group, items }) => {
                const codeArr: CodeTab[] = items.map((item, index) => ({
                    title: item.title || `Tab${index + 1}`,
                    language: item.language || "plaintext",
                    code: item.code,
                    isActive: item.active,
                }));
                const data = TabData.fromCodeTabs(codeArr);
                const targetId = items[0].id;
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                await updateBlock("markdown", htmlBlock, targetId);
                // 保留原元数据 id（即拆分时的分组 id），刷新版本号
                await TabData.writeFullToBlock(
                    targetId,
                    data,
                    TabData.createMetadata({ id: group })
                );
                // 清理拆分残留的 source 属性
                await setBlockAttrs(targetId, {
                    [CODE_TAB_SOURCE_ATTR]: "",
                });
                const restIds = items.slice(1).map((item) => item.id);
                const deleteResults = await Promise.allSettled(
                    restIds.map((restId) => deleteBlock(restId))
                );
                const failedDeletes = restIds.filter(
                    (_, index) => deleteResults[index]?.status === "rejected"
                );
                if (failedDeletes.length > 0) {
                    logger.warn("合并标签页后删除残留代码块失败", {
                        targetId,
                        failedDeletes,
                    });
                }
            }
        );

        const success = results.filter((r) => r.status === "fulfilled").length;
        const failure = results.length - success + invalid.length;
        if (success > 0) {
            this.onSuccess?.();
            pushMsg(
                `${t(this.i18n, "msg.codeBlocksToTabsCompleted").replace("{0}", success.toString())}`
            );
        }
        if (failure > 0) {
            pushMsg(
                `${t(this.i18n, "msg.codeBlocksToTabsFailed").replace("{0}", failure.toString())}`
            );
        }
        logger.info("拆分代码块 -> 标签页 合并统计", { success, failure });
        return { success, failure };
    }

    /**
     * 从代码块 markdown 首行提取语言标识（如 ```js 中的 js）。
     * @param markdown 代码块 markdown
     * @returns 语言标识，未找到返回空字符串
     */
    private extractLanguageFromMarkdown(markdown: string): string {
        const firstLine = markdown.trim().split("\n")[0] ?? "";
        return firstLine.match(/^`{3,}([^\s`]*)/)?.[1] ?? "";
    }

    /**
     * 从 IAL 提取分组来源信息（拆分产物 source 属性）。
     * @param ial IAL 字符串
     * @returns 分组来源信息，无法识别返回 null
     */
    private extractTabSourceFromIal(ial: string): CodeTabSource | null {
        const sourceRaw = this.extractAttrFromIal(ial, CODE_TAB_SOURCE_ATTR);
        if (!sourceRaw) return null;
        const source = TabData.decodeTabSource(sourceRaw);
        if (source?.id) return source;
        logger.debug("拆分产物 source 属性解析失败", { sourceRaw });
        return null;
    }

    /**
     * 从 SQL 代码块提取代码文本：优先 markdown（围栏结构可精确还原末尾空行），content 兜底。
     * @param block SQL 代码块
     * @returns 代码文本或 null
     */
    private extractCodeTextPreservingTrailing(block: SqlBlock): string | null {
        const markdown = typeof block.markdown === "string" ? block.markdown : "";
        if (markdown.trim().length > 0) {
            const unwrapped = stripCodeFence(markdown);
            if (unwrapped.trim().length > 0) return stripInvisibleChars(unwrapped);
        }
        const content = typeof block.content === "string" ? block.content : "";
        if (content.trim().length > 0) return stripInvisibleChars(content);
        return null;
    }

    /**
     * 全局拆分标签页为代码块。
     * @returns Promise<void>
     */
    async allTabsToCodeBlocks(): Promise<void> {
        logger.info("全局标签页 -> 多个代码块 查询开始");
        const blockList = (await sql(
            `SELECT * FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CODE_TABS_DATA_ATTR}', '${CUSTOM_ATTR}'))`
        )) as SqlBlock[];
        logger.info("全局标签页 -> 多个代码块 查询完成", { count: blockList.length });
        this.tabsToCodeBlocksBatch(blockList);
    }

    /**
     * 查询所有标签页块（旧格式 + 新格式），单次查询后在 JS 中分类。
     * @returns 旧格式块和新格式块
     */
    private async queryAllTabsBlocks(): Promise<{
        legacyBlocks: SqlBlock[];
        dataBlocks: SqlBlock[];
    }> {
        const allBlocks = (await sql(
            `SELECT id, ial FROM blocks WHERE id IN (SELECT block_id FROM attributes AS a WHERE a.name IN ('${CUSTOM_ATTR}', '${CODE_TABS_DATA_ATTR}'))`
        )) as SqlBlock[];

        const legacyBlocks: SqlBlock[] = [];
        const dataBlocks: SqlBlock[] = [];
        for (const block of allBlocks) {
            if (typeof block.ial === "string" && block.ial.includes(CODE_TABS_DATA_ATTR)) {
                dataBlocks.push(block);
            } else {
                legacyBlocks.push(block);
            }
        }
        return { legacyBlocks, dataBlocks };
    }

    /**
     * 统计需要升级的标签页数量（旧格式 + 元数据过期）。
     * @returns 需要升级的标签页数量
     */
    async countUpgradableTabs(): Promise<number> {
        const { legacyBlocks, dataBlocks } = await this.queryAllTabsBlocks();
        logger.debug("可升级标签页统计", { legacyBlocks: legacyBlocks.length, dataBlocks: dataBlocks.length })
        const legacyCount = legacyBlocks.length;

        let outdatedCount = 0;
        for (const block of dataBlocks) {
            const id = block.id ?? "";
            if (!id) continue;

            const metadataRaw = this.extractAttrFromIal(block.ial ?? "", CODE_TABS_METADATA_ATTR);
            const metadata = TabData.decodeMetadata(metadataRaw);
            if (!TabData.isMetadataCurrent(metadata)) {
                outdatedCount++;
            }
        }

        const total = legacyCount + outdatedCount;
        logger.info("可升级标签页统计", { legacyCount, outdatedCount, total });
        return total;
    }

    /**
     * 全局统一升级所有需要升级的标签页（旧格式迁移 + 元数据/HTML 更新）。
     * @returns 转换统计
     */
    async upgradeAllTabs(): Promise<ConversionStats> {
        logger.info("全局标签页升级开始");
        const { legacyBlocks, dataBlocks } = await this.queryAllTabsBlocks();

        const toProcess: Array<{ id: string; data: TabsData }> = [];
        const skipped: { nodeId: string; reason: string }[] = [];
        const invalid: { nodeId: string; reason: string }[] = [];

        // 处理旧格式块
        for (const block of legacyBlocks) {
            const id = block.id ?? "";
            if (!id) {
                invalid.push({ nodeId: "unknown", reason: "缺少 nodeId" });
                continue;
            }
            const legacyRaw = this.extractAttrFromIal(block.ial ?? "", CUSTOM_ATTR);
            if (!legacyRaw) {
                invalid.push({ nodeId: id, reason: "缺少旧版标签数据" });
                continue;
            }
            const legacy = TabData.decodeLegacySourceFromAttrs({ [CUSTOM_ATTR]: legacyRaw });
            if (!legacy) {
                invalid.push({ nodeId: id, reason: "旧版标签数据解码失败" });
                continue;
            }
            const upgraded = TabData.upgradeFromLegacy(legacy);
            if (!upgraded) {
                invalid.push({ nodeId: id, reason: "旧版标签数据解析失败" });
                continue;
            }
            toProcess.push({ id, data: upgraded });
        }

        // 处理新格式但元数据过期的块
        for (const block of dataBlocks) {
            const id = block.id ?? "";
            if (!id) continue;

            const metadataRaw = this.extractAttrFromIal(block.ial ?? "", CODE_TABS_METADATA_ATTR);
            const metadata = TabData.decodeMetadata(metadataRaw);
            if (TabData.isMetadataCurrent(metadata)) {
                skipped.push({ nodeId: id, reason: "元数据已是最新" });
                continue;
            }

            const dataRaw = this.extractAttrFromIal(block.ial ?? "", CODE_TABS_DATA_ATTR);
            if (!dataRaw) {
                invalid.push({ nodeId: id, reason: "缺少标签数据" });
                continue;
            }
            const data = TabData.decode(dataRaw);
            if (!data) {
                invalid.push({ nodeId: id, reason: "标签数据解码失败" });
                continue;
            }
            toProcess.push({ id, data });
        }

        logger.info("全局标签页升级统计", {
            legacyBlocks: legacyBlocks.length,
            dataBlocks: dataBlocks.length,
            toProcess: toProcess.length,
            skipped: skipped.length,
            invalid: invalid.length,
        });

        const messages = {
            completed: t(this.i18n, "msg.upgradeAllCompleted"),
            failed: t(this.i18n, "msg.upgradeAllFailed"),
            invalidBlocks: t(this.i18n, "msg.invalidBlocks"),
            noItems: t(this.i18n, "msg.noTabsToUpgrade"),
            skippedDueToFormat: t(this.i18n, "msg.skippedBlocks"),
        };

        if (toProcess.length === 0) {
            return this.resultCounter(messages, [], [], skipped, invalid);
        }

        const { results } = await this.runBatch(
            t(this.i18n, "task.progress.upgradeAll"),
            toProcess,
            async ({ id, data }) => {
                logger.debug("升级标签页", { id });
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                await updateBlock("markdown", htmlBlock, id);
                await setBlockAttrs(id, {
                    [CODE_TABS_DATA_ATTR]: TabData.encode(data),
                    [CODE_TABS_METADATA_ATTR]: TabData.encodeMetadata(TabData.createMetadata()),
                    [CUSTOM_ATTR]: "",
                });
            },
            { forceProgress: true }
        );

        return this.resultCounter(
            messages,
            toProcess.map((item) => ({ id: item.id })),
            results,
            skipped,
            invalid
        );
    }

    private async replaceWithCodeBlocks(
        id: string,
        tabs: Array<{ title: string; lang: string; code: string }>,
        metadataId: string,
        activeIndex: number
    ): Promise<void> {
        let previousId = id;
        for (let index = 0; index < tabs.length; index++) {
            const tab = tabs[index];
            const markdown = this.buildCodeBlock(tab.code, tab.lang);
            const result = await insertBlock("markdown", markdown, "", previousId, "");
            const newId = result[0].doOperations[0].id;
            // 记录来源标签页元数据 id、组内顺序与激活状态，供“一键合并回标签页”还原
            const source: CodeTabSource = {
                id: metadataId,
                order: index,
                active: index === activeIndex,
            };
            if (this.shouldPersistTitle(tab.title)) {
                source.title = tab.title;
            }
            await setBlockAttrs(newId, { [CODE_TAB_SOURCE_ATTR]: TabData.encodeTabSource(source) });
            previousId = newId;
        }
        await deleteBlock(id);
        logger.info("标签页已拆分为代码块", { id, count: tabs.length, metadataId, activeIndex });
    }

    private shouldPersistTitle(title: string): boolean {
        const trimmed = title.trim();
        if (!trimmed) return false;
        return !/^tab\d+$/i.test(trimmed);
    }

    private buildCodeBlock(code: string, language: string): string {
        // 保留代码内容原样（含末尾空行，属用户数据）
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

type GroupedCodeBlock = {
    id: string;
    order: number;
    active: boolean;
    title: string;
    language: string;
    code: string;
};

type TabBlock = HTMLElement | SqlBlock;
