<template>
  <div class="serial-panel h-full flex flex-col rounded-lg border border-gray-300 overflow-hidden p-2">
    <!-- 日志标题和控制按钮 -->
    <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
      <div class="font-medium">串口通信日志</div>
      <div class="flex space-x-2">
        <!-- 刷新速度控制 -->
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-xs"
            :class="getRefreshRateButtonClass()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ getRefreshRateLabel() }}
          </label>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
            <li><a @click="setRefreshRate('slow')" :class="{'font-bold': serialStore.dataRefreshRate === 'slow'}">慢速</a></li>
            <li><a @click="setRefreshRate('normal')" :class="{'font-bold': serialStore.dataRefreshRate === 'normal'}">正常</a></li>
            <li><a @click="setRefreshRate('fast')" :class="{'font-bold': serialStore.dataRefreshRate === 'fast'}">实时</a></li>
          </ul>
        </div>

        <!-- 接收数据格式选择 -->
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-xs" :class="getFormatButtonClass('rx')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            接收: {{ getFormatLabel(serialStore.rxFormat) }}
          </label>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
            <li><a @click="setRxFormat(DATA_FORMAT.ASCII)" :class="{'font-bold': serialStore.rxFormat === DATA_FORMAT.ASCII}">ASCII</a></li>
            <li><a @click="setRxFormat(DATA_FORMAT.HEX)" :class="{'font-bold': serialStore.rxFormat === DATA_FORMAT.HEX}">HEX</a></li>
            <li><a @click="setRxFormat(DATA_FORMAT.DEC)" :class="{'font-bold': serialStore.rxFormat === DATA_FORMAT.DEC}">DEC</a></li>
          </ul>
        </div>

        <!-- 发送数据格式选择 -->
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-xs" :class="getFormatButtonClass('tx')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            发送: {{ getFormatLabel(serialStore.txFormat) }}
          </label>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
            <li><a @click="setTxFormat(DATA_FORMAT.ASCII)" :class="{'font-bold': serialStore.txFormat === DATA_FORMAT.ASCII}">ASCII</a></li>
            <li><a @click="setTxFormat(DATA_FORMAT.HEX)" :class="{'font-bold': serialStore.txFormat === DATA_FORMAT.HEX}">HEX</a></li>
            <li><a @click="setTxFormat(DATA_FORMAT.DEC)" :class="{'font-bold': serialStore.txFormat === DATA_FORMAT.DEC}">DEC</a></li>
          </ul>
        </div>

        <!-- 时间戳显示开关 -->
        <button @click="serialStore.toggleTimestamp()" class="btn btn-xs"
          :class="serialStore.showTimestamp ? 'btn-primary' : 'btn-outline'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          时间戳
        </button>

        <!-- 自动滚动开关 -->
        <button @click="serialStore.toggleAutoScroll()" class="btn btn-xs"
          :class="serialStore.autoScroll ? 'btn-accent' : 'btn-outline'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
          </svg>
          自动滚动
        </button>

        <!-- 清空日志按钮 -->
        <button @click="clearLogs" class="btn btn-xs btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-5 0h10" />
          </svg>
          清空
        </button>
      </div>
    </div>

    <!-- 日志内容区域 - 设置固定高度和滚动 -->
    <div ref="logContainer" class="log-container flex-1 overflow-y-auto custom-scrollbar" style="max-height: 400px; height: 400px;">
      <template v-if="serialStore.logEntries.length > 0">
        <div v-for="entry in serialStore.logEntries" 
             :key="entry.id" 
             class="log-entry my-2 group hover:bg-gray-50 transition-colors duration-200 rounded-lg"
             :title="getEntryTitle(entry)">
          
          <!-- 聊天气泡样式 -->
          <div class="flex flex-col"
               :class="{ 
                 'items-start': entry.direction === 'rx', 
                 'items-end': entry.direction === 'tx'
               }">
            
            <!-- 时间戳 (靠左小字体) -->
            <span v-if="serialStore.showTimestamp" class="log-time text-xs text-gray-500 px-2">
              {{ entry.timestamp }}
            </span>

            <!-- 数据气泡 -->
            <div class="log-bubble rounded-lg px-3 py-2 border border-gray-200 max-w-[90%]"
                 :class="{
                   'bg-blue-100 rounded-tl-sm': entry.direction === 'rx',
                   'bg-green-100 rounded-tr-sm': entry.direction === 'tx',
                   'numeric-bubble': entry.dataType === 'numeric',
                   'command-bubble': entry.dataType === 'command'
                 }">
              
              <!-- 数据内容区 -->
              <div class="text-gray-800 font-mono">
                <!-- 当前为HEX模式且需要格式化显示时 -->
                <template v-if="getEntryDisplayFormat(entry) === DATA_FORMAT.HEX">
                  <div class="formatted-hex">
                    <template v-for="(chunk, index) in formatHexData(entry.data)" :key="index">
                      <div class="hex-line">{{ chunk }}</div>
                    </template>
                  </div>
                </template>
                <!-- 特殊情况：带前缀的命令数据 -->
                <template v-else-if="entry.hasPrefix && entry.originalData">
                  <div class="command-with-prefix">
                    <span class="prefix text-xs text-gray-500">{{ entry.originalData.substring(0, entry.originalData.indexOf(entry.data)) }}</span>
                    <span class="actual-content">{{ formatEntryData(entry) }}</span>
                  </div>
                </template>
                <!-- 其他情况正常显示 -->
                <template v-else>
                  {{ formatEntryData(entry) }}
                </template>
              </div>
              
              <!-- 数据类型指示与格式切换按钮 -->
              <div class="flex justify-between items-center mt-1 text-xs">
                <div>
                  <span v-if="entry.dataType === 'numeric'" class="badge badge-sm bg-blue-200 text-blue-800 border-none">数值</span>
                  <span v-else-if="entry.dataType === 'command'" class="badge badge-sm bg-purple-200 text-purple-800 border-none">命令</span>
                  <span v-else-if="entry.dataType === 'numeric-partial'" class="badge badge-sm bg-amber-200 text-amber-800 border-none">部分数据</span>
                  <span v-else-if="entry.dataType === 'unknown'" class="badge badge-sm bg-gray-200 text-gray-800 border-none">未知</span>
                  <span v-if="entry.isFixed" class="badge badge-sm bg-green-200 text-green-800 border-none ml-1">已修复</span>
                </div>
                
                <!-- 格式切换按钮组 (悬停时显示) -->
                <div class="format-toggle opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div class="btn-group btn-group-xs">
                    <button @click="toggleEntryFormat(entry, DATA_FORMAT.ASCII)" 
                            class="btn btn-xs" 
                            :class="getEntryDisplayFormat(entry) === DATA_FORMAT.ASCII ? 'btn-active' : ''">
                      ASCII
                    </button>
                    <button @click="toggleEntryFormat(entry, DATA_FORMAT.HEX)" 
                            class="btn btn-xs" 
                            :class="getEntryDisplayFormat(entry) === DATA_FORMAT.HEX ? 'btn-active' : ''">
                      HEX
                    </button>
                    <button @click="toggleEntryFormat(entry, DATA_FORMAT.DEC)" 
                            class="btn btn-xs" 
                            :class="getEntryDisplayFormat(entry) === DATA_FORMAT.DEC ? 'btn-active' : ''">
                      DEC
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="h-full flex items-center justify-center text-opacity-50">
        <p class="text-center text-base-content opacity-50">
          无数据记录
          <br />
          <span class="text-sm">连接串口后将在此处显示数据</span>
        </p>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="mt-2 flex justify-between text-sm p-2 border-t border-gray-200">
      <div>
        <span class="badge badge-sm bg-blue-100 text-blue-800 border-none mr-1">接收</span>
        <span>{{ formatBytes(serialStore.rxCount) }}</span>
      </div>
      <div>
        <span class="badge badge-sm bg-green-100 text-green-800 border-none mr-1">发送</span>
        <span>{{ formatBytes(serialStore.txCount) }}</span>
      </div>
    </div>

    <!-- 数据分析面板 (可折叠) -->
    <div class="mt-4">
      <div tabindex="0" class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
        <div class="collapse-title text-base font-medium flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
          数据统计
      </div>
      <div class="collapse-content">
          <div class="h-80 overflow-y-auto custom-scrollbar pr-2">
            <!-- 数值统计 -->
            <div class="bg-base-200 p-3 rounded-lg mb-3">
              <h4 class="font-semibold mb-2">数据统计</h4>
              <div class="stats stats-vertical shadow w-full">
            <div class="stat">
                  <div class="stat-title">数据总量</div>
                  <div class="stat-value">{{ serialStore.logEntries.length }}</div>
                  <div class="stat-desc">接收与发送总和</div>
            </div>
            <div class="stat">
                  <div class="stat-title">接收数据</div>
                  <div class="stat-value text-blue-600">{{ getRxCount }}</div>
                  <div class="stat-desc">{{ formatBytes(serialStore.rxCount) }}</div>
            </div>
            <div class="stat">
                  <div class="stat-title">发送数据</div>
                  <div class="stat-value text-green-600">{{ getTxCount }}</div>
                  <div class="stat-desc">{{ formatBytes(serialStore.txCount) }}</div>
            </div>
          </div>
        </div>

            <!-- 数值型数据统计 -->
            <div v-if="hasNumericData" class="bg-base-200 p-3 rounded-lg">
              <h4 class="font-semibold mb-2">数值型数据统计</h4>
              <div class="stats stats-vertical shadow w-full">
                <div class="stat">
                  <div class="stat-title">数值数量</div>
                  <div class="stat-value">{{ numericValues.length }}</div>
                </div>
            <div class="stat">
                  <div class="stat-title">最小值</div>
                  <div class="stat-value text-primary">{{ getMin }}</div>
            </div>
            <div class="stat">
                  <div class="stat-title">最大值</div>
                  <div class="stat-value text-secondary">{{ getMax }}</div>
            </div>
            <div class="stat">
                  <div class="stat-title">平均值</div>
                  <div class="stat-value">{{ getAverage }}</div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive } from 'vue';
