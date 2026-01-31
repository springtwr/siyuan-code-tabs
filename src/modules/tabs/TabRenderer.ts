import type { FencedBlockType, TabsData } from "@/modules/tabs/types";
import {
    FENCED_BLOCK_MARKDOWN,
    HLJS_SCRIPT,
    HLJS_SCRIPT_ID,
    HLJS_THIRD_SCRIPT,
    HLJS_THIRD_SCRIPT_ID,
    PROTYLE_HTML,
} from "@/constants";
import { encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { deleteBlock, insertBlock } from "@/api";
import { getActiveEditor, Viz } from "siyuan";

/**
 * Tabs HTML 渲染与第三方库加载编排。
 * 副作用：插入/删除临时块、触发库加载、生成 HTML 字符串。
 */
export class TabRenderer {
    /**
     * 生成 HTML 块内容（包含 tabs 结构与内容渲染）。
     * @param data tabs 数据
     * @returns HTML 字符串
     */
    static async createProtyleHtml(data: TabsData): Promise<string> {
        logger.debug("开始生成 Tabs HTML 块", { count: data.tabs.length });
        const containerDiv = document.createElement("div");
        containerDiv.innerHTML = PROTYLE_HTML;
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
                // markdown-render 使用 Lute 渲染并进行二次渲染（图表/公式等）
                content.dataset.raw = encodeSource(code);
                const rawHtml = lute.MarkdownStr("markdown", code);
                const mdDiv = document.createElement("div");
                mdDiv.innerHTML = rawHtml;
                hlText = await this.renderMarkdown(mdDiv);
                hlText = `<div class="markdown-body">${hlText}</div>`;
            } else {
                // 普通代码块走 hljs 高亮，缺失时回退为纯文本
                if (!window.hljs) {
                    await this.ensureLibraryLoaded("hljs");
                }
                const safeLang =
                    window.hljs?.getLanguage && window.hljs.getLanguage(language)
                        ? language
                        : "plaintext";
                let highlighted: string | null = null;
                if (window.hljs?.highlight) {
                    try {
                        highlighted = window.hljs.highlight(code, {
                            language: safeLang,
                            ignoreIllegals: true,
                        }).value;
                    } catch (error) {
                        logger.warn("hljs 渲染失败，回退为纯文本", { error, language });
                        highlighted = null;
                    }
                }
                if (highlighted !== null) {
                    hlText = `<div class="code language-${safeLang}" style="white-space: pre-wrap;">${highlighted}</div>`;
                } else {
                    hlText = `<div class="code language-${safeLang}" style="white-space: pre-wrap;"></div>`;
                }
            }
            content.innerHTML = hlText;
            if (language !== "markdown-render") {
                const codeBlock = content.querySelector<HTMLElement>(".code");
                if (codeBlock && !codeBlock.innerHTML) {
                    codeBlock.textContent = code;
                }
            }
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

    /**
     * Markdown 二次渲染入口（并行处理多种块类型）。
     * @param container 容器元素
     * @returns 渲染后的 HTML 字符串
     */
    private static async renderMarkdown(container: HTMLElement): Promise<string> {
        const promises: Promise<void>[] = [];

        // 处理数学公式
        const mathBlocks = container.querySelectorAll<HTMLElement>(".language-math");
        if (mathBlocks.length > 0) {
            promises.push(this.renderMath(mathBlocks));
        }

        // 处理 Mermaid
        const mermaidBlocks = container.querySelectorAll<HTMLElement>(".language-mermaid");
        if (mermaidBlocks.length > 0) {
            promises.push(this.renderMermaid(mermaidBlocks));
        }

        // 处理代码高亮
        const codeBlocks = container.querySelectorAll<HTMLElement>("pre code");
        if (codeBlocks.length > 0) {
            promises.push(this.renderCode(codeBlocks));
        }

        // 处理五线谱
        const abcBlocks = container.querySelectorAll<HTMLElement>(".language-abc");
        if (abcBlocks.length > 0) {
            promises.push(this.renderAbc(abcBlocks));
        }

        // 处理 plantUML
        const plantumlBlocks = container.querySelectorAll<HTMLElement>(".language-plantuml");
        if (plantumlBlocks.length > 0) {
            promises.push(this.renderPlantUML(plantumlBlocks));
        }

        // 处理 Graphviz
        const graphvizBlocks = container.querySelectorAll<HTMLElement>(".language-graphviz");
        if (graphvizBlocks.length > 0) {
            promises.push(this.renderGraphviz(graphvizBlocks));
        }

        await Promise.all(promises);

        return container.innerHTML;
    }

    private static async renderMath(mathBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.katex) {
            // 插入公式块，让思源加载 window.katex
            await this.ensureLibraryLoaded("katex");
        }
        // 预处理 Macros 配置
        let macros: Record<string, string> = {};
        let macrosError: string | null = null;
        try {
            const parsed = JSON.parse(window.siyuan.config.editor.katexMacros || "{}");
            if (parsed && typeof parsed === "object") {
                const entries = Object.entries(parsed as Record<string, unknown>);
                macros = entries.reduce<Record<string, string>>((acc, [key, value]) => {
                    if (typeof value === "string") {
                        acc[key] = value;
                    }
                    return acc;
                }, {});
            } else {
                macrosError = "KaTeX 宏配置无效";
            }
        } catch (error) {
            logger.warn("KaTeX 宏配置解析失败", { error });
            macrosError = "KaTeX 宏配置无效";
        }
        mathBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;
            if (macrosError) {
                el.innerHTML = "";
                const errorEl = document.createElement("span");
                errorEl.className = "ft__error";
                errorEl.textContent = macrosError;
                el.appendChild(errorEl);
                return;
            }
            try {
                window.katex.render(code, el, {
                    displayMode: el.tagName === "DIV",
                    throwOnError: false,
                    macros: macros,
                });
            } catch (e) {
                logger.warn("KaTeX 渲染失败", e);
                el.innerHTML = "";
                const errorEl = document.createElement("span");
                errorEl.className = "ft__error";
                const message = e instanceof Error ? e.message : "KaTeX Render Error";
                errorEl.textContent = `KaTeX Render Error: ${message}`;
                el.appendChild(errorEl);
            }
        });
    }

    private static async renderMermaid(mermaidBlocks: NodeListOf<HTMLElement>): Promise<void> {
        if (!window.mermaid) {
            // 插入 mermaid 块，让思源加载 window.mermaid
            await this.ensureLibraryLoaded("mermaid");
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
            await this.ensureLibraryLoaded("hljs");
        }
        codeBlocks.forEach((el) => {
            const raw = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!raw.trim()) return;

            try {
                const code = el.innerText || el.textContent || raw;
                const langClass = Array.from(el.classList).find((cls) =>
                    cls.startsWith("language-")
                );
                const language = langClass ? langClass.replace("language-", "") : "";
                const safeLang =
                    language && window.hljs.getLanguage?.(language) ? language : "plaintext";
                const result = window.hljs.highlight(code, {
                    language: safeLang,
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
            await this.ensureLibraryLoaded("abc");
        }
        abcBlocks.forEach((el) => {
            const code = window.Lute.UnEscapeHTMLStr(el.textContent) || "";
            if (!code.trim()) return;

            try {
                // 解析配置（查找 %%params）
                const config = this.parseAbcParams(code);

                window.ABCJS.renderAbc(el, code, config);
            } catch (e) {
                logger.warn("五线谱渲染失败", e);
            }
        });
    }

    /**
     * ABCJS 解析 %%params 的辅助函数。
     * @param code 原始五线谱内容
     * @returns 解析后的配置对象
     */
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
            await this.ensureLibraryLoaded("plantuml");
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
        // 确保 Viz 已加载
        if (!window.Viz) {
            await this.ensureLibraryLoaded("graphviz");
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

    static async ensureLibraryLoaded(type: FencedBlockType): Promise<void> {
        const editor = getActiveEditor(true);
        if (!editor?.protyle?.wysiwyg?.element) {
            logger.warn("无法触发库加载：未找到活动编辑器", { scriptType: type });
            // 其它类型的库一般不会出现这种情况
            // 只有 hljs 在没有打开文档的情况下升级旧版标签页才会出现这种情况
            if (type !== "hljs") return;
            logger.info("尝试手动加载 hljs");
            const loadScript = (src: string, id: string) => {
                return new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = src;
                    script.id = id;
                    script.async = false;
                    script.onload = () => resolve(`手动加载 ${id} 成功`);
                    script.onerror = () => reject(new Error(`手动加载 ${src} 失败`));
                    document.head.appendChild(script);
                });
            };
            const msg = await loadScript(HLJS_SCRIPT, HLJS_SCRIPT_ID);
            logger.debug(msg);
            const msg2 = await loadScript(HLJS_THIRD_SCRIPT, HLJS_THIRD_SCRIPT_ID);
            logger.debug(msg2);
            return;
        }
        logger.debug("触发库加载", { scriptType: type });
        const previousId = (editor.protyle.wysiwyg.element.lastChild as HTMLElement)?.dataset
            .nodeId;
        logger.debug("插入临时块以触发库加载", { previousId, scriptType: type });
        const result = await insertBlock(
            "markdown",
            FENCED_BLOCK_MARKDOWN[type],
            "",
            previousId,
            ""
        );
        const tempId = result[0].doOperations[0].id;
        await new Promise((resolve) => setTimeout(resolve, 100));
        logger.debug("删除临时块", { tempId, scriptType: type });
        await deleteBlock(tempId);
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
