import {Plugin} from "siyuan";
import {appendBlock, deleteBlock, updateBlock} from "@/api";
import "@/index.scss";
import hljs from "highlight.js";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        console.log("loading code-tabs");
        console.log(this.i18n.helloPlugin);
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall code-tabs");
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabs, click: () => this.convertToTabs(detail),
        });
    }

    private async convertToTabs(detail: any) {
        for (const item of detail.blockElements) {
            const editElement = item.querySelector('[contenteditable="true"]');
            if (editElement && item.getAttribute("data-type") === "NodeCodeBlock") {
                const codeText = editElement.textContent;
                const id = item.dataset.nodeId;
                const tempBlock = await this.getBackgroundColor(id);
                const tempId = tempBlock["tempId"];
                const codeBg = tempBlock["bg"];
                console.log(window.getComputedStyle(editElement).backgroundColor);
                console.log(codeBg);
                // 创建思源笔记中的HTMLBlock
                const htmlBlock = this.createHtmlBlock(id, codeText, codeBg);
                // 更新代码块
                if (codeText.split("tab:").length > 1) {
                    this.update(htmlBlock, item.dataset.nodeId).then(() => {
                        console.log("更新代码块");
                        deleteBlock(tempId);
                    });
                }
            }
        }
    }

    private async update(data: string, nodeId: string) {
        updateBlock("dom", data, nodeId).then(() => {
            console.log("update done");
            // const node = document.documentElement
            //     .getElementsByClassName("protyle-wysiwyg protyle-wysiwyg--attr")[0]
            //     .querySelector(`[data-node-id="${nodeId}"]`);
            // const shadow = node.querySelector('[data-content]').shadowRoot;
            // const toggleSwitch = shadow.querySelector('.tab-toggle');
            // if (toggleSwitch) {
            //     toggleSwitch.addEventListener('click', () => {
            //         // 从标签页切换回代码块
            //         this.toggleToCode(node);
            //     });
            // } else {
            //     console.error('Element not found.');
            // }
        });
    }

    // private toggleToCode(htmlBlock: Element) {
    //     const codeText = htmlBlock.getElementsByTagName('protyle-html')[0]
    //         .shadowRoot.querySelector('.tab-sourcecode').textContent;
    //     const nodeId = htmlBlock.getAttribute("data-node-id");
    //     // 先插入代码块，然后再删除原本的HTML块
    //     appendBlock("markdown", `\`\`\`tab\n${codeText}\`\`\``, nodeId).then(() => {
    //         deleteBlock(nodeId).then();
    //     })
    // }

    private createHtmlBlock(id: string, codeText: string, codeBg: string) {
        const html_1 = `
            <div data-node-id="${id}" data-type="NodeHTMLBlock" class="render-node" data-subtype="block">
                <div class="protyle-icons">
                    <span aria-label="编辑" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-icon--first protyle-action__edit">
                        <svg><use xlink:href="#iconEdit"></use></svg>
                    </span>
                    <span aria-label="更多" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-action__menu protyle-icon--last">
                        <svg><use xlink:href="#iconMore"></use></svg>
                    </span>
                </div>
                <div>`.replace(/>\s+</g, '><').trim();
        const html_2 = `<protyle-html data-content="${this.createProtyleHtml(id, codeText, codeBg)}"></protyle-html>`;
        const html_3 = `<span style="position: absolute"></span>
                </div>
                <div class="protyle-attr" contenteditable="false"></div>
            </div>`.replace(/>\s+</g, '><').trim();
        return html_1 + html_2 + html_3;
    }

    private createProtyleHtml(id: string, codeText: string, codeBg: string) {
        const codeStyle = document.getElementById('protyleHljsStyle').getAttribute('href');
        const html_1 = `  
            <div> 
                <link rel="stylesheet" href="${codeStyle}">  
                <link rel="stylesheet" href="/plugins/code-tabs/index.css">`
            .replace(/>\s+</g, '><').trim();
        const html_2 = this.createTabs(id, codeText, codeBg);
        const html_3 = `<script src="/plugins/code-tabs/util/util.js"></script>
            </div>`.replace(/>\s+</g, '><').trim();
        const html = html_1 + html_2 + html_3;
        return this.escapeHtml(html);
    }

    private createTabs(id: string, codeText: string, codeBg: string) {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tabs-container';
        tabContainer.id = id;

        // tabs 包含所有标签页的标题
        let tabs = document.createElement("div");
        tabs.className = "tabs";
        // tabContents 包含所有标签页的内容
        let tabContents = document.createElement("div");
        tabContents.className = "tab-contents";

        // 解析代码块中的代码，将它们放到对应的标签页中
        let codeTagTextArray = codeText.split("tab:");
        for (let i = 1; i < codeTagTextArray.length; i++) {
            const codeBlock = codeTagTextArray[i].split('\n');
            const language = codeBlock.shift()?.trim();
            const code = codeBlock.join('\n').trim();

            // fill up tab
            let tab = document.createElement("div");
            tab.className = "tab-item";
            tab.textContent = language;
            tab.setAttribute('onclick', 'openTag(event)');
            if (i === 1) tab.classList.add("tab-item--active");
            tabs.appendChild(tab);

            // fill up tab-content
            let content = document.createElement('div');
            content.className = "tab-content";
            if (i === 1) content.classList.add("tab-content--active");
            const pre = document.createElement('pre');
            pre.className = "hljs";
            /* 不知道为什么，反正只有这样才能在思源中正确显示带内容的尖括号，如<stdio.h>*/
            try {
                pre.innerHTML = hljs.highlight(language,code, true).value
                    .replace(/&lt;/g, '&amp;amp;lt;')
                    .replace(/&gt;/g, '&amp;amp;gt;');
            }catch (err){
                pre.innerHTML = hljs.highlight("plaintext", code, true).value
                    .replace(/&lt;/g, '&amp;amp;lt;')
                    .replace(/&gt;/g, '&amp;amp;gt;');
            }
            pre.style.backgroundColor = codeBg;
            content.appendChild(pre);
            tabContents.appendChild(content);
        }
        // 最后添加自定义内容
        // 切换键，用来将标签页切回代码块
        let tabCustomTag = document.createElement("div");
        tabCustomTag.className = "tab-toggle";
        tabCustomTag.setAttribute('onclick', 'toggle(event)');
        tabCustomTag.textContent = this.i18n.toggleToCode;
        tabs.appendChild(tabCustomTag);
        // 用来保存原始的代码块内容
        let tabSourceCode = document.createElement('div');
        tabSourceCode.className = "tab-sourcecode";
        /* 不知道为什么，反正只有这样才能在思源中正确显示带内容的尖括号，如<stdio.h>*/
        tabSourceCode.innerHTML = codeText.replace(/</g, '&amp;amp;lt;')
            .replace(/>/g, '&amp;amp;gt;');
        tabContents.appendChild(tabSourceCode);

        tabContainer.appendChild(tabs);
        tabContainer.appendChild(tabContents);
        return tabContainer.outerHTML;
    }

    private async getBackgroundColor(id: string) {
        const result = await appendBlock("markdown", "\`\`\`python\nprint(\"error\")\n", id);
        const tempId = result[0].doOperations[0].id;
        const tempElement = document.querySelector(`[data-node-id="${tempId}"]`).querySelector('[contenteditable="true"]');
        console.log(tempElement);
        const bg = window.getComputedStyle(tempElement).backgroundColor;
        // await deleteBlock(tempId);
        return {tempId, bg};
    }

    private escapeHtml(input: string): string {
        return input.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
