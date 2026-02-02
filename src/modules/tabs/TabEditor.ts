import { Dialog, type IObject, confirm } from "siyuan";

import { pushErrMsg } from "@/api";
import { CODE_TABS_ICONS } from "@/constants";
import { isMobileBackend } from "@/utils/env";
import { t } from "@/utils/i18n";
import logger from "@/utils/logger";

import { TabDataService } from "./TabDataService";
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

/**
 * 构建编辑面板的 HTML 内容。
 * @param i18n i18n 资源
 * @returns HTML 字符串
 */
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

/**
 * 标签页编辑弹窗，包含标题/语言/代码编辑与排序。
 * 副作用：创建 Dialog、绑定多种交互事件。
 */
export class TabEditor {
    /**
     * 打开编辑面板并绑定交互。
     * @param options 打开参数
     * @returns void
     */
    static open(options: EditorOptions): void {
        const state: EditorState = {
            data: TabDataService.clone(options.data),
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

        const buildSnapshot = (data: TabsData) => JSON.stringify(TabDataService.normalize(data));
        const initialSnapshot = buildSnapshot(state.data);

        const root = dialog.element;
        root.classList.add("code-tabs__editor-dialog");
        const listEl = root.querySelector<HTMLElement>('[data-role="tab-list"]');
        const inputTitle = root.querySelector<HTMLInputElement>('[data-field="title"]');
        const inputLang = root.querySelector<HTMLInputElement>('[data-field="lang"]');
        const inputCode = root.querySelector<HTMLTextAreaElement>('[data-field="code"]');
        const langSuggest = root.querySelector<HTMLElement>('[data-role="lang-suggest"]');
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

        const isMobileEnv = isMobileBackend();
        logger.debug(`当前后端：${isMobileEnv ? "mobile" : "desktop"}`);

        /**
         * 获取语言候选列表，合并 hljs 与别名。
         * @returns 语言列表
         */
        const getLanguageOptions = (): string[] => {
            const hljs = window.hljs as unknown as { listLanguages?: () => string[] };
            if (!hljs?.listLanguages) return ["plaintext", "markdown-render"];
            const languages = new Set<string>(hljs.listLanguages());
            languages.add("plaintext");
            languages.add("markdown-render");
            if (window.hljs?.getLanguage) {
                Array.from(languages).forEach((lang) => {
                    const info = window.hljs?.getLanguage?.(lang) as
                        | { aliases?: string[] }
                        | undefined;
                    info?.aliases?.forEach((alias) => languages.add(alias));
                });
            }
            return Array.from(languages).sort();
        };

        /**
         * 初始化语言联想（全平台自定义列表）。
         * @returns void
         */
        const initLanguageSuggest = () => {
            if (!langSuggest) return;
            logger.debug("初始化语言联想（自定义列表）", { isMobileEnv });
            inputLang.removeAttribute("list");
            const allOptions = getLanguageOptions();
            let isSelectingSuggest = false;
            const hideSuggest = () => {
                logger.debug("隐藏语言联想列表", {
                    isSelectingSuggest,
                    hasOptions: langSuggest.children.length,
                });
                langSuggest.classList.remove("code-tabs__editor-lang-suggest--open");
                langSuggest.innerHTML = "";
            };
            const renderSuggest = () => {
                const query = inputLang.value.trim().toLowerCase();
                logger.debug("渲染语言联想列表", {
                    query,
                    total: allOptions.length,
                });
                if (!query) {
                    hideSuggest();
                    return;
                }
                const matched = allOptions.filter((lang) => lang.includes(query)).slice(0, 60);
                if (matched.length === 0) {
                    hideSuggest();
                    return;
                }
                langSuggest.innerHTML = "";
                matched.forEach((lang) => {
                    const option = document.createElement("div");
                    option.className = "code-tabs__editor-lang-option";
                    option.dataset.value = lang;
                    option.textContent = lang;
                    option.setAttribute("role", "button");
                    option.setAttribute("tabindex", "0");
                    langSuggest.appendChild(option);
                });
                langSuggest.classList.add("code-tabs__editor-lang-suggest--open");
                logger.debug("语言联想列表已更新", { matched: matched.length });
            };
            const applyPick = (target: HTMLElement) => {
                const option = target.closest<HTMLElement>(".code-tabs__editor-lang-option");
                if (!option) {
                    logger.debug("点击候选项未命中", { tag: target.tagName });
                    return false;
                }
                const value = option.dataset.value ?? option.textContent ?? "";
                logger.debug("选中语言候选项", { value });
                inputLang.value = value;
                inputLang.dispatchEvent(new Event("input", { bubbles: true }));
                inputLang.dispatchEvent(new Event("change", { bubbles: true }));
                updateCurrentTab();
                hideSuggest();
                requestAnimationFrame(() => inputLang.focus());
                return true;
            };
            const handlePick = (event: Event) => {
                const target = event.target as HTMLElement;
                logger.debug("候选列表事件触发", { type: event.type });
                const picked = applyPick(target);
                if (!picked) return;
                event.preventDefault();
                event.stopPropagation();
                isSelectingSuggest = true;
                setTimeout(() => {
                    isSelectingSuggest = false;
                }, 0);
            };
            langSuggest.addEventListener(
                "touchstart",
                (event) => {
                    handlePick(event);
                },
                { passive: false }
            );
            langSuggest.addEventListener("touchend", handlePick);
            langSuggest.addEventListener("pointerdown", handlePick);
            langSuggest.addEventListener("mousedown", handlePick);
            langSuggest.addEventListener("click", handlePick);
            inputLang.addEventListener("input", renderSuggest);
            inputLang.addEventListener("focus", renderSuggest);
            inputLang.addEventListener("blur", () => {
                logger.debug("语言输入框 blur", { isSelectingSuggest });
                if (isSelectingSuggest) return;
                setTimeout(() => {
                    if (!isSelectingSuggest) hideSuggest();
                }, 120);
            });
            root.addEventListener("touchstart", (event) => {
                const target = event.target as HTMLElement;
                if (target === inputLang || langSuggest.contains(target)) return;
                logger.debug("触发外部触摸关闭联想列表");
                hideSuggest();
            });
            root.addEventListener("mousedown", (event) => {
                const target = event.target as HTMLElement;
                if (target === inputLang || langSuggest.contains(target)) return;
                logger.debug("触发外部点击关闭联想列表");
                hideSuggest();
            });
        };

        /**
         * 将输入框状态写回当前 tab。
         * @returns void
         */
        const updateCurrentTab = () => {
            const tab = state.data.tabs[state.currentIndex];
            if (!tab) return;
            tab.title = inputTitle.value.trim();
            tab.lang = normalizeLanguageInput(inputLang.value);
            tab.code = inputCode.value;
            renderList();
        };

        /**
         * 生成草稿快照，用于未保存提示。
         * @returns 草稿快照字符串
         */
        const getDraftSnapshot = () => {
            const draft = TabDataService.clone(state.data);
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

        /**
         * 关闭弹窗入口，强制关闭用于保存成功后。
         * @param force 是否强制关闭
         * @returns void
         */
        const close = (force = false) => {
            if (force) {
                forceClose = true;
                rawDestroy();
                forceClose = false;
                return;
            }
            dialog.destroy();
        };

        /**
         * 切换编辑中的 tab，并根据需要保存当前修改。
         * @param index 目标索引
         * @param saveCurrent 是否保存当前 tab 的输入
         * @returns void
         */
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

        /**
         * 删除 tab 后修正 active 索引，避免越界。
         * @param deleteIndex 被删除索引
         * @returns void
         */
        const updateActiveIndexAfterDelete = (deleteIndex: number) => {
            if (state.data.active === deleteIndex) {
                state.data.active = Math.max(deleteIndex - 1, 0);
            } else if (state.data.active > deleteIndex) {
                state.data.active = state.data.active - 1;
            }
        };

        const clearDropIndicator = () => {
            listEl
                .querySelectorAll<HTMLElement>(
                    ".code-tabs__editor-item--drop-before, .code-tabs__editor-item--drop-after"
                )
                .forEach((item) =>
                    item.classList.remove(
                        "code-tabs__editor-item--drop-before",
                        "code-tabs__editor-item--drop-after"
                    )
                );
        };

        const resolveDropPosition = (event: { clientY: number }, item: HTMLElement) => {
            const rect = item.getBoundingClientRect();
            return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        };

        const resolveDropIndex = (
            fromIndex: number,
            targetIndex: number,
            position: "before" | "after"
        ) => {
            let nextIndex = position === "after" ? targetIndex + 1 : targetIndex;
            if (fromIndex < nextIndex) {
                nextIndex -= 1;
            }
            const maxIndex = Math.max(state.data.tabs.length - 1, 0);
            return Math.min(Math.max(nextIndex, 0), maxIndex);
        };

        /**
         * 拖拽排序逻辑，维护 active 索引一致性。
         * @param fromIndex 起始索引
         * @param toIndex 目标索引
         * @returns void
         */
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
            const position = resolveDropPosition(event, item);
            item.classList.add(
                position === "before"
                    ? "code-tabs__editor-item--drop-before"
                    : "code-tabs__editor-item--drop-after"
            );
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
            const rawIndex = Number(item.dataset.index ?? 0);
            const position = resolveDropPosition(event, item);
            const dropIndex = resolveDropIndex(dragIndex, rawIndex, position);
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
        let pointerDropPosition: "before" | "after" | null = null;
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
            pointerDropPosition = "after";
            pointerId = event.pointerId;
            handle.setPointerCapture?.(event.pointerId);
            clearDropIndicator();
            item.classList.add("code-tabs__editor-item--drop-after");
            event.preventDefault();
        });

        listEl.addEventListener("pointermove", (event) => {
            if (pointerDragIndex === null || pointerId !== event.pointerId) return;
            const item = resolvePointerItem(event);
            if (!item) {
                clearDropIndicator();
                pointerDropIndex = null;
                pointerDropPosition = null;
                return;
            }
            const dropIndex = Number(item.dataset.index ?? 0);
            pointerDropIndex = dropIndex;
            pointerDropPosition = resolveDropPosition(event, item);
            clearDropIndicator();
            item.classList.add(
                pointerDropPosition === "before"
                    ? "code-tabs__editor-item--drop-before"
                    : "code-tabs__editor-item--drop-after"
            );
            event.preventDefault();
        });

        const finishPointerDrag = (event: PointerEvent) => {
            if (pointerDragIndex === null || pointerId !== event.pointerId) return;
            const dropIndex = pointerDropIndex;
            const dropPosition = pointerDropPosition;
            clearDropIndicator();
            if (dropIndex !== null && dropPosition) {
                const nextIndex = resolveDropIndex(pointerDragIndex, dropIndex, dropPosition);
                applyReorder(pointerDragIndex, nextIndex);
            }
            pointerDragIndex = null;
            pointerDropIndex = null;
            pointerDropPosition = null;
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
                    const validation = TabDataService.validate(state.data);
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
                                options.onSubmit(TabDataService.normalize(state.data));
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
                    options.onSubmit(TabDataService.normalize(state.data));
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
        initLanguageSuggest();
        syncFields();
        if (!isMobileEnv) {
            inputTitle.focus();
        }
    }
}
