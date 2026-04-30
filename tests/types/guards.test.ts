import { describe, it, expect } from "vitest";
import type { TabsData } from "@/types/tabs";

describe("types", () => {
    describe("TabsData 类型守卫", () => {
        it("should validate correct TabsData structure", () => {
            const validData: TabsData = {
                version: 2,
                active: 0,
                tabs: [
                    { title: "JavaScript", lang: "javascript", code: "console.log(1);" },
                ],
            };
            
            expect(validData.version).toBe(2);
            expect(validData.active).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(validData.tabs)).toBe(true);
        });

        it("should validate TabsData with multiple tabs", () => {
            const data: TabsData = {
                version: 2,
                active: 1,
                tabs: [
                    { title: "JS", lang: "javascript", code: "code1" },
                    { title: "Python", lang: "python", code: "code2" },
                    { title: "Go", lang: "go", code: "code3" },
                ],
            };
            
            expect(data.tabs.length).toBe(3);
            expect(data.active).toBeLessThan(data.tabs.length);
        });
    });

    describe("TabDataItem 类型", () => {
        it("should validate TabDataItem structure", () => {
            const tabItem = {
                title: "JavaScript",
                lang: "javascript",
                code: "console.log(1);",
            };
            
            expect(typeof tabItem.title).toBe("string");
            expect(typeof tabItem.lang).toBe("string");
            expect(typeof tabItem.code).toBe("string");
        });

        it("should allow empty code", () => {
            const emptyCodeTab = {
                title: "Empty",
                lang: "text",
                code: "",
            };
            
            expect(emptyCodeTab.code).toBe("");
        });
    });

    describe("CodeTab 类型", () => {
        it("should validate CodeTab structure", () => {
            const codeTab = {
                title: "JavaScript",
                language: "javascript",
                code: "console.log(1);",
                isActive: true,
            };
            
            expect(typeof codeTab.title).toBe("string");
            expect(typeof codeTab.language).toBe("string");
            expect(typeof codeTab.code).toBe("string");
            expect(typeof codeTab.isActive).toBe("boolean");
        });
    });

    describe("TabWidthSetting 类型", () => {
        it("should validate auto mode", () => {
            const autoSetting = {
                mode: "auto" as const,
                maxChars: 0,
            };
            
            expect(autoSetting.mode).toBe("auto");
        });

        it("should validate max-chars mode", () => {
            const maxCharsSetting = {
                mode: "max-chars" as const,
                maxChars: 20,
            };
            
            expect(maxCharsSetting.mode).toBe("max-chars");
            expect(maxCharsSetting.maxChars).toBeGreaterThan(0);
        });
    });

    describe("边界条件验证", () => {
        it("should handle tabs array with empty items", () => {
            const data: TabsData = {
                version: 2,
                active: 0,
                tabs: [],
            };
            
            expect(data.tabs.length).toBe(0);
        });

        it("should handle active index at boundary", () => {
            const data: TabsData = {
                version: 2,
                active: 2,
                tabs: [
                    { title: "Tab1", lang: "js", code: "code1" },
                    { title: "Tab2", lang: "py", code: "code2" },
                    { title: "Tab3", lang: "go", code: "code3" },
                ],
            };
            
            expect(data.active).toBe(data.tabs.length - 1);
        });

        it("should handle large code content", () => {
            const largeCode = "x".repeat(10000);
            const tabItem = {
                title: "Large",
                lang: "text",
                code: largeCode,
            };
            
            expect(tabItem.code.length).toBe(10000);
        });
    });
});
