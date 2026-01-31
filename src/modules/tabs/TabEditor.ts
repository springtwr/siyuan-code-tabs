import { pushErrMsg } from "@/api";
import { t } from "@/utils/i18n";
import { CODE_TABS_ICONS } from "@/constants";
import { Dialog, type IObject, confirm } from "siyuan";
import { TabDataManager } from "./TabDataManager";
import type { TabsData } from "./types";
import { isLanguageSupported, normalizeLanguageInput } from "./language";

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
            data: TabDataManager.clone(options.data),
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

        const buildSnapshot = (data: TabsData) => JSON.stringify(TabDataManager.normalize(data));
        const initialSnapshot = buildSnapshot(state.data);

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
                if (state.data.active === index) {
                    item.classList.add("code-tabs__editor-item--default");
                }
                item.dataset.index = String(index);
                const defaultBtn = document.createElement("button");
                defaultBtn.type = "button";
                defaultBtn.className = "code-tabs__editor-item-default";
                if (state.data.active === index) {
                    defaultBtn.classList.add("code-tabs__editor-item-default--active");
                }
                defaultBtn.dataset.action = "set-default";
                defaultBtn.dataset.index = String(index);
                defaultBtn.title = t(options.i18n, "editor.setDefault");
                defaultBtn.innerHTML = `<svg width="12" height="12" style="display:block"><use xlink:href="${CODE_TABS_ICONS}#iconStar"></use></svg>`;
                const text = document.createElement("span");
                text.className = "code-tabs__editor-item-text";
                text.textContent = tab.title;
                const handle = document.createElement("span");
                handle.className = "code-tabs__editor-item-handle";
                handle.title = t(options.i18n, "editor.dragTip");
                handle.setAttribute("draggable", "true");
                handle.innerHTML = `<svg width="12" height="12" style="display:block"><use xlink:href="${CODE_TABS_ICONS}#iconDrag"></use></svg>`;
                item.appendChild(defaultBtn);
                item.appendChild(text);
                item.appendChild(handle);
                listEl.appendChild(item);
            });
        };

        const ensureLanguageSuggestions = () => {
            const hljs = window.hljs as unknown as { listLanguages?: () => string[] };
            if (!hljs?.listLanguages) return;
            const datalistId = "code-tabs-lang-suggestions";
            let datalist = root.querySelector<HTMLDataListElement>(`#${datalistId}`);
            if (!datalist) {
                datalist = document.createElement("datalist");
                datalist.id = datalistId;
                root.appendChild(datalist);
            }
            const languages = new Set<string>(hljs.listLanguages());
            languages.add("plaintext");
            languages.add("markdown-render");
            const sorted = Array.from(languages).sort();
            datalist.innerHTML = "";
            sorted.forEach((lang) => {
                const option = document.createElement("option");
                option.value = lang;
                datalist?.appendChild(option);
            });
            inputLang.setAttribute("list", datalistId);
        };

        const updateCurrentTab = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            tab.title = inputTitle.value.trim();
            tab.lang = normalizeLanguageInput(inputLang.value);
            tab.code = inputCode.value;
            renderList();
        };

        const getDraftSnapshot = () => {
            const draft = TabDataManager.clone(state.data);
            const tab = draft.tabs[state.currentIndex];
            if (tab) {
                tab.title = inputTitle.value.trim();
                tab.lang = normalizeLanguageInput(inputLang.value);
                tab.code = inputCode.value;
            }
            return buildSnapshot(draft);
        };

        const rawDestroy = dialog.destroy.bind(dialog);
        let isConfirmingClose = false;
        let forceClose = false;
        dialog.destroy = (destroyOptions?: IObject) => {
            if (forceClose || getDraftSnapshot() === initialSnapshot) {
                rawDestroy(destroyOptions);
                return;
            }
            if (isConfirmingClose) return;
            isConfirmingClose = true;
            confirm(
                t(options.i18n, "editor.confirmDiscardTitle"),
                t(options.i18n, "editor.confirmDiscard"),
                () => {
                    isConfirmingClose = false;
                    forceClose = true;
                    rawDestroy(destroyOptions);
                    forceClose = false;
                },
                () => {
                    isConfirmingClose = false;
                    requestAnimationFrame(() => {
                        inputTitle.focus();
                    });
                }
            );
        };

        const close = (force = false) => {
            if (force) {
                forceClose = true;
                rawDestroy();
                forceClose = false;
                return;
            }
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
            const editorConfig = ((
                window as Window & {
                    siyuan?: { config?: { editor?: { codeTabSpaces?: number } } };
                }
            ).siyuan?.config?.editor ?? {}) as { codeTabSpaces?: number };
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

        const applyReorder = (fromIndex: number, toIndex: number) => {
            if (fromIndex === toIndex) return;
            updateCurrentTab();
            const [moved] = state.data.tabs.splice(fromIndex, 1);
            state.data.tabs.splice(toIndex, 0, moved);
            if (state.data.active === fromIndex) {
                state.data.active = toIndex;
            } else if (fromIndex < state.data.active && toIndex >= state.data.active) {
                state.data.active -= 1;
            } else if (fromIndex > state.data.active && toIndex <= state.data.active) {
                state.data.active += 1;
            }
            selectIndex(toIndex, false);
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
            applyReorder(dragIndex, dropIndex);
            dragIndex = null;
        });

        listEl.addEventListener("dragend", () => {
            clearDropIndicator();
            dragIndex = null;
        });

        let pointerDragIndex: number | null = null;
        let pointerDropIndex: number | null = null;
        let pointerId: number | null = null;
        const resolvePointerItem = (event: PointerEvent) => {
            const target = document.elementFromPoint(event.clientX, event.clientY);
            return target?.closest<HTMLElement>(".code-tabs__editor-item") ?? null;
        };

        listEl.addEventListener("pointerdown", (event) => {
            if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
            const target = event.target as HTMLElement;
            const handle = target.closest<HTMLElement>(".code-tabs__editor-item-handle");
            if (!handle) return;
            const item = handle.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            pointerDragIndex = Number(item.dataset.index ?? 0);
            pointerDropIndex = pointerDragIndex;
            pointerId = event.pointerId;
            handle.setPointerCapture?.(event.pointerId);
            clearDropIndicator();
            item.classList.add("code-tabs__editor-item--drop");
            event.preventDefault();
        });

        listEl.addEventListener("pointermove", (event) => {
            if (pointerDragIndex === null || pointerId !== event.pointerId) return;
            const item = resolvePointerItem(event);
            if (!item) {
                clearDropIndicator();
                pointerDropIndex = null;
                return;
            }
            const dropIndex = Number(item.dataset.index ?? 0);
            pointerDropIndex = dropIndex;
            clearDropIndicator();
            item.classList.add("code-tabs__editor-item--drop");
            event.preventDefault();
        });

        const finishPointerDrag = (event: PointerEvent) => {
            if (pointerDragIndex === null || pointerId !== event.pointerId) return;
            const dropIndex = pointerDropIndex;
            clearDropIndicator();
            if (dropIndex !== null) {
                applyReorder(pointerDragIndex, dropIndex);
            }
            pointerDragIndex = null;
            pointerDropIndex = null;
            pointerId = null;
            const target = event.target as HTMLElement | null;
            target?.releasePointerCapture?.(event.pointerId);
        };

        listEl.addEventListener("pointerup", finishPointerDrag);
        listEl.addEventListener("pointercancel", finishPointerDrag);

        root.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const defaultBtn = target.closest<HTMLElement>("[data-action='set-default']");
            if (defaultBtn) {
                event.preventDefault();
                event.stopPropagation();
                const index = Number(defaultBtn.dataset.index ?? -1);
                if (!Number.isNaN(index) && index >= 0) {
                    state.data.active = index;
                    renderList();
                }
                return;
            }
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
                    const activeTab = state.data.tabs[state.currentIndex];
                    const lang = normalizeLanguageInput(activeTab?.lang ?? "");
                    const shouldConfirm =
                        lang !== "markdown-render" && lang && !isLanguageSupported(lang);
                    if (shouldConfirm) {
                        confirm(
                            t(options.i18n, "editor.confirmUnsupportedLangTitle"),
                            t(options.i18n, "editor.confirmUnsupportedLang").replace("{0}", lang),
                            () => {
                                options.onSubmit(TabDataManager.normalize(state.data));
                                close(true);
                            },
                            () => {
                                requestAnimationFrame(() => {
                                    inputLang.focus();
                                });
                            }
                        );
                        return;
                    }
                    options.onSubmit(TabDataManager.normalize(state.data));
                    close(true);
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
        ensureLanguageSuggestions();
        syncFields();
        inputTitle.focus();
    }
}
