import { describe, it, expect } from "vitest";
import {
    CUSTOM_ATTR,
    CODE_TABS_DATA_ATTR,
    CODE_TAB_TITLE_ATTR,
    NEWLINE_FLAG,
    TAB_WIDTH_MIN,
    TAB_WIDTH_MAX,
    TAB_WIDTH_DEFAULT,
    TAB_WIDTH_SETTING_KEY,
    LEGACY_CHECK_VERSION_KEY,
    LEGACY_EXISTS_KEY,
    LEGACY_COUNT_KEY,
    PLUGIN_VERSION,
    PLUGIN_STYLE_ID,
    VIRTUAL_NODE_ID,
    EDITOR_TAB_SIZE_KEY,
    EDITOR_WORD_WRAP_KEY,
    EDITOR_LINE_NUMBERS_KEY,
} from "@/constants/keys";
import {
    PLUGIN_PATH,
    DATA_PATH,
    SIYUAN_PATH,
    CONFIG_JSON,
    THEME_ADAPTION_YAML,
    THEME_ADAPTION_ASSET_YAML,
    CODE_STYLE_CSS,
    BACKGROUND_CSS,
    GITHUB_MARKDOWN_CSS,
    GITHUB_MARKDOWN_DARK_CSS,
    GITHUB_MARKDOWN_LIGHT_CSS,
    KATEX_CSS,
    CODE_TABS_CSS,
    CODE_TABS_ICONS,
    DEBUG_LOG,
} from "@/constants/paths";
import { PROTYLE_HTML, ICON_MAIN } from "@/constants/templates";

