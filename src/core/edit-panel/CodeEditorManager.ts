import { createEditor, PrismEditor } from "prism-code-editor";
import { defaultCommands } from "prism-code-editor/commands";
import { matchBrackets } from "prism-code-editor/match-brackets";
import { indentGuides } from "prism-code-editor/guides";
import { searchWidget, highlightSelectionMatches, highlightCurrentWord } from "prism-code-editor/search";
import "prism-code-editor/layout.css";
import "prism-code-editor/guides.css";
import "prism-code-editor/search.css";
import "prism-code-editor/invisibles.css";
import "prism-code-editor/prism/languages/common";
import githubDarkTheme from "prism-code-editor/themes/github-dark.css?raw";
import githubLightTheme from "prism-code-editor/themes/github-light.css?raw";

import { t } from "@/utils/i18n";
import { EDITOR_TAB_SIZE_KEY, EDITOR_WORD_WRAP_KEY, EDITOR_LINE_NUMBERS_KEY } from "@/constants";

export interface CodeEditorOptions {
    language?: string;
    lineNumbers?: boolean;
}

export interface CodeEditorInterface {
    init(options?: CodeEditorOptions): void;
    updateCode(code: string): void;
    getCode(): string;
    focus(): void;
    destroy(): void;
    getElement(): HTMLElement;
    updateLanguage(language: string): void;
    isCursorAtStart(): boolean;
}

interface PluginConfig {
    mode?: number;
}

interface PluginMap {
    [key: string]: PluginConfig | undefined;
}

interface ConfigWithPlugin {
    plugin?: PluginMap;
    appearance?: {
        mode?: string;
    };
}

interface CodeEditorManagerOptions {
    i18n: Record<string, string>;
    data: Record<string, unknown>;
    onSaveConfig: () => Promise<void>;
}

function getCurrentThemeMode(): boolean {
    const config = window.siyuan?.config as ConfigWithPlugin;
    const pluginMode = config?.plugin?.["code-tabs"]?.mode;
    if (pluginMode !== undefined && pluginMode !== null) {
        return pluginMode === 1;
    }

    const html = document.documentElement;
    const mode = html.getAttribute("data-theme-mode") === "dark";
    if (mode !== null) {
        return mode;
    }
    const configMode = config?.appearance?.mode;
    return configMode === "dark";
}

export class CodeEditorManager implements CodeEditorInterface {
    private editor: PrismEditor | null = null;
    private container: HTMLElement;
    private themeElement: HTMLStyleElement | null = null;
    private statusBar: HTMLElement | null = null;
    private statusLineCol: HTMLElement | null = null;
    private statusLanguage: HTMLElement | null = null;
    private statusTabSize: HTMLElement | null = null;
    private statusLineNumbers: HTMLElement | null = null;
    private statusWordWrap: HTMLElement | null = null;
    private showLineNumbers: boolean = true;
    private wordWrap: boolean = true;
    private tabSize: number = 4;
    private readonly i18n: Record<string, string>;
    private readonly data: Record<string, unknown>;
    private readonly onSaveConfig: () => Promise<void>;

    constructor(container: HTMLElement, options: CodeEditorManagerOptions, _onUpdate?: (code: string) => void) {
        this.container = container;
        this.i18n = options.i18n;
        this.data = options.data;
        this.onSaveConfig = options.onSaveConfig;
        this.loadConfig();
    }

    private loadConfig(): void {
        this.tabSize = this.getConfigValue(EDITOR_TAB_SIZE_KEY, 4);
        this.wordWrap = this.getConfigValue(EDITOR_WORD_WRAP_KEY, true);
        this.showLineNumbers = this.getConfigValue(EDITOR_LINE_NUMBERS_KEY, true);
    }

    private getConfigValue<T>(key: string, defaultValue: T): T {
        const value = this.data[key];
        if (value === undefined || value === null) {
            return defaultValue;
        }
        return value as T;
    }

    private saveConfig(): void {
        this.data[EDITOR_TAB_SIZE_KEY] = this.tabSize;
        this.data[EDITOR_WORD_WRAP_KEY] = this.wordWrap;
        this.data[EDITOR_LINE_NUMBERS_KEY] = this.showLineNumbers;
        void this.onSaveConfig();
    }

    public init(options: CodeEditorOptions = {}): void {
        this.container.innerHTML = "";
        this.container.style.height = "100%";
        this.container.style.overflow = "hidden";
        this.container.style.position = "relative";
        this.container.style.display = "flex";
        this.container.style.flexDirection = "column";

        const isDark = getCurrentThemeMode();

        this.themeElement = document.createElement("style");
        this.themeElement.textContent = isDark ? githubDarkTheme : githubLightTheme;
        this.container.appendChild(this.themeElement);

        const editorWrapper = document.createElement("div");
        editorWrapper.style.flex = "1";
        editorWrapper.style.overflow = "hidden";
        this.container.appendChild(editorWrapper);

        this.editor = createEditor(
            editorWrapper,
            {
                language: options.language || "plaintext",
                value: "",
                lineNumbers: this.showLineNumbers,
                wordWrap: this.wordWrap,
                tabSize: this.tabSize,
                insertSpaces: true,
            },
            defaultCommands(),
            matchBrackets(),
            indentGuides(),
            searchWidget(),
            highlightSelectionMatches(),
            highlightCurrentWord()
        );

        this.createStatusBar(isDark);
        this.setupEventListeners();
    }

