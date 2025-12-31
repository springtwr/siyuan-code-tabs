/**
 * 通用 DOM 操作工具函数
 */

/**
 * 获取 ShadowRoot
 */
export function getShadowRoot(element: HTMLElement): ShadowRoot | null {
    let parent: Node = element;
    while (parent && parent.parentNode) {
        parent = parent.parentNode;
    }
    if (!parent || !(parent instanceof ShadowRoot)) return null;
    return parent as ShadowRoot;
}

/**
 * 获取 ShadowRoot 的宿主元素
 */
export function getShadowHost(shadowRoot: ShadowRoot): HTMLElement | null {
    const host = shadowRoot.host;
    if (!host || !host.parentNode || !host.parentNode.parentNode) return null;
    return host.parentNode.parentNode as HTMLElement;
}

/**
 * 获取 ShadowRoot 中的节点 ID
 */
export function getNodeIdFromShadow(element: HTMLElement): string | null {
    const shadowRoot = getShadowRoot(element);
    if (!shadowRoot) return null;
    const host = getShadowHost(shadowRoot);
    if (!host) return null;
    return host.dataset.nodeId || null;
}

/**
 * 获取节点 ID（支持普通和 Shadow DOM）
 */
export function getNodeId(element: HTMLElement): string | null {
    // 尝试从 Shadow DOM 获取
    const nodeIdFromShadow = getNodeIdFromShadow(element);
    if (nodeIdFromShadow) return nodeIdFromShadow;
    
    // 尝试从普通 DOM 获取
    return element.dataset.nodeId || null;
}

/**
 * 比较两个对象的配置
 */
export function compareConfig(pluginConfig: any, siyuanConfig: any): boolean {
    const pluginKeys = Object.keys(pluginConfig);
    const siyuanKeys = Object.keys(siyuanConfig);
    if (pluginKeys.length !== siyuanKeys.length) return false;
    for (const key of siyuanKeys) {
        if (pluginConfig[key] !== siyuanConfig[key]) return false;
    }
    return true;
}

/**
 * 获取思源配置
 */
export function getSiyuanConfig(): any {
    return {
        fontSize: window.siyuan.config.editor.fontSize,
        mode: window.siyuan.config.appearance.mode,
        themeLight: window.siyuan.config.appearance.themeLight,
        themeDark: window.siyuan.config.appearance.themeDark,
        codeBlockThemeLight: window.siyuan.config.appearance.codeBlockThemeLight,
        codeBlockThemeDark: window.siyuan.config.appearance.codeBlockThemeDark
    };
}

/**
 * 同步思源配置
 */
export function syncSiyuanConfig(data: any): void {
    const properties = getSiyuanConfig();
    Object.keys(properties).forEach(key => {
        Object.defineProperty(data, key, {
            value: properties[key],
            writable: true,
            enumerable: true
        });
    });
}