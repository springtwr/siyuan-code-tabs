import { Dialog, type IObject, confirm } from "siyuan";

import { pushErrMsg } from "@/api";
import { isMobileBackend } from "@/utils/env";
import { t } from "@/utils/i18n";

import { TabData } from "./TabData";
import { TabListRenderer } from "./edit-panel/TabListRenderer";
import { DragDropManager } from "./edit-panel/DragDropManager";
import { LanguageSuggest } from "./edit-panel/LanguageSuggest";
import { KeyboardNavigator } from "./edit-panel/KeyboardNavigator";
import { CodeEditorManager } from "./edit-panel/CodeEditorManager";
import type { TabsData } from "@/types/tabs";
import { isLanguageSupported, normalizeLanguageInput } from "@/utils/language";

type EditorOptions = {
    i18n: IObject;
    data: TabsData;
    currentIndex: number;
    onSubmit: (data: TabsData) => void;
    editorData: Record<string, unknown>;
    onSaveConfig: () => Promise<void>;
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
            <div class="code-tabs__editor-lang">
                <input class="b3-text-field code-tabs__editor-input" data-field="lang" />
                <div class="code-tabs__editor-lang-suggest" data-role="lang-suggest"></div>
            </div>
            <label class="code-tabs__editor-label">${t(i18n, "editor.tabCode")}</label>
            <div class="b3-text-field code-tabs__editor-code" data-field="code"></div>
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
            data: TabData.clone(options.data),
            currentIndex: Math.min(
                Math.max(options.currentIndex, 0),
                Math.max(options.data.tabs.length - 1, 0)
            ),
        };

        const dialog = new Dialog({
            title: t(options.i18n, "editor.title"),
            content: buildEditorDialogContent(options.i18n),
            width: "90vh",
            height: "70vh",
        });

        const buildSnapshot = (data: TabsData) => JSON.stringify(TabData.normalize(data));
        const initialSnapshot = buildSnapshot(state.data);

        const root = dialog.element;
        root.classList.add("code-tabs__editor-dialog");

        const listEl = root.querySelector<HTMLElement>('[data-role="tab-list"]');
        const inputTitle = root.querySelector<HTMLInputElement>('[data-field="title"]');
        const inputLang = root.querySelector<HTMLInputElement>('[data-field="lang"]');
        const codeContainer = root.querySelector<HTMLElement>('[data-field="code"]');
        const langSuggest = root.querySelector<HTMLElement>('[data-role="lang-suggest"]');
        const addButton = root.querySelector<HTMLButtonElement>('[data-action="add"]');
        const deleteButton = root.querySelector<HTMLButtonElement>('[data-action="delete"]');

        if (!listEl || !inputTitle || !inputLang || !codeContainer) {
            dialog.destroy();
            return;
        }

        const dropIndicator = document.createElement("div");
        dropIndicator.className = "code-tabs__editor-drop-indicator";

        const listRenderer = new TabListRenderer(listEl, dropIndicator, options.i18n);

        const dragDropManager = new DragDropManager(listEl, dropIndicator, (fromIndex, toIndex) => {
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
        });

        const languageSuggest = langSuggest
            ? new LanguageSuggest(inputLang, langSuggest, root, () => {
                  updateCurrentTab();
              })
            : null;

        const codeEditorManager = new CodeEditorManager(
            codeContainer,
            {
                i18n: options.i18n,
                data: options.editorData,
                onSaveConfig: options.onSaveConfig,
            },
            () => {
                updateCurrentTab();
            }
        );
        const initialLang = state.data.tabs[state.currentIndex]?.lang || "plaintext";
        codeEditorManager.init({ language: initialLang });

        const syncFields = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            inputTitle.value = tab.title;
            inputLang.value = tab.lang;
            codeEditorManager.updateLanguage(tab.lang);
            codeEditorManager.updateCode(tab.code);
        };

        syncFields();

        const keyboardNavigator = new KeyboardNavigator(
            listEl,
            inputTitle,
            inputLang,
            codeContainer,
            addButton,
            deleteButton,
            (index, saveCurrent, focusTarget) => selectIndex(index, saveCurrent, focusTarget),
            (index) => {
                state.data.active = index;
                listRenderer.render(state.data.tabs, state.currentIndex, state.data.active);
            },
            () => {
                languageSuggest?.suppressOnFocus();
            },
            () => codeEditorManager.isCursorAtStart()
        );

        const updateCurrentTab = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            tab.title = inputTitle.value.trim();
            const newLang = normalizeLanguageInput(inputLang.value);
            if (tab.lang !== newLang) {
                tab.lang = newLang;
                codeEditorManager.updateLanguage(newLang);
            }
            tab.code = codeEditorManager.getCode();
            listRenderer.render(state.data.tabs, state.currentIndex, state.data.active);
        };

        const getDraftSnapshot = () => {
            const draft = TabData.clone(state.data);
            const tab = draft.tabs[state.currentIndex];
            if (tab) {
                tab.title = inputTitle.value.trim();
                tab.lang = normalizeLanguageInput(inputLang.value);
                tab.code = codeEditorManager.getCode();
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

        const selectIndex = (
            index: number,
            saveCurrent: boolean,
            focusTarget: "title" | "list" | "none" = "title"
        ) => {
            if (saveCurrent) {
                updateCurrentTab();
            }
            state.currentIndex = Math.min(Math.max(index, 0), state.data.tabs.length - 1);
            listRenderer.render(state.data.tabs, state.currentIndex, state.data.active);
            syncFields();
            requestAnimationFrame(() => {
                if (focusTarget === "title") {
                    inputTitle.focus();
                    const length = inputTitle.value.length;
                    inputTitle.setSelectionRange(length, length);
                    return;
                }
                if (focusTarget === "list") {
                    const targetItem = listEl.querySelector<HTMLElement>(
                        `.code-tabs__editor-item[data-index="${state.currentIndex}"]`
                    );
                    targetItem?.focus();
                }
            });
        };

        inputTitle.addEventListener("input", updateCurrentTab);
        inputLang.addEventListener("input", updateCurrentTab);

        listEl.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const item = target.closest<HTMLElement>(".code-tabs__editor-item");
            if (!item) return;
            const index = Number(item.dataset.index ?? 0);
            selectIndex(index, true);
        });

        root.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const actionButton = target.closest<HTMLButtonElement>("[data-action]");
            const action = actionButton?.dataset.action;
            if (!action) return;

            const shouldKeepFocus = keyboardNavigator.getKeepActionFocus();
            keyboardNavigator.resetKeepActionFocus();

            switch (action) {
                case "set-default": {
                    state.data.active = Number(actionButton.dataset.index ?? 0);
                    listRenderer.render(state.data.tabs, state.currentIndex, state.data.active);
                    break;
                }
                case "add": {
                    updateCurrentTab();
                    const nextIndex = state.data.tabs.length + 1;
                    state.data.tabs.push({
                        title: `Tab${nextIndex}`,
                        lang: "plaintext",
                        code: "在这里输入代码",
                    });
                    selectIndex(
                        state.data.tabs.length - 1,
                        false,
                        shouldKeepFocus ? "none" : "title"
                    );
                    if (shouldKeepFocus) {
                        requestAnimationFrame(() => {
                            actionButton?.focus();
                        });
                    }
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

                    if (state.data.active === removeIndex) {
                        state.data.active = Math.max(removeIndex - 1, 0);
                    } else if (state.data.active > removeIndex) {
                        state.data.active = state.data.active - 1;
                    }

                    selectIndex(
                        Math.min(removeIndex, state.data.tabs.length - 1),
                        false,
                        shouldKeepFocus ? "none" : "title"
                    );
                    if (shouldKeepFocus) {
                        requestAnimationFrame(() => {
                            actionButton?.focus();
                        });
                    }
                    break;
                }
                case "save": {
                    updateCurrentTab();
                    const validation = TabData.validate(state.data);
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
                                options.onSubmit(TabData.normalize(state.data));
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
                    options.onSubmit(TabData.normalize(state.data));
                    close(true);
                    break;
                }
                case "cancel": {
                    close();
                    break;
                }
            }
        });

        listRenderer.render(state.data.tabs, state.currentIndex, state.data.active);
        syncFields();

        const isMobileEnv = isMobileBackend();
        if (!isMobileEnv) {
            const focusTitle = () => {
                if (dialog.element.contains(document.activeElement)) return;
                inputTitle.focus();
            };
            requestAnimationFrame(() => {
                focusTitle();
                setTimeout(focusTitle, 0);
            });
        }

        const cleanup = () => {
            dragDropManager.destroy();
            languageSuggest?.destroy();
            codeEditorManager.destroy();
        };

        dialog.element.addEventListener("destroy", cleanup, { once: true });
    }
}