    private createStatusBar(isDark: boolean): void {
        this.statusBar = document.createElement("div");
        this.statusBar.className = `code-editor-status-bar ${isDark ? "dark" : "light"}`;
        this.container.appendChild(this.statusBar);

        this.statusLanguage = document.createElement("span");
        this.statusLanguage.className = "status-item";
        this.statusLanguage.textContent = "Plain Text";
        this.statusBar.appendChild(this.statusLanguage);

        const rightSection = document.createElement("div");
        rightSection.className = "status-right";
        this.statusBar.appendChild(rightSection);

        this.statusLineCol = document.createElement("span");
        this.statusLineCol.className = "status-item";
        this.statusLineCol.textContent = `${t(this.i18n, "editor.status.line")} 1, ${t(this.i18n, "editor.status.column")} 1`;
        rightSection.appendChild(this.statusLineCol);

        this.statusTabSize = document.createElement("button");
        this.statusTabSize.className = "status-item status-btn";
        this.statusTabSize.textContent = `Tab: ${this.tabSize}`;
        this.statusTabSize.addEventListener("click", () => this.cycleTabSize());
        rightSection.appendChild(this.statusTabSize);

        this.statusLineNumbers = document.createElement("button");
        this.statusLineNumbers.className = "status-item status-btn";
        this.statusLineNumbers.textContent = `${t(this.i18n, "editor.status.lineNumbers")}: ${this.showLineNumbers ? t(this.i18n, "editor.status.on") : t(this.i18n, "editor.status.off")}`;
        this.statusLineNumbers.addEventListener("click", () => this.toggleLineNumbers());
        rightSection.appendChild(this.statusLineNumbers);

        this.statusWordWrap = document.createElement("button");
        this.statusWordWrap.className = "status-item status-btn";
        this.statusWordWrap.textContent = `${t(this.i18n, "editor.status.wordWrap")}: ${this.wordWrap ? t(this.i18n, "editor.status.on") : t(this.i18n, "editor.status.off")}`;
        this.statusWordWrap.addEventListener("click", () => this.toggleWordWrap());
        rightSection.appendChild(this.statusWordWrap);
    }

    private setupEventListeners(): void {
        if (!this.editor) return;

        this.editor.on("selectionChange", () => {
            this.updateStatusBar();
        });
    }

    private updateStatusBar(): void {
        if (!this.editor || !this.statusLineCol || !this.statusLanguage) return;

        const [start] = this.editor.getSelection();
        const lines = this.editor.value.substring(0, start).split("\n");
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        this.statusLineCol.textContent = `${t(this.i18n, "editor.status.line")} ${line}, ${t(this.i18n, "editor.status.column")} ${col}`;

        const lang = this.editor.options.language;
        this.statusLanguage.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    }

    private toggleLineNumbers(): void {
        if (!this.editor || !this.statusLineNumbers) return;
        this.showLineNumbers = !this.showLineNumbers;
        this.editor.setOptions({ lineNumbers: this.showLineNumbers });
        this.statusLineNumbers.textContent = `${t(this.i18n, "editor.status.lineNumbers")}: ${this.showLineNumbers ? t(this.i18n, "editor.status.on") : t(this.i18n, "editor.status.off")}`;
        this.saveConfig();
    }

    private toggleWordWrap(): void {
        if (!this.editor || !this.statusWordWrap) return;
        this.wordWrap = !this.wordWrap;
        this.editor.setOptions({ wordWrap: this.wordWrap });
        this.statusWordWrap.textContent = `${t(this.i18n, "editor.status.wordWrap")}: ${this.wordWrap ? t(this.i18n, "editor.status.on") : t(this.i18n, "editor.status.off")}`;
        this.saveConfig();
    }

    private cycleTabSize(): void {
        if (!this.editor || !this.statusTabSize) return;
        const tabSizes = [2, 4, 8];
        const currentIndex = tabSizes.indexOf(this.tabSize);
        const nextIndex = (currentIndex + 1) % tabSizes.length;
        this.tabSize = tabSizes[nextIndex];
        this.editor.setOptions({ tabSize: this.tabSize });
        this.statusTabSize.textContent = `Tab: ${this.tabSize}`;
        this.saveConfig();
    }

    public updateCode(code: string): void {
        if (this.editor) {
            this.editor.setOptions({ value: code });
        }
    }

    public getCode(): string {
        return this.editor?.value || "";
    }

    public focus(): void {
        this.editor?.textarea.focus();
    }

    public destroy(): void {
        this.editor?.remove();
        this.editor = null;
        if (this.themeElement) {
            this.themeElement.remove();
            this.themeElement = null;
        }
        if (this.statusBar) {
            this.statusBar.remove();
            this.statusBar = null;
        }
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public updateLanguage(language: string): void {
        if (this.editor) {
            this.editor.setOptions({ language });
            if (this.statusLanguage) {
                this.statusLanguage.textContent = language.charAt(0).toUpperCase() + language.slice(1);
            }
        }
    }

    public isCursorAtStart(): boolean {
        return this.editor ? this.editor.getSelection()[0] === 0 : false;
    }
}