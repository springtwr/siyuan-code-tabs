import { getBlockAttrs, pushErrMsg, pushMsg, setBlockAttrs, updateBlock } from "@/api";
import { CUSTOM_ATTR, TAB_SEPARATOR } from "@/constants";
import { decodeSource, encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { t } from "@/utils/i18n";
import { TabParser } from "./TabParser";
import { TabRenderer } from "./TabRenderer";
import { IObject } from "siyuan";
import { StyleProbe } from "../theme/StyleProbe";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

export function getCodeFromAttribute(block_id: string, customAttribute: string, i18n: IObject) {
    let codeText = decodeSource(customAttribute);
    if (!codeText) {
        logger.info(`标签页转为代码块失败，未找到源码: id ${block_id}`);
        pushErrMsg(`${t(i18n, "msg.allTabsToCodeFailed")}: ${block_id}`);
        return;
    }
    // 转换时顺带自动更新语法格式
    if (codeText.trim().startsWith("tab:::")) {
        const parsed = TabParser.checkCodeText(codeText, i18n);
        if (parsed.result) {
            codeText = TabParser.generateNewSyntax(parsed.code);
        }
    }
    if (codeText[codeText.length - 1] !== "\n") {
        codeText = codeText + "\n";
    }
    return codeText;
}

async function copyTextToClipboard(text: string, i18n: IObject) {
    const content = text ?? "";
    const tryNative = async () => {
        if (!navigator?.clipboard?.writeText) return false;
        try {
            await navigator.clipboard.writeText(content);
            return true;
        } catch (error) {
            logger.warn("调用 clipboard.writeText 失败", { error });
            return false;
        }
    };

    const nativeOk = await tryNative();
    if (nativeOk) {
        pushMsg(t(i18n, "msg.copyToClipboard"), 2000).then();
        return;
    }
    pushErrMsg(t(i18n, "msg.copyToClipboardFailed"));
}

type ReorderHandler = (nodeId: string, order: string[]) => void;

function getHtmlBlockFromEventTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const direct = target.closest('[data-node-id][data-type="NodeHTMLBlock"]');
    if (direct instanceof HTMLElement) return direct;
    const tabContainer = target.closest(".tabs-container");
    if (!tabContainer) return null;
    const root = tabContainer.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    const host = root.host;
    return host instanceof HTMLElement ? findHtmlBlockFromHost(host) : null;
}