import { useSerialStore, DATA_FORMAT } from '../../stores/serialStore';
import { toHexString, toAsciiString, toDecimalString } from '../../utils/dataConverter';

const serialStore = useSerialStore();
const logContainer = ref(null);

// 为每个条目存储单独的格式设置
const entryFormats = reactive(new Map());

// 获取单条记录的显示格式
const getEntryDisplayFormat = (entry) => {
  // 如果该条目有自定义格式，使用自定义的
  if (entryFormats.has(entry.id)) {
    return entryFormats.get(entry.id);
  }
  // 否则使用全局格式
  return entry.direction === 'rx' ? serialStore.rxFormat : serialStore.txFormat;
};

// 切换单条记录的格式
const toggleEntryFormat = (entry, format) => {
  entryFormats.set(entry.id, format);
};

// 格式化十六进制数据，每16字节换行
const formatHexData = (data) => {
  // 如果数据已经是HEX格式，处理现有格式
  if (/^([0-9A-Fa-f]{2}\s*)+$/.test(data)) {
    // 对于已经是HEX格式的，先去除所有空格，然后每两个字符一组
    const hexData = data.replace(/\s+/g, '').match(/.{1,2}/g) || [];
    
    // 每16字节分组并添加位置标记
    const chunked = [];
    for (let i = 0; i < hexData.length; i += 16) {
      const chunk = hexData.slice(i, i + 16);
      // 添加字节偏移前缀
      chunked.push(`${i.toString(16).padStart(4, '0')}:  ${chunk.join(' ')}`);
    }
    
    return chunked;
  } else {
    // 如果是ASCII或其他格式，先转换为HEX
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      
      // 转换为hex字符串并格式化
      const hexChars = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
      
      // 每16字节分组并添加位置标记
      const chunked = [];
      for (let i = 0; i < hexChars.length; i += 16) {
        const chunk = hexChars.slice(i, i + 16);
        // 添加字节偏移前缀
        chunked.push(`${i.toString(16).padStart(4, '0')}:  ${chunk.join(' ')}`);
      }
      
      return chunked;
    } catch (e) {
      // 转换失败则简单地按行返回
      return [data];
    }
  }
};

