export function createTabContainer(
    options: {
        tabCount?: number;
        containerWidth?: number;
        activeIndex?: number;
    } = {}
): HTMLElement {
    const { tabCount = 3, containerWidth = 500, activeIndex = 0 } = options;
    
    const container = document.createElement("div");
    container.className = "tabs-container";
    container.style.width = `${containerWidth}px`;
    
    const tabsOuter = document.createElement("div");
    tabsOuter.className = "tabs-outer";
    
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    
    for (let i = 0; i < tabCount; i++) {
        const tab = document.createElement("div");
        tab.className = "tab-item";
        tab.setAttribute("data-index", String(i));
        tab.textContent = `Tab ${i + 1}`;
        
        if (i === activeIndex) {
            tab.classList.add("tab-item--active");
        }
        
        Object.defineProperty(tab, "offsetWidth", {
            value: 100,
            configurable: true,
        });
        
        tabs.appendChild(tab);
    }
    
    tabsOuter.appendChild(tabs);
    container.appendChild(tabsOuter);
    
    const tabContents = document.createElement("div");
    tabContents.className = "tab-contents";
    container.appendChild(tabContents);
    
    return container;
}

export function createEditorPanel(options: { visible?: boolean } = {}): HTMLElement {
    const { visible = true } = options;
    
    const panel = document.createElement("div");
    panel.className = "code-tabs-editor-panel";
    panel.style.display = visible ? "block" : "none";
    
    const header = document.createElement("div");
    header.className = "editor-header";
    panel.appendChild(header);
    
    const content = document.createElement("div");
    content.className = "editor-content";
    panel.appendChild(content);
    
    return panel;
}

export function createProtyleStructure(): HTMLElement {
    const protyle = document.createElement("div");
    protyle.className = "protyle";
    
    const wysiwyg = document.createElement("div");
    wysiwyg.className = "protyle-wysiwyg";
    protyle.appendChild(wysiwyg);
    
    const content = document.createElement("div");
    content.className = "protyle-content";
    content.setAttribute("data-node-id", "test-node-id");
    wysiwyg.appendChild(content);
    
    const codeBlock = document.createElement("div");
    codeBlock.className = "protyle-code";
    codeBlock.setAttribute("data-type", "NodeCodeBlock");
    content.appendChild(codeBlock);
    
    return protyle;
}

export function cleanupTestDOM(): void {
    const containers = document.querySelectorAll(".tabs-container");
    containers.forEach((container) => container.remove());
    
    const panels = document.querySelectorAll(".code-tabs-editor-panel");
    panels.forEach((panel) => panel.remove());
    
    const protyles = document.querySelectorAll(".protyle");
    protyles.forEach((protyle) => protyle.remove());
}

export function createMockElement(
    tagName: string,
    options: {
        className?: string;
        attributes?: Record<string, string>;
        textContent?: string;
        style?: Record<string, string>;
    } = {}
): HTMLElement {
    const { className, attributes, textContent, style } = options;
    
    const element = document.createElement(tagName);
    
    if (className) {
        element.className = className;
    }
    
    if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    if (style) {
        Object.entries(style).forEach(([key, value]) => {
            element.style.setProperty(key, value);
        });
    }
    
    return element;
}
