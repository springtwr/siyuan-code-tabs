export class KeyboardNavigator {
    private listEl: HTMLElement;
    private inputTitle: HTMLInputElement;
    private inputLang: HTMLInputElement;
    private inputCode: HTMLTextAreaElement;
    private addButton: HTMLButtonElement | null;
    private deleteButton: HTMLButtonElement | null;

    private onSelectIndex: (index: number, saveCurrent: boolean, focusTarget: "title" | "list" | "none") => void;
    private onSetDefault: (index: number) => void;
    private onSuppressLangSuggest: () => void;

    private keepActionFocus = false;

    constructor(
        listEl: HTMLElement,
        inputTitle: HTMLInputElement,
        inputLang: HTMLInputElement,
        inputCode: HTMLTextAreaElement,
        addButton: HTMLButtonElement | null,
        deleteButton: HTMLButtonElement | null,
        onSelectIndex: (index: number, saveCurrent: boolean, focusTarget: "title" | "list" | "none") => void,
        onSetDefault: (index: number) => void,
        onSuppressLangSuggest: () => void
    ) {
        this.listEl = listEl;
        this.inputTitle = inputTitle;
        this.inputLang = inputLang;
        this.inputCode = inputCode;
        this.addButton = addButton;
        this.deleteButton = deleteButton;
        this.onSelectIndex = onSelectIndex;
        this.onSetDefault = onSetDefault;
        this.onSuppressLangSuggest = onSuppressLangSuggest;
        this.bindEvents();
    }

    private bindEvents(): void {
        this.listEl.addEventListener("keydown", this.handleListKeydown.bind(this));

        this.inputTitle.addEventListener("keydown", this.handleTitleKeydown.bind(this));
        this.inputCode.addEventListener("keydown", this.handleCodeKeydown.bind(this));

        this.addButton?.addEventListener("keydown", this.handleAddButtonKeydown.bind(this));
        this.deleteButton?.addEventListener("keydown", this.handleActionButtonKeydown.bind(this));

        this.listEl.addEventListener(
            "keydown",
            this.handleGlobalShiftTab.bind(this),
            true
        );
    }

    private handleListKeydown(event: KeyboardEvent): void {
        if (
            event.key !== "Tab" &&
            event.key !== "ArrowDown" &&
            event.key !== "ArrowUp" &&
            event.key !== "Enter" &&
            event.key !== " " &&
            event.key !== "Spacebar"
        ) {
            return;
        }

        const target = event.target as HTMLElement;
        const item = target.closest<HTMLElement>(".code-tabs__editor-item");
        if (!item) return;

        const items = Array.from(this.listEl.querySelectorAll<HTMLElement>(".code-tabs__editor-item"));
        const index = items.indexOf(item);
        if (index === -1) return;

        if (event.key === " " || event.key === "Spacebar") {
            event.preventDefault();
            this.onSetDefault(index);
            requestAnimationFrame(() => {
                const targetItem = this.listEl.querySelector<HTMLElement>(
                    `.code-tabs__editor-item[data-index="${index}"]`
                );
                targetItem?.focus();
            });
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            this.inputTitle.focus();
            return;
        }

        event.preventDefault();

        if (event.shiftKey) {
            if (index > 0) {
                this.onSelectIndex(index - 1, true, "list");
                return;
            }
            item.focus();
            event.stopPropagation();
            return;
        }

        if (event.key === "ArrowUp" && index > 0) {
            this.onSelectIndex(index - 1, true, "list");
            return;
        }

        if (event.key === "ArrowDown" && index < items.length - 1) {
            this.onSelectIndex(index + 1, true, "list");
            return;
        }

        const nextIndex = index + 1;
        if (nextIndex < items.length) {
            this.onSelectIndex(nextIndex, true, "list");
            return;
        }

        this.addButton?.focus();
    }

    private handleTitleKeydown(event: KeyboardEvent): void {
        if (event.key === "Tab" && !event.shiftKey) {
            this.onSuppressLangSuggest();
        }
    }

    private handleCodeKeydown(event: KeyboardEvent): void {
        if (event.key !== "Tab") return;

        if (event.shiftKey) {
            event.preventDefault();
            this.onSuppressLangSuggest();
            this.inputLang.focus();
            return;
        }

        event.preventDefault();
        this.insertSpaces();
    }

    private handleAddButtonKeydown(event: KeyboardEvent): void {
        if (event.key !== "Tab" || !event.shiftKey) return;

        event.preventDefault();
        const items = Array.from(this.listEl.querySelectorAll<HTMLButtonElement>(".code-tabs__editor-item"));
        const target = items[items.length - 1];
        if (target) {
            const index = items.indexOf(target);
            if (index >= 0) {
                this.onSelectIndex(index, true, "list");
                return;
            }
            target.focus();
            return;
        }
        this.inputTitle.focus();
    }

    private handleActionButtonKeydown(event: KeyboardEvent): void {
        if (event.key === "Enter" || event.key === " ") {
            this.keepActionFocus = true;
        }
    }

    private handleGlobalShiftTab(event: KeyboardEvent): void {
        if (event.key !== "Tab" || !event.shiftKey) return;

        const active = document.activeElement as HTMLElement | null;
        const item = active?.closest<HTMLElement>(".code-tabs__editor-item");
        if (!item || !this.listEl.contains(item)) return;

        event.preventDefault();
        event.stopPropagation();

        const items = Array.from(this.listEl.querySelectorAll<HTMLElement>(".code-tabs__editor-item"));
        const index = items.indexOf(item);
        if (index > 0) {
            this.onSelectIndex(index - 1, true, "list");
            return;
        }
        item.focus();
    }

    private insertSpaces(): void {
        const editorConfig = ((
            window as Window & {
                siyuan?: { config?: { editor?: { codeTabSpaces?: number } } };
            }
        ).siyuan?.config?.editor ?? {}) as { codeTabSpaces?: number };

        const spaces = Math.max(1, Math.min(8, Number(editorConfig.codeTabSpaces ?? 4)));
        const insert = " ".repeat(spaces);
        const start = this.inputCode.selectionStart ?? 0;
        const end = this.inputCode.selectionEnd ?? 0;

        this.inputCode.focus();
        this.inputCode.setSelectionRange(start, end);

        const canExec =
            typeof document.queryCommandSupported === "function" &&
            document.queryCommandSupported("insertText");

        if (canExec && document.execCommand("insertText", false, insert)) {
            return;
        }

        if (typeof this.inputCode.setRangeText === "function") {
            this.inputCode.setRangeText(insert, start, end, "end");
        } else {
            const value = this.inputCode.value;
            this.inputCode.value = `${value.slice(0, start)}${insert}${value.slice(end)}`;
            const nextPos = start + insert.length;
            this.inputCode.selectionStart = nextPos;
            this.inputCode.selectionEnd = nextPos;
        }

        this.inputCode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    getKeepActionFocus(): boolean {
        return this.keepActionFocus;
    }

    resetKeepActionFocus(): void {
        this.keepActionFocus = false;
    }
}