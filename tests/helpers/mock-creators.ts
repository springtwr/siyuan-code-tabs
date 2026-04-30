import { vi } from "vitest";
import type { IEventBus } from "@/types/services";

export function createMockEventBus(): IEventBus {
    return {
        on: vi.fn(),
        off: vi.fn(),
    };
}

export function createMockEditor(): {
    reload: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
} {
    return {
        reload: vi.fn(),
        focus: vi.fn(),
        destroy: vi.fn(),
    };
}

export function createMockApiResponses(): {
    getBlockAttrs: ReturnType<typeof vi.fn>;
    setBlockAttrs: ReturnType<typeof vi.fn>;
    updateBlock: ReturnType<typeof vi.fn>;
    putFile: ReturnType<typeof vi.fn>;
} {
    return {
        getBlockAttrs: vi.fn().mockResolvedValue({
            "custom-code-tabs-data": JSON.stringify({
                version: 2,
                active: 0,
                tabs: [
                    { title: "JavaScript", lang: "javascript", code: "console.log(1);" },
                ],
            }),
        }),
        setBlockAttrs: vi.fn().mockResolvedValue(undefined),
        updateBlock: vi.fn().mockResolvedValue(undefined),
        putFile: vi.fn().mockResolvedValue(undefined),
    };
}

export function createMockDialog(): ReturnType<typeof vi.fn> {
    const dialog = {
        element: document.createElement("div"),
        destroy: vi.fn(),
    };
    
    return vi.fn(() => dialog);
}

export function createMockPlugin(): {
    data: Record<string, unknown>;
    i18n: Record<string, string>;
    eventBus: IEventBus;
    addCommand: ReturnType<typeof vi.fn>;
    addTopBar: ReturnType<typeof vi.fn>;
    openSetting: ReturnType<typeof vi.fn>;
} {
    return {
        data: {},
        i18n: {
            title: "Code Tabs",
            edit: "Edit",
            copy: "Copy",
        },
        eventBus: createMockEventBus(),
        addCommand: vi.fn(),
        addTopBar: vi.fn(),
        openSetting: vi.fn(),
    };
}

export function createMockLogger(): {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    setDebugEnabled: ReturnType<typeof vi.fn>;
    setLogWriter: ReturnType<typeof vi.fn>;
    isDebugEnabled: ReturnType<typeof vi.fn>;
} {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        setDebugEnabled: vi.fn(),
        setLogWriter: vi.fn(),
        isDebugEnabled: vi.fn().mockReturnValue(false),
    };
}
