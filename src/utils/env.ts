/**
 * 判断是否为开发环境（排除 test）。
 * @returns 是否为开发环境
 */
export function isDevMode(): boolean {
    const mode = import.meta.env.MODE;
    if (mode === "test") return false;
    return import.meta.env.DEV === true || mode === "development";
}
