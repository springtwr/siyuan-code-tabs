import { pushErrMsg } from "@/api";
import { t } from "@/utils/i18n";
import { CODE_TABS_ICONS } from "@/constants";
import { Dialog, type IObject } from "siyuan";
import { TabDataManager } from "./TabDataManager";
import type { TabsData } from "./types";

type EditorOptions = {
    i18n: IObject;
    data: TabsData;
    currentIndex: number;
    onSubmit: (data: TabsData) => void;
};

type EditorState = {
    data: TabsData;
    currentIndex: number;
};

export function buildEditorDialogContent(i18n: IObject): string {
    return `
<div class="code-tabs__editor">
    <div class="code-tabs__editor-body">
        <div class="code-tabs__editor-left">
            <div class="code-tabs__editor-list" data-role="tab-list"></div>
            <div class="code-tabs__editor-actions">
                <button class="b3-button b3-button--outline b3-button--small" data-action="add">${t(
                    i18n,
                    "editor.add"
                )}</button>
                <button class="b3-button b3-button--outline b3-button--small" data-action="delete">${t(
                    i18n,
                    "editor.delete"
                )}</button>
            </div>
        </div>
        <div class="code-tabs__editor-right">
            <label class="code-tabs__editor-label">${t(i18n, "editor.tabTitle")}</label>
            <input class="b3-text-field code-tabs__editor-input" data-field="title" />
            <label class="code-tabs__editor-label">${t(i18n, "editor.tabLang")}</label>
            <input class="b3-text-field code-tabs__editor-input" data-field="lang" />
            <label class="code-tabs__editor-label">${t(i18n, "editor.tabCode")}</label>
            <textarea class="b3-text-field code-tabs__editor-textarea" data-field="code"></textarea>
        </div>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" data-action="cancel">${t(
            i18n,
            "editor.cancel"
        )}</button>
        <button class="b3-button b3-button--text" data-action="save">${t(
            i18n,
            "editor.save"
        )}</button>
    </div>
</div>
`.trim();
}

export class TabEditor {
    static open(options: EditorOptions): void {
        const state: EditorState = {
            data: TabDataManager.normalize(
                JSON.parse(JSON.stringify(options.data)) as TabsData
            ),
            currentIndex: Math.min(
                Math.max(options.currentIndex, 0),
                Math.max(options.data.tabs.length - 1, 0)
            ),
        };

        const dialog = new Dialog({
            title: t(options.i18n, "editor.title"),
            content: buildEditorDialogContent(options.i18n),
            width: "720px",
        });

        const root = dialog.element;
        root.classList.add("code-tabs__editor-dialog");
        const listEl = root.querySelector<HTMLElement>('[data-role="tab-list"]');
        const inputTitle = root.querySelector<HTMLInputElement>('[data-field="title"]');
        const inputLang = root.querySelector<HTMLInputElement>('[data-field="lang"]');
        const inputCode = root.querySelector<HTMLTextAreaElement>('[data-field="code"]');
        if (!listEl || !inputTitle || !inputLang || !inputCode) {
            dialog.destroy();
            return;
        }

        const syncFields = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            inputTitle.value = tab.title;
            inputLang.value = tab.lang;
            inputCode.value = tab.code;
        };

