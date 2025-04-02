import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 明确允许外部IP访问
    host: '0.0.0.0',
    // 禁用主机检查，允许任何域名访问
    hmr: {
      host: '0.0.0.0',
      port: 5173,
      protocol: 'ws'
    },
    // 明确允许ngrok域名和所有其他域名
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok.io',
      '.ngrok-free.app',
      'f0d0-117-139-220-45.ngrok-free.app'
    ],
    // 启用CORS
    cors: true,
    // 防止失败时自动尝试下一个端口
    strictPort: true
  },
  // 强制重新优化依赖，这是替代server.force的方式
  optimizeDeps: {
    force: true
  }
})
