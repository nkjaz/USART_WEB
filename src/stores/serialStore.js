import { defineStore } from 'pinia';
import SerialHelper from '../utils/serialHelper';
import { toHexString, toAsciiString, toDecimalString, hexStringToUint8Array, asciiStringToUint8Array, formatTime } from '../utils/dataConverter';

// 定义串口状态类型
export const SERIAL_STATUS = {
    CLOSED: 'closed',
    OPENING: 'opening',
    OPENED: 'opened',
    ERROR: 'error'
};

// 定义数据格式类型
export const DATA_FORMAT = {
    ASCII: 'ascii',
    HEX: 'hex',
    DEC: 'dec'
};

export const useSerialStore = defineStore('serial', {
    state: () => ({
        // 串口状态
        status: SERIAL_STATUS.CLOSED,
        error: null,

        // 串口配置
        availablePorts: [],
        selectedPort: null,
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',

        // 数据格式设置
        rxFormat: DATA_FORMAT.ASCII,
        txFormat: DATA_FORMAT.ASCII,

        // 数据统计
        rxCount: 0,
        txCount: 0,

        // 数据记录
        logEntries: [],

        // 自动滚动
        autoScroll: true,

        // 时间戳显示
        showTimestamp: true,

        // 输入数据
        inputText: '',

        // 串口实例
        serialHelper: new SerialHelper(),

        // 浏览器支持
        isWebSerialSupported: false,

        // 读取状态
        isReading: false,

        // 上次接收的数据
        lastReceivedData: '',

        // 最大日志条目数，防止内存泄漏
        maxLogEntries: 1000,

        // 数据刷新速度控制
        dataRefreshRate: 'normal', // slow, normal, fast
        dataBuffer: [], // 数据缓冲区，用于控制刷新速度
        refreshIntervalId: null, // 刷新定时器ID

        // 发送历史记录
        sendHistory: [],
        maxHistorySize: 10, // 最大历史记录数量

        // 连接状态监控
        connectionMonitorId: null,

        // 数据可视化控制
        showVisualization: true, // 默认显示数据可视化
    }),

    getters: {
        isConnected: (state) => state.status === SERIAL_STATUS.OPENED,
        canConnect: (state) => state.status === SERIAL_STATUS.CLOSED && state.selectedPort !== null,
        canDisconnect: (state) => state.status === SERIAL_STATUS.OPENED
    },

    actions: {
        /**
         * 初始化串口
         */
        init() {
            this.isWebSerialSupported = this.serialHelper.isWebSerialSupported();
            if (this.isWebSerialSupported) {
                this.refreshPorts();
            }

            // 从本地存储恢复发送历史记录
            this.loadSendHistory();

            // 从本地存储恢复可视化设置
            this.loadVisSettings();
        },

        /**
         * 从本地存储中加载发送历史记录
         */
        loadSendHistory() {
            try {
                const savedHistory = localStorage.getItem('serialSendHistory');
                if (savedHistory) {
                    this.sendHistory = JSON.parse(savedHistory);
                }
            } catch (error) {
                console.error('加载发送历史记录失败:', error);
                // 如果加载失败，重置历史记录
                this.sendHistory = [];
            }
        },

        /**
         * 保存发送历史记录到本地存储
         */
        saveSendHistory() {
            try {
                localStorage.setItem('serialSendHistory', JSON.stringify(this.sendHistory));
            } catch (error) {
                console.error('保存发送历史记录失败:', error);
            }
        },

        /**
         * 添加发送历史记录
         * @param {string} text 发送的文本
         */
        addToSendHistory(text) {
            // 不记录空文本
            if (!text || text.trim() === '') return;

            // 避免重复记录
            const index = this.sendHistory.indexOf(text);
            if (index !== -1) {
                // 如果已存在，移除旧记录
                this.sendHistory.splice(index, 1);
            }

            // 添加到历史记录开头
            this.sendHistory.unshift(text);

            // 限制历史记录长度
            if (this.sendHistory.length > this.maxHistorySize) {
                this.sendHistory = this.sendHistory.slice(0, this.maxHistorySize);
            }

            // 保存到本地存储
            this.saveSendHistory();
        },

        /**
         * 清空发送历史记录
         */
        clearSendHistory() {
            this.sendHistory = [];
            this.saveSendHistory();
        },

        /**
         * 刷新可用串口列表
         */
        async refreshPorts() {
            try {
                this.availablePorts = await this.serialHelper.getPorts();
            } catch (error) {
                this.error = error.message;
                console.error('刷新串口列表失败:', error);
            }
        },

        /**
         * 用户选择串口
         */
        async selectPort() {
            try {
                const port = await this.serialHelper.requestPort();
                this.selectedPort = port;
                // 自动添加到可用端口列表
                if (!this.availablePorts.includes(port)) {
                    this.availablePorts.push(port);
                }
            } catch (error) {
                console.error('选择串口失败:', error);
            }
        },

        /**
         * 连接到串口，带重试逻辑
         */
        async connect(maxRetries = 2) {
            if (!this.selectedPort) {
                this.error = '未选择串口设备，请先选择一个串口';
                return false;
            }

            // 重置错误和状态
            this.status = SERIAL_STATUS.OPENING;
            this.error = null;

            // 确保任何现有连接已经正确关闭
            if (this.serialHelper.isConnected) {
                try {
                    console.log('连接前检测到已有连接，先断开');
                    await this.serialHelper.disconnect();
                    // 短暂延时确保端口释放
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (e) {
                    console.warn('断开现有连接失败:', e);
                    // 继续尝试新连接
                }
            }

            // 配置选项
            const options = {
                baudRate: this.baudRate,
                dataBits: this.dataBits,
                stopBits: this.stopBits,
                parity: this.parity
            };

            let retryCount = 0;
            let connected = false;

            while (retryCount <= maxRetries && !connected) {
                try {
                    // 如果是重试，显示重试信息
                    if (retryCount > 0) {
                        console.log(`尝试第 ${retryCount} 次重新连接串口...`);
                        // 更新状态，通知用户正在重试
                        this.error = `连接失败，正在进行第 ${retryCount} 次重试...`;
                        // 短暂延时后再尝试
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }

                    // 记录开始连接时间
                    const startTime = Date.now();

                    // 尝试连接
                    const connectResult = await this.serialHelper.connect(this.selectedPort, options);

                    // 检查连接结果
                    if (!connectResult) {
                        throw new Error('串口连接返回失败');
                    }

                    // 验证端口是否正确打开
                    if (!this.serialHelper.isConnected) {
                        throw new Error('串口连接后状态检查失败');
                    }

                    // 连接成功，更新状态
                    this.status = SERIAL_STATUS.OPENED;
                    connected = true;

                    // 记录连接时间
                    console.log(`串口连接成功，耗时: ${Date.now() - startTime}ms`);

                    // 尝试开始数据读取
                    try {
                        const readStarted = await this.startReading();
                        if (!readStarted) {
                            console.warn('串口连接成功，但无法开始数据读取');
                            this.error = '串口已连接，但无法开始数据读取（请尝试重新连接）';
                        }
                    } catch (readError) {
                        console.error('开始数据读取时出错:', readError);
                        this.error = '串口已连接，但开始数据读取时出错: ' + readError.message;
                    }

                    // 添加连接状态检查计时器
                    this.startConnectionMonitor();

                    return true;

                } catch (error) {
                    // 连接失败，准备重试
                    console.error(`连接串口失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);

                    // 最后一次尝试失败
                    if (retryCount === maxRetries) {
                        // 更新状态为错误
                        this.status = SERIAL_STATUS.ERROR;
                        this.error = `连接失败 (${error.message || '未知错误'})。请检查设备是否已连接，或刷新页面后重试。`;

                        // 尝试重置串口状态
                        try {
                            await this.serialHelper.disconnect();
                        } catch (e) {
                            // 忽略断开时的错误
                        }

                        return false;
                    }

                    // 增加重试计数，准备下一次尝试
                    retryCount++;
                }
            }

            return connected;
        },

        /**
         * 开始监控串口连接状态
         */
        startConnectionMonitor() {
            // 清除现有的监控器
            if (this.connectionMonitorId) {
                clearInterval(this.connectionMonitorId);
                this.connectionMonitorId = null;
            }

            // 创建新的监控计时器，每3秒检查一次连接状态
            this.connectionMonitorId = setInterval(() => {
                this.checkConnectionStatus();
            }, 3000);

            console.log('已启动连接状态监控器');
        },

        /**
         * 检查串口连接状态
         */
        async checkConnectionStatus() {
            // 只在已连接状态下检查
            if (this.status !== SERIAL_STATUS.OPENED) {
                return;
            }

            try {
                // 检查串口状态的多个条件
                let isConnected = false;
                let errorReason = '';

                // 1. 检查helper的内部状态
                const helperConnected = this.serialHelper.isConnected;

                // 2. 确认端口对象存在且开放
                let portOpen = false;
                try {
                    portOpen = await this.serialHelper.checkPortOpen();
                } catch (e) {
                    errorReason = '端口状态检查失败: ' + e.message;
                }

                // 3. 查看最后一次通信时间（如果过长未收到数据可能是连接有问题）
                const lastComm = this.serialHelper.getLastCommunicationTime();
                const now = Date.now();
                const timeSinceLastComm = now - lastComm;

                // 组合检查结果
                isConnected = helperConnected && portOpen;

                // 调试日志（非生产环境）
                if (process.env.NODE_ENV !== 'production') {
                    console.debug(`连接状态检查: Helper状态=${helperConnected}, 端口状态=${portOpen}, 最后通信=${Math.floor(timeSinceLastComm / 1000)}秒前`);
                }

                // 如果已断开连接，处理断开逻辑
                if (!isConnected) {
                    console.warn('连接状态检查：串口已断开，更新状态');
                    this.handleDisconnection(errorReason || '状态监控检测到连接断开');
                } else if (timeSinceLastComm > 30000 && this.status === SERIAL_STATUS.OPENED) {
                    // 如果超过30秒没有通信但连接仍然显示开放，发送测试字节
                    try {
                        await this.serialHelper.sendKeepAlive();
                        console.log('已发送保活测试信号');
                    } catch (e) {
                        console.warn('发送保活信号失败，可能是连接已断开:', e);
                        this.handleDisconnection('保活信号发送失败: ' + e.message);
                    }
                }
            } catch (error) {
                console.error('检查连接状态时出错:', error);
                // 视为连接出错
                this.handleDisconnection('检查连接状态时出错: ' + error.message);
            }
        },

        /**
         * 处理意外断开连接
         */
        handleDisconnection(reason) {
            console.warn('处理意外断开连接:', reason);

            // 如果当前状态已经是关闭或错误，不再处理
            if (this.status === SERIAL_STATUS.CLOSED || this.status === SERIAL_STATUS.ERROR) {
                console.log('当前状态已是断开或错误状态，不再处理');
                return;
            }

            // 更新状态
            this.status = SERIAL_STATUS.ERROR;
            this.error = '串口连接已断开: ' + reason;

            // 尝试彻底关闭连接
            this.disconnect().catch(e => {
                console.error('断开连接失败:', e);
            });

            // 重置读取状态
            this.isReading = false;

            // 添加日志条目通知用户
            try {
                this.logEntries.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 5),
                    timestamp: new Date().toLocaleTimeString(),
                    data: '连接已断开: ' + reason,
                    dataType: 'system',
                    direction: 'system', // 系统消息
                    isError: true
                });
            } catch (e) {
                console.error('添加断开连接日志失败:', e);
            }
        },

        /**
         * 断开串口连接，带清理和状态恢复功能
         */
        async disconnect() {
            try {
                console.log('开始断开串口连接...');

                // 1. 首先停止所有相关活动

                // 停止读取循环
                this.isReading = false;

                // 清除连接监控计时器
                if (this.connectionMonitorId) {
                    clearInterval(this.connectionMonitorId);
                    this.connectionMonitorId = null;
                    console.log('已停止连接监控');
                }

                // 防止重复断开
                if (this.status === SERIAL_STATUS.CLOSED) {
                    console.log('串口已经是断开状态，无需再次断开');
                    return;
                }

                // 2. 调用帮助类的断开方法
                let disconnectSuccess = false;

                try {
                    // 设置断开超时 - 3秒后强制认为已断开
                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(() => {
                            console.warn('断开连接操作超时');
                            resolve(false);
                        }, 3000);
                    });

                    // 尝试断开连接
                    const disconnectPromise = this.serialHelper.disconnect();

                    // 等待断开操作完成或超时
                    disconnectSuccess = await Promise.race([
                        disconnectPromise.then(() => true),
                        timeoutPromise
                    ]);

                    if (disconnectSuccess) {
                        console.log('串口断开操作成功完成');
                    } else {
                        console.warn('串口断开操作未能在超时内完成');
                    }
                } catch (disconnectError) {
                    console.error('调用断开方法时出错:', disconnectError);
                    // 即使出错，我们仍然认为已尝试断开
                }

                // 3. 强制重置状态，确保UI显示正确
                this.status = SERIAL_STATUS.CLOSED;
                this.error = null;

                // 4. 添加系统日志条目
                try {
                    this.logEntries.push({
                        id: Date.now() + Math.random().toString(36).substr(2, 5),
                        timestamp: new Date().toLocaleTimeString(),
                        data: '串口已断开连接',
                        dataType: 'system',
                        direction: 'system'
                    });
                } catch (e) {
                    console.error('添加断开连接日志失败:', e);
                }

                console.log('串口断开过程完成');
                return true;
            } catch (error) {
                console.error('断开串口连接过程中出现异常:', error);

                // 即使出现异常，仍然确保状态重置为已关闭
                this.status = SERIAL_STATUS.CLOSED;
                this.error = error.message || '断开连接时发生未知错误';

                return false;
            }
        },

        /**
         * 开始读取数据
         */
        async startReading() {
            if (!this.serialHelper || !this.isConnected) {
                console.warn('串口未连接，无法开始读取');
                return false;
            }

            try {
                // 更新回调函数设置
                this.serialHelper.startReading((data, dataType) => {
                    this.handleReceivedData(data, dataType);
                });
                this.isReading = true;
                return true;
            } catch (error) {
                console.error('开始读取失败:', error);
                this.isReading = false;
                return false;
            }
        },

        /**
         * 分析数据包的有效性
         * @param {Uint8Array} data - 数据包
         * @returns {boolean} - 数据包是否有效
         */
        analyzeDataPacket(data) {
            // 无数据或长度为0
            if (!data || data.length === 0) return false;

            // 1. 检查是否符合数字格式（可能包含负号、小数点、空格等）
            let isNumericData = true;
            let numericChars = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', ' ', '\r', '\n']);

            // 检查是否全是数字相关字符
            for (const byte of data) {
                const char = String.fromCharCode(byte);
                if (!numericChars.has(char)) {
                    isNumericData = false;
                    break;
                }
            }

            // 数字型数据的额外验证 - 识别类似 "-", ".1411" 这样的不完整数据
            if (isNumericData) {
                // 将数据转换为字符串
                const dataStr = new TextDecoder().decode(data).trim();

                // 检查是否仅包含负号
                if (dataStr === '-') {
                    return false; // 不完整数据
                }

                // 检查是否以小数点开头且无前导数字
                if (dataStr.startsWith('.')) {
                    return false; // 不完整数据
                }

                // 尝试解析为数字，看是否有效
                return !isNaN(parseFloat(dataStr));
            }

            // 2. 检查是否为常见协议格式

            // 2.1 检查是否有STX/ETX标记
            let hasStx = false;
            let hasEtx = false;

            for (const byte of data) {
                if (byte === 0x02) hasStx = true; // STX
                if (byte === 0x03) hasEtx = true; // ETX
            }

            if (hasStx && hasEtx) {
                return true; // 包含完整的STX/ETX对
            }

            // 2.2 检查是否为完整的ASCII行
            if (data.includes(0x0A)) { // 包含换行符
                const text = new TextDecoder().decode(data);
                // 检查是否有常见的行内容（字母、数字、标点等）
                return /[a-zA-Z0-9,.;:]/.test(text);
            }

            // 3. 复杂协议模式识别（需要根据实际使用的协议定制）
            // 这里提供一个示例框架

            // 3.1 检查是否为JSON格式数据
            try {
                const text = new TextDecoder().decode(data);
                if (text.startsWith('{') && text.endsWith('}')) {
                    JSON.parse(text);
                    return true; // 有效的JSON
                }
            } catch (e) {
                // 解析失败，不是有效JSON
            }

            // 3.2 检查是否为固定长度帧
            // 假设协议规定数据帧长度为固定值或者范围
            const validLengths = [8, 16, 32, 64]; // 示例固定长度值
            if (validLengths.includes(data.length)) {
                return true;
            }

            // 默认检查 - 如果包含可打印字符且长度合理，认为有效
            let hasPrintableChars = false;
            for (const byte of data) {
                if (byte >= 32 && byte <= 126) {
                    hasPrintableChars = true;
                    break;
                }
            }

            const hasReasonableLength = data.length > 0 && data.length < 1024;

            return hasPrintableChars && hasReasonableLength;
        },

        /**
         * 处理接收到的数据
         * @param {string|Uint8Array} data 接收到的数据
         * @param {string} dataType 数据类型，如'numeric', 'command', 'numeric-partial'等
         */
        handleReceivedData(data, dataType) {
            // 数据类型处理
            let dataTypeName = dataType || 'unknown';
            let formattedData = '';
            let originalData = '';

            // 尝试将二进制数据转换为文本
            if (data instanceof Uint8Array) {
                try {
                    formattedData = new TextDecoder().decode(data);
                    originalData = formattedData;
                } catch (e) {
                    console.error('解码数据失败:', e);
                    formattedData = `[二进制数据 ${data.length}字节]`;
                    originalData = formattedData;
                }
            } else {
                formattedData = String(data);
                originalData = formattedData;
            }

            // 存储收到的数据及其类型
            let specialFormatting = false;
            let isNumericData = false;
            let isPartialData = false;
            let shouldFixIncomplete = false;
            let prefixInfo = null;

            const dataTypeInfo = {
                type: dataTypeName,
                details: {}
            };

            // 处理带前缀的命令/响应（如uart read:xxx）
            if (dataTypeName === 'command') {
                // 检查是否有传递过来的details
                if (arguments.length > 2 && arguments[2] && typeof arguments[2] === 'object') {
                    const details = arguments[2];
                    if (details.prefix && details.content) {
                        prefixInfo = details.prefix;
                        // 保留原始数据进行显示
                        originalData = `${details.prefix} ${details.content}`;
                        // 实际数据内容用于处理
                        formattedData = details.content;
                        dataTypeInfo.details = details;
                    }
                }
            }

            // 根据数据类型进行特殊处理
            if (dataTypeName === 'numeric') {
                // 数值类型特殊处理
                if (formattedData.trim() !== '') {
                    const numValue = parseFloat(formattedData);
                    if (!isNaN(numValue)) {
                        dataTypeInfo.details = {
                            value: numValue,
                            isNegative: formattedData.trim().startsWith('-'),
                            hasDecimal: formattedData.includes('.')
                        };
                        isNumericData = true;
                    }
                }
            } else if (dataTypeName === 'numeric-partial') {
                // 不完整数值处理
                isPartialData = true;

                if (formattedData.trim() === '-') {
                    dataTypeInfo.details = { isNegative: true };
                } else if (formattedData.trim().startsWith('.')) {
                    dataTypeInfo.details = {
                        hasDecimal: true,
                        decimalPart: formattedData.trim().substring(1)
                    };
                }
            }

            // 检查是否需要修复不完整的数据
            if (this.logEntries.length > 0 && dataTypeName === 'numeric') {
                const lastEntry = this.logEntries[this.logEntries.length - 1];

                // 1. 检查前一条是否为单独的负号，需要合并
                if (lastEntry.dataType === 'numeric-partial' && lastEntry.data.trim() === '-' && dataTypeName === 'numeric') {
                    console.log('自动修复：将负号与数值合并');
                    shouldFixIncomplete = true;

                    // 从日志中移除不完整的负号条目
                    this.logEntries.pop();

                    // 如果当前数据是正数，则变为负数
                    if (dataTypeInfo.details && dataTypeInfo.details.value !== undefined) {
                        const absValue = Math.abs(dataTypeInfo.details.value);
                        dataTypeInfo.details.value = -absValue;
                        dataTypeInfo.details.isNegative = true;
                        formattedData = String(-absValue);
                    } else {
                        // 简单处理：前面加负号
                        formattedData = '-' + formattedData;
                    }
                }
                // 2. 检查前一条是否为小数点开头，需要将两者合并
                else if (lastEntry.dataType === 'numeric-partial' && lastEntry.data.trim().startsWith('.') && dataTypeName === 'numeric') {
                    console.log('自动修复：将前导小数点与整数合并');
                    shouldFixIncomplete = true;

                    // 从日志中移除不完整的前导小数点条目
                    this.logEntries.pop();

                    // 将前导小数点与当前值合并处理
                    // 如果当前数字是整数，则合并为"整数.小数部分"
                    if (dataTypeInfo.details && dataTypeInfo.details.value !== undefined) {
                        // 解析前导小数部分（移除可能的前导0）
                        const decimalPart = lastEntry.data.trim().substring(1); // 移除点号
                        const currentValue = dataTypeInfo.details.value;

                        // 如果当前值为整数且小数部分有效，则合并
                        if (Number.isInteger(currentValue) && decimalPart.length > 0) {
                            const combinedValue = parseFloat(currentValue + "." + decimalPart);

                            dataTypeInfo.details.value = combinedValue;
                            dataTypeInfo.details.hasDecimal = true;
                            formattedData = String(combinedValue);
                            specialFormatting = true;
                            isNumericData = true;
                        }
                    }
                }
            }

            // 创建新的日志条目对象
            const newEntry = {
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                timestamp: new Date().toLocaleTimeString(),
                data: formattedData,
                originalData: originalData,
                dataType: dataTypeName,
                details: dataTypeInfo.details,
                isFixed: shouldFixIncomplete,
                direction: 'rx',
                hasPrefix: !!prefixInfo
            };

            // 根据刷新速度设置决定是直接添加还是放入缓冲区
            if (this.dataRefreshRate === 'fast') {
                // 快速模式：直接添加到日志
                this.logEntries.push(newEntry);

                // 限制日志条目数量
                if (this.logEntries.length > this.maxLogEntries) {
                    this.logEntries = this.logEntries.slice(-this.maxLogEntries);
                }
            } else {
                // 其他模式：添加到缓冲区
                this.dataBuffer.push(newEntry);
            }

            // 更新状态
            this.lastReceivedData = formattedData;
            // 更新计数器
            this.rxCount += formattedData.length;
        },

        /**
         * 发送数据
         * @param {string} text 要发送的文本
         * @param {boolean} keepText 是否保留输入框文本（用于自动发送模式）
         */
        async sendData(text = null, keepText = false) {
            const dataToSend = text || this.inputText;
            if (!dataToSend || dataToSend.length === 0) return;

            try {
                let binaryData;

                // 根据发送格式转换数据
                switch (this.txFormat) {
                    case DATA_FORMAT.HEX:
                        binaryData = hexStringToUint8Array(dataToSend);
                        break;
                    case DATA_FORMAT.ASCII:
                    default:
                        binaryData = asciiStringToUint8Array(dataToSend);
                }

                // 发送数据
                await this.serialHelper.sendData(binaryData);

                // 增加发送字节计数
                this.txCount += binaryData.length;

                // 添加到日志
                this.logEntries.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 5),
                    timestamp: new Date().toLocaleTimeString(),
                    data: dataToSend,
                    dataType: 'command',
                    direction: 'tx'
                });

                // 限制日志条目数量，避免内存占用过大
                if (this.logEntries.length > this.maxLogEntries) {
                    this.logEntries = this.logEntries.slice(-this.maxLogEntries);
                }

                // 添加到发送历史记录
                this.addToSendHistory(dataToSend);

                // 不在自动发送模式下才清空输入框
                if (!keepText) {
                    this.inputText = '';
                }

            } catch (error) {
                this.error = error.message;
                console.error('发送数据失败:', error);
            }
        },

        /**
         * 清空日志记录
         */
        clearLogs() {
            this.logEntries = [];
        },

        /**
         * 切换接收数据格式
         * @param {string} format 
         */
        setRxFormat(format) {
            this.rxFormat = format;
        },

        /**
         * 切换发送数据格式
         * @param {string} format 
         */
        setTxFormat(format) {
            this.txFormat = format;
            this.inputText = ''; // 格式切换时清空输入框
        },

        /**
         * 切换自动滚动
         */
        toggleAutoScroll() {
            this.autoScroll = !this.autoScroll;
        },

        /**
         * 切换时间戳显示
         */
        toggleTimestamp() {
            this.showTimestamp = !this.showTimestamp;
        },

        /**
         * 设置数据刷新速度
         * @param {string} rate - 速度级别: slow, normal, fast
         */
        setRefreshRate(rate) {
            // 清除现有的刷新定时器
            if (this.refreshIntervalId) {
                clearInterval(this.refreshIntervalId);
                this.refreshIntervalId = null;
            }

            this.dataRefreshRate = rate;

            // 根据速度设置不同的刷新间隔
            let interval = 1000;
            switch (rate) {
                case 'slow':
                    interval = 1000; // 慢速：1秒刷新一次
                    break;
                case 'normal':
                    interval = 200;  // 正常：200毫秒刷新一次
                    break;
                case 'fast':
                    interval = 0;    // 快速：实时刷新，不缓冲
                    break;
                default:
                    interval = 200;
            }

            // 如果不是快速模式，设置定时器定期处理缓冲区数据
            if (interval > 0) {
                this.refreshIntervalId = setInterval(() => {
                    this.processDataBuffer();
                }, interval);
            }
        },

        /**
         * 处理数据缓冲区
         */
        processDataBuffer() {
            if (this.dataBuffer.length === 0) return;

            // 将缓冲区的所有数据一次性添加到日志中
            for (const item of this.dataBuffer) {
                this.logEntries.push(item);
            }

            // 清空缓冲区
            this.dataBuffer = [];

            // 限制日志条目数量
            if (this.logEntries.length > this.maxLogEntries) {
                this.logEntries = this.logEntries.slice(-this.maxLogEntries);
            }
        },

        /**
         * 从本地存储中加载可视化设置
         */
        loadVisSettings() {
            try {
                const savedVisState = localStorage.getItem('serialVisState');
                if (savedVisState !== null) {
                    this.showVisualization = JSON.parse(savedVisState);
                }
            } catch (error) {
                console.error('加载可视化设置失败:', error);
            }
        },

        /**
         * 保存可视化设置到本地存储
         */
        saveVisSettings() {
            try {
                localStorage.setItem('serialVisState', JSON.stringify(this.showVisualization));
            } catch (error) {
                console.error('保存可视化设置失败:', error);
            }
        },
    }
}); 