import { describe, expect, it } from "vitest";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import type { TabsData } from "@/modules/tabs/types";

describe("TabRenderer", () => {
    it("createProtyleHtml 生成基础结构", () => {
        const data: TabsData = {
            version: 2,
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "const a = 1;" }],
        };
        const html = TabRenderer.createProtyleHtml(data);
        expect(html).toContain("tabs-container");
        expect(html).toContain("tab-item--active");
        expect(html).toContain("tab-content--active");
    });

    it("createProtyleHtml 支持 markdown-render", () => {
        const data: TabsData = {
            version: 2,
            active: 0,
            tabs: [{ title: "MD", lang: "markdown-render", code: "## Title" }],
        };
        const html = TabRenderer.createProtyleHtml(data);
        expect(html).toContain("markdown-body");
    });
});
