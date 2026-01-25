import { CodeBlockStyleSnapshot, ThemeStyle } from "@/modules/theme/types";
import logger from "@/utils/logger";

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
        body: ["fontFamily", "padding", "backgroundColor", "overflowY", "borderTop"],
        content: ["backgroundColor", "margin", "padding"],
    };

    function extract(el, props) {
        const cs = getComputedStyle(el);
        const out = {};
        for (const p of props) out[p] = cs[p];
        return out;
    }

    let cached: {
        root: HTMLElement;
        block: HTMLElement;
        action: HTMLElement;
        hljs: HTMLElement;
        content: HTMLElement;
    } | null = null;
    let lastStyle: ThemeStyle | null = null;

    function createVirtualProtyle() {
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

    function probe() {
        const { block, action, hljs, content } = getVirtualProtyle();

        const snapshot: CodeBlockStyleSnapshot = {
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
        cleanup(): void {
            if (!cached) return;
            cached.root.remove();
            cached = null;
            lastStyle = null;
        },
    };
})();
