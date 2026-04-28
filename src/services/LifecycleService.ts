import type { ILifecycleService, LifecycleServiceDeps, IEventBus } from "@/types/services";
import { EditorRefreshService } from "./EditorRefreshService";
import { ProtyleLifecycleService } from "./ProtyleLifecycleService";
import logger from "@/utils/logger";

/**
 * 生命周期服务
 * 协调编辑器刷新和Protyle事件监听，提供统一的生命周期管理接口
 */
export class LifecycleService implements ILifecycleService {
    private readonly editorRefreshService: EditorRefreshService;
    private readonly protyleLifecycleService: ProtyleLifecycleService;
    private registeredEventBus: IEventBus | null = null;

    constructor(deps: LifecycleServiceDeps) {
        this.editorRefreshService = deps.editorRefreshService as EditorRefreshService;
        this.protyleLifecycleService = deps.protyleLifecycleService as ProtyleLifecycleService;
    }

    init(): void {
        logger.info("LifecycleService 初始化");
    }

    cleanup(): void {
        logger.info("LifecycleService 清理");
        if (this.registeredEventBus) {
            this.unregisterEventListeners(this.registeredEventBus);
        }
    }

    refreshActiveDocument(): void {
        this.editorRefreshService.reloadActiveDocument();
    }

    refreshOverflow(root?: HTMLElement | ShadowRoot): void {
        this.editorRefreshService.refreshOverflow(root);
    }

    setRefreshOverflowProvider(
        provider: () => ((root?: HTMLElement | ShadowRoot) => void) | undefined
    ): void {
        this.editorRefreshService.setRefreshOverflowProvider(provider);
    }

    registerEventListeners(eventBus: IEventBus): void {
        if (this.registeredEventBus) {
            logger.warn("LifecycleService: 事件已注册，先注销旧监听");
            this.unregisterEventListeners(this.registeredEventBus);
        }

        this.protyleLifecycleService.register(eventBus);
        this.registeredEventBus = eventBus;
        logger.debug("LifecycleService: 事件监听已注册");
    }

    unregisterEventListeners(eventBus: IEventBus): void {
        this.protyleLifecycleService.unregister(eventBus);
        this.registeredEventBus = null;
        logger.debug("LifecycleService: 事件监听已注销");
    }
}
