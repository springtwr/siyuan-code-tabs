import { isDevMode } from "@/utils/env";

export function t(i18n: Record<string, string>, key: string, fallback?: string): string {
    if (!i18n) {
        if (isDevMode()) {
            throw new Error(`[code-tabs] i18n 未初始化: ${key}`);
        }
        return fallback ?? key;
    }
    const value = i18n[key];
    if (value === undefined || value === null || value === "") {
        if (isDevMode()) {
            throw new Error(`[code-tabs] i18n 缺失: ${key}`);
        }
        return fallback ?? key;
    }
    return value;
}
