export class LanguageSuggest {
    private inputEl: HTMLInputElement;
    private suggestEl: HTMLElement;
    private rootEl: HTMLElement;
    private onSelect: (lang: string) => void;

    private allOptions: string[] = [];
    private isSelectingSuggest = false;
    private activeIndex = -1;
    private suppressFocus = false;

    constructor(
        inputEl: HTMLInputElement,
        suggestEl: HTMLElement,
        rootEl: HTMLElement,
        onSelect: (lang: string) => void
    ) {
        this.inputEl = inputEl;
        this.suggestEl = suggestEl;
        this.rootEl = rootEl;
        this.onSelect = onSelect;
        this.init();
    }

    suppressOnFocus(): void {
        this.suppressFocus = true;
    }

    private init(): void {
        this.allOptions = this.getLanguageOptions();
        this.bindEvents();
    }

    private getLanguageOptions(): string[] {
        const hljs = window.hljs as unknown as { listLanguages?: () => string[] };
        if (!hljs?.listLanguages) return ["plaintext", "markdown-render"];

        const languages = new Set<string>(hljs.listLanguages());
        languages.add("plaintext");
        languages.add("markdown-render");

        if (window.hljs?.getLanguage) {
            Array.from(languages).forEach((lang) => {
                const info = window.hljs?.getLanguage?.(lang) as { aliases?: string[] } | undefined;
                info?.aliases?.forEach((alias) => languages.add(alias));
            });
        }

        return Array.from(languages).sort();
    }

    private bindEvents(): void {
        this.suggestEl.addEventListener("touchstart", this.handlePick.bind(this), {
            passive: false,
        });
        this.suggestEl.addEventListener("touchend", this.handlePick.bind(this));
        this.suggestEl.addEventListener("pointerdown", this.handlePick.bind(this));
        this.suggestEl.addEventListener("mousedown", this.handlePick.bind(this));
        this.suggestEl.addEventListener("click", this.handlePick.bind(this));

        this.suggestEl.addEventListener("mousemove", this.handleMouseMove.bind(this));

        this.inputEl.addEventListener("input", () => this.renderSuggest());
        this.inputEl.addEventListener("focus", () => {
            if (this.suppressFocus) {
                this.suppressFocus = false;
                return;
            }
            this.renderSuggest();
        });
        this.inputEl.addEventListener("keydown", this.handleKeydown.bind(this));
        this.inputEl.addEventListener("blur", this.handleBlur.bind(this));

        this.rootEl.addEventListener("touchstart", this.handleOutsideClick.bind(this));
        this.rootEl.addEventListener("mousedown", this.handleOutsideClick.bind(this));
    }

    private handlePick(event: Event): void {
        const target = event.target as HTMLElement;
        const option = target.closest<HTMLElement>(".code-tabs__editor-lang-option");
        if (!option) return;

        const value = option.dataset.value ?? option.textContent ?? "";
        this.inputEl.value = value;
        this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        this.inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        this.onSelect(value);
        this.hideSuggest();

        requestAnimationFrame(() => this.inputEl.focus());

        event.preventDefault();
        event.stopPropagation();
        this.isSelectingSuggest = true;
        setTimeout(() => {
            this.isSelectingSuggest = false;
        }, 0);
    }

    private handleMouseMove(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const option = target.closest<HTMLElement>(".code-tabs__editor-lang-option");
        if (!option) return;

        const options = this.getOptions();
        const index = options.indexOf(option);
        if (index === -1 || index === this.activeIndex) return;

        this.setActive(index);
    }

    private handleKeydown(event: KeyboardEvent): void {
        const isOpen = this.suggestEl.classList.contains("code-tabs__editor-lang-suggest--open");

        if (!isOpen && event.key === "ArrowDown") {
            this.renderSuggest();
            return;
        }

        if (!isOpen) return;

        switch (event.key) {
            case "Tab":
                event.preventDefault();
                this.setActive(event.shiftKey ? this.activeIndex - 1 : this.activeIndex + 1);
                break;
            case "ArrowDown":
                event.preventDefault();
                this.setActive(this.activeIndex + 1);
                break;
            case "ArrowUp":
                event.preventDefault();
                this.setActive(this.activeIndex - 1);
                break;
            case "Enter": {
                event.preventDefault();
                const options = this.getOptions();
                const target = options[this.activeIndex];
                if (target) {
                    this.inputEl.value = target.dataset.value ?? target.textContent ?? "";
                    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                    this.inputEl.dispatchEvent(new Event("change", { bubbles: true }));
                    this.onSelect(this.inputEl.value);
                    this.hideSuggest();
                }
                break;
            }
            case "Escape":
                event.preventDefault();
                this.hideSuggest();
                event.stopPropagation();
                break;
        }
    }

