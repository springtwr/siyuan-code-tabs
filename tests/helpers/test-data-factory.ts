import type { TabsData, TabDataItem, CodeTab } from "@/types/tabs";

export function createValidTabData(overrides: Partial<TabsData> = {}): TabsData {
    return {
        version: 2,
        active: 0,
        tabs: [
            { title: "JavaScript", lang: "javascript", code: "console.log('hello');" },
            { title: "Python", lang: "python", code: "print('hello')" },
        ],
        ...overrides,
    };
}

export function createInvalidTabData(): Partial<TabsData> {
    return {
        version: 2,
        active: 999,
        tabs: [],
    };
}

export function createValidTabDataItem(
    overrides: Partial<TabDataItem> = {}
): TabDataItem {
    return {
        title: "JavaScript",
        lang: "javascript",
        code: "console.log('hello');",
        ...overrides,
    };
}

export function createValidCodeTab(overrides: Partial<CodeTab> = {}): CodeTab {
    return {
        title: "JavaScript",
        language: "javascript",
        code: "console.log('hello');",
        isActive: true,
        ...overrides,
    };
}

export function createMockI18n(
    translations: Record<string, string> = {}
): Record<string, string> {
    return {
        title: "Code Tabs",
        edit: "Edit",
        copy: "Copy",
        default: "Set as Default",
        ...translations,
    };
}

export function createMultipleTabs(count: number): TabDataItem[] {
    return Array.from({ length: count }, (_, i) => ({
        title: `Tab ${i + 1}`,
        lang: `language${i + 1}`,
        code: `// Code ${i + 1}\nconsole.log(${i + 1});`,
    }));
}

export function createLargeTabData(tabCount: number): TabsData {
    return {
        version: 2,
        active: 0,
        tabs: createMultipleTabs(tabCount),
    };
}
