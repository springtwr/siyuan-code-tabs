import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StyleProbe } from "@/services/StyleProbe";

describe("StyleProbe", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        StyleProbe.cleanup();
    });

    describe("get", () => {
        it("should return style snapshot", () => {
            const snapshot = StyleProbe.get();
            
            expect(snapshot).toBeDefined();
            expect(snapshot.block).toBeDefined();
            expect(snapshot.header).toBeDefined();
            expect(snapshot.body).toBeDefined();
            expect(snapshot.content).toBeDefined();
        });

        it("should return correct structure for block", () => {
            const snapshot = StyleProbe.get();
            
            expect(typeof snapshot.block.backgroundColor).toBe("string");
            expect(typeof snapshot.block.fontSize).toBe("string");
            expect(typeof snapshot.block.lineHeight).toBe("string");
        });

        it("should return correct structure for header", () => {
            const snapshot = StyleProbe.get();
            
            expect(typeof snapshot.header.position).toBe("string");
            expect(typeof snapshot.header.height).toBe("string");
        });

        it("should return correct structure for body", () => {
            const snapshot = StyleProbe.get();
            
            expect(typeof snapshot.body.fontFamily).toBe("string");
            expect(typeof snapshot.body.padding).toBe("string");
        });
    });

    describe("getFullStyle", () => {
        it("should return ThemeStyle object", () => {
            const style = StyleProbe.getFullStyle();
            
            expect(style).toBeDefined();
            expect(typeof style.blockBg).toBe("string");
            expect(typeof style.hljsBg).toBe("string");
            expect(typeof style.fontFamily).toBe("string");
            expect(typeof style.fontSize).toBe("string");
        });

        it("should contain all required properties", () => {
            const style = StyleProbe.getFullStyle();
            
            const requiredProps = [
                "blockBg",
                "protyleActionBg",
                "hljsBg",
                "editableBg",
                "fontFamily",
                "fontSize",
                "lineHeight",
                "blockPadding",
                "hljsPadding",
                "editablePadding",
                "blockMargin",
                "hljsMargin",
                "editableMargin",
                "color",
                "border",
                "borderLeft",
                "boxShadow",
                "borderRadius",
            ];
            
            requiredProps.forEach((prop) => {
                expect(style).toHaveProperty(prop);
            });
        });
    });

    describe("getCachedStyle", () => {
        it("should return cached style if available", () => {
            StyleProbe.getFullStyle();
            const cached = StyleProbe.getCachedStyle();
            
            expect(cached).toBeDefined();
        });

        it("should return new style if cache is empty", () => {
            StyleProbe.cleanup();
            const style = StyleProbe.getCachedStyle();
            
            expect(style).toBeDefined();
        });
    });

    describe("resetCachedStyle", () => {
        it("should reset cached style", () => {
            StyleProbe.getFullStyle();
            StyleProbe.resetCachedStyle();
            
            const style = StyleProbe.getCachedStyle();
            expect(style).toBeDefined();
        });
    });

    describe("cleanup", () => {
        it("should cleanup without error", () => {
            StyleProbe.get();
            expect(() => StyleProbe.cleanup()).not.toThrow();
        });

        it("should be idempotent", () => {
            StyleProbe.cleanup();
            StyleProbe.cleanup();
            expect(() => StyleProbe.cleanup()).not.toThrow();
        });
    });

    describe("DOM 操作", () => {
        it("should create and remove virtual protyle", () => {
            StyleProbe.get();
            
            const virtualNode = document.querySelector('[data-node-id="19700101000000-codetab"]');
            expect(virtualNode).toBeNull();
        });

        it("should not have memory leak after multiple calls", () => {
            for (let i = 0; i < 10; i++) {
                StyleProbe.get();
            }
            
            const virtualNodes = document.querySelectorAll('[data-node-id="19700101000000-codetab"]');
            expect(virtualNodes.length).toBe(0);
        });
    });
});
