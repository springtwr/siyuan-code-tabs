import { describe, expect, it, vi } from "vitest";
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
        // normalize 处理中间空行，markTrailingBlankLine 补充紧贴闭合标签的末尾空行
        expect(html).toContain("a\n&#8203;\n&#8203;&lt;/div&gt;");
    });

    it("createProtyleHtml 保留单个末尾空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a\n" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        expect(html).toContain("a\n&#8203;&lt;/div&gt;");
    });

    it("createProtyleHtml 保留模板换行缩进且无结构空行", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "const a = 1;" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 节点间换行/缩进需保留（思源优化排版据此识别 HTML 块）
        expect(html).toContain("\n&lt;div class=&quot;tabs-container&quot;&gt;");
        expect(html).toContain("\n    &lt;div class=&quot;tabs-outer&quot;&gt;");
        expect(html).toContain("\n        &lt;div class=&quot;tabs&quot;&gt;");
        // 结构区不应存在空行（连续换行）
        const noBlank = html.split("\n").every((line) => line.trim() !== "");
        expect(noBlank).toBe(true);
    });

    it("createProtyleHtml 代码中的特殊字符转义（锁定既有行为基线）", async () => {
        const data: TabsData = {
            active: 0,
            tabs: [{ title: "A", lang: "plaintext", code: "a < b && c" }],
        };
        const html = await TabRenderer.createProtyleHtml(data);
        // 锁定当前多层转义行为（encodeTextNodes + innerHTML 序列化 + escapeHtml）；
        // 若思源渲染侧对此显示异常，需另行调整转义链路
        expect(html).toContain("a &amp;amp;lt; b &amp;amp;amp;&amp;amp;amp; c");
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