// 格式化显示的数据
const formatEntryData = (entry) => {
  const format = getEntryDisplayFormat(entry);
  
  // 根据选定的格式转换数据
  if (typeof entry.data === 'string') {
    switch (format) {
      case DATA_FORMAT.HEX:
        // 如果原始数据是ASCII格式，先转为Uint8Array再转为十六进制
        try {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(entry.data);
          return toHexString(bytes);
        } catch (e) {
          return entry.data;
        }
      case DATA_FORMAT.ASCII:
        return entry.data;
      case DATA_FORMAT.DEC:
        try {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(entry.data);
          return toDecimalString(bytes);
        } catch (e) {
          return entry.data;
        }
      default:
        return entry.data;
    }
  }
  
  return entry.data;
};

// 清空日志
const clearLogs = () => {
  serialStore.clearLogs();
  // 同时清空条目格式缓存
  entryFormats.clear();
};

// 计算状态相关
const stats = computed(() => {
  const entries = serialStore.logEntries;
  return {
    totalEntries: entries.length,
    numericCount: entries.filter(e => e.dataType === 'numeric').length,
    commandCount: entries.filter(e => e.dataType === 'command').length,
    unknownCount: entries.filter(e => e.dataType !== 'numeric' && e.dataType !== 'command').length
  };
});

