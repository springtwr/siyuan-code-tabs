import { describe, expect, it, vi } from "vitest";
import { debounce } from "@/utils/common";

describe("common utils", () => {
    it("debounce delays calls", async () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 10);
        debounced();
        debounced();
        await new Promise((r) => setTimeout(r, 20));
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
