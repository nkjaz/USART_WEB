/**
 * 串口通信辅助类
 * 使用Web Serial API实现浏览器中的串口通信
 */
export default class SerialHelper {
    constructor() {
        this.port = null;              // 当前打开的串口
        this.reader = null;            // 当前串口的读取器
        this.writer = null;            // 当前串口的写入器
        this.keepReading = false;      // 读取循环是否应继续
        this.dataBuffer = new Uint8Array(0); // 数据缓冲区
        this.lastProcessTime = Date.now(); // 上次处理数据的时间
        this.bufferTimeThreshold = 1000; // 缓冲区数据最长保留时间(ms)
        this.bufferTimeoutId = null;   // 缓冲区超时计时器ID
        this.onDataReceived = null;    // 数据接收回调函数
    }

    /**
     * 获取所有可用串口设备
     * @returns {Promise<Array>} 串口设备列表
     */
    async getPorts() {
        if ('serial' in navigator) {
            try {
                // 获取已获得授权的串口列表
                const ports = await navigator.serial.getPorts();
                return ports;
            } catch (error) {
                console.error('获取串口列表失败:', error);
                throw error;
            }
        } else {
            throw new Error('当前浏览器不支持Web Serial API');
        }
    }

    /**
     * 请求用户选择串口设备
     * @returns {Promise<SerialPort>} 用户选择的串口
     */
    async requestPort() {
        if ('serial' in navigator) {
            try {
                // 弹出串口选择对话框
                const port = await navigator.serial.requestPort();

                // 检查端口是否有效
                if (!port) {
                    throw new Error('未能获取有效的串口设备');
                }

                console.log('用户选择了串口设备:', port);
                return port;
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    console.error('未找到可用的串口设备');
                    throw new Error('未找到可用的串口设备，请确保设备已正确连接');
                } else if (error.name === 'SecurityError') {
                    console.error('串口访问被拒绝:', error);
                    throw new Error('串口访问被拒绝，请检查浏览器权限设置');
                } else {
                    console.error('选择串口失败:', error);
                    throw new Error(`选择串口失败: ${error.message || '用户未选择串口或操作被取消'}`);
                }
            }
        } else {
            console.error('当前浏览器不支持Web Serial API');
            throw new Error('当前浏览器不支持Web Serial API，请使用Chrome/Edge/Opera浏览器');
        }
    }

    /**
     * 打开串口连接
     * @param {SerialPort} port 串口对象
     * @param {Object} options 串口配置参数
     * @returns {Promise<void>}
     */
    async connect(port, options = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
    }) {
        if (!port) {
            console.error('无效的串口对象');
            throw new Error('无效的串口对象，请重新选择串口');
        }

        try {
            this.port = port;

            // 如果端口已经打开，先尝试关闭
            if (port.readable || port.writable) {
                try {
                    await port.close();
                    console.log('已关闭先前打开的串口连接');
                } catch (closeError) {
                    console.warn('关闭先前连接时出错，将继续尝试新连接:', closeError);
                }
            }

            // 尝试打开连接
            await this.port.open(options);

            // 验证连接是否真的成功
            if (!this.port.readable || !this.port.writable) {
                throw new Error('串口打开后不可读写，请检查设备连接');
            }

            // 连接成功后，记录设备信息并尝试获取端口号
            try {
                const info = port.getInfo();
                console.log('设备信息:', info);

                // 尝试获取更多设备属性
                console.log('端口对象属性:');
                for (const key in port) {
                    try {
                        if (typeof port[key] !== 'function') {
                            console.log(`${key}: ${port[key]}`);
                        }
                    } catch (e) {
                        // 忽略访问错误
                    }
                }

                // 为了调试，打印完整的端口对象
                console.log('完整端口对象:', JSON.stringify(port, (key, value) => {
                    if (typeof value === 'function') {
                        return '[Function]';
                    }
                    if (value instanceof ReadableStream || value instanceof WritableStream) {
                        return '[Stream]';
                    }
                    return value;
                }));

            } catch (infoError) {
                console.warn('获取设备信息失败:', infoError);
            }

            console.log('串口已成功连接:', port);
            // 重置数据缓冲区
            this.dataBuffer = new Uint8Array(0);
            return true;
        } catch (error) {
            this.port = null;

            if (error.name === 'NetworkError') {
                console.error('串口连接被拒绝或设备已被占用:', error);
                throw new Error('串口连接被拒绝或设备已被占用，请检查设备是否已被其他程序使用');
            } else if (error.name === 'InvalidStateError') {
                console.error('串口状态无效:', error);
                throw new Error('串口状态无效，请刷新页面重试');
            } else {
                console.error('串口连接失败:', error);
                throw new Error(`串口连接失败: ${error.message || '未知错误'}`);
            }
        }
    }

    /**
     * 断开串口连接
     */
    async disconnect() {
        try {
            // 停止读取循环
            this.keepReading = false;

            // 关闭并释放reader
            if (this.reader) {
                try {
                    await this.reader.cancel();
                    console.log('读取器已取消');
                } catch (readerError) {
                    console.warn('取消读取器时出错:', readerError);
                }

                try {
                    this.reader.releaseLock();
                    console.log('读取器锁已释放');
                } catch (lockError) {
                    console.warn('释放读取器锁时出错:', lockError);
                }
                this.reader = null;
            }

            // 关闭并释放writer
            if (this.writer) {
                try {
                    await this.writer.close();
                    console.log('写入器已关闭');
                } catch (writerError) {
                    console.warn('关闭写入器时出错:', writerError);
                }

                try {
                    this.writer.releaseLock();
                    console.log('写入器锁已释放');
                } catch (lockError) {
                    console.warn('释放写入器锁时出错:', lockError);
                }
                this.writer = null;
            }

            // 关闭端口
            if (this.port) {
                try {
                    // 检查端口是否仍然打开
                    if (this.port.readable || this.port.writable) {
                        await this.port.close();
                        console.log('串口已关闭');
                    } else {
                        console.log('串口已经处于关闭状态');
                    }
                } catch (portError) {
                    console.warn('关闭串口时出错:', portError);
                }
                this.port = null;
            }
        } catch (error) {
            console.error('断开连接时出错:', error);
            throw error;
        }
    }

    /**
     * 获取连接状态
     * @returns {boolean} 是否已连接
     */
    get isConnected() {
        return this.port !== null && this.port.readable && this.port.writable;
    }

    /**
     * 尝试获取串口设备的COM端口号
     * 注意：Web Serial API并不直接提供COM端口号，这是一个尝试从设备路径解析的方法
     * @param {SerialPort} port 串口对象
     * @returns {string|null} 端口号或null
     */
    extractPortNumber(port) {
        if (!port) return null;

        try {
            // 获取设备信息
            const info = port.getInfo();

            // 一些浏览器实现中，port对象可能有一个URL属性
            // 包含Windows下的COM端口号信息
            if (port.url) {
                const match = port.url.match(/COM(\d+)/i);
                if (match && match[1]) {
                    return match[1];
                }
            }

            // 有些浏览器可能将端口信息添加到扩展属性中
            if (port.comName) {
                const match = port.comName.match(/COM(\d+)/i);
                if (match && match[1]) {
                    return match[1];
                }
            }

            // 使用设备路径尝试提取
            if (info && info.device && info.device.path) {
                const match = info.device.path.match(/COM(\d+)/i);
                if (match && match[1]) {
                    return match[1];
                }
            }

            // 如果都无法获取，则返回null
            return null;
        } catch (error) {
            console.warn('提取端口号失败:', error);
            return null;
        }
    }

    /**
     * 检查端口是否正常打开
     * @returns {Promise<boolean>} 端口是否正常打开
     */
    async checkPortOpen() {
        if (!this.port) {
            return false;
        }

        try {
            // 检查端口是否可读写
            if (!this.port.readable || !this.port.writable) {
                return false;
            }

            // 尝试获取可读流的基本信息以确认连接状态
            // 这是一个轻量级检查，不会实际读取数据
            const readableStatus = !!this.port.readable;
            const writableStatus = !!this.port.writable;

            return readableStatus && writableStatus;
        } catch (error) {
            console.error('检查端口状态时出错:', error);
            return false;
        }
    }

    /**
     * 获取最后通信时间
     * @returns {number} 最后处理数据的时间戳
     */
    getLastCommunicationTime() {
        return this.lastProcessTime || Date.now();
    }

    /**
     * 更新最后通信时间
     * 在每次收发数据时应调用此方法
     */
    updateLastCommunicationTime() {
        this.lastProcessTime = Date.now();
    }

    /**
     * 发送保活信号
     * 发送一个特殊字节，用于检测串口连接是否仍然活跃
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendKeepAlive() {
        try {
            if (!this.isConnected) {
                throw new Error('串口未连接');
            }

            // 发送一个零字节作为保活信号
            // 这通常不会影响大多数设备的正常工作
            const keepAliveSignal = new Uint8Array([0x00]);

            await this.sendData(keepAliveSignal);

            // 更新最后通信时间
            this.updateLastCommunicationTime();

            return true;
        } catch (error) {
            console.error('发送保活信号失败:', error);
            throw error;
        }
    }

    /**
     * 合并两个Uint8Array
     * @param {Uint8Array} a 第一个数组
     * @param {Uint8Array} b 第二个数组
     * @returns {Uint8Array} 合并后的数组
     */
    concatUint8Arrays(a, b) {
        const result = new Uint8Array(a.length + b.length);
        result.set(a, 0);
        result.set(b, a.length);
        return result;
    }

    /**
     * 处理接收到的数据
     * @param {Uint8Array} newData 新接收到的数据
     * @param {function} callback 回调函数，用于处理完整的数据帧
     */
    processReceivedData(newData, callback) {
        // 检查是否有新数据
        if (!newData || newData.length === 0) {
            return;
        }

        // 更新最后通信时间
        this.updateLastCommunicationTime();

        // 将新数据添加到缓冲区
        const completeBuffer = new Uint8Array(this.dataBuffer.length + newData.length);
        completeBuffer.set(this.dataBuffer);
        completeBuffer.set(newData, this.dataBuffer.length);
        this.dataBuffer = completeBuffer;

        // 提取完整帧
        const { frames, remainingBuffer } = this.extractFrames(this.dataBuffer);

        // 更新缓冲区
        this.dataBuffer = remainingBuffer;

        // 处理检测到的完整帧
        for (const frame of frames) {
            if (typeof callback === 'function') {
                callback(frame.data, frame.type, frame.details);
            }
        }

        // 如果缓冲区不为空，且超过缓冲时间阈值，则尝试处理残留数据
        if (this.dataBuffer.length > 0) {
            clearTimeout(this.bufferTimeoutId);
            this.bufferTimeoutId = setTimeout(() => {
                // 超时后，如果缓冲区中还有数据，作为完整帧处理
                if (this.dataBuffer.length > 0) {
                    const { frames } = this.extractFrames(this.dataBuffer);
                    for (const frame of frames) {
                        if (typeof callback === 'function') {
                            callback(frame.data, frame.type, frame.details);
                        }
                    }
                    // 清空缓冲区
                    this.dataBuffer = new Uint8Array(0);
                }
            }, this.bufferTimeThreshold);
        }
    }

    /**
     * 提取完整帧，根据接收到的数据特征识别并提取完整数据帧
     * @param {Uint8Array} buffer - 数据缓冲区
     * @return {Array} - 提取的完整帧数组及其类型信息
     */
    extractFrames(buffer) {
        if (!buffer || buffer.length === 0) {
            return { frames: [], remainingBuffer: buffer };
        }

        try {
            // 先尝试解码成文本进行分析
            const textContent = new TextDecoder().decode(buffer);
            const frames = [];
            const lines = textContent.split(/\r?\n/);

            let remainingText = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // 最后一行可能不完整，保留到下一次处理
                if (i === lines.length - 1 && !textContent.endsWith('\n')) {
                    remainingText = line;
                    continue;
                }

                // 跳过空行
                if (line.trim() === '') continue;

                // 分析当前行的类型
                const frameInfo = this.analyzeFrameType(line);

                // 添加处理好的帧到结果列表
                frames.push({
                    data: frameInfo.details && frameInfo.details.content ? frameInfo.details.content : line,
                    type: frameInfo.type,
                    details: frameInfo.details || {}
                });
            }

            // 转换剩余文本为缓冲区
            const remainingBuffer = remainingText ?
                new TextEncoder().encode(remainingText) :
                new Uint8Array(0);

            return {
                frames,
                remainingBuffer
            };
        } catch (e) {
            console.error('解析帧时出错:', e);
            // 解析出错，返回原始缓冲区
            return {
                frames: [],
                remainingBuffer: buffer
            };
        }
    }

    /**
     * 分析数据帧类型
     * @param {Uint8Array} frame 数据帧
     * @returns {{type: string, isValid: boolean, details: Object}} 帧类型信息
     */
    analyzeFrameType(frame) {
        // 空帧处理
        if (!frame || frame.trim() === '') {
            return { type: 'unknown' };
        }

        const trimmedFrame = frame.trim();

        // 检测是否为命令或响应（带前缀）
        let prefixMatch = null;
        let actualContent = '';

        if (trimmedFrame.match(/^uart\s+read:/i)) {
            prefixMatch = trimmedFrame.match(/^uart\s+read:\s*(.*)/i);
            actualContent = prefixMatch && prefixMatch[1] ? prefixMatch[1] : '';
            return {
                type: 'command',
                details: {
                    prefix: 'uart read:',
                    content: actualContent
                }
            };
        } else if (trimmedFrame.match(/^command:/i)) {
            prefixMatch = trimmedFrame.match(/^command:\s*(.*)/i);
            actualContent = prefixMatch && prefixMatch[1] ? prefixMatch[1] : '';
            return {
                type: 'command',
                details: {
                    prefix: 'command:',
                    content: actualContent
                }
            };
        } else if (trimmedFrame.match(/^response:/i)) {
            prefixMatch = trimmedFrame.match(/^response:\s*(.*)/i);
            actualContent = prefixMatch && prefixMatch[1] ? prefixMatch[1] : '';
            return {
                type: 'command',
                details: {
                    prefix: 'response:',
                    content: actualContent
                }
            };
        } else if (trimmedFrame.match(/^>>/i)) {
            prefixMatch = trimmedFrame.match(/^>>\s*(.*)/i);
            actualContent = prefixMatch && prefixMatch[1] ? prefixMatch[1] : '';
            return {
                type: 'command',
                details: {
                    prefix: '>>',
                    content: actualContent
                }
            };
        }

        // 检查是否只是一个单独的负号
        if (trimmedFrame === '-') {
            return {
                type: 'numeric-partial',
                details: { isNegative: true }
            };
        }

        // 检查是否以小数点开头（可能是不完整的数字）
        if (trimmedFrame.startsWith('.') && /^\.\d*$/.test(trimmedFrame)) {
            return {
                type: 'numeric-partial',
                details: {
                    hasDecimal: true,
                    decimalPart: trimmedFrame.substring(1)
                }
            };
        }

        // 检查是否为纯数字（允许负号、小数点）
        if (/^-?\d+(\.\d+)?$/.test(trimmedFrame)) {
            const value = parseFloat(trimmedFrame);
            return {
                type: 'numeric',
                details: {
                    value,
                    isNegative: trimmedFrame.startsWith('-'),
                    hasDecimal: trimmedFrame.includes('.'),
                    wholePart: parseInt(value),
                    decimalPart: trimmedFrame.includes('.') ?
                        trimmedFrame.split('.')[1] : null
                }
            };
        }

        // 默认为未知类型
        return { type: 'unknown' };
    }

    /**
     * 设置回调函数并开始读取串口数据
     * @param {function} callback 回调函数，将接收数据和数据类型
     */
    startReading(callback) {
        if (!this.port || !this.port.readable) {
            throw new Error('串口未连接或不可读');
        }

        // 保存回调函数引用
        this.onDataReceived = callback;

        // 设置标志以启动读取循环
        this.keepReading = true;

        // 重置数据缓冲区
        this.dataBuffer = new Uint8Array(0);

        // 开始读取循环
        this.readLoop();
    }

    /**
     * 发送数据到串口
     * @param {Uint8Array|string} data 要发送的数据
     * @param {boolean} isHex 是否是十六进制字符串
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendData(data, isHex = false) {
        if (!this.port || !this.port.writable) {
            throw new Error('串口未连接');
        }

        try {
            if (!this.writer) {
                this.writer = this.port.writable.getWriter();
            }

            // 如果是字符串，转换为Uint8Array
            const dataToSend = typeof data === 'string'
                ? new TextEncoder().encode(data)
                : data;

            await this.writer.write(dataToSend);

            // 更新最后通信时间
            this.updateLastCommunicationTime();

            console.log('数据发送成功:', dataToSend);
            return true;
        } catch (error) {
            console.error('发送数据失败:', error);
            throw error;
        } finally {
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
        }
    }

    /**
     * 检查浏览器是否支持Web Serial API
     * @returns {boolean} 是否支持
     */
    isWebSerialSupported() {
        return 'serial' in navigator;
    }

    /**
     * 实现持续读取串口数据的循环
     */
    async readLoop() {
        if (!this.port || !this.port.readable) {
            console.error('串口未连接或不可读');
            return;
        }

        try {
            // 获取读取器
            this.reader = this.port.readable.getReader();

            // 使用循环持续读取数据
            while (this.keepReading) {
                try {
                    const { value, done } = await this.reader.read();

                    if (done) {
                        console.log('读取结束');
                        break;
                    }

                    if (value) {
                        console.log('接收原始数据:', value);
                        this.processReceivedData(value, this.onDataReceived);
                    }
                } catch (readError) {
                    console.error('数据读取错误:', readError);
                    // 出错时不退出循环，尝试继续读取
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('读取串口数据时发生错误:', error);
            throw error;
        } finally {
            // 确保释放读取器锁
            if (this.reader) {
                try {
                    this.reader.releaseLock();
                } catch (releaseError) {
                    console.error('释放reader锁失败:', releaseError);
                }
                this.reader = null;
            }
        }
    }
} 