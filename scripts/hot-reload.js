import http from 'http';

/**
 * 发送思源 API 请求的辅助函数
 * @param {Object} options - 配置对象
 * @param {string} path - API 路径
 * @param {Object} data - 发送的数据
 */
function sendSiyuanRequest(options, path, data) {
    const { host = '127.0.0.1', port = 6806, token = '' } = options;

    return new Promise((resolve) => {
        const postData = JSON.stringify(data);

        const reqOptions = {
            hostname: host,
            port: port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,
            }
        };

        const req = http.request(reqOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.code === 0) {
                        console.log(`\x1b[32m[SiYuan Reload]\x1b[0m API 调用成功`);
                    } else {
                        console.error(`\x1b[31m[SiYuan Reload]\x1b[0m API 返回错误: ${json.msg}`);
                    }
                } catch (e) {
                    // 忽略 JSON 解析错误
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            if (options.isWatch) {
                console.warn(`\x1b[33m[SiYuan Reload]\x1b[0m 请求失败: ${e.message}`);
            }
            resolve();
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Vite 插件主函数
 * @param {Object} options - 插件配置
 * @param {string} options.packageName - 插件包名
 * @param {string} [options.frontend='all'] - 前端类型
 * @param {boolean} [options.isWatch=false] - 是否处于监听模式
 */
export default function siyuanReloadPlugin(options) {
    const {
        packageName,
        frontend = 'all',
        isWatch = false
    } = options;

    return {
        name: 'vite-plugin-siyuan-reload',
        writeBundle() {
            if (!isWatch) return;

            console.log(`\x1b[36m[SiYuan Reload]\x1b[0m 代码已更新，触发思源插件重载...`);

            // 直接设置 enabled: true 触发重载
            sendSiyuanRequest(options, '/api/petal/setPetalEnabled', {
                packageName,
                enabled: true,
                frontend
            }).then(() => {
                console.log(`\x1b[32m[SiYuan Reload]\x1b[0m 插件 [${packageName}] 重载完成！`);
                // 重载插件后重载UI
                sendSiyuanRequest({token: process.env.SIYUAN_TOKEN || ''}, '/api/ui/reloadUI', {}).then(() => {
                    console.log(`\x1b[32m[SiYuan Reload]\x1b[0m UI 重载完成！`);
                })
            });
        }
    };
}
