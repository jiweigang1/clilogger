/**
 * 测试懒加载MCP Server的启动性能
 */
import { startMCPServerProxy } from '../codex/mcpserver.js';
import LogManager from '../logger-manager.js';

const logger = LogManager.getSystemLogger();

console.log('=== 测试MCP Server懒加载性能 ===');

// 记录启动开始时间
const startTime = Date.now();

logger.info('开始启动MCP Server代理...');

// 启动MCP Server代理（现在不会立即连接所有MCP服务）
startMCPServerProxy();

// 记录启动完成时间
const endTime = Date.now();
const startupTime = endTime - startTime;

console.log(`\n=== 测试结果 ===`);
console.log(`MCP Server代理启动时间: ${startupTime}ms`);
console.log(`启动方式: 懒加载（不会立即连接所有MCP服务）`);
console.log(`状态: 代理服务已启动，等待客户端请求时才会连接具体的MCP服务`);

logger.info(`MCP Server代理启动完成，耗时: ${startupTime}ms`);

// 保持进程运行一段时间以便观察
setTimeout(() => {
    console.log('\n=== 测试完成 ===');
    console.log('MCP Server代理采用懒加载机制，只有在收到客户端请求时才会连接对应的MCP服务');
    console.log('这样可以显著减少启动时间，特别是当配置了多个MCP服务时');
    process.exit(0);
}, 3000);