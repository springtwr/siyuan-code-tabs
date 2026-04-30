import { vi } from "vitest";

export function mockBoundingClientRect(
    element: Element,
    rect: { width?: number; height?: number; top?: number; left?: number }
): void {
    const getBoundingClientRect = element.getBoundingClientRect.bind(element);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        ...getBoundingClientRect(),
        width: rect.width ?? 100,
        height: rect.height ?? 30,
        top: rect.top ?? 0,
        left: rect.left ?? 0,
        bottom: (rect.top ?? 0) + (rect.height ?? 30),
        right: (rect.left ?? 0) + (rect.width ?? 100),
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        toJSON: () => ({ ...rect }),
    });
}

export function mockComputedStyle(
    styles: Record<string, string> = {}
): () => void {
    const originalGetComputedStyle = window.getComputedStyle;
    
    window.getComputedStyle = vi.fn((_element: Element) => {
        const defaultStyles: CSSStyleDeclaration = {
            width: "100px",
            height: "30px",
            fontSize: "14px",
            fontFamily: "monospace",
            lineHeight: "1.5",
            color: "#333",
            backgroundColor: "#fff",
            padding: "0",
            margin: "0",
            border: "none",
            display: "block",
            visibility: "visible",
            ...Object.fromEntries(
                Object.entries(styles).map(([key, value]) => [key, value])
            ),
        } as unknown as CSSStyleDeclaration;
        
        return defaultStyles;
    });
    
    return () => {
        window.getComputedStyle = originalGetComputedStyle;
    };
}

export function mockResizeObserver(): () => void {
    const originalResizeObserver = globalThis.ResizeObserver;
    
    class MockResizeObserver {
        constructor(_callback: ResizeObserverCallback) {
            void _callback;
        }
        
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
    
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    
    return () => {
        globalThis.ResizeObserver = originalResizeObserver;
    };
}
