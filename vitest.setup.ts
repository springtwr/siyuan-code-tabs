import { vi } from "vitest";

if (!globalThis.atob) {
    globalThis.atob = (input: string) => Buffer.from(input, "base64").toString("binary");
}
if (!globalThis.btoa) {
    globalThis.btoa = (input: string) => Buffer.from(input, "binary").toString("base64");
}

if (!globalThis.window.hljs) {
    globalThis.window.hljs = {
        getLanguage: (lang: string) => (lang ? { name: lang } : null),
        highlight: (code: string) => ({ value: code }),
    };
}

if (!globalThis.window.siyuan) {
    globalThis.window.siyuan = {
        appearance: {},
        config: {
            editor: {
                fontSize: 16,
                codeLigatures: false,
                codeLineWrap: false,
                codeSyntaxHighlightLineNum: false,
                codeTabSpaces: 4,
                allowHTMLBLockScript: true,
                katexMacros: "{}",
                plantUMLServePath: "http://www.plantuml.com/plantuml/svg/~1",
            },
            appearance: {
                mode: "light",
                themeLight: "default",
                themeDark: "default",
                codeBlockThemeLight: "default",
                codeBlockThemeDark: "default",
            },
        },
        notebooks: {},
        menus: {},
        dialogs: {},
        blockPanels: {},
        storage: {},
        user: {},
        ws: {},
        languages: {},
    };
}

vi.stubGlobal("TextEncoder", globalThis.TextEncoder);
vi.stubGlobal("TextDecoder", globalThis.TextDecoder);
