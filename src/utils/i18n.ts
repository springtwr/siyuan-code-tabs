import { isDevMode } from "@/utils/env";

/**
 * i18n 取值包装：开发环境抛错，生产环境降级。
 * @param i18n 语言资源
 * @param key 文案 key
 * @param fallback 兜底文案
 * @returns 文案内容
 */
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
