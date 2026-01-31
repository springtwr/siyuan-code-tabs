/**
 * 通用工具函数（避免引入模块依赖）。
 */

/**
 * Promise 延迟函数，用于异步节流或等待渲染稳定。
 * @param ms 延迟毫秒
 * @returns Promise<void>
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数：合并高频事件，避免重复执行。
 * @param func 目标函数
 * @param wait 防抖等待时间
 * @returns 包装后的函数
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