// 滚动到最底部
const scrollToBottom = () => {
  if (!logContainer.value || !serialStore.autoScroll) return;
  
  // 使用平滑滚动效果
  logContainer.value.scrollTo({
    top: logContainer.value.scrollHeight,
    behavior: 'smooth'
  });
};

// 格式化字节数
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + sizes[i];
};

// 监听日志变化，自动滚动
watch(() => serialStore.logEntries.length, (newLength, oldLength) => {
  // 只有当有新条目添加时才滚动
  if (newLength > oldLength) {
    // 延迟滚动以确保DOM已更新
    setTimeout(scrollToBottom, 50);
  }
});

// 获取条目标题（用于鼠标悬停提示）
const getEntryTitle = (entry) => {
  const direction = entry.direction === 'rx' ? '接收' : '发送';
  const type = entry.dataType === 'numeric' ? '数值型数据' : 
               entry.dataType === 'command' ? '命令数据' : '普通数据';
  const time = entry.timestamp;
  
  let formatInfo = '';
  const format = getEntryDisplayFormat(entry);
  switch (format) {
    case DATA_FORMAT.HEX: formatInfo = '(HEX格式)'; break;
    case DATA_FORMAT.ASCII: formatInfo = '(ASCII格式)'; break;
    case DATA_FORMAT.DEC: formatInfo = '(DEC格式)'; break;
  }
  
  return `${direction} | ${type} ${formatInfo} | ${time}`;
};

// 组件挂载后初始化
onMounted(() => {
  scrollToBottom();
  // 初始化刷新速度为正常
  serialStore.setRefreshRate('normal');
});

// 数值型数据
const numericValues = computed(() => {
  return serialStore.logEntries
    .filter(entry => {
      // 检查数据类型是否为numeric或者数据内容是否为数字
      return entry.dataType === 'numeric' || 
             (typeof entry.data === 'string' && /^-?\d+(\.\d+)?$/.test(entry.data.trim()));
    })
    .map(entry => {
      // 尝试从数据中提取数值
      if (entry.details && typeof entry.details.value === 'number') {
        return entry.details.value;
      }
      // 如果details中没有value，尝试解析数据字符串
      try {
        const value = parseFloat(entry.data.trim());
        return isNaN(value) ? null : value;
      } catch (e) {
        return null;
      }
    })
    .filter(value => value !== null);
});

// 获取接收数据条目数量
const getRxCount = computed(() => {
  return serialStore.logEntries.filter(entry => entry.direction === 'rx').length;
});

// 获取发送数据条目数量
const getTxCount = computed(() => {
  return serialStore.logEntries.filter(entry => entry.direction === 'tx').length;
});

// 获取最小值
const getMin = computed(() => {
  if (numericValues.value.length === 0) return '0';
  const min = Math.min(...numericValues.value);
  // 根据数值大小选择合适的精度
  return formatNumericValue(min);
});

// 获取最大值
const getMax = computed(() => {
  if (numericValues.value.length === 0) return '0';
  const max = Math.max(...numericValues.value);
  // 根据数值大小选择合适的精度
  return formatNumericValue(max);
});

// 获取平均值
const getAverage = computed(() => {
  if (numericValues.value.length === 0) return '0';
  const sum = numericValues.value.reduce((acc, val) => acc + val, 0);
  const avg = sum / numericValues.value.length;
  // 保持更高精度的平均值显示
  return formatNumericValue(avg);
});

// 获取最近的数值型数据，用于图表显示
const recentNumericData = computed(() => {
  // 从所有日志条目中过滤出数值型数据
  const numericEntries = serialStore.logEntries
    .filter(entry => {
      const isNumeric = entry.dataType === 'numeric' || 
            (typeof entry.data === 'string' && /^-?\d+(\.\d+)?$/.test(entry.data.trim()));
      
      if (isNumeric) {
        console.log('找到数值型数据:', entry.data, entry);
      }
      
      return isNumeric && entry.direction === 'rx'; // 只处理接收的数据
    })
    .map(entry => {
      // 提取数值和时间
      let value;
      if (entry.details && typeof entry.details.value === 'number') {
        value = entry.details.value;
      } else {
        try {
          value = parseFloat(entry.data.trim());
        } catch (e) {
          value = null;
        }
      }
      
      if (value !== null && !isNaN(value)) {
        console.log('处理数值数据:', value);
      }
      
      return {
        value: isNaN(value) ? null : value,
        timestamp: entry.timestamp,
        id: entry.id
      };
    })
    .filter(item => item.value !== null);
  
  // 返回最近的数据点，最多30个
  console.log(`找到 ${numericEntries.length} 个有效数值数据点`);
  return numericEntries.slice(-30).reverse();
});

