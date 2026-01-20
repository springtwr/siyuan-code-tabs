import { Marked } from "marked";
import markedKatex, { type MarkedKatexOptions } from "marked-katex-extension";
import { markedHighlight } from "marked-highlight";
import { CodeTab } from "@/modules/tabs/types";
import { htmlBlockStr, protyleHtmlStr } from "@/constants";

export class TabRenderer {
    static createHtmlBlock(codeArr: CodeTab[], toggleToCode: string): string {
        const containerDiv = document.createElement("div");
        containerDiv.innerHTML = htmlBlockStr;
        const protyleHtml = containerDiv.querySelector("protyle-html") as HTMLElement;
        protyleHtml.dataset.content = this.createProtyleHtml(codeArr, toggleToCode);
        return containerDiv.innerHTML;
    }

    private static createProtyleHtml(codeArr: CodeTab[], toggleToCode: string): string {
        const containerDiv = document.createElement("div");
        containerDiv.innerHTML = protyleHtmlStr;
        const tabContainer = containerDiv.querySelector(".tabs-container") as HTMLElement;

        const tabsOuter = containerDiv.querySelector(".tabs-outer") as HTMLElement;
        const tabs = containerDiv.querySelector(".tabs") as HTMLElement;

        tabs.setAttribute("onwheel", "pluginCodeTabs.wheelTag(event)");
        tabs.setAttribute("ontouchstart", "pluginCodeTabs.touchStart(event)");
        tabs.setAttribute("ontouchend", "pluginCodeTabs.touchEnd(event)");

        const tabContents = containerDiv.querySelector(".tab-contents") as HTMLElement;
        let activeIndex = 0;
        for (let i = 0; i < codeArr.length; i++) {
            let title = codeArr[i].title;
            const language = codeArr[i].language;
            const code = codeArr[i].code;
            if (title.split(":::active").length > 1) {
                title = title.split(":::active")[0].trim();
                activeIndex = i;
            }

            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.textContent = title;
            tab.title = title;
            tab.setAttribute("onclick", "pluginCodeTabs.openTag(event)");
            tabs.appendChild(tab);

            const content = document.createElement("div");
            content.className = "tab-content hljs";
            content.dataset.render = "true";
            let hlText = code;
            if (language === "markdown-render") {
                const marked = new Marked(
                    markedHighlight({
                        langPrefix: "hljs language-",
                        highlight(code, lang) {
                            const language = window.hljs.getLanguage(lang) ? lang : "plaintext";
                            return window.hljs.highlight(code, { language }).value;
                        },
                    })
                );
                const options: MarkedKatexOptions = {
                    throwOnError: false,
                };
                marked.use(markedKatex(options));
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
            tabContents.appendChild(content);
        }

        tabs.children[activeIndex].classList.add("tab-item--active");
        tabContents.children[activeIndex + 1].classList.add("tab-content--active");

        const tabToggle = containerDiv.querySelector(".tab-toggle") as HTMLElement;
        tabToggle.setAttribute("onclick", "pluginCodeTabs.toggle(event)");
        tabToggle.textContent = toggleToCode;

        tabsOuter.appendChild(tabs);
        tabsOuter.appendChild(tabToggle);

        tabContainer.appendChild(tabsOuter);
        tabContainer.appendChild(tabContents);
        return this.escapeHtml(containerDiv.innerHTML);
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
