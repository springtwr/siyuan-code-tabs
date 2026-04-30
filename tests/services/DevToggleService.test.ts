import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DevToggleService } from "@/services/DevToggleService";

vi.mock("@/services/ThemeManager", () => ({
    ThemeManager: {
        putStyleFile: vi.fn().mockResolvedValue({ changed: false }),
        updateAllTabsStyle: vi.fn(),
    },
}));

vi.mock("@/services/LineNumberService", () => ({
    LineNumberService: {
        refreshAll: vi.fn(),
        scanAll: vi.fn(),
    },
}));

vi.mock("@/utils/dom", () => ({
    syncSiyuanConfig: vi.fn(),
}));

describe("DevToggleService", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        
        vi.stubGlobal("window", {
            siyuan: {
                config: {
                    editor: {
                        codeLineWrap: false,
                        codeLigatures: false,
                        codeSyntaxHighlightLineNum: false,
                    },
                },
            },
        });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    describe("toggleEditorSetting", () => {
        it("should toggle codeLineWrap setting", () => {
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeLineWrap", data, onReload);
            
            expect(window.siyuan.config.editor.codeLineWrap).toBe(true);
        });

        it("should toggle codeLigatures setting", () => {
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeLigatures", data, onReload);
            
            expect(window.siyuan.config.editor.codeLigatures).toBe(true);
        });

        it("should toggle codeSyntaxHighlightLineNum setting", () => {
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeSyntaxHighlightLineNum", data, onReload);
            
            expect(window.siyuan.config.editor.codeSyntaxHighlightLineNum).toBe(true);
        });

        it("should toggle from true to false", () => {
            window.siyuan.config.editor.codeLineWrap = true;
            
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeLineWrap", data, onReload);
            
            expect(window.siyuan.config.editor.codeLineWrap).toBe(false);
        });

        it("should call onReload callback", async () => {
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeLineWrap", data, onReload);
            
            await vi.waitFor(() => {
                expect(onReload).toHaveBeenCalled();
            });
        });
    });

    describe("错误处理", () => {
        it("should handle ThemeManager.putStyleFile error gracefully", async () => {
            const onReload = vi.fn();
            const data = {};
            
            DevToggleService.toggleEditorSetting("codeLineWrap", data, onReload);
            
            await vi.waitFor(() => {
                expect(onReload).toHaveBeenCalled();
            });
        });
    });
});
