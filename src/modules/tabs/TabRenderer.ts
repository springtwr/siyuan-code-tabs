import { Marked } from "marked";
import markedKatex, { type MarkedKatexOptions } from "marked-katex-extension";
import { markedHighlight } from "marked-highlight";
import { CodeTab } from "@/modules/tabs/types";
import { protyleHtmlStr } from "@/constants";
import { encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";

export class TabRenderer {
    static createProtyleHtml(codeArr: CodeTab[], toggleToCode: string): string {
        logger.debug("开始生成 Tabs HTML 块", { count: codeArr.length });
        const containerDiv = document.createElement("div");
        containerDiv.innerHTML = protyleHtmlStr;
        const tabContainer = containerDiv.querySelector(".tabs-container") as HTMLElement;

        const tabsOuter = containerDiv.querySelector(".tabs-outer") as HTMLElement;
        const tabs = containerDiv.querySelector(".tabs") as HTMLElement;

        tabs.setAttribute("onwheel", "pluginCodeTabs.wheelTag(event)");
        tabs.setAttribute("ontouchstart", "pluginCodeTabs.touchStart(event)");
        tabs.setAttribute("ontouchend", "pluginCodeTabs.touchEnd(event)");
        tabs.setAttribute("oncontextmenu", "pluginCodeTabs.contextMenu(event)");
        tabs.setAttribute("ondragover", "pluginCodeTabs.dragOver(event)");
        tabs.setAttribute("ondrop", "pluginCodeTabs.dragDrop(event)");
        tabs.setAttribute("ondragleave", "pluginCodeTabs.dragLeave(event)");

        const tabContents = containerDiv.querySelector(".tab-contents") as HTMLElement;
        let activeIndex = 0;
        let hasActive = false;
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

        for (let i = 0; i < codeArr.length; i++) {
            const title = codeArr[i].title;
            const language = codeArr[i].language;
            const code = codeArr[i].code;
            if (codeArr[i].isActive && !hasActive) {
                activeIndex = i;
                hasActive = true;
            }

            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.dataset.tabId = String(i);
            tab.textContent = title;
            tab.title = title;
            tab.setAttribute("onclick", "pluginCodeTabs.openTag(event)");
            tab.setAttribute("draggable", "true");
            tab.setAttribute("ondragstart", "pluginCodeTabs.dragStart(event)");
            tab.setAttribute("ondragend", "pluginCodeTabs.dragEnd(event)");
            tabs.appendChild(tab);

            const content = document.createElement("div");
            content.className = "tab-content hljs";
            content.dataset.tabId = String(i);
            content.dataset.render = "true";
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
            if (language === "markdown-render") {
                const codeBlocks = content.querySelectorAll<HTMLElement>("code");
                codeBlocks.forEach((block) => this.encodeTextNodes(block));
            } else {
                const codeBlock = content.querySelector<HTMLElement>(".code");
                if (codeBlock) this.encodeTextNodes(codeBlock);
            }
            tabContents.appendChild(content);
        }

        tabs.children[activeIndex].classList.add("tab-item--active");
        tabContents.children[activeIndex + 1].classList.add("tab-content--active");
        logger.debug("Tabs 内容生成完成", { activeIndex, count: codeArr.length });

        const tabToggle = containerDiv.querySelector(".tab-toggle") as HTMLElement;
        tabToggle.setAttribute("onclick", "pluginCodeTabs.toggle(event)");
        tabToggle.textContent = toggleToCode;

        tabsOuter.appendChild(tabs);
        tabsOuter.appendChild(tabToggle);

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
