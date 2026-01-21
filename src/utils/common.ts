/**
 * 通用工具函数
 */

/**
 * Promise 延迟函数
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * 检查对象是否相等（浅比较）
 */
export function shallowEqual(
    objA: Record<string, unknown>,
    objB: Record<string, unknown>
): boolean {
    if (objA === objB) return true;

    if (!objA || !objB || typeof objA !== "object" || typeof objB !== "object") {
        return false;
    }

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (objA[key] !== objB[key]) return false;
    }

    return true;
}
