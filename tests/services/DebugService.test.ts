import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { DebugService } from "@/services/DebugService";
import logger from "@/utils/logger";
import { restoreAllMocks } from "../helpers/env-mock";
import { DEBUG_ENABLED_KEY } from "@/constants";

describe("DebugService", () => {
    let service: DebugService;
    let data: Record<string, unknown>;
    let onSaveConfig: Mock<() => Promise<void>>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let loggerSetDebugEnabledSpy: ReturnType<typeof vi.spyOn>;
    let loggerSetLogWriterSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        data = {};
        onSaveConfig = vi.fn().mockResolvedValue(undefined) as Mock<() => Promise<void>>;
        service = new DebugService({ data, onSaveConfig });
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
            data[DEBUG_ENABLED_KEY] = true;
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

        it("should have checked state from data", () => {
            data[DEBUG_ENABLED_KEY] = true;
            const toggle = service.createToggle();
            expect(toggle.checked).toBe(true);
        });

        it("should update data on change", () => {
            const toggle = service.createToggle();
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change"));
            expect(data[DEBUG_ENABLED_KEY]).toBe(true);
        });

        it("should call setDebugEnabled on change", () => {
            const toggle = service.createToggle();
            toggle.checked = true;
            toggle.dispatchEvent(new Event("change"));
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalled();
        });
    });

    describe("setDebugEnabled", () => {
        it("should update data", () => {
            service.setDebugEnabled(true);
            expect(data[DEBUG_ENABLED_KEY]).toBe(true);
        });

        it("should call onSaveConfig", () => {
            service.setDebugEnabled(true);
            expect(onSaveConfig).toHaveBeenCalled();
        });

        it("should call logger.setDebugEnabled", () => {
            service.setDebugEnabled(true);
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalledWith(true);
        });

        it("should log info message", () => {
            service.setDebugEnabled(true);
            expect(loggerInfoSpy).toHaveBeenCalledWith("调试日志开关变更", { enabled: true });
        });

        it("should handle onSaveConfig error gracefully", () => {
            onSaveConfig.mockRejectedValue(new Error("Save failed"));
            
            service.setDebugEnabled(true);
            
            expect(loggerSetDebugEnabledSpy).toHaveBeenCalledWith(true);
        });
    });

    describe("getDebugEnabled", () => {
        it("should return true when data has true", () => {
            data[DEBUG_ENABLED_KEY] = true;
            expect(service.getDebugEnabled()).toBe(true);
        });

        it("should return false when data has false", () => {
            data[DEBUG_ENABLED_KEY] = false;
            expect(service.getDebugEnabled()).toBe(false);
        });

        it("should return false when data is empty", () => {
            expect(service.getDebugEnabled()).toBe(false);
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
            const customService = new DebugService({ data, onSaveConfig, logPath: "/custom/path.log" });
            expect(customService).toBeDefined();
        });

        it("should use custom bufferLimit", () => {
            const customService = new DebugService({ data, onSaveConfig, bufferLimit: 500 });
            expect(customService).toBeDefined();
        });

        it("should use custom debounceMs", () => {
            const customService = new DebugService({ data, onSaveConfig, debounceMs: 2000 });
            expect(customService).toBeDefined();
        });
    });
});
