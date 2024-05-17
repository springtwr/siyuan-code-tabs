enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

class Logger {
    private readonly isDev: boolean;

    constructor() {
        // 访问 Vite 环境变量，判断是否处于开发环境
        this.isDev = process.env.DEV_MODE === 'true';
    }

    public info(message: string): void {
        this.log(LogLevel.INFO, message);
    }

    public warn(message: string): void {
        this.log(LogLevel.WARN, message);
    }

    public error(message: string): void {
        this.log(LogLevel.ERROR, message);
    }

    private log(level: LogLevel, message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [code-tabs] [${level.toUpperCase()}]: ${message}`;
        // 生产环境中只输出错误信息，屏蔽 info 和 warn 信息
        if (!this.isDev) {
            if (level === LogLevel.ERROR) {
                console.log(logMessage);
            }
            return;
        }
        console.log(logMessage);
    }
}

// 导出 Logger 类的单例实例
const logger = new Logger();
export default logger;
