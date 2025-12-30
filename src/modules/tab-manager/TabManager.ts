import ClipboardJS from "clipboard";
import {getBlockAttrs, pushErrMsg, pushMsg, updateBlock} from "@/api";
import {customAttr} from "@/assets/constants";
import {decodeSource} from "@/utils/encoding";
import logger from "@/utils/logger";
import {TabParser} from "../parser/TabParser";
import {IObject} from "siyuan";

export function getCodeFromAttribute(block_id: string, customAttribute: string, i18n: IObject) {
    let codeText = decodeSource(customAttribute);
    if (!codeText) {
        logger.info('标签页转为代码块失败，未找到源码');
        pushErrMsg(`${i18n.allTabsToCodeFailed}: ${block_id}`);
        return;
    }
    // 转换时顺带自动更新语法格式
    if (codeText.trim().startsWith('tab:::')) {
        const parsed = TabParser.checkCodeText(codeText, i18n);
        if (parsed.result) {
            codeText = TabParser.generateNewSyntax(parsed.code);
        }
    }
    if (codeText[codeText.length - 1] !== '\n') {
        codeText = codeText + '\n';
    }
    return codeText;
}

export class TabManager {
    static initGlobalFunctions(i18n: IObject) {
        window.pluginCodeTabs = {
            openTag: (evt: MouseEvent) => {
                const clicked = evt.target as HTMLElement;
                const tabContainer = clicked.closest('.tabs-container');
                const tabItems = tabContainer.querySelectorAll('.tab-item');
                const tabContents = tabContainer.querySelectorAll('.tab-content');
                tabItems.forEach((tabItem: HTMLElement, index: number) => {
                    if (tabItem === clicked) {
                        tabItem.classList.add('tab-item--active');
                        tabContents[index].classList.add('tab-content--active');
                    } else {
                        tabItem.classList.remove('tab-item--active');
                        tabContents[index].classList.remove('tab-content--active');
                    }
                });
            },

            copyCode: (evt: MouseEvent) => {
                const tabContainer = (evt.target as HTMLElement).closest('.tabs-container');
                const tabContent = tabContainer.querySelector('.tab-content--active');
                let textContent = tabContent.textContent;

                if (tabContent.firstChild instanceof HTMLElement && tabContent.firstChild.className.includes('markdown')) {
                    const tabContents = tabContent.parentNode;
                    const childElements = Array.from(tabContents.children);
                    const index = childElements.indexOf(tabContent as Element) - 1;

                    let parent: Node = evt.target as Node;
                    while (parent && parent.parentNode) {
                        parent = parent.parentNode;
                    }
                    if (!parent || !(parent instanceof ShadowRoot)) return;
                    const host = parent.host;
                    if (!host || !host.parentNode || !host.parentNode.parentNode) return;
                    const htmlBlock = host.parentNode.parentNode as HTMLElement;
                    const nodeId = htmlBlock.dataset.nodeId;

                    getBlockAttrs(nodeId).then(res => {
                        if (!res) return;
                        let codeText = decodeSource(res[`${customAttr}`]);
                        // Fallback check if needed, though decodeSource handles it.
                        // Ensure strict string type if necessary, or just proceed.
                        if (codeText && codeText[codeText.length - 1] !== '\n') {
                            codeText = codeText + '\n';
                        }
                        const codeArr = codeText.trim().match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
                        textContent = codeArr[index];
                        const lines = textContent.split('\n');
                        lines.shift();
                        if (lines[0] && lines[0].startsWith('lang:::')) {
                            lines.shift();
                        }
                        textContent = lines.join('\n');
                        copyTextToClipboard(textContent);
                    });
                } else {
                    copyTextToClipboard(textContent);
                }

                function copyTextToClipboard(text: string) {
                    const btn = evt.target as HTMLElement;
                    const clipboard = new ClipboardJS(btn, {
                        text: () => text
                    });
                    clipboard.on('success', (e) => {
                        e.clearSelection();
                        pushMsg("已复制到剪贴板(Copied to clipboard)", 2000).then();
                    });
                    clipboard.on('error', (e) => {
                        logger.error(e);
                    });
                    btn.click();
                    clipboard.destroy();
                }
            },

            toggle: (evt: MouseEvent) => {
                let parent: Node = evt.target as Node;
                while (parent && parent.parentNode) {
                    parent = parent.parentNode;
                }
                if (!parent || !(parent instanceof ShadowRoot)) return;
                const host = parent.host;
                if (!host || !host.parentNode || !host.parentNode.parentNode) return;
                const htmlBlock = host.parentNode.parentNode as HTMLElement;
                const nodeId = htmlBlock.dataset.nodeId;

                getBlockAttrs(nodeId).then(res => {
                    if (!res) return;
                    const codeText = getCodeFromAttribute(nodeId, res[`${customAttr}`], i18n);
                    const flag = "```````````````````````````";
                    updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
                        logger.info('标签页转为代码块');
                    });
                });
            },

            wheelTag: (evt: WheelEvent) => {
                let tabs = (evt.target as HTMLElement).closest('.tabs') as HTMLElement;
                evt.preventDefault();
                const hasHorizontalScroll = tabs.scrollWidth > tabs.clientWidth;
                if (hasHorizontalScroll) {
                    tabs.scrollLeft += evt.deltaY;
                }
            },

            startX: 0,
            scrollLeft: 0,
            isDragging: false,
            rafId: null,
            touchStart: function (evt: TouchEvent) {
                evt.stopPropagation();
                const tabs = (evt.target as HTMLElement).closest('.tabs') as HTMLElement;
                if (tabs.scrollWidth <= tabs.clientWidth) return;

                const touch = evt.touches[0];
                this.startX = touch.pageX;
                this.scrollLeft = tabs.scrollLeft;
                this.isDragging = true;
                tabs.addEventListener('touchmove', this.touchMove, {passive: true});
            },

            touchMove: function (evt: TouchEvent) {
                const tabs = (evt.target as HTMLElement).closest('.tabs') as HTMLElement;
                if (!this.isDragging) return;

                const touch = evt.touches[0];
                const deltaX = touch.pageX - this.startX;
                if (this.rafId) cancelAnimationFrame(this.rafId);
                this.rafId = requestAnimationFrame(() => {
                    tabs.scrollLeft = this.scrollLeft - deltaX;
                });
            },

            touchEnd: function (evt: TouchEvent) {
                const tabs = (evt.target as HTMLElement).closest('.tabs') as HTMLElement;
                tabs.removeEventListener('touchmove', this.touchMove);
                this.isDragging = false;
            }
        };
    }
}
