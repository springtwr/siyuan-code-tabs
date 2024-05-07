import {Plugin} from "siyuan";
import "@/index.scss";
import {insertBlock, deleteBlock, updateBlock} from "@/api";
import hljs from 'highlight.js';

export default class CodeTabs extends Plugin {
    private blockIconEventBindThis = this.blockIconEvent.bind(this);

    async onload() {
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        console.log("loading code-tabs");
        console.log(this.i18n.helloPlugin);
        // this.protyleSlash
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall code-tabs");
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            iconHTML: "",
            label: this.i18n.codeToTabs,
            click: () => {
                // const doOperations: IOperation[] = [];
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement && item.getAttribute("data-type") === "NodeCodeBlock") {
                        const codeText = editElement.textContent;
                        // 创建思源笔记中的HTMLBlock
                        const htmlBlock = this.createHtmlBlock(item.dataset);
                        const tabsHtml = this.createHtmlContent();
                        let tabsHtmlContent = htmlBlock.querySelector('[data-content]');
                        tabsHtmlContent.attributes[0].textContent = tabsHtml.outerHTML;
                        // tabsHtmlContent.setAttribute('data-content', tabsHtml.outerHTML);
                        // 更新代码块
                        if (codeText.split("tab:").length > 1) {
                            this.update(htmlBlock.outerHTML, item.dataset.nodeId, codeText).then(() => {
                                console.log("更新代码块");
                            });
                        }
                    }
                });
            }
        });
    }

    private async update(outerHTML: string, nodeId: string, codeText: string) {
        updateBlock("dom", outerHTML, nodeId).then(() => {
            const nod = document.documentElement.getElementsByClassName("protyle-wysiwyg protyle-wysiwyg--attr")[0].querySelector(`[data-node-id="${nodeId}"]`);
            const shadow = nod.querySelector('[data-content]').shadowRoot;
            // 创建标签页
            const tabContainer = this.createTabs(codeText, shadow.querySelector('.tab-container'));
            const codeContents = tabContainer.querySelectorAll('pre code');
            codeContents.forEach((code: HTMLPreElement) => {
                hljs.highlightElement(code);
            });
            shadow.host.setAttribute("data-content", shadow.innerHTML.replace(/&lt;/g, '&amp;lt;').replace(/&gt;/g, '&amp;gt;'));
            const toggleSwitch = shadow.querySelector('.tab-item--toggle');
            if (toggleSwitch) {
                // 添加监听
                toggleSwitch.addEventListener('click', () => {
                    // 在这里编写你的事件处理逻辑
                    this.toggleToCode(nod);
                });
            } else {
                console.error('Element with ID "myElement" not found.');
            }
        });
    }

    private toggleToCode(htmlBlock: Element) {
        const codeText = htmlBlock.getElementsByTagName('protyle-html')[0].shadowRoot.querySelector('.tab-content--sourcecode').textContent;
        const nodeId = htmlBlock.getAttribute("data-node-id");
        insertBlock("markdown", `\`\`\`tab\n${codeText}\`\`\``, nodeId).then(() => {
            deleteBlock(nodeId).then();
        })
    }

    private getCurrentTime() {
        // 获取当前时间
        const currentDate = new Date();
        // 获取当前时间的年、月、日、小时、分钟和秒
        const currentYear = currentDate.getFullYear();
        const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const currentDay = currentDate.getDate().toString().padStart(2, '0');
        const currentHour = currentDate.getHours().toString().padStart(2, '0');
        const currentMinute = currentDate.getMinutes().toString().padStart(2, '0');
        const currentSecond = currentDate.getSeconds().toString().padStart(2, '0');
        // 格式化当前时间
        return `${currentYear}${currentMonth}${currentDay}${currentHour}${currentMinute}${currentSecond}`;
    }

    private createHtmlBlock(dataSet: DOMStringMap) {
        //create HtmlNode
        const formattedCurrentTime = this.getCurrentTime();
        // 创建html块
        const htmlBlock = document.createElement('div');
        // 设置父级 div 元素的属性
        htmlBlock.setAttribute('data-node-id', dataSet.nodeId);
        htmlBlock.setAttribute('data-node-index', '1');
        htmlBlock.setAttribute('data-type', "NodeHTMLBlock");
        htmlBlock.setAttribute('class', 'render-node block-focus');
        htmlBlock.setAttribute('updated', formattedCurrentTime);
        htmlBlock.setAttribute('data-subtype', 'block');
        // 创建包含“编辑”和“更多”按钮 的 div 元素
        const iconsDiv = document.createElement('div');
        iconsDiv.setAttribute('class', 'protyle-icons');
        // 创建“编辑”按钮
        const editIcon = document.createElement('span');
        editIcon.setAttribute('class', 'b3-tooltips__nw b3-tooltips protyle-icon protyle-icon--first protyle-action__edit');
        editIcon.setAttribute('aria-label', '编辑');
        const iconEditSvg = document.createElement('svg');
        const iconEditLink = document.createElement('use');
        iconEditLink.setAttribute('xlink:href', '#iconEdit');
        iconEditSvg.appendChild(iconEditLink);
        editIcon.appendChild(iconEditSvg);
        // 创建“更多”按钮
        const moreIcon = document.createElement('span');
        moreIcon.setAttribute('class', 'b3-tooltips__nw b3-tooltips protyle-icon protyle-action__menu protyle-icon--last');
        moreIcon.setAttribute('aria-label', '更多');
        const iconMoreSvg = document.createElement('svg');
        const iconMoreLink = document.createElement('use');
        iconMoreLink.setAttribute('xlink:href', '#iconMore');
        iconMoreSvg.appendChild(iconMoreLink);
        moreIcon.appendChild(iconMoreSvg);
        //将创建好的两个按钮添加到div元素
        iconsDiv.appendChild(editIcon);
        iconsDiv.appendChild(moreIcon);
        // 创建包含标签的 div 元素
        const tabsDiv = document.createElement('div');
        const tabsContentElement = document.createElement('protyle-html');
        tabsContentElement.setAttribute('data-content', '<p>test for code-tabs</p>');
        const positionSpan = document.createElement('span');
        positionSpan.setAttribute('style', 'position: absolute');
        tabsDiv.appendChild(tabsContentElement);
        tabsDiv.appendChild(positionSpan);
        // 创建包含特定属性的 div 元素
        const attrDiv = document.createElement('div');
        attrDiv.setAttribute('class', 'protyle-attr');
        attrDiv.setAttribute('contenteditable', 'false');
        // 将所有元素添加到父级 div 元素中
        htmlBlock.appendChild(iconsDiv);
        htmlBlock.appendChild(tabsDiv)
        htmlBlock.appendChild(attrDiv);
        return htmlBlock;
    }

    private createTabs(textContent: string, tabContainer) {
        // tabsTag 包含所有标签页的标题
        let tabsTag = document.createElement("div");
        tabsTag.className = "tabs";
        // contentsTag 包含所有标签页的内容
        let contentsTag = document.createElement("div");
        contentsTag.className = "tab-contents";
        tabContainer.appendChild(tabsTag);
        tabContainer.appendChild(contentsTag);

        // 解析代码块中的代码，将它们放到对应的标签页中
        let codeTagTextArray = textContent.split("tab:");
        for (let i = 1; i < codeTagTextArray.length; i++) {
            // fill up tabs
            let language = codeTagTextArray[i].substring(
                0,
                codeTagTextArray[i].indexOf("\n")
            );
            let tabItemTag = document.createElement("div");
            tabItemTag.className = "tab-item";
            tabItemTag.textContent = language;
            tabItemTag.setAttribute('onclick', 'openTag(event)');
            if (i === 1) tabItemTag.classList.add("tab-item--active");
            tabsTag.appendChild(tabItemTag);

            // fill up tab-contents
            let codeText = codeTagTextArray[i].substring(
                codeTagTextArray[i].indexOf("\n") + 1
            );
            let tabContentTag = document.createElement('div');
            tabContentTag.className = "tab-content";
            let codeElement = document.createElement('code');
            codeElement.className = 'language-' + language;
            codeElement.innerHTML = codeText.replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd();
            let preElement = document.createElement('pre');
            preElement.appendChild(codeElement);
            tabContentTag.appendChild(preElement);
            if (i === 1) tabContentTag.classList.add("tab-content--active");
            contentsTag.appendChild(tabContentTag);

            // 最后添加自定义内容
            if (i === codeTagTextArray.length - 1) {
                let tabCustomTag = document.createElement("div");
                tabCustomTag.className = "tab-item";
                tabCustomTag.classList.add("tab-item--toggle");
                tabCustomTag.textContent = this.i18n.toggleToCode;
                tabsTag.appendChild(tabCustomTag);
                let tabSourceCode = document.createElement('div');
                tabSourceCode.className = "tab-content";
                tabSourceCode.classList.add("tab-content--sourcecode");
                tabSourceCode.textContent = textContent;
                contentsTag.appendChild(tabSourceCode);
            }
        }
        return tabContainer
    }

    private createHtmlContent() {
        const parentDiv = document.createElement('div');
        const title = document.createElement('title');
        title.textContent = "code-tabs"
        // 创建引用标签样式表和highlight.js的元素
        const highlightCss = document.createElement('link');
        highlightCss.rel = "stylesheet";
        highlightCss.href = "/stage/protyle/js/highlight.js/styles/idea.min.css";
        const tabsCss = document.createElement('link');
        tabsCss.rel = "stylesheet";
        tabsCss.href = "/plugins/code-tabs/index.css";
        // const highlightScript = document.createElement('script');
        // highlightScript.src = "/stage/protyle/js/highlight.js/highlight.min.js";
        parentDiv.appendChild(highlightCss);
        parentDiv.appendChild(tabsCss);
        // parentDiv.appendChild(highlightScript);
        // 将所有标签页添加到HTMLBlock中
        const contentDiv = document.createElement('div');
        contentDiv.className = "tab-container";
        parentDiv.appendChild(contentDiv);

        const tabsScript = document.createElement('script');
        tabsScript.textContent = `function openTag(evt) {
    let tabContainer = evt.target.parentNode.parentNode;
    let tabItemTags = tabContainer.querySelectorAll(".tab-item");
    let tabContentTags = tabContainer.querySelectorAll(".tab-content");
    for (let i = 0; i < tabItemTags.length-1; i++) {
        if (tabItemTags[i] === evt.target) {
            tabItemTags[i].classList.add("tab-item--active");
            tabContentTags[i].classList.add("tab-content--active");
        } else {
            tabItemTags[i].classList.remove("tab-item--active");
            tabContentTags[i].classList.remove("tab-content--active");
        }
    }
}`;
        parentDiv.appendChild(tabsScript);
        return parentDiv;
    }
}
