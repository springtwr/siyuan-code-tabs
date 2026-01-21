import { describe, expect, it, vi } from "vitest";
import { debounce, shallowEqual } from "@/utils/common";

describe("common utils", () => {
    it("shallowEqual compares keys", () => {
        expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("debounce delays calls", async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 10);
        debounced();
        debounced();
        await new Promise((r) => setTimeout(r, 20));
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
