import { ThemeStyle } from "@/modules/theme/types";
import logger from "@/utils/logger";

/**
 * 通过虚拟 code-block 采样主题样式。
 * 副作用：创建隐藏 DOM 节点用于测量。
 */
export const StyleProbe = (() => {
    const SYNC_PROPS = {
        block: [
            "backgroundColor",
            "border",
            "borderLeft",
            "borderRadius",
            "boxShadow",
            "margin",
            "padding",
            "maxHeight",
            "fontSize",
            "lineHeight",
            "color",
        ],
        header: ["position", "height", "padding", "backgroundColor", "borderBottom"],
        body: ["fontFamily", "padding", "backgroundColor", "overflowY", "borderTop", "margin"],
        content: ["backgroundColor", "margin", "padding"],
    } as const;

    type SyncGroup = keyof typeof SYNC_PROPS;
    type CssPropKey = keyof CSSStyleDeclaration;
    type SyncPropKey<T extends SyncGroup> = (typeof SYNC_PROPS)[T][number] & CssPropKey;
    type StyleSnapshot = { [K in SyncGroup]: Record<SyncPropKey<K>, string> };

    type VirtualProtyle = {
        root: HTMLElement;
        block: HTMLElement;
        action: HTMLElement;
        hljs: HTMLElement;
        content: HTMLElement;
    };

    function extract<T extends SyncGroup>(
        el: HTMLElement,
        props: readonly SyncPropKey<T>[]
    ): Record<SyncPropKey<T>, string> {
        const cs = getComputedStyle(el);
        const out = {} as Record<SyncPropKey<T>, string>;
        for (const p of props) out[p] = cs[p];
        return out;
    }

    let cached: VirtualProtyle | null = null;
    let lastStyle: ThemeStyle | null = null;

    /**
     * 构建隐藏的 protyle DOM，用于获取计算样式。
     * @returns 虚拟 protyle 节点
     */
    function createVirtualProtyle(): VirtualProtyle {
        const root = document.createElement("div");
        root.className = "protyle";
        root.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            pointer-events: none;
            contain: layout style paint;
            `;

        const wysiwyg = document.createElement("div");
        wysiwyg.className = "protyle-wysiwyg";
        wysiwyg.setAttribute("contenteditable", "true");

        const block = document.createElement("div");
        block.className = "code-block";
        block.dataset.type = "NodeCodeBlock";
        block.dataset.nodeId = "virtual";

        const action = document.createElement("div");
        action.className = "protyle-action";

        const hljs = document.createElement("div");
        hljs.className = "hljs";
        hljs.textContent = "test";

        const content = document.createElement("div");
        content.setAttribute("contenteditable", "true");
        content.setAttribute("spellcheck", "false");

        hljs.appendChild(content);
        block.append(action, hljs);
        wysiwyg.appendChild(block);
        root.appendChild(wysiwyg);
        document.body.appendChild(root);

        return { root, block, action, hljs, content };
    }

    function getVirtualProtyle() {
        if (!cached) {
            cached = createVirtualProtyle();
        }
        return cached;
    }

    /**
     * 采样并返回当前主题样式快照。
     * @returns 样式快照
     */
    function probe(): StyleSnapshot {
        const { block, action, hljs, content } = getVirtualProtyle();

        const snapshot: StyleSnapshot = {
            block: extract(block, SYNC_PROPS.block),
            header: extract(action, SYNC_PROPS.header),
            body: extract(hljs, SYNC_PROPS.body),
            content: extract(content, SYNC_PROPS.content),
        };

        return snapshot;
    }

    return {
        get() {
            logger.debug("采集代码块样式快照");
            return probe();
        },
        /**
         * 采样完整样式并缓存。
         * @returns 完整主题样式
         */
        getFullStyle(): ThemeStyle {
            logger.debug("采集完整主题样式");
            const cache = probe();

            const style: ThemeStyle = {
                blockBg: cache.block.backgroundColor,
                protyleActionBg: cache.header.backgroundColor,
                hljsBg: cache.body.backgroundColor,
                editableBg: cache.content.backgroundColor,
                fontFamily: cache.body.fontFamily,
                fontSize: cache.block.fontSize,
                lineHeight: cache.block.lineHeight,
                blockPadding: cache.block.padding,
                hljsPadding: cache.body.padding,
                editablePadding: cache.content.padding,
                blockMargin: cache.block.margin,
                hljsMargin: cache.body.margin,
                editableMargin: cache.content.margin,
                color: cache.block.color,
                border: cache.block.border,
                borderLeft: cache.block.borderLeft,
                boxShadow: cache.block.boxShadow,
                borderRadius: cache.block.borderRadius,
                protyleActionPosition: cache.header.position,
                protyleActionBorderBottom: cache.header.borderBottom,
                hljsBorderTop: cache.body.borderTop,
                hljsOverflowY: cache.body.overflowY,
                hljsMaxHeight: cache.block.maxHeight,
            };
            lastStyle = style;
            return style;
        },
        getCachedStyle(): ThemeStyle {
            if (lastStyle) return lastStyle;
            return this.getFullStyle();
        },
        resetCachedStyle(): void {
            lastStyle = null;
        },
        /**
         * 清理虚拟 DOM，释放引用。
         * @returns void
         */
        cleanup(): void {
            if (!cached) return;
            cached.root.remove();
            cached = null;
            lastStyle = null;
        },
    };
})();
