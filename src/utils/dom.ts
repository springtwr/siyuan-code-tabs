/**
 * 通用 DOM 操作工具函数（含 Shadow DOM 兼容）。
 */

/**
 * 获取 ShadowRoot
 * @param element DOM 节点
 * @returns ShadowRoot 或 null
 */
export function getShadowRoot(element: HTMLElement): ShadowRoot | null {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : null;
}

/**
 * 获取 ShadowRoot 的宿主元素
 * @param shadowRoot ShadowRoot
 * @returns 宿主元素或 null
 */
export function getShadowHost(shadowRoot: ShadowRoot): HTMLElement | null {
    const host = shadowRoot.host;
    if (!host || !host.parentNode || !host.parentNode.parentNode) return null;
    return host.parentNode.parentNode as HTMLElement;
}

/**
 * 获取 ShadowRoot 中的节点 ID
 * @param element DOM 节点
 * @returns nodeId 或 null
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
 * @param element DOM 节点
 * @returns nodeId 或 null
 */
export function getNodeId(element: HTMLElement): string | null {
    // 尝试从 Shadow DOM 获取
    const nodeIdFromShadow = getNodeIdFromShadow(element);
    if (nodeIdFromShadow) return nodeIdFromShadow;

    // 尝试从普通 DOM 获取
    return element.dataset.nodeId || null;
}

/**
 * 判断是否为 Record 结构。
 * @param value 任意值
 * @returns 是否为 Record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * 比较思源配置快照与插件配置。
 * 变化时用于触发样式更新。
 * @param pluginConfig 插件配置快照
 * @param siyuanConfig 思源配置快照
 * @returns 是否一致
 */
export function compareConfig(pluginConfig: unknown, siyuanConfig: unknown): boolean {
    if (!isRecord(pluginConfig) || !isRecord(siyuanConfig)) {
        return false;
    }
    for (const key of Object.keys(siyuanConfig)) {
        if (pluginConfig[key] !== siyuanConfig[key]) return false;
    }
    return true;
}

/**
 * 获取思源配置
 * @returns 关键配置字段
 */
export function getSiyuanConfig(): Record<string, unknown> {
    return {
        fontSize: window.siyuan.config.editor.fontSize,
        mode: window.siyuan.config.appearance.mode,
        themeLight: window.siyuan.config.appearance.themeLight,
        themeDark: window.siyuan.config.appearance.themeDark,
        codeBlockThemeLight: window.siyuan.config.appearance.codeBlockThemeLight,
        codeBlockThemeDark: window.siyuan.config.appearance.codeBlockThemeDark,
        codeLigatures: window.siyuan.config.editor.codeLigatures,
        codeLineWrap: window.siyuan.config.editor.codeLineWrap,
        codeSyntaxHighlightLineNum: window.siyuan.config.editor.codeSyntaxHighlightLineNum,
    };
}

/**
 * 同步思源配置到插件数据对象。
 * @param data 插件配置对象
 * @returns void
 */
export function syncSiyuanConfig(data: Record<string, unknown>): void {
    const properties = getSiyuanConfig();
    Object.keys(properties).forEach((key) => {
        Object.defineProperty(data, key, {
            value: properties[key],
            writable: true,
            enumerable: true,
        });
    });
}

/**
 * 获取思源笔记中“逻辑上被选中或聚焦”的所有指定类型块
 * - 如果存在 .protyle-wysiwyg--select，则返回所有选中块
 * - 否则，根据 Selection 焦点位置返回当前光标所在块
 *
 * @param selector 例如 '[data-type="NodeCodeBlock"]'
 * @returns 匹配的 HTMLElement 数组（通常 0～N 个）
 */
export function getSelectedElements(selector: string): HTMLElement[] {
    // 优先检查是否有视觉多选
    const visuallySelected = document.querySelectorAll<HTMLElement>(
        `.protyle-wysiwyg--select${selector}, .protyle-wysiwyg--select ${selector}`
    );

    if (visuallySelected.length > 0) {
        return Array.from(visuallySelected);
    }

    // 无多选则回退到 Selection 焦点位置
    const selection = document.getSelection();
    if (!selection || (!selection.anchorNode && !selection.focusNode)) {
        return [];
    }

    // 使用 focusNode（或 anchorNode）定位当前块
    const node = selection.focusNode || selection.anchorNode;
    if (!node) return [];

    // 向上查找匹配 selector 的祖先
    let el: Element | null =
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

    while (el) {
        if (el.matches(selector)) {
            return [el as HTMLElement];
        }
        el = el.parentElement;
    }

    return [];
}
