import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import logger from "@/utils/logger";

describe("logger", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        logger.setDebugEnabled(false);
        logger.setLogWriter(undefined);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        logger.setDebugEnabled(false);
        logger.setLogWriter(undefined);
    });

    describe("setDebugEnabled", () => {
        it("should enable debug mode when set to true", () => {
            logger.setDebugEnabled(true);
            expect(logger.isDebugEnabled()).toBe(true);
        });

        it("should disable debug mode when set to false", () => {
            logger.setDebugEnabled(false);
            expect(logger.isDebugEnabled()).toBe(false);
        });

        it("should toggle debug mode multiple times", () => {
            logger.setDebugEnabled(true);
            expect(logger.isDebugEnabled()).toBe(true);
            
            logger.setDebugEnabled(false);
            expect(logger.isDebugEnabled()).toBe(false);
            
            logger.setDebugEnabled(true);
            expect(logger.isDebugEnabled()).toBe(true);
        });
    });

    describe("debug", () => {
        it("should not log when debug is disabled", () => {
            logger.setDebugEnabled(false);
            logger.debug("test message");
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it("should log when debug is enabled in test mode", () => {
            logger.setDebugEnabled(true);
            logger.debug("test message");
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should include context in debug log", () => {
            logger.setDebugEnabled(true);
            logger.debug("test message", { key: "value" });
            expect(consoleLogSpy).toHaveBeenCalled();
            const callArg = consoleLogSpy.mock.calls[0][0];
            expect(callArg).toContain("test message");
            expect(callArg).toContain("key");
        });
    });

    describe("info", () => {
        it("should log info message when debug enabled", () => {
            logger.setDebugEnabled(true);
            logger.info("info message");
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should include context in info log", () => {
            logger.setDebugEnabled(true);
            logger.info("info message", { context: "test" });
            expect(consoleLogSpy).toHaveBeenCalled();
            const callArg = consoleLogSpy.mock.calls[0][0];
            expect(callArg).toContain("info message");
        });

        it("should not log info when debug disabled in test mode", () => {
            logger.setDebugEnabled(false);
            logger.info("info message");
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe("warn", () => {
        it("should log warning message when debug enabled", () => {
            logger.setDebugEnabled(true);
            logger.warn("warning message");
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should include context in warn log", () => {
            logger.setDebugEnabled(true);
            logger.warn("warning message", { reason: "test" });
            expect(consoleLogSpy).toHaveBeenCalled();
            const callArg = consoleLogSpy.mock.calls[0][0];
            expect(callArg).toContain("warning message");
        });

        it("should not log warn when debug disabled in test mode", () => {
            logger.setDebugEnabled(false);
            logger.warn("warning message");
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe("error", () => {
        it("should log error message when debug enabled", () => {
            logger.setDebugEnabled(true);
            logger.error("error message");
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should log error object when debug enabled", () => {
            logger.setDebugEnabled(true);
            const error = new Error("test error");
            logger.error(error);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should include context in error log when debug enabled", () => {
            logger.setDebugEnabled(true);
            logger.error("error message", { code: 500 });
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should log error to console.error when debug disabled", () => {
            logger.setDebugEnabled(false);
            logger.error("error message");
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe("setLogWriter", () => {
        it("should call log writer when debug is enabled", () => {
            const writer = vi.fn();
            logger.setLogWriter(writer);
            logger.setDebugEnabled(true);
            
            logger.debug("test message");
            
            expect(writer).toHaveBeenCalled();
        });

        it("should not call log writer when debug is disabled", () => {
            const writer = vi.fn();
            logger.setLogWriter(writer);
            logger.setDebugEnabled(false);
            
            logger.debug("test message");
            
            expect(writer).not.toHaveBeenCalled();
        });

        it("should remove log writer when set to undefined", () => {
            const writer = vi.fn();
            logger.setLogWriter(writer);
            logger.setDebugEnabled(true);
            
            logger.setLogWriter(undefined);
            logger.debug("test message");
            
            expect(writer).not.toHaveBeenCalled();
        });

        it("should call log writer for info when debug enabled", () => {
            const writer = vi.fn();
            logger.setLogWriter(writer);
            logger.setDebugEnabled(true);
            
            logger.info("test message");
            
            expect(writer).toHaveBeenCalled();
        });
    });

    describe("format handling", () => {
        it("should handle string messages", () => {
            logger.setDebugEnabled(true);
            logger.info("simple string");
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle number messages", () => {
            logger.setDebugEnabled(true);
            logger.info(12345);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle object messages", () => {
            logger.setDebugEnabled(true);
            logger.info({ key: "value", nested: { a: 1 } });
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle null messages", () => {
            logger.setDebugEnabled(true);
            logger.info(null);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle undefined messages", () => {
            logger.setDebugEnabled(true);
            logger.info(undefined);
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle circular references", () => {
            logger.setDebugEnabled(true);
            const circular: Record<string, unknown> = { key: "value" };
            circular.self = circular;
            
            logger.info(circular);
            
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle bigint values", () => {
            logger.setDebugEnabled(true);
            logger.info({ bigint: BigInt(9007199254740991) });
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it("should handle Error instances", () => {
            logger.setDebugEnabled(true);
            const error = new Error("test error");
            error.stack = "test stack";
            
            logger.info(error);
            
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe("isDebugEnabled", () => {
        it("should return false by default", () => {
            logger.setDebugEnabled(false);
            expect(logger.isDebugEnabled()).toBe(false);
        });

        it("should return true after enabling", () => {
            logger.setDebugEnabled(true);
            expect(logger.isDebugEnabled()).toBe(true);
        });
    });

    describe("test mode behavior", () => {
        it("should only output error to console.error when debug disabled", () => {
            logger.setDebugEnabled(false);
            
            logger.debug("debug message");
            logger.info("info message");
            logger.warn("warn message");
            logger.error("error message");
            
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it("should output all logs to console.log when debug enabled", () => {
            logger.setDebugEnabled(true);
            
            logger.debug("debug message");
            logger.info("info message");
            logger.warn("warn message");
            logger.error("error message");
            
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });
});
