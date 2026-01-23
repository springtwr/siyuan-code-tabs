import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IObject } from "siyuan";
import { TabConverter } from "@/modules/tabs/TabConverter";
import { CUSTOM_ATTR, TAB_SEPARATOR } from "@/constants";
import { encodeSource } from "@/utils/encoding";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import * as api from "@/api";

vi.mock("@/api", () => ({
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    insertBlock: vi.fn().mockResolvedValue([{ doOperations: [{ id: "new-id" }] }]),
    pushMsg: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    updateBlock: vi.fn().mockResolvedValue(undefined),
    sql: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/tabs/TabRenderer", () => ({
    TabRenderer: {
        createHtmlBlock: vi.fn(() => "<div>mock</div>"),
    },
}));

const i18n = {} as IObject;

describe("TabConverter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("codeToTabsBatch: 应转换符合语法的代码块", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "block-1";
        block.dataset.type = "NodeCodeBlock";
        const content = document.createElement("div");
        content.setAttribute("contenteditable", "true");
        content.textContent = "::: JS | js\nconsole.log('ok')\n";
        block.appendChild(content);

        const converter = new TabConverter(i18n);
        const stats = await converter.codeToTabsBatch([block]);

        expect(stats.success).toBe(1);
        expect(stats.failure).toBe(0);
        expect(TabRenderer.createHtmlBlock).toHaveBeenCalled();
        expect(api.insertBlock).toHaveBeenCalled();
        expect(api.setBlockAttrs).toHaveBeenCalledWith(
            "new-id",
            expect.objectContaining({ [CUSTOM_ATTR]: expect.any(String) })
        );
        expect(api.deleteBlock).toHaveBeenCalledWith("block-1");
    });

    it("tabToCodeBatch: 应将标签页还原为 tab 语法代码块", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-1";
        block.dataset.type = "NodeHTMLBlock";
        const codeText = "::: JS | js\nconsole.log('ok')\n";
        block.setAttribute(CUSTOM_ATTR, encodeSource(codeText));

        const converter = new TabConverter(i18n);
        const stats = await converter.tabToCodeBatch([block]);

        expect(stats.success).toBe(1);
        expect(stats.failure).toBe(0);
        expect(api.updateBlock).toHaveBeenCalledWith(
            "markdown",
            expect.stringContaining(`${TAB_SEPARATOR}tab\n`),
            "tab-1"
        );
    });

    it("tabsToPlainCodeBlocksBatch: 应拆分为多个标准代码块", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-2";
        block.dataset.type = "NodeHTMLBlock";
        const codeText = `::: JS | js\nconsole.log('a')\n\n::: PY | python\nprint('b')\n`;
        block.setAttribute(CUSTOM_ATTR, encodeSource(codeText));

        const converter = new TabConverter(i18n);
        const stats = await converter.tabsToPlainCodeBlocksBatch([block]);

        expect(stats.success).toBe(1);
        expect(api.insertBlock).toHaveBeenCalledTimes(2);
        expect(api.deleteBlock).toHaveBeenCalledWith("tab-2");
    });

    it("mergeCodeBlocksToTabSyntax: 应合并并删除多余块", async () => {
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

        const converter = new TabConverter(i18n);
        await converter.mergeCodeBlocksToTabSyntax([blockA, blockB]);

        expect(api.updateBlock).toHaveBeenCalledWith(
            "markdown",
            expect.stringContaining(`${TAB_SEPARATOR}tab`),
            "a"
        );
        expect(api.deleteBlock).toHaveBeenCalledWith("b");
    });
});
