import { describe, expect, it, vi } from "vitest";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import type { TabsData } from "@/modules/tabs/types";

// Mock window.Lute
window.Lute = {
    New: () => ({
        MarkdownStr: (_name: string, code: string) =>
            `<div data-type="NodeParagraph">${code}</div>`,
    }),
    UnEscapeHTMLStr: (input: string) => input,
    EscapeHTMLStr: (input: string) => input,
    EChartsMindmapStr: (input: string) => input,
};

describe("TabRenderer", () => {
    it("createProtyleHtml 生成基础结构", async () => {
        const data: TabsData = {
            version: 2,
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "const a = 1;" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        expect(html).toContain("tabs-container");
        expect(html).toContain("tab-item--active");
        expect(html).toContain("tab-content--active");
    });

    it("createProtyleHtml 支持 markdown-render", async () => {
        const data: TabsData = {
            version: 2,
            active: 0,
            tabs: [{ title: "MD", lang: "markdown-render", code: "## Title" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        expect(html).toContain("markdown-body");
    });

    it("renderCode 解析 language-* class", async () => {
        const original = window.hljs;
        const highlight = vi.fn(() => ({ value: "ok" }));
        window.hljs = {
            ...original,
            highlight,
            getLanguage: vi.fn(() => "js"),
        } as unknown as typeof original;

        const originalLute = window.Lute;
        window.Lute = {
            New: () => ({
                MarkdownStr: () => `<pre><code class="language-js hljs">const a = 1;</code></pre>`,
            }),
            UnEscapeHTMLStr: (input: string) => input,
            EscapeHTMLStr: (input: string) => input,
            EChartsMindmapStr: (input: string) => input,
        };

        const data: TabsData = {
            version: 2,
            active: 0,
            tabs: [{ title: "MD", lang: "markdown-render", code: "```js\\nconst a=1\\n```" }],
        };
        await TabRenderer.createProtyleHtml(data);
        expect(highlight).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ language: "js" })
        );

        window.Lute = originalLute;
        window.hljs = original;
    });
});
