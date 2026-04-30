import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LifecycleService } from "@/services/LifecycleService";
import { createMockEventBus } from "../helpers/mock-creators";

describe("LifecycleService", () => {
    let service: LifecycleService;
    let mockEventBus: ReturnType<typeof createMockEventBus>;
    let mockEditor: { reload: (reset?: boolean) => void };
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockEventBus = createMockEventBus();
        mockEditor = { reload: vi.fn() as unknown as (reset?: boolean) => void };
        loggerInfoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        
        service = new LifecycleService({
            getActiveEditor: () => mockEditor,
            getRefreshOverflow: () => vi.fn(),
        });
    });

    afterEach(() => {
        loggerInfoSpy.mockRestore();
    });

    describe("constructor", () => {
        it("should create instance with default options", () => {
            const defaultService = new LifecycleService();
            expect(defaultService).toBeDefined();
        });

        it("should create instance with custom getActiveEditor", () => {
            const customEditor = { reload: vi.fn() };
            const customService = new LifecycleService({
                getActiveEditor: () => customEditor,
            });
            expect(customService).toBeDefined();
        });

        it("should create instance with custom getRefreshOverflow", () => {
            const customService = new LifecycleService({
                getRefreshOverflow: () => vi.fn(),
            });
            expect(customService).toBeDefined();
        });
    });

    describe("register", () => {
        it("should register event listeners", () => {
            service.register(mockEventBus);
            
            expect(mockEventBus.on).toHaveBeenCalledWith("loaded-protyle-static", expect.any(Function));
            expect(mockEventBus.on).toHaveBeenCalledWith("loaded-protyle-dynamic", expect.any(Function));
        });

        it("should call eventBus.on twice", () => {
            service.register(mockEventBus);
            
            expect(mockEventBus.on).toHaveBeenCalledTimes(2);
        });
    });

    describe("unregister", () => {
        it("should unregister event listeners", () => {
            service.unregister(mockEventBus);
            
            expect(mockEventBus.off).toHaveBeenCalledWith("loaded-protyle-static", expect.any(Function));
            expect(mockEventBus.off).toHaveBeenCalledWith("loaded-protyle-dynamic", expect.any(Function));
        });

        it("should call eventBus.off twice", () => {
            service.unregister(mockEventBus);
            
            expect(mockEventBus.off).toHaveBeenCalledTimes(2);
        });
    });

    describe("reloadActiveDocument", () => {
        it("should reload active editor", () => {
            service.reloadActiveDocument();
            
            expect(mockEditor.reload).toHaveBeenCalledWith(true);
        });

        it("should not reload if editor is null", () => {
            const nullEditorService = new LifecycleService({
                getActiveEditor: () => null,
            });
            
            nullEditorService.reloadActiveDocument();
            
            expect(mockEditor.reload).not.toHaveBeenCalled();
        });
    });

    describe("refreshOverflow", () => {
        it("should call refreshOverflow function when available", () => {
            const mockRefresh = vi.fn();
            const refreshService = new LifecycleService({
                getRefreshOverflow: () => mockRefresh,
            });
            
            refreshService.refreshOverflow();
            
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("should not throw when refreshOverflow is undefined", () => {
            const noRefreshService = new LifecycleService({
                getRefreshOverflow: () => undefined,
            });
            
            expect(() => noRefreshService.refreshOverflow()).not.toThrow();
        });

        it("should pass root parameter to refreshOverflow", () => {
            const mockRefresh = vi.fn();
            const refreshService = new LifecycleService({
                getRefreshOverflow: () => mockRefresh,
            });
            
            const root = document.createElement("div");
            refreshService.refreshOverflow(root);
            
            expect(mockRefresh).toHaveBeenCalledWith(root);
        });
    });

    describe("setRefreshOverflowProvider", () => {
        it("should update refreshOverflow provider", () => {
            const mockRefresh = vi.fn();
            service.setRefreshOverflowProvider(() => mockRefresh);
            
            service.refreshOverflow();
            
            expect(mockRefresh).toHaveBeenCalled();
        });
    });

    describe("cleanup", () => {
        it("should cleanup without error", () => {
            expect(() => service.cleanup()).not.toThrow();
        });
    });

    describe("handleProtyleLoaded", () => {
        it("should handle protyle loaded event", () => {
            const mockRefresh = vi.fn();
            
            const refreshService = new LifecycleService({
                getRefreshOverflow: () => mockRefresh,
            });
            
            const mockEvent = {
                detail: {
                    protyle: {
                        wysiwyg: { element: document.createElement("div") },
                    },
                },
            };
            
            refreshService.register(mockEventBus);
            
            const calls = (mockEventBus.on as ReturnType<typeof vi.fn>).mock.calls;
            const handler = calls.find(
                (call: unknown[]) => call[0] === "loaded-protyle-static"
            )?.[1];
            
            if (handler) {
                handler(mockEvent);
            }
            
            expect(mockRefresh).toHaveBeenCalled();
        });
    });
});
