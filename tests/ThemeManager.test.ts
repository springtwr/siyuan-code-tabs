import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { BACKGROUND_CSS, CODE_STYLE_CSS } from "@/constants";
import { putFile } from "@/api";
import { fetchFileFromUrl, fetchYamlFromUrl } from "@/utils/network";
import { StyleProbe } from "@/modules/theme/StyleProbe";

vi.mock("@/api", () => ({
    putFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/network", () => ({
    fetchFileFromUrl: vi.fn(),
    fetchYamlFromUrl: vi.fn(),
}));

vi.mock("@/modules/theme/StyleProbe", () => ({
    StyleProbe: {
        getFullStyle: vi.fn(() => ({
            blockBg: "#fff",
            protyleActionBg: "#fff",
            hljsBg: "#fff",
            editableBg: "#fff",
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: "1.5",
            blockPadding: "8px",
            hljsPadding: "8px",
            editablePadding: "8px",
            blockMargin: "0",
            hljsMargin: "0",
            editableMargin: "0",
            color: "#000",
            border: "1px solid #000",
            borderLeft: "none",
            boxShadow: "none",
            borderRadius: "4px",
            protyleActionPosition: "static",
            protyleActionBorderBottom: "1px solid #000",
            hljsBorderTop: "1px solid #000",
            hljsOverflowY: "auto",
            hljsMaxHeight: "none",
        })),
        getCachedStyle: vi.fn(() => ({
            blockBg: "#fff",
            protyleActionBg: "#fff",
            hljsBg: "#fff",
            editableBg: "#fff",
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: "1.5",
            blockPadding: "8px",
            hljsPadding: "8px",
            editablePadding: "8px",
            blockMargin: "0",
            hljsMargin: "0",
            editableMargin: "0",
            color: "#000",
            border: "1px solid #000",
            borderLeft: "none",
            boxShadow: "none",
            borderRadius: "4px",
            protyleActionPosition: "static",
            protyleActionBorderBottom: "1px solid #000",
            hljsBorderTop: "1px solid #000",
            hljsOverflowY: "auto",
            hljsMaxHeight: "none",
        })),
        resetCachedStyle: vi.fn(),
    },
}));

const resetThemeManagerState = () => {
    const manager = ThemeManager as unknown as {
        lastCodeStyleHref?: string;
        lastMarkdownMode?: string;
        lastBackgroundHash?: string;
        cachedThemeConfig?: unknown;
        lastThemeKey?: string;
    };
    manager.lastCodeStyleHref = undefined;
    manager.lastMarkdownMode = undefined;
    manager.lastBackgroundHash = undefined;
    manager.cachedThemeConfig = undefined;
    manager.lastThemeKey = undefined;
};

describe("ThemeManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetThemeManagerState();
        document.head.innerHTML = "";
        document.documentElement.setAttribute("data-theme-mode", "light");
        document.documentElement.setAttribute("data-light-theme", "default");
        document.documentElement.setAttribute("data-dark-theme", "default");
        window.siyuan.config.appearance.mode = "light";
        window.siyuan.config.editor.codeLigatures = false;
        window.siyuan.config.editor.codeLineWrap = false;
    });

    it("putStyleFile updates code-style css when link changes", async () => {
        const link = document.createElement("link");
        link.id = "protyleHljsStyle";
        link.href = "https://example.com/hljs.css";
        document.head.appendChild(link);

        (fetchFileFromUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            new File([""], "code-style.css", { type: "text/css" })
        );

        const result = await ThemeManager.putStyleFile({
            update: { codeStyle: true, background: false, markdown: false },
        });

        expect(putFile).toHaveBeenCalledWith(CODE_STYLE_CSS, false, expect.any(File));
        expect(result.codeStyle).toBe(true);
    });

    it("putStyleFile updates background css when theme changes", async () => {
        (fetchYamlFromUrl as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            version: "1",
            themes: [],
        });

        const result = await ThemeManager.putStyleFile({
            update: { codeStyle: false, background: true, markdown: false },
            forceProbe: true,
        });

        expect(putFile).toHaveBeenCalledWith(BACKGROUND_CSS, false, expect.any(File));
        expect(result.background).toBe(true);
        expect(StyleProbe.getFullStyle).toHaveBeenCalled();
    });
});
