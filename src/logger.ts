enum LogLevel {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

class Logger {
    private readonly isDev: boolean;

    constructor() {
        // 访问 Vite 环境变量，判断是否处于开发环境
        this.isDev = process.env.DEV_MODE === 'true';
    }

    public info(message: any): void {
        this.log(LogLevel.INFO, message);
    }

    public warn(message: any): void {
        this.log(LogLevel.WARNING, message);
    }

    public error(message: any): void {
        this.log(LogLevel.ERROR, message);
    }

    private log(level: LogLevel = LogLevel.INFO, message: any): void {
        // 生产环境中只输出错误信息，屏蔽 info 和 warn 信息
        if (!this.isDev) {
            if (level === LogLevel.ERROR) {
                console.error(`[${new Date().toISOString()}] [code-tabs] [${level.toUpperCase()}]: ${message}`);
            }
            return;
        }
        const timestamp = new Date().toISOString();
        let logHeader = `[${timestamp}] [code-tabs] [${level.toUpperCase()}]: `;
        let elementFlag: Boolean = false;
        if (message instanceof Element || message instanceof Object) {
            elementFlag = true;
        }
        if (elementFlag) {
            console.log(logHeader);
            console.log(message);
        } else {
            console.log(logHeader + `${message}`);
        }
    }
}

// 导出 Logger 类的单例实例
const logger = new Logger();
export default logger;
