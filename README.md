# 网页串口助手

一款无需下载、无需安装的在线串口助手，基于Web Serial API实现，用户通过浏览器访问即可实现串口通信功能。

## 功能特点

- 基于Web Serial API，无需安装驱动或插件
- 支持多种波特率、数据位、停止位和校验位配置
- 数据收发支持ASCII、HEX和DEC格式
- 简洁现代的用户界面，响应式设计适配各种设备
- 轻量化设计，支持快速部署到云端

## 浏览器兼容性

由于使用Web Serial API，本应用目前仅支持以下浏览器：

- Chrome 89+
- Edge 89+
- Opera 76+
- 其他基于Chromium的浏览器

Firefox和Safari暂不支持Web Serial API。

## 使用方法

1. 连接串口设备到电脑
2. 访问网页串口助手
3. 在设置面板中选择串口设备并配置参数
4. 点击"连接"按钮建立连接
5. 在发送区域输入数据并发送
6. 在数据记录区域查看收发的数据

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 技术栈

- 前端框架：Vue.js 3
- 状态管理：Pinia
- UI组件：Tailwind CSS + DaisyUI
- 构建工具：Vite
- 串口通信：Web Serial API

## 许可证

MIT
