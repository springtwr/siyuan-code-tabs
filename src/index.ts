import {Plugin} from "siyuan";
import {deleteBlock, insertBlock, updateBlock} from "@/api";
import "@/index.scss";
import hljs from 'highlight.js';

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

    private convertToTabs(detail: any) {
        detail.blockElements.forEach((item: HTMLElement) => {
            const editElement = item.querySelector('[contenteditable="true"]');
            if (editElement && item.getAttribute("data-type") === "NodeCodeBlock") {
                const codeText = editElement.textContent;
                // 创建思源笔记中的HTMLBlock
                const htmlBlock = this.createHtmlBlock(item.dataset.nodeId, codeText);
                // 更新代码块
                if (codeText.split("tab:").length > 1) {
                    this.update(htmlBlock, item.dataset.nodeId).then(() => {
                        console.log("更新代码块");
                    });
                }
            }
        });
    }

    private async update(data: string, nodeId: string) {
        updateBlock("dom", data, nodeId).then(() => {
            const node = document.documentElement
                .getElementsByClassName("protyle-wysiwyg protyle-wysiwyg--attr")[0]
                .querySelector(`[data-node-id="${nodeId}"]`);
            const shadow = node.querySelector('[data-content]').shadowRoot;
            // 高亮代码块
            const codeContents = shadow.querySelectorAll('pre code');
            codeContents.forEach((code: HTMLPreElement) => {
                hljs.highlightElement(code);
            });
            const toggleSwitch = shadow.querySelector('.tab-toggle');
            if (toggleSwitch) {
                toggleSwitch.addEventListener('click', () => {
                    // 从标签页切换回代码块
                    this.toggleToCode(node);
                });
            } else {
                console.error('Element not found.');
            }
        });
    }

    private toggleToCode(htmlBlock: Element) {
        const codeText = htmlBlock.getElementsByTagName('protyle-html')[0]
            .shadowRoot.querySelector('.tab-sourcecode').textContent;
        const nodeId = htmlBlock.getAttribute("data-node-id");
        // 先插入代码块，然后再删除原本的HTML块
        insertBlock("markdown", `\`\`\`tab\n${codeText}\`\`\``, nodeId).then(() => {
            deleteBlock(nodeId).then();
        })
    }

    /**
     * 创建思源文档中的HTMLBlock
     * @param id 要转换的代码块的data-node-id
     * @param codeText 要转换的代码块中的内容
     * @return HTMLBlock的HTML字符串
     * @private
     */
    private createHtmlBlock(id: string, codeText: string) {
        return `
<div data-node-id="${id}" 
    data-type="NodeHTMLBlock" 
    class="render-node" 
    data-subtype="block">
    <div class="protyle-icons">
        <span aria-label="编辑" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-icon--first protyle-action__edit">
            <svg><use xlink:href="#iconEdit"></use></svg>
        </span>
        <span aria-label="更多" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-action__menu protyle-icon--last">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
    </div>
    <div>
        <protyle-html data-content="${this.createProtyleHtml(codeText)}"></protyle-html>
        <span style="position: absolute">​</span>
    </div>
    <div class="protyle-attr" contenteditable="false"></div>
</div>`;
    }

    private createProtyleHtml(codeText: string) {
        const tabContainer = this.createTabs(codeText);
        const html = `  
<div>  
    <link rel="stylesheet" href="/stage/protyle/js/highlight.js/styles/idea.min.css">  
    <link rel="stylesheet" href="/plugins/code-tabs/index.css">  
    ${tabContainer}  
    <script>  
        function openTag(evt) {  
            let tabContainer = evt.target.closest('.tab-container');  
            let tabItems = tabContainer.querySelectorAll('.tab-item');  
            let tabContents = tabContainer.querySelectorAll('.tab-content');  
            tabItems.forEach((tabItem, index) => {  
                if (tabItem === evt.target) {  
                    tabItem.classList.add('tab-item--active');  
                    tabContents[index].classList.add('tab-content--active');  
                } else {  
                    tabItem.classList.remove('tab-item--active');  
                    tabContents[index].classList.remove('tab-content--active');  
                }  
            });  
        }  
    </script>  
</div>  
    `;
        return this.escapeHtml(html);
    }

    private createTabs(codeText: string) {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tabs-container';

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

            // 先添加自定义内容
            if (i === 1) {
                // 切换键，用来将标签页切回代码块
                let tabCustomTag = document.createElement("div");
                tabCustomTag.className = "tab-toggle";
                tabCustomTag.textContent = this.i18n.toggleToCode;
                tabs.appendChild(tabCustomTag);
                // 用来保存原始的代码块内容
                let tabSourceCode = document.createElement('div');
                tabSourceCode.className = "tab-sourcecode";
                tabSourceCode.textContent = code;
                tabContents.appendChild(tabSourceCode);
            }

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

            let codeElement = document.createElement('code');
            codeElement.className = 'language-' + language;
            codeElement.textContent = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let preElement = document.createElement('pre');
            preElement.appendChild(codeElement);
            content.appendChild(preElement);
            tabContents.appendChild(content);
        }
        tabContainer.appendChild(tabs);
        tabContainer.appendChild(tabContents);
        return tabContainer.outerHTML;
    }

    // private getCurrentTime() {
    //     // 获取当前时间
    //     const currentDate = new Date();
    //     // 获取当前时间的年、月、日、小时、分钟和秒
    //     const currentYear = currentDate.getFullYear();
    //     const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    //     const currentDay = currentDate.getDate().toString().padStart(2, '0');
    //     const currentHour = currentDate.getHours().toString().padStart(2, '0');
    //     const currentMinute = currentDate.getMinutes().toString().padStart(2, '0');
    //     const currentSecond = currentDate.getSeconds().toString().padStart(2, '0');
    //     // 格式化当前时间
    //     return `${currentYear}${currentMonth}${currentDay}${currentHour}${currentMinute}${currentSecond}`;
    // }

    private escapeHtml(input: string): string {
        return input.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
