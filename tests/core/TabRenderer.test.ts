import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabRenderer } from "@/core/TabRenderer";
import type { TabsData } from "@/types/tabs";

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
    beforeEach(() => {
        TabRenderer.setEscapeHtmlEnabled(false);
    });

    it("createProtyleHtml 生成基础结构", async () => {
        const data: TabsData = {
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
            active: 0,
            tabs: [{ title: "MD", lang: "markdown-render", code: "## Title" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        expect(html).toContain("markdown-body");
    });

    it("createProtyleHtml 提前去除代码中的零宽字符", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a\u200b\n\nb" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 代码自带的零宽字符应在渲染前被 strip，避免与占位标记混淆
        expect(html).not.toContain("a\u200b");
        // 中间空行仍正常占位
        expect(html).toContain("a\n&#8203;\nb");
    });

    it("createProtyleHtml 保留代码中的空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a\n\n\nb" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 两个连续空行应各自保留（normalizeHtmlBlockContent 以 &#8203; 实体标记空行）
        expect(html).toContain("a\n&#8203;\n&#8203;\nb");
    });

    it("createProtyleHtml 保留代码末尾空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a\n\n" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 默认（关闭 escapeHtml）状态下，结构标签保持原样，仅空行以 &#8203; 实体标记
        expect(html).toContain("a\n&#8203;\n&#8203;</div>");
    });

    it("createProtyleHtml 保留单个末尾空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a\n" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        expect(html).toContain("a\n&#8203;</div>");
    });

    it("createProtyleHtml 保留模板换行缩进且无结构空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "const a = 1;" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 节点间换行/缩进需保留（思源优化排版据此识别 HTML 块）；
        // 默认（关闭 escapeHtml）状态下结构标签保持原样
        expect(html).toContain("\n<div class=\"tabs-container\">");
        expect(html).toContain("\n    <div class=\"tabs-outer\">");
        expect(html).toContain("\n        <div class=\"tabs\">");
        // 结构区不应存在空行（连续换行）
        const noBlank = html.split("\n").every((line) => line.trim() !== "");
        expect(noBlank).toBe(true);
    });

    it("createProtyleHtml 默认不转义特殊字符（锁定默认行为）", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a < b && c" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 默认（关闭 escapeHtml）仅保留 encodeTextNodes + innerHTML 序列化后的实体
        expect(html).toContain("a &amp;lt; b &amp;amp;&amp;amp; c");
    });

    it("createProtyleHtml 启用 escapeHtml 时整块转义（回归）", async () => {
        TabRenderer.setEscapeHtmlEnabled(true);
        try {
            const data: TabsData = {
                active: 0,
                tabs: [{ title: "A", lang: "plaintext", code: "a < b && c" }],
            };
            const html = await TabRenderer.createProtyleHtml(data);
            // 开启后对整块 HTML 做字符转义，结构标签与特殊字符均被二次转义
            expect(html).toContain("a &amp;amp;lt; b &amp;amp;amp;&amp;amp;amp; c");
            expect(html).toContain("&lt;div class=&quot;tabs-container&quot;&gt;");
        } finally {
            TabRenderer.setEscapeHtmlEnabled(false);
        }
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
