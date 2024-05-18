import {Plugin} from "siyuan";
import {appendBlock, deleteBlock, getBlockAttrs, putFile, setBlockAttrs, updateBlock} from "@/api";
import "@/index.scss";
import hljs from "highlight.js";
import logger from "@/logger";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        logger.info("loading code-tabs");
        logger.info(this.i18n.helloPlugin);

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
    }

    async onLayoutReady() {
        logger.info("layout ready");
        // 监听代码主题和系统主题变化
        const head = document.querySelector('head');
        const config = {attributes: true, childList: true, subtree: true};
        const callback = (mutationsList: any) => {
            // 遍历所有变动
            const selector = /<link.*theme|<link.*style/gi;
            for (let mutation of mutationsList) {
                // 用防抖函数保证head中与主题相关的节点快速变化时只进行一次样式配置
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((addedNode: any) => {
                        if (selector.test(addedNode.outerHTML)) {
                            debounced();
                        }
                    });
                    mutation.removedNodes.forEach((removedNode: any) => {
                        if (selector.test(removedNode.outerHTML)) {
                            debounced();
                        }
                    });
                    // this.putStyleFile().then();
                } else if (mutation.type === 'attributes') {
                    if (selector.test(mutation.target.outerHTML)) {
                        debounced();
                    }
                }
            }
        };
        // 防抖函数
        const debounce = <T extends Function>(func: T, wait: number) => {
            let timeout: ReturnType<typeof setTimeout> | null = null;
            return function (...args: any) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
        // 防抖回调
        const putFile = () => {
            logger.info(this.i18n.codeStyleChange);
            this.putStyleFile().then();
        }
        const debounced = debounce(putFile, 500);
        const observer = new MutationObserver(callback);
        observer.observe(head, config);

        // 加载插件时配置样式文件
        const codeStyle = document.querySelector('link#protyleHljsStyle')?.getAttribute('href');
        // 思源当前的代码样式
        const fileCodeStyle = await this.fetchFileFromUrl(codeStyle, 'code-style.css');
        // code-tabs当前使用的代码样式
        const fileCodeStylePlugin = await this.fetchFileFromUrl('/plugins/code-tabs/code-style.css', 'code-style.css');
        // code-tabs目录中不存在样式文件或样式文件与思源使用的不同时重新配置样式文件
        if (fileCodeStylePlugin === undefined || fileCodeStylePlugin.size === 0) {
            await this.putStyleFile();
        } else {
            const codeStyleContent = await fileCodeStyle.text();
            const pluginCodeStyleContent = await fileCodeStylePlugin.text();
            if (codeStyleContent !== pluginCodeStyleContent) {
                logger.info(this.i18n.initPutFile);
                await this.putStyleFile();
            }
        }
    }

    async onunload() {
        logger.info(this.i18n.byePlugin)
    }

    uninstall() {
        logger.info("uninstall code-tabs");
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

    /**
     * 将代码块转换为标签页
     * @param item
     * @private
     */
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

    /**
     * 更新当前文档中所有的代码标签页
     * @private
     */
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

    /**
     * 通过思源api更新code-tabs的HTML块
     * @param dataType
     * @param data
     * @param id
     * @param codeText
     * @private
     */
    private update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        updateBlock(dataType, data, id).then(() => {
            logger.info(this.i18n.updateCodeBlock);
            setBlockAttrs(id, {['custom-plugin-code-tabs-sourcecode']: codeText}).then(() => {
                const node = document.querySelector(`[data-node-id="${id}"][data-type="NodeHTMLBlock"]`);
                const editButton = node.querySelector('.protyle-action__edit');
                const clickEvent = new MouseEvent('click', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                });
                editButton.dispatchEvent(clickEvent);
                const closeButton = document.querySelector('.block__icon--show[data-type="close"]');
                closeButton.dispatchEvent(clickEvent);
            });
        })
    }

    /**
     * 生成HTMLBlock的dom字符串
     * @param id 要转换的代码块的data-node-id
     * @param codeText 代码块的原始文本
     * @return dom字符串
     * @private
     */
    private createHtmlBlock(id: string, codeText: string): string {
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
     * @return 转义后的dom字符串
     * @private
     */
    private createProtyleHtml(codeText: string): string {
        const html_1 = `  
            <div> 
                <link rel="stylesheet" href="/plugins/code-tabs/code-style.css">  
                <link rel="stylesheet" href="/plugins/code-tabs/background.css">
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
     * @return dom字符串
     * @private
     */
    private createTabs(codeText: string): string {
        // tab-container类用于存放所有的标签和标签内容
        const tabContainer = document.createElement('div');
        tabContainer.className = 'tabs-container';

        // tabs 包含所有标签页的标题
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        // tab-contents 包含所有标签页的内容
        const tabContents = document.createElement("div");
        tabContents.className = "tab-contents protyle-wysiwyg protyle-wysiwyg--attr";
        tabContents.style.cssText = "white-space: pre-wrap; word-break: break-all; font-variant-ligatures: none; position: relative;"
        // 添加复制按钮
        const iconContainer = document.createElement('span');
        iconContainer.className = 'code-tabs--icon_copy';
        iconContainer.setAttribute('onclick', 'copyCode(event)');
        const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        copySvg.setAttribute('viewBox', '0 0 35 35');
        copySvg.setAttribute('fill', '#9a9ea9');
        copySvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const copyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        copyPath.setAttribute('d',
            'M22.545-0h-17.455c-1.6 0-2.909 1.309-2.909 2.909v20.364h2.909v-20.364h17.455v-2.909zM26.909 ' +
            '5.818h-16c-1.6 0-2.909 1.309-2.909 2.909v20.364c0 1.6 1.309 2.909 2.909 2.909h16c1.6 0 2.909-1.309 ' +
            '2.909-2.909v-20.364c0-1.6-1.309-2.909-2.909-2.909zM26.909 29.091h-16v-20.364h16v20.364z');
        copySvg.appendChild(copyPath);
        iconContainer.appendChild(copySvg);
        tabContents.appendChild(iconContainer);

        // 解析代码块中的代码，将它们放到对应的标签页中
        // 通过tab::：分割不同的语言代码同时指定标题，通过lang:::指定语言类型
        const codeTagTextArray = codeText.split("tab:::");
        for (let i = 1; i < codeTagTextArray.length; i++) {
            const codeBlockArr = codeTagTextArray[i].split('lang:::');
            let title: string;
            // 如果指定了语言类型，则分别设置标题和语言类型，否则标题和语言类型使用同一个值
            if (codeBlockArr.length > 1) {
                title = codeBlockArr.shift().trim();
            }
            const codeBlock = codeBlockArr[0].split('\n');
            const language = codeBlock.shift()?.trim();
            const code = codeBlock.join('\n').trim();
            if (title === undefined) {
                title = language;
            }

            // 填充标签
            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.textContent = title;
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
            content.innerHTML = hlText.replace(/&lt;/g, '&amp;lt;')
                .replace(/&gt;/g, '&amp;gt;');
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
     * 转义dom字符串中的特殊字符，这里只转义引号和 &
     * @param input 要转义的字符串
     * @return 转义后的字符串
     * @private
     */
    private escapeHtml(input: string): string {
        /* 不转义尖括号刚好能正常运行 */
        return input.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 通过url获取当前思源笔记中的文件
     * @param route 文件的路由路径
     * @param fileName 文件名
     * @return url对应的File对象，找不到时返回一个内容为空的File对象
     * @private
     */
    private async fetchFileFromUrl(route: string, fileName: string): Promise<File> {
        try {
            let file: File;
            if (route === undefined) {
                const emptyContent = new Uint8Array(0);
                const blob = new Blob([emptyContent], {type: 'text/css'});
                file = new File([blob], fileName, {type: 'text/css'});
            } else {
                const baseUrl = "http://127.0.0.1:6806";
                // fetch时禁用缓存，避免后续文件判断逻辑因缓存而出错
                const response = await this.fetchWithRetry(baseUrl + route, {
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                if (!response.ok) {
                    if (response.status === 404) {
                        logger.warn("file not found: " + route);
                        return undefined;
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                }
                const blob = await response.blob();
                file = new File([blob], fileName, {type: blob.type});
            }
            return file;
        } catch (error) {
            console.error('fetchFileFromUrl Error: ', error);
        }
    }

    /**
     * 设置fetch失败重连
     * @param url
     * @param options fetch选项
     * @param retries 最大重连次数
     * @param delay 重连间隔
     * @private
     */
    private async fetchWithRetry(url: string, options: RequestInit = {}, retries: number = 3, delay: number = 1000): Promise<Response> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response; // If the request is successful, return the response
            } catch (error) {
                if (attempt < retries - 1) {
                    console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                } else {
                    console.error('All attempts failed.');
                    throw error; /* If all retries fail, throw the error */
                }
            }
        }
        throw new Error('Failed to fetch data after multiple attempts.');
    }

    /**
     * 在思源的主题或代码样式改变时重新配置code-tabs的样式文件
     * @private
     */
    private async putStyleFile() {
        // 配置代码样式文件
        const codeStyle = document.querySelector('link#protyleHljsStyle')?.getAttribute('href');
        const fileCodeStyle = await this.fetchFileFromUrl(codeStyle, 'code-style.css');
        putFile('/data/plugins/code-tabs/code-style.css', false, fileCodeStyle).then();
        // 配置代码背景色样式文件
        const bg = await this.getBackgroundColor();
        const cssContent = `.tab-contents.protyle-wysiwyg .hljs { background-color: ${bg}; }`;
        const blob = new Blob([cssContent], {type: 'text/css'});
        const fileBackgroundStyle = new File([blob], 'styles.css', {type: 'text/css'});
        putFile('/data/plugins/code-tabs/background.css', false, fileBackgroundStyle).then();
    }

    /**
     * 简单粗暴的获取当前文档主题下的代码块背景颜色
     * @return 代码块背景色的rgb代码，如“rgb(0, 0, 0)”
     * @private
     */
    private async getBackgroundColor() {
        /* 先插入一个新的临时代码块，获取代码块的背景颜色后再删除它 */
        const block = document.querySelector('[data-type*="Node"][data-node-id]') as HTMLElement;
        const id = block?.dataset.nodeId;
        if (id === undefined) {
            return "rgb(248, 249, 250)";
        }
        const result = await appendBlock("markdown", "\`\`\`python\nprint(\"temp block\")\n", id);
        logger.info("insert a temp code-block");
        const tempId = result[0].doOperations[0].id;
        const tempElement = document.querySelector(`[data-node-id="${tempId}"]`).querySelector('[contenteditable="true"]');
        const bg = window.getComputedStyle(tempElement).backgroundColor;
        deleteBlock(tempId).then(() => logger.info("delete temp code-block"));
        return bg;
    }
}