    private handleBlur(): void {
        setTimeout(() => {
            if (!this.isSelectingSuggest) {
                this.hideSuggest();
            }
        }, 120);
    }

    private handleOutsideClick(event: Event): void {
        const target = event.target as HTMLElement;
        if (target === this.inputEl || this.suggestEl.contains(target)) return;
        this.hideSuggest();
    }

    private getLanguagePriority(lang: string): number {
        const priorityMap: Record<string, number> = {
            javascript: 1,
            typescript: 2,
            python: 3,
            java: 4,
            cpp: 5,
            c: 6,
            go: 7,
            rust: 8,
            php: 9,
            ruby: 10,
            swift: 11,
            kotlin: 12,
            bash: 13,
            shell: 14,
            sql: 15,
            json: 16,
            xml: 17,
            yaml: 18,
            markdown: 19,
            plaintext: 20,
        };
        return priorityMap[lang] ?? 100;
    }

    private compareLanguageMatch(a: string, b: string, query: string): number {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        const aStartsWith = aLower.startsWith(query);
        const bStartsWith = bLower.startsWith(query);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        if (aStartsWith && bStartsWith) {
            const aLen = a.length;
            const bLen = b.length;
            if (aLen !== bLen) return aLen - bLen;

            const aPriority = this.getLanguagePriority(aLower);
            const bPriority = this.getLanguagePriority(bLower);
            if (aPriority !== bPriority) return aPriority - bPriority;
        } else {
            const aIndex = aLower.indexOf(query);
            const bIndex = bLower.indexOf(query);
            if (aIndex !== bIndex) return aIndex - bIndex;

            const aLen = a.length;
            const bLen = b.length;
            if (aLen !== bLen) return aLen - bLen;
        }

        return a.localeCompare(b);
    }

    private renderSuggest(): void {
        const query = this.inputEl.value.trim().toLowerCase();
        if (!query) {
            this.hideSuggest();
            return;
        }

        const matched = this.allOptions
            .filter((lang) => lang.includes(query))
            .sort((a, b) => this.compareLanguageMatch(a, b, query))
            .slice(0, 60);
        if (matched.length === 0) {
            this.hideSuggest();
            return;
        }

        this.suggestEl.innerHTML = "";
        matched.forEach((lang) => {
            const option = document.createElement("div");
            option.className = "code-tabs__editor-lang-option";
            option.dataset.value = lang;
            option.textContent = lang;
            option.setAttribute("role", "button");
            option.setAttribute("tabindex", "0");
            this.suggestEl.appendChild(option);
        });

        this.suggestEl.classList.add("code-tabs__editor-lang-suggest--open");
        this.setActive(0);
    }

    private hideSuggest(): void {
        this.suggestEl.classList.remove("code-tabs__editor-lang-suggest--open");
        this.suggestEl.innerHTML = "";
        this.activeIndex = -1;
    }

    private getOptions(): HTMLElement[] {
        return Array.from(
            this.suggestEl.querySelectorAll<HTMLElement>(".code-tabs__editor-lang-option")
        );
    }

    private setActive(nextIndex: number): void {
        const options = this.getOptions();
        if (options.length === 0) return;

        const total = options.length;
        const safeIndex = ((nextIndex % total) + total) % total;

        options.forEach((option) =>
            option.classList.remove("code-tabs__editor-lang-option--active")
        );

        const active = options[safeIndex];
        active.classList.add("code-tabs__editor-lang-option--active");
        active.scrollIntoView({ block: "nearest" });
        this.activeIndex = safeIndex;
    }

    destroy(): void {
        this.hideSuggest();
    }
}
