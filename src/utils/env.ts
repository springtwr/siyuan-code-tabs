import { getBackend } from "siyuan";

/**
 * 判断是否为开发环境（排除 test）。
 * @returns 是否为开发环境
 */
export function isDevMode(): boolean {
    const mode = import.meta.env.MODE;
    if (mode === "test") return false;
    return import.meta.env.DEV === true || mode === "development";
}

/**
 * 判断是否为移动端后端（思源移动端）。
 * @returns 是否为移动端
 */
export function isMobileBackend(): boolean {
    try {
        const backend = getBackend?.();
        return backend === "android" || backend === "ios" || backend === "harmony";
    } catch {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }
}