// 格式化数值，根据大小自动调整精度
const formatNumericValue = (value) => {
  if (Math.abs(value) >= 1000) {
    // 大数值取整
    return value.toFixed(0);
  } else if (Math.abs(value) >= 100) {
    // 中等数值保留1位小数
    return value.toFixed(1);
  } else if (Math.abs(value) >= 10) {
    // 小数值保留2位小数
    return value.toFixed(2);
  } else if (Math.abs(value) >= 1) {
    // 更小的数值保留3位小数
    return value.toFixed(3);
  } else if (Math.abs(value) >= 0.001) {
    // 非常小的数值保留4位小数
    return value.toFixed(4);
  } else {
    // 极小的数值使用科学记数法
    return value.toExponential(3);
  }
};

// 数据类型显示标签
const getDataTypeLabel = (dataType) => {
  switch (dataType) {
    case 'numeric': return '数值';
    case 'numeric-partial': return '部分数值';
    case 'command': return '指令';
    case 'text': return '文本';
    case 'protocol': return '协议';
    case 'binary': return '二进制';
    default: return dataType || '未知';
  }
};

// 获取日志条目类
const getLogEntryClass = (entry) => {
  if (entry.dataType === 'numeric-partial') {
    return 'log-entry-invalid';
  } else if (entry.dataType === 'numeric') {
    return 'log-entry-numeric';
  } else if (entry.dataType === 'command') {
    return 'log-entry-command';
  } else if (entry.dataType === 'unknown') {
    return '';
  }
  return '';
};

// 获取刷新速度按钮类
const getRefreshRateButtonClass = () => {
  switch (serialStore.dataRefreshRate) {
    case 'slow': return 'btn-primary';
    case 'normal': return 'btn-outline';
    case 'fast': return 'btn-accent';
    default: return 'btn-outline';
  }
};

// 获取刷新速度标签
const getRefreshRateLabel = () => {
  switch (serialStore.dataRefreshRate) {
    case 'slow': return '慢速';
    case 'normal': return '正常';
    case 'fast': return '实时';
    default: return '未知';
  }
};

// 设置刷新速度
const setRefreshRate = (rate) => {
  serialStore.setRefreshRate(rate);
};

// 组件卸载前清理
onBeforeUnmount(() => {
  // 清除刷新定时器
  if (serialStore.refreshIntervalId) {
    clearInterval(serialStore.refreshIntervalId);
    serialStore.refreshIntervalId = null;
  }
});

// 获取数据格式按钮类
const getFormatButtonClass = (direction) => {
  const format = direction === 'rx' ? serialStore.rxFormat : serialStore.txFormat;
  
  switch (format) {
    case DATA_FORMAT.ASCII:
      return 'btn-primary';
    case DATA_FORMAT.HEX:
      return 'btn-accent';
    case DATA_FORMAT.DEC:
      return 'btn-secondary';
    default:
      return 'btn-outline';
  }
};

// 获取接收数据格式标签
const getFormatLabel = (format) => {
  switch (format) {
    case DATA_FORMAT.ASCII: return 'ASCII';
    case DATA_FORMAT.HEX: return 'HEX';
    case DATA_FORMAT.DEC: return 'DEC';
    default: return '未知';
  }
};

// 设置接收数据格式
const setRxFormat = (format) => {
  serialStore.setRxFormat(format);
};

// 设置发送数据格式
const setTxFormat = (format) => {
  serialStore.setTxFormat(format);
};

// 判断是否有数值型数据
const hasNumericData = computed(() => {
  return numericValues.value.length > 0;
});
</script>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 #e2e8f0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #e2e8f0;
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #94a3b8;
  border-radius: 2px;
}

.log-bubble {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.formatted-hex {
  font-family: monospace;
  white-space: pre-wrap;
}

.hex-line {
  padding-left: 4px;
  line-height: 1.4;
}

.numeric-bubble {
  border-left: 3px solid #3b82f6;
}

.command-bubble {
  border-left: 3px solid #8b5cf6;
}

.command-with-prefix {
  display: flex;
  flex-direction: column;
}

.prefix {
  margin-bottom: 2px;
  font-style: italic;
}

.actual-content {
  font-weight: 500;
}
</style>