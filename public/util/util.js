window.pluginCodeTabs = {
    debounce: function (func, wait) {
        let timeout = null;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    updateTabPosition: function (clicked) {
        this.log("info", "更新标签位置");
        const htmlBlock = this.getHtmlBlock(clicked);
        const nodeId = htmlBlock.dataset.nodeId;
        const protyle = htmlBlock.querySelector('protyle-html');
        const shadowRoot = protyle.shadowRoot;
        protyle.dataset.content = shadowRoot.innerHTML;
        this.updateBlock('dom', htmlBlock.outerHTML, nodeId).then();
    },

    openTag: function (evt) {
        const clicked = evt.target;
        const tabContainer = this.getTabContainer(clicked);
        const tabItems = tabContainer.querySelectorAll('.tab-item');
        const tabContents = tabContainer.querySelectorAll('.tab-content');
        tabItems.forEach((tabItem, index) => {
            if (tabItem === clicked) {
                tabItem.classList.add('tab-item--active');
                tabContents[index].classList.add('tab-content--active');
            } else {
                tabItem.classList.remove('tab-item--active');
                tabContents[index].classList.remove('tab-content--active');
            }
        });
        // 使用防抖函数保证在至少1秒内没有切换标签页时才使用api更新HTML块
        this.Debounced(clicked);
    },

    copyCode: function (evt) {
        const tabContainer = this.getTabContainer(evt.target);
        const tabContent = tabContainer.querySelector('.tab-content--active');
        const textContent = tabContent.textContent;
        if (textContent) {
            // 使用 Clipboard API 复制文本内容到剪贴板
            navigator.clipboard.writeText(textContent).then(() => {
                this.pushMsg("已复制到剪贴板(Copied to clipboard)", 2000).then();
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    },

    toggle: function (evt) {
        const htmlBlock = this.getHtmlBlock(evt.target);
        const nodeId = htmlBlock.dataset.nodeId;
        this.getBlockAttrs(nodeId).then(res => {
            // 切回代码块时要将自定义属性的字符串中的零宽空格还原成换行符
            const codeText = res['custom-plugin-code-tabs-sourcecode'].replace(/\u200b/g, '\n');
            const flag = "```````````````````````````";
            this.updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
                this.log('info', '标签页转为代码块');
            });
        });
    },

    getHtmlBlock: function (element) {
        let parent = element;
        while (parent.parentNode) {
            parent = parent.parentNode;
        }
        return parent.host.parentNode.parentNode;
    },

    getTabContainer: function (element) {
        return element.parentNode.parentNode;
    },

    getBlockAttrs: async function (id) {
        let data = {
            id: id
        }
        let url = '/api/attr/getBlockAttrs';
        return this.request(url, data);
    },

    updateBlock: async function (dataType, data, id) {
        let payload = {
            dataType: dataType,
            data: data,
            id: id
        }
        let url = '/api/block/updateBlock';
        return this.request(url, payload);
    },

    pushMsg: async function (msg, timeout = 7000) {
        let payload = {
            msg: msg,
            timeout: timeout
        };
        let url = "/api/notification/pushMsg";
        return this.request(url, payload);
    },

    request: async function (route, data) {
        const baseUrl = 'http://127.0.0.1:6806';
        const url = baseUrl + route;
        try {
            const response = await fetch(url, {
                method: 'POST', headers: {
                    'Content-Type': 'application/json',
                }, body: JSON.stringify(data),
            });
            const resData = await response.json();
            return resData.code === 0 ? resData.data : null;
        } catch (error) {
            console.error('There has been a problem with your fetch operation:', error);
            throw error;
        }
    },

    log: function (level, message) {
        if (window.CODE_TABS_DEV_MODE !== 'true') {
            return;
        }
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [code-tabs] [${level.toUpperCase()}]: ${message}`;
        console.log(logMessage);
    }
}
window.pluginCodeTabs.Debounced = window.pluginCodeTabs.debounce(window.pluginCodeTabs.updateTabPosition, 1000);