describe("constants", () => {
    describe("keys 常量", () => {
        it("should have valid CUSTOM_ATTR", () => {
            expect(CUSTOM_ATTR).toBe("custom-plugin-code-tabs-sourcecode");
            expect(typeof CUSTOM_ATTR).toBe("string");
        });

        it("should have valid CODE_TABS_DATA_ATTR", () => {
            expect(CODE_TABS_DATA_ATTR).toBe("custom-code-tabs-data");
            expect(typeof CODE_TABS_DATA_ATTR).toBe("string");
        });

        it("should have valid CODE_TAB_TITLE_ATTR", () => {
            expect(CODE_TAB_TITLE_ATTR).toBe("custom-code-tab-title");
            expect(typeof CODE_TAB_TITLE_ATTR).toBe("string");
        });

        it("should have valid NEWLINE_FLAG", () => {
            expect(NEWLINE_FLAG).toBe("⤵↩");
            expect(typeof NEWLINE_FLAG).toBe("string");
        });

        it("should have valid tab width constants", () => {
            expect(TAB_WIDTH_MIN).toBe(4);
            expect(TAB_WIDTH_MAX).toBe(30);
            expect(TAB_WIDTH_DEFAULT).toBe(12);
            expect(TAB_WIDTH_MIN).toBeLessThan(TAB_WIDTH_MAX);
            expect(TAB_WIDTH_DEFAULT).toBeGreaterThanOrEqual(TAB_WIDTH_MIN);
            expect(TAB_WIDTH_DEFAULT).toBeLessThanOrEqual(TAB_WIDTH_MAX);
        });

        it("should have valid setting keys", () => {
            expect(TAB_WIDTH_SETTING_KEY).toBe("codeTabsTabWidth");
            expect(LEGACY_CHECK_VERSION_KEY).toBe("codeTabsLegacyCheckVersion");
            expect(LEGACY_EXISTS_KEY).toBe("codeTabsLegacyExists");
            expect(LEGACY_COUNT_KEY).toBe("codeTabsLegacyCount");
        });

        it("should have valid PLUGIN_VERSION", () => {
            expect(typeof PLUGIN_VERSION).toBe("string");
        });

        it("should have valid PLUGIN_STYLE_ID", () => {
            expect(PLUGIN_STYLE_ID).toBe("pluginsStylecode-tabs");
        });

        it("should have valid VIRTUAL_NODE_ID", () => {
            expect(VIRTUAL_NODE_ID).toBe("19700101000000-codetab");
        });

        it("should have valid editor setting keys", () => {
            expect(EDITOR_TAB_SIZE_KEY).toBe("codeTabsEditorTabSize");
            expect(EDITOR_WORD_WRAP_KEY).toBe("codeTabsEditorWordWrap");
            expect(EDITOR_LINE_NUMBERS_KEY).toBe("codeTabsEditorLineNumbers");
        });
    });

    describe("paths 常量", () => {
        it("should have valid PLUGIN_PATH", () => {
            expect(PLUGIN_PATH).toBe("/plugins/code-tabs");
            expect(PLUGIN_PATH.startsWith("/")).toBe(true);
        });

        it("should have valid DATA_PATH", () => {
            expect(DATA_PATH).toBe("/data/plugins/code-tabs");
            expect(DATA_PATH.startsWith("/data")).toBe(true);
        });

        it("should have valid SIYUAN_PATH", () => {
            expect(SIYUAN_PATH).toBe("/stage/protyle");
        });

        it("should have valid config paths", () => {
            expect(CONFIG_JSON).toContain(DATA_PATH);
            expect(CONFIG_JSON).toContain("config.json");
        });

        it("should have valid theme adaption paths", () => {
            expect(THEME_ADAPTION_YAML).toContain(DATA_PATH);
            expect(THEME_ADAPTION_ASSET_YAML).toContain(PLUGIN_PATH);
        });

        it("should have valid css paths", () => {
            expect(CODE_STYLE_CSS).toContain("code-style.css");
            expect(BACKGROUND_CSS).toContain("background.css");
            expect(GITHUB_MARKDOWN_CSS).toContain("github-markdown.css");
            expect(KATEX_CSS).toContain("katex.min.css");
            expect(CODE_TABS_CSS).toContain("code-tabs.css");
        });

        it("should have valid icon path", () => {
            expect(CODE_TABS_ICONS).toContain("code-tabs-icons.svg");
        });

        it("should have valid debug log path", () => {
            expect(DEBUG_LOG).toContain("debug.log");
            expect(DEBUG_LOG).toContain(DATA_PATH);
        });

        it("should have valid github markdown css paths", () => {
            expect(GITHUB_MARKDOWN_DARK_CSS).toContain("github-markdown-dark.css");
            expect(GITHUB_MARKDOWN_LIGHT_CSS).toContain("github-markdown-light.css");
        });
    });

    describe("templates 常量", () => {
        it("should have valid PROTYLE_HTML", () => {
            expect(typeof PROTYLE_HTML).toBe("string");
            expect(PROTYLE_HTML.length).toBeGreaterThan(0);
            expect(PROTYLE_HTML).toContain("tabs-container");
            expect(PROTYLE_HTML).toContain("tabs-outer");
            expect(PROTYLE_HTML).toContain("tabs");
            expect(PROTYLE_HTML).toContain("tab-contents");
        });

        it("should have valid ICON_MAIN", () => {
            expect(typeof ICON_MAIN).toBe("string");
            expect(ICON_MAIN.length).toBeGreaterThan(0);
            expect(ICON_MAIN).toContain("<svg");
            expect(ICON_MAIN).toContain("</svg>");
        });

        it("PROTYLE_HTML should contain required elements", () => {
            expect(PROTYLE_HTML).toContain("code-tabs--icon_group");
            expect(PROTYLE_HTML).toContain("code-tabs--icon_default");
            expect(PROTYLE_HTML).toContain("code-tabs--icon_edit");
            expect(PROTYLE_HTML).toContain("code-tabs--icon_copy");
        });

        it("PROTYLE_HTML should be minified", () => {
            expect(PROTYLE_HTML).not.toMatch(/>\s+</);
            expect(PROTYLE_HTML).not.toMatch(/\n/);
        });
    });

    describe("常量完整性验证", () => {
        it("all path constants should start with /", () => {
            const paths = [
                PLUGIN_PATH,
                DATA_PATH,
                SIYUAN_PATH,
                CONFIG_JSON,
                THEME_ADAPTION_YAML,
                THEME_ADAPTION_ASSET_YAML,
                CODE_STYLE_CSS,
                BACKGROUND_CSS,
                GITHUB_MARKDOWN_CSS,
                GITHUB_MARKDOWN_DARK_CSS,
                GITHUB_MARKDOWN_LIGHT_CSS,
                KATEX_CSS,
                CODE_TABS_CSS,
                CODE_TABS_ICONS,
                DEBUG_LOG,
            ];
            
            paths.forEach((path) => {
                expect(path.startsWith("/")).toBe(true);
            });
        });

        it("all string constants should be non-empty", () => {
            const stringConstants = [
                CUSTOM_ATTR,
                CODE_TABS_DATA_ATTR,
                CODE_TAB_TITLE_ATTR,
                NEWLINE_FLAG,
                TAB_WIDTH_SETTING_KEY,
                PLUGIN_STYLE_ID,
                VIRTUAL_NODE_ID,
            ];
            
            stringConstants.forEach((str) => {
                expect(str.length).toBeGreaterThan(0);
            });
        });

        it("all numeric constants should be valid numbers", () => {
            expect(Number.isInteger(TAB_WIDTH_MIN)).toBe(true);
            expect(Number.isInteger(TAB_WIDTH_MAX)).toBe(true);
            expect(Number.isInteger(TAB_WIDTH_DEFAULT)).toBe(true);
            expect(TAB_WIDTH_MIN).toBeGreaterThan(0);
            expect(TAB_WIDTH_MAX).toBeGreaterThan(0);
            expect(TAB_WIDTH_DEFAULT).toBeGreaterThan(0);
        });
    });
});
