import { Marked } from "marked";
import markedKatex, { type MarkedKatexOptions } from "marked-katex-extension";
import { markedHighlight } from "marked-highlight";
import type { TabsData } from "@/modules/tabs/types";
import { protyleHtmlStr } from "@/constants";
import { encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";

export class TabRenderer {
    static createProtyleHtml(data: TabsData): string {
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
        const marked = new Marked(
            markedHighlight({
                langPrefix: "hljs language-",
                highlight(code, lang) {
                    const language = window.hljs.getLanguage(lang) ? lang : "plaintext";
                    return window.hljs.highlight(code, { language }).value;
                },
            })
        );
        const options = {
            throwOnError: false,
        } as MarkedKatexOptions;
        marked.use(markedKatex(options));

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
                hlText = marked.parse(code) as string;
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
