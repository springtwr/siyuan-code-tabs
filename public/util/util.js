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
    const nodeId = shadowRoot.querySelector('.tabs-container').id;
    const codeText = shadowRoot.querySelector('.tab-sourcecode').textContent;
    appendBlock("markdown", `\`\`\`tab\n${codeText}\`\`\``, nodeId).then(() => {
        deleteBlock(nodeId).then();
    })
}

async function appendBlock(dataType, data, parentID) {
    let payload = {
        dataType,
        data,
        parentID
    }
    let url = '/api/block/appendBlock';
    return request(url, payload);
}

async function deleteBlock(id) {
    let data = {
        id: id
    }
    let url = '/api/block/deleteBlock';
    return request(url, data);
}

async function request(urlSuffix, data) {
    const baseUrl = 'http://127.0.0.1:6806';
    const url = baseUrl + urlSuffix;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (response.code === 0) {
            return await response;
        }
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
        throw error;
    }
}
