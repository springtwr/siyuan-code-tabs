import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IObject } from "siyuan";
import { TabTransformManager } from "@/modules/tabs/TabTransformManager";
import { CODE_TABS_DATA_ATTR } from "@/constants";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import * as api from "@/api";
import { TabDataService } from "@/modules/tabs/TabDataService";

vi.mock("@/api", () => ({
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    getBlockAttrs: vi.fn().mockResolvedValue(undefined),
    insertBlock: vi.fn().mockResolvedValue([{ doOperations: [{ id: "new-id" }] }]),
    pushMsg: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    updateBlock: vi.fn().mockResolvedValue(undefined),
    sql: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/tabs/TabRenderer", () => ({
    TabRenderer: {
        createProtyleHtml: vi.fn(() => "<div>mock</div>"),
    },
}));

const i18n = {} as IObject;

describe("TabTransformManager", () => {
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

        const converter = new TabTransformManager(i18n);
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

    it("tabsToCodeBlocksBatch: 应拆分为多个代码块", async () => {
        const block = document.createElement("div");
        block.dataset.nodeId = "tab-2";
        block.dataset.type = "NodeHTMLBlock";
        const data = TabDataService.createDefaultData();
        data.tabs = [
            { title: "Custom1", lang: "js", code: "console.log('a')" },
            { title: "Custom2", lang: "python", code: "print('b')" },
        ];
        vi.spyOn(api, "getBlockAttrs").mockResolvedValue({
            [CODE_TABS_DATA_ATTR]: TabDataService.encode(data),
        });

        const converter = new TabTransformManager(i18n);
        const stats = await converter.tabsToCodeBlocksBatch([block]);

        expect(stats.success).toBe(1);
        expect(api.insertBlock).toHaveBeenCalledTimes(2);
        expect(api.deleteBlock).toHaveBeenCalledWith("tab-2");
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

        const converter = new TabTransformManager(i18n);
        await converter.mergeCodeBlocksToTabSyntax([blockA, blockB]);

        expect(api.updateBlock).toHaveBeenCalledWith("markdown", expect.any(String), "a");
        expect(api.deleteBlock).toHaveBeenCalledWith("b");
    });
});
