/**
 * 数据格式转换工具
 * 支持ASCII、HEX和DEC格式之间的相互转换
 */

/**
 * 将Uint8Array转换为十六进制字符串
 * @param {Uint8Array} data - 字节数组
 * @param {string} separator - 分隔符，默认为空格
 * @returns {string} 十六进制字符串
 */
export function toHexString(data, separator = ' ') {
    if (!data || data.length === 0) return '';

    return Array.from(data)
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(separator);
}

/**
 * 将Uint8Array转换为ASCII字符串
 * @param {Uint8Array} data - 字节数组
 * @returns {string} ASCII字符串
 */
export function toAsciiString(data) {
    if (!data || data.length === 0) return '';

    try {
        // 检查是否包含有效UTF-8编码数据
        const isValidUtf8 = checkValidUtf8(data);

        if (isValidUtf8) {
            const decoder = new TextDecoder('utf-8', { fatal: false });
            return decoder.decode(data);
        } else {
            // 对于无法解码的数据，使用基本的ASCII转换，替换不可打印字符
            return Array.from(data)
                .map(byte => {
                    if (byte >= 32 && byte <= 126) {
                        return String.fromCharCode(byte);
                    } else if (byte === 10 || byte === 13) {
                        // 保留换行和回车字符
                        return String.fromCharCode(byte);
                    } else {
                        // 替换不可打印字符
                        return '.';
                    }
                })
                .join('');
        }
    } catch (error) {
        console.error('转换为ASCII字符串失败:', error);
        // 降级处理
        return Array.from(data)
            .map(byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
            .join('');
    }
}

/**
 * 检查Uint8Array是否包含有效的UTF-8编码数据
 * @param {Uint8Array} data - 字节数组
 * @returns {boolean} 是否是有效的UTF-8
 */
function checkValidUtf8(data) {
    // 简单检查：尝试解码并重新编码，比较前后是否一致
    try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const encoded = decoder.decode(data);
        const encoder = new TextEncoder();
        const reEncoded = encoder.encode(encoded);

        // 检查长度是否大致匹配（允许少量差异，UTF-8编码可能不是1:1映射）
        if (Math.abs(data.length - reEncoded.length) > data.length * 0.2) {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 将Uint8Array转换为十进制数字字符串
 * @param {Uint8Array} data - 字节数组
 * @param {string} separator - 分隔符，默认为空格
 * @returns {string} 十进制字符串
 */
export function toDecimalString(data, separator = ' ') {
    if (!data || data.length === 0) return '';

    return Array.from(data)
        .map(byte => byte.toString(10))
        .join(separator);
}

/**
 * 将十六进制字符串转换为Uint8Array
 * @param {string} hexString - 十六进制字符串，可以包含空格或其他分隔符
 * @returns {Uint8Array} 字节数组
 */
export function hexStringToUint8Array(hexString) {
    // 移除所有非十六进制字符（如空格、逗号等）
    const cleanHexString = hexString.replace(/[^0-9A-Fa-f]/g, '');

    // 确保字符串长度为偶数
    const paddedHexString = cleanHexString.length % 2 === 0
        ? cleanHexString
        : '0' + cleanHexString;

    const bytes = [];
    for (let i = 0; i < paddedHexString.length; i += 2) {
        const byte = parseInt(paddedHexString.substr(i, 2), 16);
        bytes.push(byte);
    }

    return new Uint8Array(bytes);
}

/**
 * 将ASCII字符串转换为Uint8Array
 * @param {string} asciiString - ASCII字符串
 * @returns {Uint8Array} 字节数组
 */
export function asciiStringToUint8Array(asciiString) {
    if (!asciiString) return new Uint8Array();

    try {
        const encoder = new TextEncoder();
        return encoder.encode(asciiString);
    } catch (error) {
        console.error('ASCII字符串转换失败:', error);
        throw error;
    }
}

/**
 * 检查字符串是否为有效的十六进制字符串
 * @param {string} input - 要检查的字符串
 * @returns {boolean} 是否为有效的十六进制字符串
 */
export function isValidHexString(input) {
    // 移除所有空格和其他常见分隔符
    const cleanInput = input.replace(/[\s,;:]/g, '');

    // 检查是否只包含十六进制字符
    return /^[0-9A-Fa-f]*$/.test(cleanInput);
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的日期时间字符串 (HH:MM:SS.mmm)
 */
export function formatTime(date = new Date()) {
    return date.toTimeString().split(' ')[0] + '.' +
        date.getMilliseconds().toString().padStart(3, '0');
} 