import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IObject } from "siyuan";
import { TransformCore } from "@/core/TransformCore";
import {
    CODE_TAB_SOURCE_ATTR,
    CODE_TABS_DATA_ATTR,
    CODE_TABS_METADATA_ATTR,
} from "@/constants";
import { TabRenderer } from "@/core/TabRenderer";
import * as api from "@/api";
import { TabData } from "@/core/TabData";

const { getActiveEditor } = vi.hoisted(() => ({
    getActiveEditor: vi.fn<() => unknown>(() => null),
}));

vi.mock("siyuan", () => ({
    getActiveEditor,
    IObject: {},
}));

vi.mock("@/api", () => ({
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    getBlockAttrs: vi.fn().mockResolvedValue(undefined),
    insertBlock: vi.fn().mockResolvedValue([{ doOperations: [{ id: "new-id" }] }]),
    pushMsg: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    updateBlock: vi.fn().mockResolvedValue(undefined),
    sql: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/core/TabRenderer", () => ({
    TabRenderer: {
        createProtyleHtml: vi.fn(() => "<div>mock</div>"),
    },
}));

const i18n = {} as IObject;

describe("TransformCore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("upgradeAllTabs: 无标签页时给出提示", async () => {
        vi.mocked(api.sql).mockResolvedValue([]);

        const converter = new TransformCore(i18n);
        const stats = await converter.upgradeAllTabs();

        expect(stats.success).toBe(0);
        expect(api.pushMsg).toHaveBeenCalledWith("msg.noTabsToUpgrade");
    });

    it("tabsToCodeBlocksBatch: 大标签页（标签数超阈值）显示进度窗口", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-big";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabData.createDefaultData();
        data.tabs = Array.from({ length: 25 }, (_, i) => ({
            title: `Tab${i + 1}`,
            lang: "plaintext",
            code: `code${i}`,
        }));
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabData.encode(data),
        });
        const appendSpy = vi.spyOn(document.body, "appendChild");

        const converter = new TransformCore(i18n);
        await converter.tabsToCodeBlocksBatch([block]);

        // 25 个标签 >= 阈值 20，应按标签总数触发进度窗口创建
        const created = appendSpy.mock.calls.some(
            ([el]) => el instanceof HTMLElement && el.classList.contains("code-tabs__task")
        );
        expect(created).toBe(true);
        appendSpy.mockRestore();
    });

    it("tabsToCodeBlocksBatch: 小标签页不显示进度窗口", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-small";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabData.createDefaultData();
        data.tabs = Array.from({ length: 5 }, (_, i) => ({
            title: `Tab${i + 1}`,
            lang: "plaintext",
            code: `code${i}`,
        }));
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabData.encode(data),
        });
        const appendSpy = vi.spyOn(document.body, "appendChild");

        const converter = new TransformCore(i18n);
        await converter.tabsToCodeBlocksBatch([block]);

        // 5 个标签低于阈值，不应创建进度窗口
        const created = appendSpy.mock.calls.some(
            ([el]) => el instanceof HTMLElement && el.classList.contains("code-tabs__task")
        );
        expect(created).toBe(false);
        appendSpy.mockRestore();
    });

    it("codeToTabsBatch: 应转换符合语法的代码块", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-1";
        block.dataset.type = "NodeCodeBlock";
        const content = document.createElement("div");
        content.setAttribute("contenteditable", "true");
        content.textContent = "::: JS | js\nconsole.log('ok')\n";
        block.appendChild(content);

        const converter = new TransformCore(i18n);
        const stats = await converter.codeToTabsBatch([block]);

        expect(stats.success).toBe(1);
        expect(stats.failure).toBe(0);
        expect(TabRenderer.createProtyleHtml).toHaveBeenCalled();
        expect(api.updateBlock).toHaveBeenCalledWith("markdown", "<div>mock</div>", "block-1");
        expect(api.setBlockAttrs).toHaveBeenCalledWith(
            "block-1",
            expect.objectContaining({ [CODE_TABS_DATA_ATTR]: expect.any(String) })
        );
        expect(api.deleteBlock).not.toHaveBeenCalledWith("block-1");
    });

    it("tabsToCodeBlocksBatch: 应拆分为多个代码块并写入分组来源属性", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-2";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabData.createDefaultData();
        data.tabs = [
            { title: "Custom1", lang: "js", code: "console.log('a')" },
            { title: "Custom2", lang: "python", code: "print('b')" },
        ];
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabData.encode(data),
        });

        const converter = new TransformCore(i18n);
        const stats = await converter.tabsToCodeBlocksBatch([block]);

        expect(stats.success).toBe(1);
        expect(api.insertBlock).toHaveBeenCalledTimes(2);
        expect(api.deleteBlock).toHaveBeenCalledWith("tab-2");
        // 每个拆分出的代码块都应写入统一的 source 属性（含分组 id、组内顺序与激活状态）
        const sourceCalls = vi
            .mocked(api.setBlockAttrs)
            .mock.calls.filter(([id]) => id === "new-id");
        expect(sourceCalls).toHaveLength(2);
        const source0 = TabData.decodeTabSource(sourceCalls[0][1]?.[CODE_TAB_SOURCE_ATTR] ?? "");
        const source1 = TabData.decodeTabSource(sourceCalls[1][1]?.[CODE_TAB_SOURCE_ATTR] ?? "");
        expect(source0?.id).toBeTruthy();
        expect(source0?.order).toBe(0);
        expect(source0?.title).toBe("Custom1");
        expect(source0?.active).toBe(true);
        expect(source1?.order).toBe(1);
        expect(source1?.title).toBe("Custom2");
        expect(source1?.active).toBe(false);
    });

    it("tabsToCodeBlocksBatch: 拆分时应保留原元数据 id 作为分组 id", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-3";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabData.createDefaultData();
        data.tabs = [{ title: "Custom1", lang: "js", code: "console.log('a')" }];
        const metadata = TabData.createMetadata();
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabData.encode(data),
            [CODE_TABS_METADATA_ATTR]: TabData.encodeMetadata(metadata),
        });

        const converter = new TransformCore(i18n);
        await converter.tabsToCodeBlocksBatch([block]);

        const sourceCall = vi
            .mocked(api.setBlockAttrs)
            .mock.calls.find(([id]) => id === "new-id");
        const source = TabData.decodeTabSource(sourceCall?.[1]?.[CODE_TAB_SOURCE_ATTR] ?? "");
        expect(source?.id).toBe(metadata.id);
    });

    it("codeBlocksToTabsInDocument: 应按分组合并为标签页并保留元数据 id", async () => {
        getActiveEditor.mockReturnValue({
            protyle: { block: { rootID: "doc-1" } },
        });
        const source0 = TabData.encodeTabSource({ id: "group-1", order: 0, title: "JS" });
        const source1 = TabData.encodeTabSource({ id: "group-1", order: 1, active: true });
        vi.mocked(api.sql).mockResolvedValue([
            {
                id: "code-1",
                ial: `${CODE_TAB_SOURCE_ATTR}="${source0}"`,
                content: "console.log('a')",
                markdown: "```js\nconsole.log('a')\n```",
            },
            {
                id: "code-2",
                ial: `${CODE_TAB_SOURCE_ATTR}="${source1}"`,
                content: "print('b')",
                markdown: "```python\nprint('b')\n```",
            },
        ]);

        const onSuccess = vi.fn();
        const converter = new TransformCore(i18n, onSuccess);
        const stats = await converter.codeBlocksToTabsInDocument();

        expect(stats.success).toBe(1);
        expect(stats.failure).toBe(0);
        expect(api.updateBlock).toHaveBeenCalledWith("markdown", expect.any(String), "code-1");
        expect(api.deleteBlock).toHaveBeenCalledWith("code-2");
        expect(api.deleteBlock).not.toHaveBeenCalledWith("code-1");
        // 合并成功后应触发文档刷新，使 HTML 块立即重新渲染
        expect(onSuccess).toHaveBeenCalledTimes(1);

        // 合并后的标签页应保留原元数据 id（即拆分时的分组 id）
        const writeCall = vi.mocked(api.setBlockAttrs).mock.calls.find(([id]) => id === "code-1");
        const metadataRaw = writeCall?.[1]?.[CODE_TABS_METADATA_ATTR] ?? "";
        expect(TabData.decodeMetadata(metadataRaw)?.id).toBe("group-1");

        // 数据内容：标题/语言/代码按顺序还原
        const dataRaw = writeCall?.[1]?.[CODE_TABS_DATA_ATTR] ?? "";
        const decoded = TabData.decode(dataRaw);
        expect(decoded?.tabs[0]).toEqual({
            title: "JS",
            lang: "js",
            code: "console.log('a')",
        });
        expect(decoded?.tabs[1]).toEqual({
            title: "Tab2",
            lang: "python",
            code: "print('b')",
        });
        // 激活状态应还原为拆分时的默认标签（第二个标签）
        expect(decoded?.active).toBe(1);

        // 应清理拆分残留的 source 属性
        expect(api.setBlockAttrs).toHaveBeenCalledWith(
            "code-1",
            expect.objectContaining({ [CODE_TAB_SOURCE_ATTR]: "" })
        );
    });

    it("codeBlocksToTabsInDocument: 合并时保留代码末尾空行（优先 markdown 提取）", async () => {
        getActiveEditor.mockReturnValue({
            protyle: { block: { rootID: "doc-1" } },
        });
        const source0 = TabData.encodeTabSource({ id: "group-9", order: 0 });
        const source1 = TabData.encodeTabSource({ id: "group-9", order: 1 });
        vi.mocked(api.sql).mockResolvedValue([
            {
                id: "code-1",
                ial: `${CODE_TAB_SOURCE_ATTR}="${source0}"`,
                // content 无末尾空行，markdown 含末尾空行：应优先 markdown 还原
                content: "a",
                markdown: "```js\na\n\n\n```",
            },
            {
                id: "code-2",
                ial: `${CODE_TAB_SOURCE_ATTR}="${source1}"`,
                content: "b",
                markdown: "```python\nb\n```",
            },
        ]);

        const converter = new TransformCore(i18n);
        await converter.codeBlocksToTabsInDocument();

        const writeCall = vi.mocked(api.setBlockAttrs).mock.calls.find(([id]) => id === "code-1");
        const dataRaw = writeCall?.[1]?.[CODE_TABS_DATA_ATTR] ?? "";
        const decoded = TabData.decode(dataRaw);
        expect(decoded?.tabs[0].code).toBe("a\n\n");
    });

    it("codeBlocksToTabsInDocument: 组内代码块数超阈值时显示进度窗口", async () => {
        getActiveEditor.mockReturnValue({
            protyle: { block: { rootID: "doc-1" } },
        });
        // 单个组含 25 个代码块（>= 阈值 20），应按代码块总数触发进度窗口
        const blocks = Array.from({ length: 25 }, (_, i) => ({
            id: `code-${i}`,
            ial: `${CODE_TAB_SOURCE_ATTR}="${TabData.encodeTabSource({ id: "big", order: i })}"`,
            content: `c${i}`,
            markdown: "```js\nc" + i + "\n```",
        }));
        vi.mocked(api.sql).mockResolvedValue(blocks);
        const appendSpy = vi.spyOn(document.body, "appendChild");

        const converter = new TransformCore(i18n);
        await converter.codeBlocksToTabsInDocument();

        const created = appendSpy.mock.calls.some(
            ([el]) => el instanceof HTMLElement && el.classList.contains("code-tabs__task")
        );
        expect(created).toBe(true);
        appendSpy.mockRestore();
    });

    it("codeBlocksToTabsInDocument: 无拆分代码块时提示且不执行", async () => {
        getActiveEditor.mockReturnValue({
            protyle: { block: { rootID: "doc-1" } },
        });
        vi.mocked(api.sql).mockResolvedValue([]);

        const onSuccess = vi.fn();
        const converter = new TransformCore(i18n, onSuccess);
        const stats = await converter.codeBlocksToTabsInDocument();

        expect(stats.success).toBe(0);
        expect(api.pushMsg).toHaveBeenCalledWith("msg.noSplitCodeBlocksToMerge");
        expect(api.updateBlock).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("tabsToCodeBlocksBatch: 拆分时保留代码末尾空行", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-4";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabData.createDefaultData();
        data.tabs = [{ title: "Custom1", lang: "js", code: "console.log('a')\n\n" }];
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabData.encode(data),
        });

        const converter = new TransformCore(i18n);
        await converter.tabsToCodeBlocksBatch([block]);

        // 代码末尾空行是用户数据，拆分生成的代码块应原样保留
        expect(api.insertBlock).toHaveBeenCalledWith(
            "markdown",
            "```js\nconsole.log('a')\n\n\n```",
            "",
            "tab-4",
            ""
        );
    });

    it("mergeCodeBlocksToTabSyntax: 合并时仅去除 DOM 换行伪影，保留末尾空行", async () => {
        const makeBlock = (id: string, language: string, code: string) => {
            const block = document.createElement("div");
            block.dataset.nodeId = id;
            block.dataset.type = "NodeCodeBlock";
            const lang = document.createElement("div");
            lang.className = "protyle-action__language";
            lang.textContent = language;
            const content = document.createElement("div");
            content.setAttribute("contenteditable", "true");
            // 模拟思源代码块 DOM：textContent 末尾带一个换行伪影
            content.textContent = code;
            block.appendChild(lang);
            block.appendChild(content);
            return block;
        };

        // 真实代码末尾 2 个空行 + DOM 伪影 1 个换行
        const blockA = makeBlock("a", "js", "console.log('a')\n\n\n");
        const blockB = makeBlock("b", "python", "print('b')\n\n\n");

        const converter = new TransformCore(i18n);
        await converter.mergeCodeBlocksToTabSyntax([blockA, blockB]);

        const writeCall = vi.mocked(api.setBlockAttrs).mock.calls.find(([id]) => id === "a");
        const dataRaw = writeCall?.[1]?.[CODE_TABS_DATA_ATTR] ?? "";
        const decoded = TabData.decode(dataRaw);
        // 应仅去掉伪影换行，保留用户真实的 2 个末尾空行
        expect(decoded?.tabs[0].code).toBe("console.log('a')\n\n");
        expect(decoded?.tabs[1].code).toBe("print('b')\n\n");
    });

    it("mergeCodeBlocksToTabSyntax: 合并时还原拆分记录的 active", async () => {
        const makeBlock = (
            id: string,
            language: string,
            code: string,
            source?: { id: string; order: number; active?: boolean; title?: string }
        ) => {
            const block = document.createElement("div");
            block.dataset.nodeId = id;
            block.dataset.type = "NodeCodeBlock";
            const lang = document.createElement("div");
            lang.className = "protyle-action__language";
            lang.textContent = language;
            const content = document.createElement("div");
            content.setAttribute("contenteditable", "true");
            content.textContent = code;
            block.appendChild(lang);
            block.appendChild(content);
            if (source) {
                block.setAttribute(CODE_TAB_SOURCE_ATTR, TabData.encodeTabSource(source));
            }
            return block;
        };

        const blockA = makeBlock("a", "js", "console.log('a')", {
            id: "g1",
            order: 0,
        });
        const blockB = makeBlock("b", "python", "print('b')", {
            id: "g1",
            order: 1,
            active: true,
        });

        const converter = new TransformCore(i18n);
        await converter.mergeCodeBlocksToTabSyntax([blockA, blockB]);

        const writeCall = vi.mocked(api.setBlockAttrs).mock.calls.find(([id]) => id === "a");
        const dataRaw = writeCall?.[1]?.[CODE_TABS_DATA_ATTR] ?? "";
        const decoded = TabData.decode(dataRaw);
        // 第二个标签拆分时是默认标签，合并后应还原
        expect(decoded?.active).toBe(1);
    });

    it("mergeCodeBlocksToTabSyntax: 应合并为标签页并删除多余块", async () => {
        const makeBlock = (id: string, language: string, code: string) => {
            const block = document.createElement("div");
            block.dataset.nodeId = id;
            block.dataset.type = "NodeCodeBlock";
            const lang = document.createElement("div");
            lang.className = "protyle-action__language";
            lang.textContent = language;
            const content = document.createElement("div");
            content.setAttribute("contenteditable", "true");
            content.textContent = code;
            block.appendChild(lang);
            block.appendChild(content);
            return block;
        };

        const blockA = makeBlock("a", "js", "console.log('a')");
        const blockB = makeBlock("b", "python", "print('b')");

        const converter = new TransformCore(i18n);
        await converter.mergeCodeBlocksToTabSyntax([blockA, blockB]);

        expect(api.updateBlock).toHaveBeenCalledWith("markdown", expect.any(String), "a");
        expect(api.deleteBlock).toHaveBeenCalledWith("b");
    });
});
