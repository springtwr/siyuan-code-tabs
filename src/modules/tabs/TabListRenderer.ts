import { IObject } from "siyuan";

import { CODE_TABS_ICONS } from "@/constants";
import { t } from "@/utils/i18n";

import type { TabDataItem } from "./types";

export class TabListRenderer {
    private listEl: HTMLElement;
    private dropIndicator: HTMLElement;
    private i18n: IObject;

    constructor(listEl: HTMLElement, dropIndicator: HTMLElement, i18n: IObject) {
        this.listEl = listEl;
        this.dropIndicator = dropIndicator;
        this.i18n = i18n;
    }

    render(tabs: TabDataItem[], currentIndex: number, activeIndex: number): void {
        this.listEl.innerHTML = "";
        tabs.forEach((tab, index) => {
            const item = this.createTabItem(tab, index, currentIndex, activeIndex);
            this.listEl.appendChild(item);
        });
        this.listEl.appendChild(this.dropIndicator);
    }

    private createTabItem(
        tab: TabDataItem,
        index: number,
        currentIndex: number,
        activeIndex: number
    ): HTMLElement {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "code-tabs__editor-item";
        if (index === currentIndex) {
            item.classList.add("code-tabs__editor-item--active");
        }
        if (activeIndex === index) {
            item.classList.add("code-tabs__editor-item--default");
        }
        item.dataset.index = String(index);

        const defaultBtn = this.createDefaultButton(index, activeIndex);
        const text = this.createTextElement(tab.title);
        const handle = this.createDragHandle();

        item.appendChild(defaultBtn);
        item.appendChild(text);
        item.appendChild(handle);
        return item;
    }

    private createDefaultButton(index: number, activeIndex: number): HTMLElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-tabs__editor-item-default";
        if (activeIndex === index) {
            button.classList.add("code-tabs__editor-item-default--active");
        }
        button.dataset.action = "set-default";
        button.dataset.index = String(index);
        button.title = t(this.i18n, "editor.setDefault");
        button.innerHTML = `<svg width="12" height="12" style="display:block"><use xlink:href="${CODE_TABS_ICONS}#iconStar"></use></svg>`;
        return button;
    }

    private createTextElement(text: string): HTMLElement {
        const span = document.createElement("span");
        span.className = "code-tabs__editor-item-text";
        span.textContent = text;
        return span;
    }

    private createDragHandle(): HTMLElement {
        const handle = document.createElement("span");
        handle.className = "code-tabs__editor-item-handle";
        handle.title = t(this.i18n, "editor.dragTip");
        handle.setAttribute("draggable", "true");
        handle.innerHTML = `<svg width="12" height="12" style="display:block"><use xlink:href="${CODE_TABS_ICONS}#iconDrag"></use></svg>`;
        return handle;
    }
}