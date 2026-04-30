import { vi } from "vitest";

vi.mock("siyuan", () => ({
    getBackend: () => "desktop",
}));

let envMocks: (() => void)[] = [];

export function mockImportMetaEnv(env: Record<string, unknown>): void {
    const originalEnv = (globalThis as Record<string, unknown>).importMetaEnv;
    (globalThis as Record<string, unknown>).importMetaEnv = env;
    envMocks.push(() => {
        (globalThis as Record<string, unknown>).importMetaEnv = originalEnv;
    });
}

export function mockDevMode(isDev: boolean): void {
    vi.stubGlobal("import.meta", {
        env: {
            MODE: isDev ? "development" : "production",
            DEV: isDev,
        },
    });
    envMocks.push(() => {
        vi.unstubAllGlobals();
    });
}

export function mockTestMode(): void {
    vi.stubGlobal("import.meta", {
        env: {
            MODE: "test",
            DEV: false,
        },
    });
    envMocks.push(() => {
        vi.unstubAllGlobals();
    });
}

export function mockLocalStorage(storage: Record<string, string> = {}): void {
    const store: Record<string, string> = { ...storage };
    const originalLocalStorage = globalThis.localStorage;
    
    globalThis.localStorage = {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            Object.keys(store).forEach((key) => delete store[key]);
        }),
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
        get length() {
            return Object.keys(store).length;
        },
    } as Storage;
    
    envMocks.push(() => {
        globalThis.localStorage = originalLocalStorage;
    });
}

export function restoreAllMocks(): void {
    envMocks.forEach((restore) => restore());
    envMocks = [];
    vi.clearAllMocks();
}
