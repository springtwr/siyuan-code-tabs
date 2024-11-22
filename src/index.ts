import {Plugin} from "siyuan";
import {deleteBlock, getBlockAttrs, insertBlock, pushErrMsg, pushMsg, putFile, setBlockAttrs, updateBlock} from "@/api";
import hljs from "highlight.js";
import {Marked} from "marked";
import markedKatex from "marked-katex-extension";
import {markedHighlight} from "marked-highlight";
import logger from "@/logger";

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private htmlBlockStr = `
        <div data-type="NodeHTMLBlock" class="render-node" data-subtype="block" style="padding: 0; margin: 0">
            <div class="protyle-icons">
                <span aria-label="编辑" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-icon--first protyle-action__edit">
                    <svg><use xlink:href="#iconEdit"></use></svg>
                </span>
                <span aria-label="更多" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-action__menu protyle-icon--last">
                    <svg><use xlink:href="#iconMore"></use></svg>
                </span>
            </div>
            <div>
                <protyle-html></protyle-html>
                <span style="position: absolute"></span>
            </div>
            <div class="protyle-attr" contenteditable="false"></div>
        </div>`.replace(/>\s+</g, '><').trim();
    private protyleHtmlStr = `
        <div> 
            <link rel="stylesheet" href="/plugins/code-tabs/code-style.css">  
            <link rel="stylesheet" href="/plugins/code-tabs/github-markdown.css">
            <link rel="stylesheet" href="/plugins/code-tabs/asset/katex.min.css">
            <link rel="stylesheet" href="/plugins/code-tabs/asset/code-tabs.css">
            <link rel="stylesheet" href="/plugins/code-tabs/background.css">
            <div class="tabs-container" style="display: block; position: relative; will-change: background-color">
                <div class="tabs-outer" style="position: absolute; display: flex; top:0; left: 0; right: 0; justify-content: space-between; align-items: baseline;">
                    <div class="tabs" style="order: 0; display: flex; width: calc(100% - 6em); height: 100%; align-items: center; overflow: hidden; scroll-behavior: smooth"></div>
                    <div class="tab-toggle" style="order: 1; width: 6em; height: 100%; text-align: center; font-weight: bold; padding: 5px;"></div>
                </div>
                <div class="tab-contents" style="word-break: break-word; font-variant-ligatures: none; position: relative;">
                    <span class="code-tabs--icon_copy" onclick="pluginCodeTabs.copyCode(event)"><img src="/plugins/code-tabs/asset/copy.png" alt="复制"></span>
                </div>
            </div>
        </div>`.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        logger.info("loading code-tabs");
        logger.info(this.i18n.helloPlugin);
        // 检查是否开启了允许块内脚本执行开关
        if (!window.siyuan.config.editor.allowHTMLBLockScript) {
            pushErrMsg(`${this.i18n.notAllowHtmlBlockScript}`).then();
        }
        // 用一个全局变量来存放标签页中使用的的函数和对象，避免大量污染全局命名空间
        // 直接使用全局变量比在shadow dom中使用模块化脚本要方便一点
        // 同时也避免了直接在shadow dom中引用外部脚本会因更新HTML块导致的脚本重复执行
        this.addFunctionForCodeTabs();

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
        // 读取思源的主题和字体配置，保存到插件中。mode=0表示浅色模式
        this.syncSiyuanConfig();
        // 启动时从插件的配置文件中读取配置，和思源的配置对比，不同或配置文件不存在则更改插件配置
        const configFile = await this.fetchFileFromUrl('/plugins/code-tabs/config.json', 'config.json');
        if (configFile === undefined || configFile.size === 0) {
            await this.putStyleFile();
            await this.saveConfig();
            this.updateAllTabsStyle();
        } else {
            const loadDataFromFile = async function (file: File) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const data = JSON.parse(reader.result as string);
                            resolve(data as Object);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = () => {
                        reject(reader.error);
                    };
                    reader.readAsText(file);
                });
            }
            const data = await loadDataFromFile(configFile);
            const configFlag = this.compareConfig(data, this.data);
            if (!configFlag) {
                await this.putStyleFile();
                await this.saveConfig();
                this.updateAllTabsStyle();
            }
        }
        // 启动后的配置检查完成后this.data保存的就是插件的配置(此时插件配置应该和思源的配置是相同的)，思源的配置从window对象中读取
        // 监听代码主题和系统主题变化
        const html = document.documentElement;
        const htmlConfig = {attributes: true, childList: false, subtree: false};
        const head = document.head;
        const config = {attributes: true, childList: true, subtree: true};
        const callback = (mutationsList: any) => {
            // 遍历所有变动
            const siyuanConfig = this.getSiyuanConfig();
            const selector = /<link.*theme/gi;
            for (let mutation of mutationsList) {
                // 用防抖函数保证head中与主题相关的节点快速变化时只进行一次样式配置
                const configFlag = this.compareConfig(siyuanConfig, this.data)
                if (!configFlag) {
                    debounced();
                    break;
                }
                if (mutation.type === 'attributes' && selector.test(mutation.target.outerHTML)) {
                    // 某些第三方主题配色变化时并不会改变系统配置，因此要单独处理
                    debounced();
                    break;
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
            this.putStyleFile().then(() => {
                this.syncSiyuanConfig();
                this.saveConfig();
                this.updateAllTabsStyle();
            });

        }
        const debounced = debounce(putFile, 500);
        const observer = new MutationObserver(callback);
        observer.observe(html, htmlConfig);
        observer.observe(head, config);
    }

    async onunload() {
        // 关闭插件时先将此时的配置保存到插件的配置文件中，用来在下次启动插件时对比配置是否发生变化
        await this.saveConfig();
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
            iconHTML: "", label: this.i18n.fixAllTabs, click: () => {
                document.querySelectorAll('[data-type="NodeHTMLBlock"][custom-plugin-code-tabs-sourcecode]').forEach(node => {
                    const nodeId = (node as HTMLElement).dataset.nodeId;
                    getBlockAttrs(nodeId).then(res => {
                        // 从自定义属性中取出原始的代码时要将字符串中的零宽空格还原成换行符
                        const codeText = res['custom-plugin-code-tabs-sourcecode'].replace(/\u200b/g, '\n');
                        const codeArr = this.checkCodeText(codeText);
                        if (codeArr.result) {
                            // 生成思源笔记中的HTMLBlock字符串
                            const htmlBlock = this.createHtmlBlock(nodeId, codeArr.code);
                            // 更新代码块，将它转换为HTMLBlock
                            this.update('dom', htmlBlock, nodeId, codeText);
                        } else {
                            pushErrMsg(`${this.i18n.fixAllTabsErrMsg}: ${nodeId}`).then();
                        }
                    });
                });
            },
        });
    }

    /**
     * 将代码块转换为标签页
     * @param item 代码块
     * @private
     */
    private async convertToTabs(item: any) {
        const id = item.dataset.nodeId;
        // codeText 是代码块中的原始文本，使用前需去除其中的零宽字符
        const codeText = item.querySelector('[contenteditable="true"]').textContent.replace(/\u200d/g, '').replace(/\u200b/g, '');
        const checkResult = this.checkCodeText(codeText);
        // 更新代码块，将它转换为HTMLBlock
        if (checkResult.result) {
            // 生成思源笔记中的HTMLBlock字符串
            const htmlBlock = this.createHtmlBlock(id, checkResult.code);
            this.update('dom', htmlBlock, id, codeText);
        }
    }

    /**
     * 通过思源api更新code-tabs的HTML块，更新后将原始代码存入自定义属性
     * @param dataType
     * @param data
     * @param id
     * @param codeText
     * @private
     */
    private update(dataType: "markdown" | "dom", data: string, id: string, codeText: string) {
        updateBlock(dataType, data, id).then(() => {
            logger.info(this.i18n.updateCodeBlock);
            // 使用零宽空格来代替换行实现压缩字符串的效果，由于之前的处理此时可以保证此时字符串里面没有零宽空格
            const newLineFlag = '\u200b';
            codeText = codeText.replace(/[\r\n]/g, `${newLineFlag}`);
            setBlockAttrs(id, {['custom-plugin-code-tabs-sourcecode']: codeText}).then(() => {
                const node = document.querySelector(`[data-node-id="${id}"][data-type="NodeHTMLBlock"]`);
                const editButton = node.querySelector('.protyle-action__edit');
                const clickEvent = new MouseEvent('click', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                });
                logger.info(editButton);
                editButton.dispatchEvent(clickEvent);
                const closeButton = document.querySelector('.block__icon--show[data-type="close"]');
                logger.info(closeButton);
                closeButton.dispatchEvent(clickEvent);
            });
        })
    }

    /**
     * 标签语法检查
     * @param codeText 去除了零宽字符的代码
     * @private
     */
    private checkCodeText(codeText: string): { result: boolean, code: codeTab[] } {
        // 标签需要以tab:::开头，且开头不能有空格
        codeText = codeText.trim();
        if (codeText.startsWith('tab:::')) {
            // 用正则分割代码
            const codeArr = codeText.match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
            const codeResult: codeTab[] = [];
            for (let i = 0; i < codeArr.length; i++) {
                const codeSplitArr = codeArr[i].trim().split('\n');
                if (codeSplitArr.length === 1 || codeSplitArr.length === 2 && codeSplitArr[1].trim().startsWith('lang:::')) {
                    pushMsg(`${this.i18n.noCodeWhenCheckCode} (${i + 1})`).then();
                    return {result: false, code: []};
                }
                if (codeSplitArr[0].length < 7) {
                    pushMsg(`${this.i18n.noTitleWhenCheckCode} (${i + 1})`).then();
                    return {result: false, code: []};
                }
                const title = codeSplitArr[0].substring(6).trim();
                let language = '';
                if (codeSplitArr[1].trim().startsWith('lang:::')) {
                    const languageLine = codeSplitArr[1].trim();
                    if (languageLine.length < 8) {
                        pushMsg(`${this.i18n.noLangWhenCheckCode} (${i + 1})`).then();
                        return {result: false, code: []};
                    }
                    language = languageLine.substring(7).trim().toLowerCase();
                    // 获取语言类型后删除该行
                    codeSplitArr.splice(1, 1);
                }
                codeSplitArr.shift();
                const code = codeSplitArr.join('\n').trim();
                if (language === '') {
                    language = title;
                }
                language = hljs.getLanguage(language) ? language : 'plaintext';
                codeResult.push({
                    title: title,
                    language: language,
                    code: code
                });
            }
            return {result: true, code: codeResult}
        } else {
            pushMsg(this.i18n.headErrWhenCheckCode).then();
            return {result: false, code: []}
        }
    }

    /**
     * 生成HTMLBlock的dom字符串
     * @param id 要转换的代码块的data-node-id
     * @param codeArr 包含标签页中标题、语言类型和代码的数组
     * @return dom字符串
     * @private
     */
    private createHtmlBlock(id: string, codeArr: codeTab[]): string {
        const containerDiv = document.createElement('div');
        containerDiv.innerHTML = this.htmlBlockStr;
        const node = containerDiv.querySelector('.render-node') as HTMLElement;
        node.dataset.nodeId = id;
        const protyleHtml = containerDiv.querySelector('protyle-html') as HTMLElement;
        protyleHtml.dataset.content = this.createProtyleHtml(codeArr);
        return containerDiv.innerHTML;
    }

    /**
     * 生成HTMLBlock中 protyle-html 元素的data-content的dom字符串，即可直接在思源的HTMLBlock中编辑的dom字符串
     * @param codeArr 包含标签页中标题、语言类型和代码的数组
     * @return 转义后的dom字符串
     * @private
     */
    private createProtyleHtml(codeArr: codeTab[]): string {
        const containerDiv = document.createElement('div');
        containerDiv.innerHTML = this.protyleHtmlStr;
        const tabContainer = containerDiv.querySelector('.tabs-container') as HTMLElement;

        // tabs-outer 作为包含tabs和切换按钮的容器
        const tabsOuter = containerDiv.querySelector('.tabs-outer') as HTMLElement;
        // tabs 包含所有标签页的标题
        const tabs = containerDiv.querySelector('.tabs') as HTMLElement;
        // 为tabs设置滚动监听
        tabs.setAttribute('onwheel', 'pluginCodeTabs.wheelTag(event)')
        // tab-contents 包含所有标签页的内容
        const tabContents = containerDiv.querySelector('.tab-contents') as HTMLElement;
        // 解析代码块中的代码，将它们放到对应的标签页中
        // 通过tab::：分割不同的语言代码同时指定标题，通过lang:::指定语言类型
        // 通过前面的trim和startsWith过滤可以保证此时字符串一定以tab:::开头
        let activeIndex = 0;
        for (let i = 0; i < codeArr.length; i++) {
            let title = codeArr[i].title;
            const language = codeArr[i].language;
            const code = codeArr[i].code;
            if (title.split(':::active').length > 1) {
                title = title.split(':::active')[0].trim();
                activeIndex = i;
            }

            // 填充标签
            const tab = document.createElement("div");
            tab.className = "tab-item";
            tab.textContent = title;
            tab.title = title;
            tab.setAttribute('onclick', 'pluginCodeTabs.openTag(event)');
            // if (i === 1) tab.classList.add("tab-item--active");
            tabs.appendChild(tab);

            // 填充对应的标签页内容
            const content = document.createElement('div');
            content.className = "tab-content hljs";
            // if (i === 1) content.classList.add("tab-content--active");
            content.dataset.render = "true";
            let hlText = code;
            // 如果语言被支持，则进行格式处理，否则按纯文本处理，其中markdown单独使用marked处理
            if (language === 'markdown') {
                const marked = new Marked(
                    markedHighlight({
                        langPrefix: 'hljs language-',
                        highlight(code, lang) {
                            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                            return hljs.highlight(code, {language}).value;
                        }
                    })
                );
                const options = {
                    throwOnError: false
                };
                marked.use(markedKatex(options));
                hlText = marked.parse(code) as string;
                hlText = `<div class="markdown-body">${hlText}</div>`;
            } else {
                hlText = hljs.highlight(code, {language: language, ignoreIllegals: true}).value;
                hlText = `<div class="code language-${language}" style="white-space: pre-wrap;">${hlText}</div>`;
            }
            content.innerHTML = hlText;
            tabContents.appendChild(content);
        }
        // 设定默认激活的标签
        tabs.children[activeIndex].classList.add('tab-item--active');
        // tabContents中的第一个元素是复制按钮
        tabContents.children[activeIndex + 1].classList.add('tab-content--active');
        // 最后添加自定义内容
        // 切换键，用来将标签页切回代码块
        const tabToggle = containerDiv.querySelector('.tab-toggle') as HTMLElement
        tabToggle.setAttribute('onclick', 'pluginCodeTabs.toggle(event)');
        tabToggle.textContent = this.i18n.toggleToCode;        // 将tabs和tabToggle装入tabsOuter
        tabsOuter.appendChild(tabs);
        tabsOuter.appendChild(tabToggle);

        tabContainer.appendChild(tabsOuter);
        tabContainer.appendChild(tabContents);
        return this.escapeHtml(containerDiv.innerHTML);
    }

    /**
     * 转义dom字符串中的特殊字符
     * @param input 要转义的字符串
     * @return 转义后的字符串
     * @private
     */
    private escapeHtml(input: string): string {
        /* 不转义尖括号刚好能正常运行 */
        return input.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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
                // fetch时禁用缓存，避免后续文件判断逻辑因缓存而出错
                const response = await this.fetchWithRetry(route, {
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                if (!response.ok) {
                    return undefined;
                }
                const blob = await response.blob();
                file = new File([blob], fileName, {type: blob.type});
            }
            return file;
        } catch (error) {
            logger.error(`fetchFileFromUrl: ${route}, error: ${error}`);
        }
    }

    /**
     * 设置fetch失败重连
     * @param route
     * @param options fetch选项
     * @param retries 最大重连次数
     * @param delay 重连间隔
     * @private
     */
    private async fetchWithRetry(route: string, options: RequestInit = {}, retries: number = 3, delay: number = 1000): Promise<Response> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const baseUrl = document.querySelector('base#baseURL')?.getAttribute('href');
                // const baseUrl = "http://127.0.0.1:6806";
                const url = baseUrl + route;
                logger.info(`fetching: ${url}`);
                const response = await fetch(url, options);
                if (!response.ok) {
                    // 获取插件的样式文件时返回404表示文件不存在，不需要重试
                    if (response.status === 404) {
                        if (route === '/plugins/code-tabs/code-style.css' || route === '/plugins/code-tabs/background.css') {
                            logger.warn(`plugin style file not found: ${route}`);
                            return response;
                        }
                    }
                    logger.info(`fetch error with: ${url} ${response.status}`);
                    throw new Error(`http error: ${response.status}`);
                }
                logger.info(`fetch successes: ${url}`);
                return response;
            } catch (error) {
                if (attempt < retries - 1) {
                    logger.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
                } else {
                    logger.error('All retries failed');
                    throw error;
                }
            }
        }
    }

    /**
     * 在思源的主题或代码样式改变时重新配置code-tabs的样式文件
     * @private
     */
    private async putStyleFile() {
        // 配置代码样式文件
        const codeStyle = document.querySelector('link#protyleHljsStyle')?.getAttribute('href');
        const fileCodeStyle = await this.fetchFileFromUrl(codeStyle, 'code-style.css');
        await putFile('/data/plugins/code-tabs/code-style.css', false, fileCodeStyle);
        // 配置代码背景色样式文件
        const style = await this.getCodeBlockStyle();
        const cssContent = `
.tabs-container {
  border: ${style.border}; 
  border-radius: ${style.borderRadius};
  box-shadow: ${style.boxShadow};
  padding: ${style.blockPadding};
  margin: ${style.blockMargin};
  background-color: ${style.blockBg};
}
.tabs {
  background-color: ${style.protyleActionBg};
}
.tab-toggle {
  background-color: ${style.protyleActionBg};
}
.tab-contents > .hljs { 
  padding: ${style.hljsPadding};
  margin: ${style.hljsMargin};
  background-color: ${style.hljsBg}; 
  font-family: ${style.fontFamily};
}
.tab-contents > .hljs > .tab-content {
  padding: ${style.editablePadding};
  margin: ${style.editableMargin};
  background-color: ${style.editableBg};
}
`;
        const blob = new Blob([cssContent], {type: 'text/css'});
        const fileBackgroundStyle = new File([blob], 'styles.css', {type: 'text/css'});
        await putFile('/data/plugins/code-tabs/background.css', false, fileBackgroundStyle);
        // 配置代码中markdown的样式文件
        const mode = document.documentElement.getAttribute('data-theme-mode');
        if (mode === 'dark') {
            const darkModeFile = await this.fetchFileFromUrl('/plugins/code-tabs/asset/github-markdown-dark.css', 'github-markdown.css');
            await putFile('/data/plugins/code-tabs/github-markdown.css', false, darkModeFile);
        } else {
            const lightModeFile = await this.fetchFileFromUrl('/plugins/code-tabs/asset/github-markdown-light.css', 'github-markdown.css');
            await putFile('/data/plugins/code-tabs/github-markdown.css', false, lightModeFile);
        }
    }

    /**
     * 简单粗暴的获取当前文档主题下的代码块背景颜色和其它样式
     * @private
     */
    private async getCodeBlockStyle() {
        /* 先插入一个新的临时代码块，获取代码块的背景颜色后再删除它 */
        let protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
        logger.info(protyle);
        let block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
        logger.info(block);
        let i = 0;
        while (block == undefined || block.childElementCount === 0) {
            // 有时切换主题时速度太快会导致代码运行到这里时文档还没有加载完成，需要再等待一会重试
            await new Promise(resolve => setTimeout(resolve, 300));
            protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
            block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
            // 重试7次之后不管成功与否都直接退出
            i++;
            if (i > 6) {
                break;
            }
        }
        block = block?.lastChild as HTMLElement;
        const id = block?.dataset.nodeId;
        if (id === undefined) {
            pushErrMsg(this.i18n.errMsgGetBackground).then();
            return {
                blockBg: "rgb(248, 249, 250)",
                protyleActionBg: "transparent",
                hljsBg: "rgb(248, 249, 250)",
                editableBg: "rgb(248, 249, 250)",
                fontFamily: '"JetBrainsMono-Regular", mononoki, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                blockPadding: "2em 1em",
                hljsPadding: "0",
                editablePadding: "0",
                blockMargin: "1em, 0",
                hljsMargin: "0",
                editableMargin: "0",
                border: "none",
                boxShadow: "none",
                borderRadius: "6px"
            };
        }
        const result = await insertBlock("markdown", "\`\`\`python\nprint(\"code-tabs: temp block\")\n", '', id, '');
        logger.info("insert a temp code-block");
        const tempId = result[0].doOperations[0].id;
        // 背景色一般就在NodeCodeBlock这个元素或者包含hljs类的那个子元素上，官方主题在hljs类上，一些第三方主题在NodeCodeBlock这个元素上
        const blockElement = document.querySelector(`[data-node-id="${tempId}"][data-type="NodeCodeBlock"]`);
        const protyleActionElement = blockElement.querySelector('.protyle-action');
        const hljsElement = blockElement.querySelector('.hljs');
        const editableElement = blockElement.querySelector('[contenteditable="true"]');

        const protyleBg = window.getComputedStyle(protyle).backgroundColor;
        const blockBg = window.getComputedStyle(blockElement).backgroundColor;
        const protyleActionBg = window.getComputedStyle(protyleActionElement).backgroundColor;
        const hljsBg = window.getComputedStyle(hljsElement).backgroundColor;
        const editableBg = window.getComputedStyle(editableElement).backgroundColor;
        logger.info('protyle bg: ' + protyleBg);
        logger.info('node bg: ' + blockBg);
        logger.info('protyle-action bg: ' + protyleActionBg);
        logger.info('hljs bg: ' + hljsBg);
        logger.info('editable bg: ' + editableBg);
        const fontFamily = window.getComputedStyle(editableElement).fontFamily;
        let blockPadding = window.getComputedStyle(blockElement).padding;
        let hljsPadding = window.getComputedStyle(hljsElement).padding;
        const editablePadding = window.getComputedStyle(editableElement).padding;
        let [blockTop, blockRight, blockBottom, blockLeft] = this.parsePadding(blockPadding);
        let [hljsTop, hljsRight, hljsBottom, hljsLeft] = this.parsePadding(hljsPadding);
        const lineHeight = parseFloat(window.getComputedStyle(blockElement).lineHeight);
        blockTop = lineHeight + 22;
        logger.info('blockTop: ' + blockTop);
        blockPadding = `${blockTop}px ${blockRight}px ${blockBottom}px ${blockLeft}px`;
        hljsTop = hljsTop == 0 ? 8 : hljsTop;
        logger.info('hljsTop: ' + hljsTop);
        hljsPadding = `${hljsTop}px ${hljsRight}px ${hljsBottom}px ${hljsLeft}px`;
        const blockMargin = window.getComputedStyle(blockElement).margin;
        const hljsMargin = window.getComputedStyle(hljsElement).margin;
        const editableMargin = window.getComputedStyle(editableElement).margin;

        const border = window.getComputedStyle(blockElement).border;
        const boxShadow = window.getComputedStyle(blockElement).boxShadow;
        const borderRadius = window.getComputedStyle(blockElement).borderRadius;
        deleteBlock(tempId).then(() => logger.info("delete temp code-block"));
        return {
            blockBg: blockBg,
            protyleActionBg: protyleActionBg,
            hljsBg: hljsBg,
            editableBg: editableBg,
            fontFamily: fontFamily,
            blockPadding: blockPadding,
            hljsPadding: hljsPadding,
            editablePadding: editablePadding,
            blockMargin: blockMargin,
            hljsMargin: hljsMargin,
            editableMargin: editableMargin,
            border: border,
            boxShadow: boxShadow,
            borderRadius: borderRadius
        };
    }

    /**
     * 用来解析padding的值
     * @param padding 通过getComputedStyle()获取的padding值
     * @private
     */
    private parsePadding(padding: string) {
        const paddings = padding.split(' ').map(value => parseInt(value, 10));

        let paddingTop: number;
        let paddingRight: number;
        let paddingBottom: number;
        let paddingLeft: number;

        switch (paddings.length) {
            case 1:
                // padding: 10px
                paddingTop = paddings[0];
                paddingRight = paddings[0];
                paddingBottom = paddings[0];
                paddingLeft = paddings[0];
                break;
            case 2:
                // padding: 10px 20px
                paddingTop = paddings[0];
                paddingRight = paddings[1];
                paddingBottom = paddings[0];
                paddingLeft = paddings[1];
                break;
            case 3:
                // padding: 10px 20px 30px
                paddingTop = paddings[0];
                paddingRight = paddings[1];
                paddingBottom = paddings[2];
                paddingLeft = paddings[1];
                break;
            case 4:
                // padding: 10px 20px 30px 40px
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = paddings;
                break;
            default:
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = [0, 0, 0, 0];
        }

        return [paddingTop, paddingRight, paddingBottom, paddingLeft];
    }

    /**
     * 更新已打开文档中所有代码标签页的css链接，为它们加上查询参数。
     * 用来避免因缓存导致的样式更新不及时，关闭文档后链接会自动还原
     * @private
     */
    private updateAllTabsStyle() {
        document.querySelectorAll('[data-type="NodeHTMLBlock"][custom-plugin-code-tabs-sourcecode]').forEach(node => {
            const shadowRoot = node.querySelector('protyle-html').shadowRoot;
            shadowRoot.querySelectorAll('link').forEach(link => {
                const currentHref = link.href;
                const currentTime = Date.now().toString();
                const url = new URL(currentHref);
                url.searchParams.set('t', currentTime);
                link.href = url.pathname + url.search;
            });
        });
    }

    /**
     * 获取思源的设置
     * @private
     */
    private getSiyuanConfig() {
        return {
            fontSize: window.siyuan.config.editor.fontSize,
            mode: window.siyuan.config.appearance.mode,
            themeLight: window.siyuan.config.appearance.themeLight,
            themeDark: window.siyuan.config.appearance.themeDark,
            codeBlockThemeLight: window.siyuan.config.appearance.codeBlockThemeLight,
            codeBlockThemeDark: window.siyuan.config.appearance.codeBlockThemeDark
        }
    }

    /**
     * 将思源的配置同步到插件的data中
     * @private
     */
    private syncSiyuanConfig() {
        const properties = this.getSiyuanConfig();
        Object.keys(properties).forEach(key => {
            Object.defineProperty(this.data, key, {
                value: properties[key],
                writable: true,
                enumerable: true
            });
        });
    }

    /**
     * 将配置写入到插件根目录的配置文件中
     * @private
     */
    private async saveConfig() {
        this.syncSiyuanConfig();
        const file = new File([JSON.stringify(this.data)], 'config.json', {type: 'application/json'});
        await putFile('/data/plugins/code-tabs/config.json', false, file);
    }

    /**
     * 对比思源的配置和插件的配置是否相同
     * @param pluginConfig
     * @param siyuanConfig
     * @private
     */
    private compareConfig(pluginConfig: Object, siyuanConfig: Object) {
        // 获取对象的所有属性名
        const pluginKeys = Object.keys(pluginConfig);
        const siyuanKeys = Object.keys(siyuanConfig);

        // 比较属性数量是否相同
        if (pluginKeys.length !== siyuanKeys.length) {
            return false;
        }
        // 比较每个属性的值是否相同
        for (const key of siyuanKeys) {
            if (pluginConfig[key] !== siyuanConfig[key]) {
                return false;
            }
        }
        return true;
    }

    /**
     * 将代码标签页要用到的函数全都绑定到一个全局变量上
     * @private
     */
    private addFunctionForCodeTabs() {
        window.pluginCodeTabs = {
            openTag: function (evt: MouseEvent) {
                const clicked = evt.target as HTMLElement;
                const tabContainer = this.getTabContainer(clicked);
                const tabItems = tabContainer.querySelectorAll('.tab-item');
                const tabContents = tabContainer.querySelectorAll('.tab-content');
                tabItems.forEach((tabItem: HTMLElement, index: number) => {
                    if (tabItem === clicked) {
                        tabItem.classList.add('tab-item--active');
                        tabContents[index].classList.add('tab-content--active');
                    } else {
                        tabItem.classList.remove('tab-item--active');
                        tabContents[index].classList.remove('tab-content--active');
                    }
                });
            },

            copyCode: function (evt: MouseEvent) {
                const tabContainer = this.getTabContainer(evt.target);
                const tabContent = tabContainer.querySelector('.tab-content--active');
                const textContent = tabContent.textContent;
                if (textContent) {
                    // 使用 Clipboard API 复制文本内容到剪贴板
                    navigator.clipboard.writeText(textContent).then(() => {
                        pushMsg("已复制到剪贴板(Copied to clipboard)", 2000).then();
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                }
            },

            toggle: function (evt: MouseEvent) {
                const htmlBlock = this.getHtmlBlock(evt.target);
                const nodeId = htmlBlock.dataset.nodeId;
                getBlockAttrs(nodeId).then(res => {
                    // 切回代码块时要将自定义属性的字符串中的零宽空格还原成换行符
                    let codeText = res['custom-plugin-code-tabs-sourcecode'].replace(/\u200b/g, '\n');
                    if (codeText[codeText.length - 1] !== '\n') {
                        codeText = codeText + '\n';
                    }
                    const flag = "```````````````````````````";
                    updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
                        logger.info('标签页转为代码块');
                    });
                });
            },

            wheelTag: function (evt: WheelEvent) {
                let target = evt.target as HTMLElement;
                if(target.classList.contains('tab-item')) {
                    target = target.parentElement;
                }
                evt.preventDefault(); // 阻止默认滚动行为
                const hasHorizontalScroll = target.scrollWidth > target.clientWidth;
                if(hasHorizontalScroll) {
                    target.scrollLeft += evt.deltaY; // 横向滚动
                }
            },

            getHtmlBlock: function (element: Node) {
                let parent = element;
                while (parent.parentNode) {
                    parent = parent.parentNode;
                }
                return (parent as ShadowRoot).host.parentNode.parentNode;
            },

            getTabContainer: function (element: Node) {
                return element.parentNode.parentNode.parentNode;
            }
        }
    }
}