function findHtmlBlockFromHost(host: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = host;
    while (current) {
        if (
            current.dataset?.nodeId &&
            (current.dataset.type === "NodeHTMLBlock" || current.hasAttribute(CUSTOM_ATTR))
        ) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

function reorderTabContents(tabsEl: HTMLElement, contentsEl: HTMLElement): string[] {
    const order = Array.from(tabsEl.querySelectorAll<HTMLElement>(".tab-item"))
        .map((item) => item.dataset.tabId)
        .filter((id): id is string => Boolean(id));
    logger.debug("拖拽排序：tab 顺序", { order });

    const contentNodes = Array.from(contentsEl.querySelectorAll<HTMLElement>(".tab-content"));
    const contentMap = new Map<string, HTMLElement>();
    contentNodes.forEach((node) => {
        const id = node.dataset.tabId;
        if (id) contentMap.set(id, node);
    });
    logger.debug("拖拽排序：content 映射", { ids: Array.from(contentMap.keys()) });
    const copyIcon = contentsEl.querySelector<HTMLElement>(".code-tabs--icon_copy");
    contentNodes.forEach((node) => node.remove());
    order.forEach((id) => {
        const node = contentMap.get(id);
        if (node) contentsEl.appendChild(node);
    });
    if (copyIcon) {
        contentsEl.insertBefore(copyIcon, contentsEl.firstChild);
    }
    return order;
}

function clearDragIndicators(tabsEl: HTMLElement): void {
    tabsEl
        .querySelectorAll(".tab-item--drop-left, .tab-item--drop-right")
        .forEach((el) => el.classList.remove("tab-item--drop-left", "tab-item--drop-right"));
}

function isCoarsePointer(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches
    );
}

function resolveTabsElement(
    target: EventTarget | null,
    tabItem: HTMLElement | null
): HTMLElement | null {
    if (tabItem?.parentElement instanceof HTMLElement) return tabItem.parentElement;
    if (!(target instanceof HTMLElement)) return null;
    const tabsEl = target.closest(".tabs");
    return tabsEl instanceof HTMLElement ? tabsEl : null;
}

export class TabManager {
    static initGlobalFunctions(i18n: IObject, onReorder?: ReorderHandler, onReload?: () => void) {
        logger.debug("初始化全局 Tabs 交互函数");
        const longPressDelay = 350;
        const longPressMoveThreshold = 8;
        const dragState = {
            draggingId: "",
            dropHandled: false,
            overTab: null as HTMLElement | null,
            overBefore: false,
            overInTabs: false,
        };
        const touchState = {
            dragTab: null as HTMLElement | null,
            tabsEl: null as HTMLElement | null,
            startX: 0,
            startY: 0,
            scrollLeft: 0,
            isDragging: false,
            rafId: null as number | null,
            reordering: false,
            moved: false,
            longPressTimer: null as number | null,
            scrollPossible: false,
        };

        const touchMove = (evt: TouchEvent) => {
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            if (!tabs) return;

            const touch = evt.touches[0];
            const deltaX = touch.pageX - touchState.startX;
            const deltaY = touch.pageY - touchState.startY;
            if (
                !touchState.moved &&
                (Math.abs(deltaX) > longPressMoveThreshold ||
                    Math.abs(deltaY) > longPressMoveThreshold)
            ) {
                touchState.moved = true;
                if (touchState.longPressTimer) {
                    clearTimeout(touchState.longPressTimer);
                    touchState.longPressTimer = null;
                }
                if (!touchState.reordering && touchState.scrollPossible) {
                    touchState.isDragging = true;
                }
            }

            if (touchState.reordering) {
                evt.preventDefault();
                touchState.moved = true;
                const tabsEl = touchState.tabsEl ?? tabs;
                if (!tabsEl) return;
                clearDragIndicators(tabsEl);
                const candidates = Array.from(
                    tabsEl.querySelectorAll<HTMLElement>(".tab-item")
                ).filter((item) => item.dataset.tabId !== dragState.draggingId);
                if (candidates.length === 0) {
                    dragState.overTab = null;
                    dragState.overBefore = false;
                    dragState.overInTabs = false;
                    return;
                }
                let targetItem: HTMLElement | null = null;
                let before = false;
                for (const item of candidates) {
                    const rect = item.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    if (touch.clientX < mid) {
                        targetItem = item;
                        before = true;
                        break;
                    }
                }
                if (!targetItem) {
                    targetItem = candidates[candidates.length - 1];
                    before = false;
                }
                targetItem.classList.add(before ? "tab-item--drop-left" : "tab-item--drop-right");
                dragState.overTab = targetItem;
                dragState.overBefore = before;
                dragState.overInTabs = true;
                return;
            }

            if (!touchState.isDragging) return;
            if (touchState.rafId) cancelAnimationFrame(touchState.rafId);
            touchState.rafId = requestAnimationFrame(() => {
                tabs.scrollLeft = touchState.scrollLeft - deltaX;
            });
        };

        const touchStart = (evt: TouchEvent) => {
            evt.stopPropagation();
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            if (!tabs) return;

            const touch = evt.touches[0];
            touchState.startX = touch.pageX;
            touchState.startY = touch.pageY;
            touchState.scrollLeft = tabs.scrollLeft;
            touchState.scrollPossible = tabs.scrollWidth > tabs.clientWidth;
            touchState.moved = false;
            touchState.isDragging = false;

            const tabItem = (evt.target as HTMLElement).closest(".tab-item") as HTMLElement | null;
            const allowLongPress = isCoarsePointer() && tabItem;
            if (allowLongPress) {
                if (touchState.longPressTimer) {
                    clearTimeout(touchState.longPressTimer);
                }
                touchState.longPressTimer = window.setTimeout(() => {
                    const tabId = tabItem?.dataset.tabId ?? "";
                    if (!tabId) return;
                    dragState.draggingId = tabId;
                    dragState.dropHandled = false;
                    dragState.overTab = null;
                    dragState.overBefore = false;
                    dragState.overInTabs = false;
                    touchState.dragTab = tabItem;
                    touchState.tabsEl = tabs;
                    touchState.reordering = true;
                    touchState.isDragging = false;
                    tabItem.classList.add("tab-item--dragging");
                    logger.debug("触摸长按进入拖拽", { tabId });
                }, longPressDelay);
            } else {
                touchState.isDragging = touchState.scrollPossible;
            }

            tabs.addEventListener("touchmove", touchMove, { passive: false });
        };

        const touchEnd = (evt: TouchEvent) => {
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            tabs?.removeEventListener("touchmove", touchMove);
            if (touchState.longPressTimer) {
                clearTimeout(touchState.longPressTimer);
                touchState.longPressTimer = null;
            }
            if (touchState.reordering) {
                const tabsEl =
                    touchState.tabsEl ?? resolveTabsElement(evt.target, touchState.dragTab);
                if (tabsEl) clearDragIndicators(tabsEl);
                const draggedId = dragState.draggingId;
                if (
                    touchState.moved &&
                    draggedId &&
                    tabsEl &&
                    (dragState.overTab || dragState.overInTabs)
                ) {
                    pluginCodeTabs.applyReorder(
                        draggedId,
                        tabsEl,
                        dragState.overTab,
                        dragState.overBefore
                    );
                }
                touchState.dragTab?.classList.remove("tab-item--dragging");
                touchState.dragTab = null;
                touchState.tabsEl = null;
                dragState.draggingId = "";
                dragState.overTab = null;
                dragState.overInTabs = false;
                touchState.reordering = false;
            }
            touchState.isDragging = false;
            touchState.scrollPossible = false;
        };

        const pluginCodeTabs = {
            codeBlockStyle: StyleProbe,
            openTag: (evt: MouseEvent) => {
                const clicked = evt.target as HTMLElement;
                const tabContainer = clicked.closest(".tabs-container") as HTMLElement | null;
                if (!tabContainer) return;
                const tabItems = tabContainer.querySelectorAll(".tab-item");
                const tabContents = tabContainer.querySelectorAll(".tab-content");
                tabItems.forEach((tabItem: HTMLElement, index: number) => {
                    if (tabItem === clicked) {
                        tabItem.classList.add("tab-item--active");
                        tabContents[index].classList.add("tab-content--active");
                    } else {
                        tabItem.classList.remove("tab-item--active");
                        tabContents[index].classList.remove("tab-content--active");
                    }
                });
                logger.debug("切换标签页", { index: Array.from(tabItems).indexOf(clicked) });
                LineNumberManager.refreshActive(tabContainer);
            },

            copyCode: async (evt: MouseEvent) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                const tabContainer = trigger.closest(".tabs-container");
                if (!tabContainer) return;
                const tabContent = tabContainer.querySelector<HTMLElement>(".tab-content--active");
                if (!tabContent) return;
                logger.debug("触发复制代码");

                const rawEncoded = tabContent.dataset.raw;
                if (rawEncoded !== undefined) {
                    await copyTextToClipboard(decodeSource(rawEncoded), i18n);
                    return;
                }

                if (tabContent.querySelector(".markdown-body")) {
                    pushErrMsg(t(i18n, "msg.copyNeedRegenTabs"));
                    return;
                }

                const codeEl = tabContent.querySelector(".code");
                const codeText = codeEl?.textContent ?? tabContent.textContent ?? "";
                await copyTextToClipboard(codeText, i18n);
            },
            setDefault: async (evt: MouseEvent) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                const tabContainer = trigger.closest(".tabs-container");
                if (!tabContainer) return;
                const activeTab = tabContainer.querySelector<HTMLElement>(".tab-item--active");
                if (!activeTab) return;
                const activeId = Number(activeTab.dataset.tabId ?? "");
                if (Number.isNaN(activeId)) return;

                const htmlBlock = getHtmlBlockFromEventTarget(trigger);
                const nodeId = htmlBlock?.dataset.nodeId;
                if (!nodeId) return;

                try {
                    const attrs = await getBlockAttrs(nodeId);
                    if (!attrs || !attrs[`${CUSTOM_ATTR}`]) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    const codeText = getCodeFromAttribute(nodeId, attrs[`${CUSTOM_ATTR}`], i18n);
                    if (!codeText) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    const parsed = TabParser.checkCodeText(codeText, i18n, true);
                    if (!parsed.result || parsed.code.length === 0) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    if (activeId < 0 || activeId >= parsed.code.length) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    const currentActiveIndex = parsed.code.findIndex((tab) => tab.isActive);
                    if (currentActiveIndex === activeId) {
                        logger.debug("默认标签未变化，跳过更新", {
                            nodeId,
                            activeId,
                        });
                        return;
                    }
                    const updated = parsed.code.map((tab, index) => {
                        if (index === activeId) {
                            return {
                                ...tab,
                                isActive: true,
                            };
                        }
                        return {
                            ...tab,
                            isActive: false,
                        };
                    });
                    const newSyntax = TabParser.generateNewSyntax(updated);
                    const htmlBlock = TabRenderer.createProtyleHtml(
                        updated,
                        t(i18n, "label.toggleToCode")
                    );
                    await updateBlock("markdown", htmlBlock, nodeId);
                    await setBlockAttrs(nodeId, { [`${CUSTOM_ATTR}`]: encodeSource(newSyntax) });
                    pushMsg(t(i18n, "msg.setDefaultActive"));
                    logger.debug("已设置默认标签", { nodeId, activeId });
                    onReload?.();
                } catch (error) {
                    logger.warn("设置默认标签失败", { error, nodeId, activeId });
                    pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                }
            },
            applyReorder: (
                draggedId: string,
                tabsEl: HTMLElement,
                tabItem: HTMLElement | null,
                before: boolean
            ) => {
                const draggedEl = tabsEl.querySelector<HTMLElement>(
                    `.tab-item[data-tab-id="${draggedId}"]`
                );
                if (!draggedEl) return;
                if (tabItem && draggedEl === tabItem) return;

                if (tabItem) {
                    tabsEl.insertBefore(draggedEl, before ? tabItem : tabItem.nextSibling);
                    logger.debug("拖拽插入", {
                        before,
                        draggedId,
                        targetId: tabItem.dataset.tabId,
                    });
                } else {
                    tabsEl.appendChild(draggedEl);
                    logger.debug("拖拽插入到末尾", { draggedId });
                }

                const tabContainer = tabsEl.closest(".tabs-container");
                const contentsEl = tabContainer?.querySelector<HTMLElement>(".tab-contents");
                if (!contentsEl) return;
                const order = reorderTabContents(tabsEl, contentsEl);

                const htmlBlock = getHtmlBlockFromEventTarget(tabItem || tabsEl);
                const nodeId = htmlBlock?.dataset.nodeId;
                logger.debug("拖拽持久化触发", { nodeId, order });
                if (nodeId && onReorder) {
                    onReorder(nodeId, order);
                }
            },
            dragStart: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                if (!tabItem) return;
                const tabId = tabItem.dataset.tabId ?? "";
                logger.debug("拖拽开始", { tabId });
                dragState.draggingId = tabId;
                dragState.dropHandled = false;
                dragState.overTab = null;
                dragState.overBefore = false;
                dragState.overInTabs = false;
                tabItem.classList.add("tab-item--dragging");
                if (evt.dataTransfer) {
                    evt.dataTransfer.effectAllowed = "move";
                    evt.dataTransfer.setData("text/plain", tabId);
                }
            },
            dragOver: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                evt.preventDefault();
                if (evt.dataTransfer) {
                    evt.dataTransfer.dropEffect = "move";
                }
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (!tabsEl) return;
                clearDragIndicators(tabsEl);
                if (!tabItem) {
                    dragState.overTab = null;
                    dragState.overBefore = false;
                    dragState.overInTabs = true;
                    return;
                }
                const rect = tabItem.getBoundingClientRect();
                const before = evt.clientX < rect.left + rect.width / 2;
                tabItem.classList.add(before ? "tab-item--drop-left" : "tab-item--drop-right");
                dragState.overTab = tabItem;
                dragState.overBefore = before;
                dragState.overInTabs = true;
                logger.debug("拖拽悬停", {
                    targetId: tabItem.dataset.tabId,
                    before,
                });
            },
            dragDrop: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                evt.preventDefault();
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (!tabsEl) return;

                const draggedId =
                    dragState.draggingId || evt.dataTransfer?.getData("text/plain") || "";
                logger.debug("拖拽释放", { draggedId, targetId: tabItem?.dataset.tabId ?? "" });
                if (!draggedId) return;
                clearDragIndicators(tabsEl);
                if (tabItem) {
                    const rect = tabItem.getBoundingClientRect();
                    const before = evt.clientX < rect.left + rect.width / 2;
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, tabItem, before);
                } else {
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, null, false);
                }
                dragState.dropHandled = true;
            },
            dragEnd: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                tabItem?.classList.remove("tab-item--dragging");
                const draggedId = dragState.draggingId;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (tabsEl) clearDragIndicators(tabsEl);
                logger.debug("拖拽结束");
                if (
                    !dragState.dropHandled &&
                    tabsEl &&
                    (dragState.overTab || dragState.overInTabs)
                ) {
                    logger.debug("拖拽结束未触发 drop，执行回退排序");
                    pluginCodeTabs.applyReorder(
                        draggedId,
                        tabsEl,
                        dragState.overTab,
                        dragState.overBefore
                    );
                }
                dragState.draggingId = "";
                dragState.overTab = null;
                dragState.overInTabs = false;
            },
            dragLeave: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, null);
                if (tabsEl) clearDragIndicators(tabsEl);
                logger.debug("拖拽离开");
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

                getBlockAttrs(nodeId).then((res) => {
                    if (!res) return;
                    const codeText = getCodeFromAttribute(nodeId, res[`${CUSTOM_ATTR}`], i18n);
                    const flag = TAB_SEPARATOR;
                    updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
                        logger.info(`标签页转为代码块: id ${nodeId}`);
                    });
                });
            },

            wheelTag: (evt: WheelEvent) => {
                let tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
                evt.preventDefault();
                const hasHorizontalScroll = tabs.scrollWidth > tabs.clientWidth;
                if (hasHorizontalScroll) {
                    tabs.scrollLeft += evt.deltaY;
                }
            },

            touchStart,
            touchMove,
            touchEnd,
            contextMenu: (evt: Event) => {
                if (!isCoarsePointer()) return;
                evt.preventDefault();
                evt.stopPropagation();
                logger.debug("移动端标签栏拦截长按菜单");
            },
        };
        window.pluginCodeTabs = pluginCodeTabs;
    }
}
