import {Plugin} from "siyuan";
import {getBlockAttrs, putFile, setBlockAttrs, updateBlock} from "@/api";
import "@/index.scss";
import hljs from "highlight.js";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        console.log("loading code-tabs");
        console.log(this.i18n.helloPlugin);

        // 添加快捷键
        this.addCommand({
            langKey: "codeToTabs",
            hotkey: "",
            callback: () => {
                const selection = document.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer.parentNode?.parentNode as any;
                    const editElement = currentNode?.querySelector('[contenteditable="true"]');
                    if (editElement && currentNode.dataset?.type === "NodeCodeBlock") {
                        this.convertToTabs(currentNode);
                    }
                }
            }
        });

        // 加载配件时配置样式文件
        this.putStyleFile().then();
    }

    onLayoutReady() {
        // 监听系统主题变化
        const rootNode = document.documentElement;
        const config = {attributes: true, attributeFilter: ['data-theme-mode', 'data-light-theme', 'data-dark-theme']};
        const callback = (mutationsList: any) => {
            // 遍历所有变动
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes') {
                    this.putStyleFile().then();
                }
            }
        };
        const observer = new MutationObserver(callback);
        observer.observe(rootNode, config);
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall code-tabs");
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.codeToTabs, click: () => {
                for (const item of detail.blockElements) {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.dataset?.type === "NodeCodeBlock") {
                        this.convertToTabs(item).then()
                    }
                }
            }
        });
        detail.menu.addItem({
            iconHTML: "", label: this.i18n.updateAllTabs, click: () => this.updateAllTabs(),
        });
    }

    private async convertToTabs(item: any) {
        const id = item.dataset.nodeId;
        // codeText 是代码块中的原始文本
        const codeText = item.querySelector('[contenteditable="true"]').textContent;
        // 生成思源笔记中的HTMLBlock字符串
        const htmlBlock = this.createHtmlBlock(id, codeText);
        // 更新代码块，将它转换为HTMLBlock
        if (codeText.split("tab:").length > 1) {
            this.update('dom', htmlBlock, id, codeText);
        }
    }

    private async updateAllTabs() {
        // 找到当前文档中所有的HTMLBlock
        const htmlBlocks = document.documentElement.querySelectorAll('.render-node');
        htmlBlocks.forEach((htmlBlock: HTMLDivElement) => {
            const shadowRoot = htmlBlock.querySelector('protyle-html').shadowRoot;
            // 找到代码标签页的元素
            if (shadowRoot.querySelector('.tabs-container')) {
                // 更新HTMLBlock
                getBlockAttrs(htmlBlock.dataset.nodeId).then(res => {
                    const nodeId = htmlBlock.dataset.nodeId;
                    const codeText = res['custom-plugin-code-tabs-sourcecode'];
                    const html = this.createHtmlBlock(nodeId, codeText);
                    this.update('dom', html, nodeId, codeText);
                });
            }
        });
    }

    private update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        updateBlock(dataType, data, id).then(() => {
            console.log("code-tabs: 更新代码块");
            setBlockAttrs(id, {['custom-plugin-code-tabs-sourcecode']: codeText}).then();
        })
    }

    /**
     * 生成HTMLBlock的dom字符串
     * @param id 要转换的代码块的data-node-id
     * @param codeText 代码块的原始文本
     * @private
     */
    private createHtmlBlock(id: string, codeText: string) {
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
        const html_2 = `<protyle-html data-content="${this.createProtyleHtml(codeText)}"></protyle-html>`;
        const html_3 = `<span style="position: absolute"></span>
                </div>
                <div class="protyle-attr" contenteditable="false"></div>
            </div>`.replace(/>\s+</g, '><').trim();
        return html_1 + html_2 + html_3;
    }

    /**
     * 生成HTMLBlock中 protyle-html 元素的data-content的dom字符串，即可直接在思源的HTMLBlock中编辑的dom字符串
     * @param codeText 代码块的原始文本
     * @private
     */
    private createProtyleHtml(codeText: string) {
        const html_1 = `  
            <div> 
                <link rel="stylesheet" href="/plugins/code-tabs/siyuan-theme-default.css">
                <link rel="stylesheet" href="/plugins/code-tabs/code-style.css">  
                <link rel="stylesheet" href="/plugins/code-tabs/theme.css">
                <link rel="stylesheet" href="/plugins/code-tabs/index.css">`.replace(/>\s+</g, '><').trim();
        const html_2 = this.createTabs(codeText);
        const html_3 = `
                <script src="/plugins/code-tabs/util/util.js"></script>
            </div>`.replace(/>\s+</g, '><').trim();
        const html = html_1 + html_2 + html_3;
        return this.escapeHtml(html);
    }

    /**
     * 生成代码标签页的dom字符串
     * @param codeText 代码块的原始文本
     * @private
     */
    private createTabs(codeText: string) {
        // tab-container类用于存放所有的标签和标签内容
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tabs-container';

        // tabs 包含所有标签页的标题
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        // tab-contents 包含所有标签页的内容
        const tabContents = document.createElement("div");
        tabContents.className = "tab-contents protyle-wysiwyg protyle-wysiwyg--attr";
        tabContents.style.cssText = "white-space: pre-wrap; word-break: break-all; font-variant-ligatures: none;"

        // 解析代码块中的代码，将它们放到对应的标签页中
        const codeTagTextArray = codeText.split("tab:");
        for (let i = 1; i < codeTagTextArray.length; i++) {
            // 通过tab：分割不同的语言代码
            const codeBlock = codeTagTextArray[i].split('\n');
            const language = codeBlock.shift()?.trim();
            const code = codeBlock.join('\n').trim();

            // 填充标签
            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.textContent = language;
            tab.setAttribute('onclick', 'openTag(event)');
            if (i === 1) tab.classList.add("tab-item--active");
            tabs.appendChild(tab);

            // 填充对应的标签页内容
            const content = document.createElement('div');
            content.className = "tab-content hljs";
            if (i === 1) content.classList.add("tab-content--active");
            content.dataset.render = "true";
            /* 不知道为什么，反正只有这样才能在思源中正确显示带内容的尖括号，如<stdio.h>*/
            let hlText = code;
            if (hljs.getLanguage(language) !== undefined) {
                // 如果语言被支持，则进行高亮处理
                hlText = hljs.highlight(code, {language: language, ignoreIllegals: true}).value;
            } else {
                hlText = hljs.highlight(code, {language: "plaintext", ignoreIllegals: true}).value
            }
            content.innerHTML = hlText.replace(/&lt;/g, '&amp;amp;lt;')
                .replace(/&gt;/g, '&amp;amp;gt;');
            tabContents.appendChild(content);
        }
        // 最后添加自定义内容
        // 切换键，用来将标签页切回代码块
        const tabCustomTag = document.createElement("div");
        tabCustomTag.className = "tab-toggle";
        tabCustomTag.setAttribute('onclick', 'toggle(event)');
        tabCustomTag.textContent = this.i18n.toggleToCode;
        tabs.appendChild(tabCustomTag);

        tabContainer.appendChild(tabs);
        tabContainer.appendChild(tabContents);
        return tabContainer.outerHTML;
    }

    /**
     * 转义dom字符串中的特殊字符
     * @param input 要转义的字符串
     * @private
     */
    private escapeHtml(input: string): string {
        /* 不转义尖括号刚好能正常运行 */
        return input.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private async fetchFileFromUrl(route: string, fileName: string) {
        try {
            const baseUrl = "http://127.0.0.1:6806";
            const response = await fetch(baseUrl + route);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            return new File([blob], fileName, {type: blob.type});
        } catch (error) {
            console.error('fetchFileFromUrl Error: ', error);
        }
    }

    private async putStyleFile() {
        // 配置样式文件
        const syStyle = document.querySelector('link#themeDefaultStyle').getAttribute('href');
        const codeStyle = document.querySelector('link#protyleHljsStyle').getAttribute('href');
        const themeStyle = document.querySelector('link#themeStyle')?.getAttribute('href');
        const fileSyStyle = await this.fetchFileFromUrl(syStyle, 'siyuan-theme-default.css');
        const fileCodeStyle = await this.fetchFileFromUrl(codeStyle, 'code-style.css');
        let fileThemeStyle: File;
        // 如果使用了主题就复制主题的css样式，否则就创建一个空白文件
        if (themeStyle) {
            fileThemeStyle = await this.fetchFileFromUrl(themeStyle, 'theme.css');
        } else {
            const emptyContent = new Uint8Array(0);
            const blob = new Blob([emptyContent], {type: 'text/css'});
            fileThemeStyle = new File([blob], 'theme.css', {type: 'text/css'});
        }
        putFile('/data/plugins/code-tabs/siyuan-theme-default.css', false, fileSyStyle).then();
        putFile('/data/plugins/code-tabs/code-style.css', false, fileCodeStyle).then();
        putFile('/data/plugins/code-tabs/theme.css', false, fileThemeStyle).then();
    }
}