        const renderList = () => {
            listEl.innerHTML = "";
            state.data.tabs.forEach((tab, index) => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "code-tabs__editor-item";
                if (index === state.currentIndex) {
                    item.classList.add("code-tabs__editor-item--active");
                }
                item.dataset.index = String(index);
                const text = document.createElement("span");
                text.className = "code-tabs__editor-item-text";
                text.textContent = tab.title;
                const handle = document.createElement("span");
                handle.className = "code-tabs__editor-item-handle";
                handle.title = t(options.i18n, "editor.dragTip");
                handle.setAttribute("draggable", "true");
                handle.innerHTML = `<svg width="12" height="12" style="display:block"><use xlink:href="${CODE_TABS_ICONS}#iconDrag"></use></svg>`;
                item.appendChild(text);
                item.appendChild(handle);
                listEl.appendChild(item);
            });
        };

        const updateCurrentTab = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            tab.title = inputTitle.value.trim();
            tab.lang = inputLang.value.trim() || "plaintext";
            tab.code = inputCode.value;
            renderList();
        };

        const close = () => {
            dialog.destroy();
        };

        const selectIndex = (index: number, saveCurrent: boolean) => {
            if (saveCurrent) {
                updateCurrentTab();
            }
            state.currentIndex = Math.min(Math.max(index, 0), state.data.tabs.length - 1);
            renderList();
            syncFields();
        };

        listEl.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            const index = Number(item.dataset.index ?? 0);
            selectIndex(index, true);
        });

        inputTitle.addEventListener("input", updateCurrentTab);
        inputLang.addEventListener("input", updateCurrentTab);
        inputCode.addEventListener("input", updateCurrentTab);
        inputCode.addEventListener("keydown", (event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            const editorConfig = ((window as Window & {
                siyuan?: { config?: { editor?: { codeTabSpaces?: number } } };
            }).siyuan?.config?.editor ?? {}) as { codeTabSpaces?: number };
            const spaces = Math.max(1, Math.min(8, Number(editorConfig.codeTabSpaces ?? 4)));
            const insert = " ".repeat(spaces);
            const start = inputCode.selectionStart ?? 0;
            const end = inputCode.selectionEnd ?? 0;
            const value = inputCode.value;
            inputCode.value = `${value.slice(0, start)}${insert}${value.slice(end)}`;
            const nextPos = start + insert.length;
            inputCode.selectionStart = nextPos;
            inputCode.selectionEnd = nextPos;
            updateCurrentTab();
        });

        const updateActiveIndexAfterDelete = (deleteIndex: number) => {
            if (state.data.active === deleteIndex) {
                state.data.active = Math.max(deleteIndex - 1, 0);
            } else if (state.data.active > deleteIndex) {
                state.data.active = state.data.active - 1;
            }
        };

        const clearDropIndicator = () => {
            listEl
                .querySelectorAll<HTMLElement>(".code-tabs__editor-item--drop")
                .forEach((item) => item.classList.remove("code-tabs__editor-item--drop"));
        };

        let dragIndex: number | null = null;

        listEl.addEventListener("dragstart", (event) => {
            const target = event.target as HTMLElement;
            const handle = target.closest<HTMLElement>(".code-tabs__editor-item-handle");
            if (!handle) return;
            const item = handle.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            dragIndex = Number(item.dataset.index ?? 0);
            event.dataTransfer?.setData("text/plain", String(dragIndex));
            event.dataTransfer?.setDragImage(item, 0, 0);
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
            }
        });

        listEl.addEventListener("dragover", (event) => {
            if (dragIndex === null) return;
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            event.preventDefault();
            clearDropIndicator();
            item.classList.add("code-tabs__editor-item--drop");
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "move";
            }
        });

        listEl.addEventListener("dragleave", (event) => {
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>(".code-tabs__editor-item");
            if (item) {
                item.classList.remove("code-tabs__editor-item--drop");
            }
        });

        listEl.addEventListener("drop", (event) => {
            if (dragIndex === null) return;
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            event.preventDefault();
            const dropIndex = Number(item.dataset.index ?? 0);
            clearDropIndicator();
            if (dropIndex === dragIndex) {
                dragIndex = null;
                return;
            }
            updateCurrentTab();
            const [moved] = state.data.tabs.splice(dragIndex, 1);
            state.data.tabs.splice(dropIndex, 0, moved);
            if (state.data.active === dragIndex) {
                state.data.active = dropIndex;
            } else if (dragIndex < state.data.active && dropIndex >= state.data.active) {
                state.data.active -= 1;
            } else if (dragIndex > state.data.active && dropIndex <= state.data.active) {
                state.data.active += 1;
            }
            selectIndex(dropIndex, false);
            dragIndex = null;
        });

        listEl.addEventListener("dragend", () => {
            clearDropIndicator();
            dragIndex = null;
        });

        root.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
            if (!action) return;
            switch (action) {
                case "add": {
                    updateCurrentTab();
                    const nextIndex = state.data.tabs.length + 1;
                    state.data.tabs.push({
                        title: `Tab${nextIndex}`,
                        lang: "plaintext",
                        code: "在这里输入代码",
                    });
                    selectIndex(state.data.tabs.length - 1, false);
                    break;
                }
                case "delete": {
                    if (state.data.tabs.length <= 1) {
                        pushErrMsg(t(options.i18n, "editor.deleteLast")).then();
                        return;
                    }
                    updateCurrentTab();
                    const removeIndex = state.currentIndex;
                    state.data.tabs.splice(removeIndex, 1);
                    updateActiveIndexAfterDelete(removeIndex);
                    selectIndex(Math.min(removeIndex, state.data.tabs.length - 1), false);
                    break;
                }
                case "save": {
                    updateCurrentTab();
                    const validation = TabDataManager.validate(state.data);
                    if (!validation.ok) {
                        if (validation.errors.some((err) => err.includes("title"))) {
                            pushErrMsg(t(options.i18n, "editor.emptyTitle")).then();
                            return;
                        }
                        if (validation.errors.some((err) => err.includes("code"))) {
                            pushErrMsg(t(options.i18n, "editor.emptyCode")).then();
                            return;
                        }
                    }
                    options.onSubmit(TabDataManager.normalize(state.data));
                    close();
                    break;
                }
                case "cancel": {
                    close();
                    break;
                }
                default:
                    break;
            }
        });

        renderList();
        syncFields();
        inputTitle.focus();
    }
}
