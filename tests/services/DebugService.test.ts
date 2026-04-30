import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebugService } from "@/services/DebugService";
import logger from "@/utils/logger";
import { mockLocalStorage, restoreAllMocks } from "../helpers/env-mock";

describe("DebugService", () => {
    let service: DebugService;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let loggerSetDebugEnabledSpy: ReturnType<typeof vi.spyOn>;
    let loggerSetLogWriterSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockLocalStorage();
        service = new DebugService();
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        loggerSetDebugEnabledSpy = vi.spyOn(logger, "setDebugEnabled").mockImplementation(() => {});
        loggerSetLogWriterSpy = vi.spyOn(logger, "setLogWriter").mockImplementation(() => {});
        loggerInfoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    });

    afterEach(() => {
        restoreAllMocks();
        consoleWarnSpy.mockRestore();
        loggerSetDebugEnabledSpy.mockRestore();
        loggerSetLogWriterSpy.mockRestore();
        loggerInfoSpy.mockRestore();
    });

    describe("init", () => {
        it("should call logger.setDebugEnabled with stored value", () => {
            localStorage.setItem("code-tabs.debug", "true");
            service.init();
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalledWith(true);
        });

        it("should initialize log writer", () => {
            service.init();
            expect(loggerSetLogWriterSpy).toHaveBeenCalled();
        });
    });

    describe("createToggle", () => {
        it("should return checkbox element", () => {
            const toggle = service.createToggle();
            expect(toggle.tagName).toBe("INPUT");
            expect(toggle.type).toBe("checkbox");
            expect(toggle.className).toBe("b3-switch");
        });

        it("should have checked state from localStorage", () => {
            localStorage.setItem("code-tabs.debug", "true");
            const toggle = service.createToggle();
            expect(toggle.checked).toBe(true);
        });

        it("should update localStorage on change", () => {
            const toggle = service.createToggle();
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change"));
            expect(localStorage.getItem("code-tabs.debug")).toBe("true");
        });

        it("should call setDebugEnabled on change", () => {
            const toggle = service.createToggle();
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change"));
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalled();
        });
    });

    describe("setDebugEnabled", () => {
        it("should update localStorage", () => {
            service.setDebugEnabled(true);
            expect(localStorage.getItem("code-tabs.debug")).toBe("true");
        });

        it("should call logger.setDebugEnabled", () => {
            service.setDebugEnabled(true);
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalledWith(true);
        });

        it("should log info message", () => {
            service.setDebugEnabled(true);
            expect(loggerInfoSpy).toHaveBeenCalledWith("调试日志开关变更", { enabled: true });
        });

        it("should handle localStorage error gracefully", () => {
            vi.spyOn(localStorage, "setItem").mockImplementation(() => {
                throw new Error("QuotaExceededError");
            });
            
            service.setDebugEnabled(true);
            
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalledWith(true);
        });
    });

    describe("getDebugEnabled", () => {
        it("should return true when localStorage has true", () => {
            localStorage.setItem("code-tabs.debug", "true");
            expect(service.getDebugEnabled()).toBe(true);
        });

        it("should return false when localStorage has false", () => {
            localStorage.setItem("code-tabs.debug", "false");
            expect(service.getDebugEnabled()).toBe(false);
        });

        it("should return false when localStorage is empty", () => {
            expect(service.getDebugEnabled()).toBe(false);
        });

        it("should handle localStorage error gracefully", () => {
            const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("Storage error");
            });
            
            expect(service.getDebugEnabled()).toBe(false);
            
            getItemSpy.mockRestore();
        });
    });

    describe("cleanup", () => {
        it("should clear log buffer", () => {
            service.init();
            service.cleanup();
            expect(loggerSetLogWriterSpy).toHaveBeenCalledWith(undefined);
        });

        it("should remove log writer", () => {
            service.init();
            service.cleanup();
            expect(loggerSetLogWriterSpy).toHaveBeenLastCalledWith(undefined);
        });
    });

    describe("constructor options", () => {
        it("should use custom logPath", () => {
            const customService = new DebugService({ logPath: "/custom/path.log" });
            expect(customService).toBeDefined();
        });

        it("should use custom bufferLimit", () => {
            const customService = new DebugService({ bufferLimit: 500 });
            expect(customService).toBeDefined();
        });

        it("should use custom debounceMs", () => {
            const customService = new DebugService({ debounceMs: 2000 });
            expect(customService).toBeDefined();
        });
    });
});
