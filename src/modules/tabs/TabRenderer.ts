import type { FencedBlockType, TabsData } from "@/modules/tabs/types";
import { FENCED_BLOCK_MARKDOWN, protyleHtmlStr } from "@/constants";
import { encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { deleteBlock, insertBlock } from "@/api";
import { getActiveEditor, Viz } from "siyuan";

export async function ensureLibraryLoaded(type: FencedBlockType): Promise<void> {
    const editor = getActiveEditor(true);
    const previousId = (editor?.protyle.wysiwyg.element.lastChild as HTMLElement)?.dataset.nodeId;
    const result = await insertBlock("markdown", FENCED_BLOCK_MARKDOWN[type], "", previousId, "");
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
        const mathBlocks = container.querySelectorAll<HTMLElement>(".language-math");
        if (mathBlocks.length > 0) {
            await this.renderMath(mathBlocks);
        }

        // 处理 Mermaid
        const mermaidBlocks = container.querySelectorAll<HTMLElement>(".language-mermaid");
        if (mermaidBlocks.length > 0) {
            await this.renderMermaid(mermaidBlocks);
        }

        // 处理代码高亮
        const codeBlocks = container.querySelectorAll<HTMLElement>("pre code");
        if (codeBlocks.length > 0) {
            await this.renderCode(codeBlocks);
        }

        // 处理五线谱
        const abcBlocks = container.querySelectorAll<HTMLElement>(".language-abc");
        if (abcBlocks.length > 0) {
            await this.renderAbc(abcBlocks);
        }

        // 处理 plantUML
        const plantumlBlocks = container.querySelectorAll<HTMLElement>(".language-plantuml");
        if (plantumlBlocks.length > 0) {
            await this.renderPlantUML(plantumlBlocks);
        }

        // 处理 Graphviz
        const graphvizBlocks = container.querySelectorAll<HTMLElement>(".language-graphviz");
        if (graphvizBlocks.length > 0) {
            await this.renderGraphviz(graphvizBlocks);
        }

        return container.innerHTML;
    }

    private static async renderMath(mathBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.katex) {
            // 插入公式块，让思源加载 window.katex
            await ensureLibraryLoaded("katex");
        }
        // 预处理 Macros 配置
        const macros = JSON.parse(window.siyuan.config.editor.katexMacros || "{}");
        mathBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;
            try {
                window.katex.render(code, el, {
                    displayMode: el.tagName === "DIV",
                    throwOnError: false,
                    macros: macros,
                });
            } catch (e) {
                logger.warn("KaTeX 渲染失败", e);
            }
        });
    }

    private static async renderMermaid(mermaidBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.mermaid) {
            // 插入 mermaid 块，让思源加载 window.mermaid
            await ensureLibraryLoaded("mermaid");
        }
        const renderPromises = Array.from(mermaidBlocks).map(async (el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

            try {
                const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
                const renderResult = await window.mermaid.render(id, code);
                el.innerHTML = renderResult.svg;
            } catch (e) {
                logger.warn("Mermaid 渲染失败", e);
            }
        });
        await Promise.all(renderPromises);
    }

    private static async renderCode(codeBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.hljs) {
            // 插入代码块，让思源加载 window.hljs
            await ensureLibraryLoaded("hljs");
        }
        codeBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

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

    private static async renderAbc(abcBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.ABCJS) {
            // 插入 abcjs 块，让思源加载 window.ABCJS
            await ensureLibraryLoaded("abc");
        }
        abcBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

            try {
                // 解析配置（查找 %%params）
                const config = this.parseAbcParams(code);

                window.ABCJS.renderAbc(el, code, config);
                // el.innerHTML = renderResult.svg;
            } catch (e) {
                logger.warn("五线谱渲染失败", e);
            }
        });
    }

    /** ABCJS 解析 %%params 的辅助函数 */
    private static parseAbcParams(code: string) {
        const lines = code.split("\n");
        const firstLine = lines[0] || "";

        if (firstLine.trim().startsWith("%%params")) {
            try {
                return JSON.parse(firstLine.trim().substring("%%params".length));
            } catch (e) {
                logger.warn("无效的五线谱参数", e);
            }
        }
        return { responsive: "resize" };
    }

    private static async renderPlantUML(plantumlBlocks: NodeListOf<HTMLElement>): Promise<void> {
        // 确保 plantumlEncoder 已加载
        if (!window.plantumlEncoder) {
            await ensureLibraryLoaded("plantuml");
        }

        plantumlBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

            try {
                // 将 PlantUML 文本压缩成 URL 参数
                const encoded = window.plantumlEncoder.encode(code);

                // 从思源配置中获取 PlantUML 服务地址
                const serverUrl =
                    window.siyuan.config.editor.plantUMLServePath ||
                    "http://www.plantuml.com/plantuml/svg/~1";
                const imageUrl = `${serverUrl}${encoded}`;

                // 渲染 SVG
                el.innerHTML = `<object type="image/svg+xml" data="${imageUrl}"></object>`;

                // 错误降级处理 如果 <object> 加载失败（某些浏览器不支持），尝试降级为 <img>
                const obj = el.firstElementChild as HTMLObjectElement;
                if (obj) {
                    obj.addEventListener("error", () => {
                        el.innerHTML = `<img src="${imageUrl}" alt="PlantUML diagram" />`;
                    });
                }
            } catch (e) {
                logger.warn("PlantUML 渲染失败", e);
                // 在界面上显示错误信息
                el.innerHTML = `<span class="ft__error">Render Error</span>`;
            }
        });
    }

    private static async renderGraphviz(graphvizBlocks: NodeListOf<HTMLElement>): Promise<void> {
        //
        if (!window.Viz) {
            await ensureLibraryLoaded("graphviz");
        }

        // 准备 Viz 实例
        // Viz.instance() 异步返回 viz 实例对象
        let vizInstance: Viz;
        try {
            vizInstance = (await window.Viz.instance()) as Viz;
        } catch (e) {
            logger.error("Graphviz 初始化失败", e);
            return;
        }
        graphvizBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

            // 准备容器
            el.innerHTML = `<div style="width:100%; overflow:auto;"></div>`;
            const container = el.firstElementChild as HTMLElement;

            try {
                // 渲染
                const svgElement = vizInstance.renderSVGElement(code);

                // 插入 DOM
                container.appendChild(svgElement);
            } catch (e) {
                logger.warn("Graphviz 渲染失败", e);
                container.innerHTML = `<div class="ft__error">Graphviz Render Error: ${e.message}</div>`;
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
