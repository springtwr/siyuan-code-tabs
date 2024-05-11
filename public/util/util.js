function openTag(evt) {
    let tabContainer = evt.target.parentNode.parentNode;
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

    // const nodeId = shadowRoot.querySelector('.tabs-container').id;
    // const codeText = shadowRoot.querySelector('.tab-sourcecode').textContent;
    getBlockAttrs(nodeId).then(res => {
        const codeText = res['custom-plugin-code-tabs-sourcecode'];
        const flag = "```````````````````````````";
        updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
            console.log("code-tabs: 标签页转为代码块");
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
