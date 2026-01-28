import type { TabsData } from "@/modules/tabs/types";
import { protyleHtmlStr } from "@/constants";
import { encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { deleteBlock, insertBlock } from "@/api";
import { getActiveEditor } from "siyuan";


export async function ensureLibraryLoaded(markdown: string): Promise<void> {
    const editor = getActiveEditor(true);
    const previousId = (editor?.protyle.wysiwyg.element.lastChild as HTMLElement)?.dataset.nodeId;
    const result = await insertBlock("markdown", markdown, "", previousId, "");
    const tempId = result[0].doOperations[0].id;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await deleteBlock(tempId);
}

export class TabRenderer {
    static async createProtyleHtml(data: TabsData): Promise<string> {
        logger.debug("开始生成 Tabs HTML 块", { count: data.tabs.length });
        const containerDiv = document.createElement("div");
        containerDiv.innerHTML = protyleHtmlStr;
        const tabContainer = containerDiv.querySelector(".tabs-container") as HTMLElement;

        const tabsOuter = containerDiv.querySelector(".tabs-outer") as HTMLElement;
        const tabs = containerDiv.querySelector(".tabs") as HTMLElement;


        const tabContents = containerDiv.querySelector(".tab-contents") as HTMLElement;
        const activeIndex = Math.min(
            Math.max(data.active ?? 0, 0),
            Math.max(data.tabs.length - 1, 0)
        );

        const lute = window.Lute.New();

        for (let i = 0; i < data.tabs.length; i++) {
            const title = data.tabs[i].title;
            const language = data.tabs[i].lang;
            const code = data.tabs[i].code;

            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.dataset.tabId = String(i);
            tab.textContent = title;
            tab.title = title;
            tab.setAttribute("onclick", "pluginCodeTabs.openTag(event)");
            tabs.appendChild(tab);

            const content = document.createElement("div");
            content.className = "tab-content hljs";
            content.dataset.tabId = String(i);
            content.dataset.render = "true";
            content.dataset.lang = language;
            let hlText = code;
            if (language === "markdown-render") {
                content.dataset.raw = encodeSource(code);
                const rawHtml = lute.MarkdownStr("markdown", code);
                const mdDiv = document.createElement("div");
                mdDiv.innerHTML = rawHtml;
                hlText = await this.renderMarkdown(mdDiv);
                hlText = `<div class="markdown-body">${hlText}</div>`;
            } else {
                hlText = window.hljs.highlight(code, {
                    language: language,
                    ignoreIllegals: true,
                }).value;
                hlText = `<div class="code language-${language}" style="white-space: pre-wrap;">${hlText}</div>`;
            }
            content.innerHTML = hlText;
            if (i === activeIndex) {
                content.classList.add("tab-content--active");
            }
            if (language === "markdown-render") {
                const codeBlocks = content.querySelectorAll<HTMLElement>("code");
                codeBlocks.forEach((block) => this.encodeTextNodes(block));
            } else {
                const codeBlock = content.querySelector<HTMLElement>(".code");
                if (codeBlock) this.encodeTextNodes(codeBlock);
            }
            tabContents.appendChild(content);

            if (i === activeIndex) {
                tab.classList.add("tab-item--active");
            }
        }
        logger.debug("Tabs 内容生成完成", { activeIndex, count: data.tabs.length });

        tabsOuter.appendChild(tabs);

        tabContainer.appendChild(tabsOuter);
        tabContainer.appendChild(tabContents);
        const escaped = this.normalizeHtmlBlockContent(this.escapeHtml(containerDiv.innerHTML));
        logger.debug("Tabs HTML 块生成完成");
        return `<div>${escaped}</div>`;
    }

    private static async renderMarkdown(container: HTMLElement): Promise<string> {
        // 处理数学公式
        const mathBlocks = container.querySelectorAll<HTMLElement>('.language-math');
        if (mathBlocks.length > 0) {
            await this.renderMath(mathBlocks);
        }

        // 处理 Mermaid
        const mermaidBlocks = container.querySelectorAll<HTMLElement>('.language-mermaid');
        if (mermaidBlocks.length > 0) {
            await this.renderMermaid(mermaidBlocks);
        }

        // 处理代码高亮
        const codeBlocks = container.querySelectorAll<HTMLElement>("pre code");
        await this.renderCode(codeBlocks);

        return container.innerHTML;
    }

    private static async renderMath(mathBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.katex) {
            // 插入公式块，让思源加载 window.katex
            const markdown = '$$\n\n$$';
            await ensureLibraryLoaded(markdown);
        }
        mathBlocks.forEach(el => {
            const code = el.textContent || "";
            try {
                window.katex.render(window.Lute.UnEscapeHTMLStr(code), el, {
                    displayMode: el.classList.contains("language-math"),
                    throwOnError: false,
                    macros: {}
                });
            } catch (e) {
                logger.warn("KaTeX 渲染失败", e);
            }
        });
    }

    private static async renderMermaid(mermaidBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.mermaid) {
            // 插入 mermaid 块，让思源加载 window.mermaid
            const markdown = '```mermaid\n\n```';
            await ensureLibraryLoaded(markdown);
        }
        const renderPromises = Array.from(mermaidBlocks).map(async (el) => {
            const code = el.textContent || "";
            if (!code.trim()) return;

            try {
                const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
                const renderResult = await window.mermaid.render(id, window.Lute.UnEscapeHTMLStr(code));
                el.innerHTML = renderResult.svg;
                // results.push(renderResult.svg);
            } catch (e) {
                logger.warn("Mermaid 渲染失败", e);
                // results.push(code);
            }
        });
        await Promise.all(renderPromises);
    }

    private static async renderCode(codeBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.hljs) {
            // 插入代码块，让思源加载 window.hljs
            const markdown = '```typescript\n\n```';
            await ensureLibraryLoaded(markdown);
        }
        codeBlocks.forEach(el => {
            try {
                const code = el.innerText;
                const language = el.className.replace("language-", "");
                const result = window.hljs.highlight(code, {
                    language: language,
                    ignoreIllegals: true,
                });
                el.innerHTML = result.value;
            } catch (e) {
                logger.warn("hljs 渲染失败", e);
            }
        });
    }

    private static normalizeHtmlBlockContent(input: string): string {
        return input
            .split(/\r?\n/)
            .map((line) => (line.trim().length === 0 ? `${line}&#8203;` : line))
            .join("\n");
    }

    private static encodeTextNodes(root: HTMLElement): void {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode() as Text | null;
        while (current) {
            if (current.data) {
                current.data = current.data
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
            }
            current = walker.nextNode() as Text | null;
        }
    }

    private static escapeHtml(input: string): string {
        return input
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
}
