function openTag(evt) {
    const tabContainer = evt.target.parentNode.parentNode;
    const tabItems = tabContainer.querySelectorAll('.tab-item');
    const tabContents = tabContainer.querySelectorAll('.tab-content');
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

function copyCode(evt) {
    const tabContainer = evt.target.parentNode.parentNode;
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
}

function toggle(evt) {
    const findRootParent = (element) => {
        let parent = element;
        while (parent.parentNode) {
            parent = parent.parentNode;
        }
        return parent;
    }
    const shadowRoot = findRootParent(evt.target);
    const htmlBlock = shadowRoot.host.parentNode.parentNode;
    const nodeId = htmlBlock.dataset.nodeId;
    getBlockAttrs(nodeId).then(res => {
        const codeText = res['custom-plugin-code-tabs-sourcecode'];
        const flag = "```````````````````````````";
        updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
            const timestamp = new Date().toISOString();
            log('info', '标签页转为代码块');
        });
    });
}

async function getBlockAttrs(id) {
    let data = {
        id: id
    }
    let url = '/api/attr/getBlockAttrs';
    return request(url, data);
}

async function updateBlock(dataType, data, id) {
    let payload = {
        dataType: dataType,
        data: data,
        id: id
    }
    let url = '/api/block/updateBlock';
    return request(url, payload);
}

async function pushMsg(msg, timeout = 7000) {
    let payload = {
        msg: msg,
        timeout: timeout
    };
    let url = "/api/notification/pushMsg";
    return request(url, payload);
}

async function request(route, data) {
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
}

function log(level, message) {
    if (window.CODE_TABS_DEV_MODE !== 'true') {
        return;
    }
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [code-tabs] [${level.toUpperCase()}]: ${message}`;
    console.log(logMessage);
}
