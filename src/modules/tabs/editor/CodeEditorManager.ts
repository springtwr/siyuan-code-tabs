import { CodeJar } from "codejar";

type HighlightCallback = (code: string, lang: string) => string;

export interface CodeEditorOptions {
    tab?: string;
    indentOn?: RegExp;
    preserveIdent?: boolean;
    addClosing?: boolean;
    language?: string;
    smartClosing?: boolean;
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

export class CodeEditorManager implements CodeEditorInterface {
    private jar: CodeJar | null = null;
    private container: HTMLElement;
    private preElement: HTMLPreElement | null = null;
    private codeElement: HTMLElement | null = null;
    private onUpdate?: (code: string) => void;
    private language: string = "plaintext";
    private highlight: HighlightCallback;
    private smartClosing: boolean = false;

    constructor(container: HTMLElement, onUpdate?: (code: string) => void) {
        this.container = container;
        this.onUpdate = onUpdate;
        this.highlight = this.createHighlightFn();
    }

    private createHighlightFn(): HighlightCallback {
        const hljs = (
            window as Window & {
                hljs?: {
                    highlight: (code: string, lang: { language: string }) => { value: string };
                };
            }
        ).hljs;

        if (hljs) {
            return (code: string, lang: string): string => {
                try {
                    const result = hljs.highlight(code, { language: lang });
                    return result.value;
                } catch {
                    return this.escapeHtml(code);
                }
            };
        }

        return (code: string): string => {
            return this.escapeHtml(code);
        };
    }

    private escapeHtml(code: string): string {
        return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    public init(options: CodeEditorOptions = {}): void {
        if (options.language) {
            this.language = options.language;
        }

        this.smartClosing = options.smartClosing ?? true;

        this.setupContainer();

        if (!this.codeElement) {
            return;
        }

        const highlightFn = (editor: HTMLElement) => {
            const code = editor.textContent || "";
            editor.innerHTML = this.highlight(code, this.language);
        };

        const useAddClosing = options.addClosing ?? true;

        this.jar = CodeJar(this.codeElement, highlightFn, {
            tab: options.tab || "    ",
            indentOn: options.indentOn || /([{[])$/,
            preserveIdent: options.preserveIdent ?? true,
            addClosing: useAddClosing,
            history: true,
            catchTab: true,
        });

        if (this.smartClosing) {
            this.setupSmartClosing();
        }

        if (this.onUpdate) {
            this.jar.onUpdate(this.onUpdate);
        }
    }

    private setupSmartClosing(): void {
        if (!this.codeElement) {
            return;
        }

        this.codeElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey) {
                return;
            }

            const closingChars = ")]}'\"";
            const char = event.key;

            const closingIndex = closingChars.indexOf(char);
            if (closingIndex === -1) {
                return;
            }

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                return;
            }

            const range = selection.getRangeAt(0);
            if (!range.collapsed) {
                return;
            }

            const textNode = range.startContainer;
            if (textNode.nodeType !== Node.TEXT_NODE) {
                return;
            }

            const text = textNode.textContent || "";
            const offset = range.startOffset;

            if (offset < text.length && text[offset] === char) {
                event.preventDefault();
                const newRange = document.createRange();
                newRange.setStart(textNode, offset + 1);
                newRange.setEnd(textNode, offset + 1);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        });

        this.codeElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "a") {
                event.preventDefault();
                const selection = window.getSelection();
                if (selection && this.codeElement) {
                    const range = document.createRange();
                    range.selectNodeContents(this.codeElement);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        });
    }

    private setupContainer(): void {
        this.container.innerHTML = "";

        this.preElement = document.createElement("pre");
        this.preElement.className = "code-tabs__editor-pre";

        this.codeElement = document.createElement("code");
        this.codeElement.className = "code-tabs__editor-code-inner";

        this.preElement.appendChild(this.codeElement);
        this.container.appendChild(this.preElement);
    }

    public updateCode(code: string): void {
        if (this.jar) {
            this.jar.updateCode(code);
        } else if (this.codeElement) {
            this.codeElement.textContent = code;
        }
    }

    public getCode(): string {
        if (this.jar) {
            return this.jar.toString();
        }
        return this.codeElement?.textContent || "";
    }

    public focus(): void {
        if (this.codeElement) {
            this.codeElement.focus();
        }
    }

    public destroy(): void {
        if (this.jar) {
            this.jar.destroy();
            this.jar = null;
        }
        this.preElement = null;
        this.codeElement = null;
        this.smartClosing = false;
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public updateLanguage(language: string): void {
        this.language = language;
        if (this.jar && this.codeElement) {
            const code = this.jar.toString();
            this.codeElement.innerHTML = this.highlight(code, this.language);
        }
    }

    public isCursorAtStart(): boolean {
        if (!this.jar) {
            return false;
        }

        const position = this.jar.save();
        return position.start === 0;
    }
}
