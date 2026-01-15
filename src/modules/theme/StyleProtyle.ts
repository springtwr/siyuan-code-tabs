import { ThemeStyle } from "@/assets/theme-adaption";
import { codeBlockStyleSnapshot } from "@/types";

export const StyleProbe = (() => {
    let cache: codeBlockStyleSnapshot

    const SYNC_PROPS = {
        block: [
            'backgroundColor',
            'border',
            'borderRadius',
            'boxShadow',
            'margin',
            'padding',
            'fontSize',
            'lineHeight',
            'color'
        ],
        header: [
            'position',
            'height',
            'padding',
            'backgroundColor',
            'borderBottom',
        ],
        body: [
            'fontFamily',
            'padding',
            'backgroundColor',
            'overflow',
            'borderTop'
        ],
        content: [
            'backgroundColor',
            'margin',
            'padding'
        ]

    }

    function extract(el, props) {
        const cs = getComputedStyle(el)
        const out = {}
        for (const p of props) out[p] = cs[p]
        return out
    }

    function createVirtualProtyle() {
        const root = document.createElement('div')
        root.className = 'protyle'
        root.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            pointer-events: none;
            contain: layout style paint;
            `

        const wysiwyg = document.createElement('div')
        wysiwyg.className = 'protyle-wysiwyg'
        wysiwyg.setAttribute('contenteditable', 'true')

        const block = document.createElement('div')
        block.className = 'code-block'
        block.dataset.type = 'NodeCodeBlock'
        block.dataset.nodeId = 'virtual'

        const action = document.createElement('div')
        action.className = 'protyle-action'

        const hljs = document.createElement('div')
        hljs.className = 'hljs'
        hljs.textContent = 'test'

        const content = document.createElement('div')
        content.setAttribute('contenteditable', 'true')
        content.setAttribute('spellcheck', 'false')

        hljs.appendChild(content)
        block.append(action, hljs)
        wysiwyg.appendChild(block)
        root.appendChild(wysiwyg)
        document.body.appendChild(root)

        return { root, block, action, hljs, content }
    }

    function probe() {
        const { root, block, action, hljs, content } = createVirtualProtyle()

        const snapshot: codeBlockStyleSnapshot = {
            block: extract(block, SYNC_PROPS.block),
            header: extract(action, SYNC_PROPS.header),
            body: extract(hljs, SYNC_PROPS.body),
            content: extract(content, SYNC_PROPS.content)
        }

        root.remove()
        return snapshot
    }

    return {
        get() {
            if (!cache) cache = probe()
            return cache
        },
        getFullStyle(): ThemeStyle {
            if (!cache) cache = probe()

            return {
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
                boxShadow: cache.block.boxShadow,
                borderRadius: cache.block.borderRadius,
                protyleActionPosition: cache.header.position,
                protyleActionBorderBottom: cache.header.borderBottom,
                hljsBorderTop: cache.body.borderTop
            }
        },
        invalidate() {
            cache = null
        }
    }
})()
