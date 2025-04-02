<template>
  <div class="serial-card">
    <div class="card-body">
      <h2 class="serial-card-title">串口设置</h2>

      <!-- 不支持Web Serial API的提示 -->
      <div v-if="!serialStore.isWebSerialSupported" class="alert alert-error shadow-lg">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>您的浏览器不支持Web Serial API，请使用Chrome/Edge/Opera浏览器。</span>
        </div>
      </div>

      <!-- 串口选择 -->
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">串口</span>
        </label>
        <div class="input-group">
          <select class="select select-bordered flex-1 text-xs" style="min-width: 200px;"
            :disabled="!serialStore.isWebSerialSupported || serialStore.isConnected" v-model="selectedPortInfo">
            <option disabled value="">请选择串口</option>
            <option v-for="(port, index) in serialStore.availablePorts" :key="index" :value="index"
              :title="getPortDetailInfo(port)" class="text-xs hover:bg-base-200 cursor-help">
              {{ getPortInfo(port) }}
            </option>
          </select>
          <button class="btn btn-square" :disabled="!serialStore.isWebSerialSupported || serialStore.isConnected"
            @click="serialStore.selectPort()" title="选择串口设备">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button class="btn btn-square" :disabled="!serialStore.isWebSerialSupported || serialStore.isConnected"
            @click="serialStore.refreshPorts()" title="刷新串口列表">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <label class="label">
          <span class="label-text-alt text-info">鼠标悬停查看设备信息</span>
        </label>
      </div>

      <!-- 波特率选择 -->
      <div class="form-control w-full mt-2">
        <label class="label">
          <span class="label-text">波特率</span>
        </label>
        <select class="select select-bordered w-full" v-model="serialStore.baudRate"
          :disabled="serialStore.isConnected">
          <option v-for="rate in baudRates" :key="rate.value" :value="parseInt(rate.value)">{{ rate.label }}</option>
        </select>
      </div>

      <!-- 数据位选择 -->
      <div class="form-control w-full mt-2">
        <label class="label">
          <span class="label-text">数据位</span>
        </label>
        <select class="select select-bordered w-full" v-model="serialStore.dataBits"
          :disabled="serialStore.isConnected">
          <option :value="5">5</option>
          <option :value="6">6</option>
          <option :value="7">7</option>
          <option :value="8">8</option>
        </select>
      </div>

      <!-- 停止位选择 -->
      <div class="form-control w-full mt-2">
        <label class="label">
          <span class="label-text">停止位</span>
        </label>
        <select class="select select-bordered w-full" v-model="serialStore.stopBits"
          :disabled="serialStore.isConnected">
          <option :value="1">1</option>
          <option :value="2">2</option>
        </select>
      </div>

      <!-- 校验位选择 -->
      <div class="form-control w-full mt-2">
        <label class="label">
          <span class="label-text">校验位</span>
        </label>
        <select class="select select-bordered w-full" v-model="serialStore.parity" :disabled="serialStore.isConnected">
          <option value="none">无</option>
          <option value="even">偶校验</option>
          <option value="odd">奇校验</option>
        </select>
      </div>

      <!-- 连接/断开按钮 -->
      <div class="card-actions mt-4">
        <button v-if="!serialStore.isConnected" class="btn btn-primary btn-block" :disabled="!serialStore.canConnect"
          @click="serialStore.connect()">
          连接
        </button>
        <button v-else class="btn btn-error btn-block" @click="serialStore.disconnect()">
          断开
        </button>
      </div>

      <!-- 状态显示 -->
      <div class="mt-4 flex justify-between items-center">
        <span class="text-sm">状态:</span>
        <div class="badge gap-2" :class="statusClass">
          <div class="w-2 h-2 rounded-full"
            :class="{ 'bg-success': serialStore.isConnected, 'bg-error': !serialStore.isConnected }"></div>
          {{ serialStore.isConnected ? '已连接' : '未连接' }}
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="serialStore.error" class="alert alert-error mt-2 text-sm">
        {{ serialStore.error }}
      </div>

      <!-- 可视化控制 -->
      <div class="form-control mt-4">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" v-model="serialStore.showVisualization" class="toggle toggle-primary"
            :disabled="!serialStore.isConnected" />
          <span class="label-text">显示数据可视化</span>
          <span v-if="!serialStore.isConnected" class="label-text-alt text-neutral-500">(需要先连接)</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useSerialStore } from '../../stores/serialStore';

const serialStore = useSerialStore();

// 串口下拉选项
const selectedPortInfo = ref('');

// 波特率选项，低于9600的标记为低速
const baudRates = [
  { value: 110, label: '110 (低速)', isLow: true },
  { value: 300, label: '300 (低速)', isLow: true },
  { value: 1200, label: '1200 (低速)', isLow: true },
  { value: 2400, label: '2400 (低速)', isLow: true },
  { value: 4800, label: '4800 (低速)', isLow: true },
  { value: 9600, label: '9600', isLow: false },
  { value: 14400, label: '14400', isLow: false },
  { value: 19200, label: '19200', isLow: false },
  { value: 38400, label: '38400', isLow: false },
  { value: 57600, label: '57600', isLow: false },
  { value: 115200, label: '115200', isLow: false },
  { value: 128000, label: '128000', isLow: false },
  { value: 256000, label: '256000', isLow: false },
  { value: 1000000, label: '1000000', isLow: false }
];

// 计算状态显示样式
const statusClass = computed(() => {
  return serialStore.isConnected
    ? 'badge-success text-success-content'
    : 'badge-error text-error-content';
});

// 获取端口显示信息
const getPortInfo = (port) => {
  const info = port.getInfo();

  // 设备名称，尝试根据VID/PID识别常见设备
  let deviceName = '串口设备';

  // 添加VID/PID信息
  if (info && info.usbVendorId) {
    // 尝试匹配芯片名称
    const chipInfo = getChipInfo(info.usbVendorId, info.usbProductId);
    if (chipInfo) {
      deviceName = chipInfo;
    }
  }

  // 设备编号
  const deviceIndex = serialStore.availablePorts.indexOf(port);
  const portNumber = deviceIndex >= 0 ? (deviceIndex + 1) : '?';

  return `${deviceName} #${portNumber}`;
};

// 获取端口详细信息（用于悬停提示）
const getPortDetailInfo = (port) => {
  const info = port.getInfo();
  let details = [];

  // 设备类型信息
  if (info && info.usbVendorId) {
    const vid = info.usbVendorId.toString(16).padStart(4, '0').toUpperCase();
    const pid = info.usbProductId.toString(16).padStart(4, '0').toUpperCase();

    details.push(`设备ID: ${vid}:${pid}`);

    // 芯片信息
    const chipInfo = getChipInfo(info.usbVendorId, info.usbProductId);
    if (chipInfo) {
      details.push(`型号: ${chipInfo}`);
    }

    // 厂商信息
    const vendorInfo = getVendorInfo(info.usbVendorId);
    if (vendorInfo) {
      details.push(`厂商: ${vendorInfo}`);
    }
  }

  return details.join('\n');
};

// 根据VID和PID识别常见的USB转串口芯片
const getChipInfo = (vendorId, productId) => {
  // 常见的USB转串口芯片
  const knownChips = {
    // FTDI
    '0403': {
      '6001': 'FTDI FT232R',
      '6010': 'FTDI FT2232H',
      '6011': 'FTDI FT4232H',
      '6014': 'FTDI FT232H',
      '6015': 'FTDI FT231X'
    },
    // Silicon Labs CP210x系列
    '10c4': {
      'ea60': 'Silicon Labs CP210x',
      'ea70': 'Silicon Labs CP2105',
      'ea71': 'Silicon Labs CP2102N'
    },
    // Prolific
    '067b': {
      '2303': 'Prolific PL2303'
    },
    // QinHeng和WCH系列
    '1a86': {
      '7523': 'CH340',
      '5523': 'CH341',
      '55d4': 'CH9102'
    }
  };

  const vid = vendorId.toString(16).padStart(4, '0');
  const pid = productId.toString(16).padStart(4, '0');

  if (knownChips[vid] && knownChips[vid][pid]) {
    return knownChips[vid][pid];
  }

  return null;
};

// 根据VID获取厂商信息
const getVendorInfo = (vendorId) => {
  const vid = vendorId.toString(16).padStart(4, '0');

  // 常见USB厂商
  const vendors = {
    '0403': 'Future Technology Devices International (FTDI)',
    '10c4': 'Silicon Laboratories',
    '067b': 'Prolific Technology',
    '1a86': 'QinHeng Electronics / WCH'
  };

  return vendors[vid] || null;
};

// 监听选择的端口变化
watch(selectedPortInfo, (newValue) => {
  if (newValue !== '') {
    serialStore.selectedPort = serialStore.availablePorts[parseInt(newValue)];
  } else {
    serialStore.selectedPort = null;
  }
});

// 监听可视化状态变化
watch(() => serialStore.showVisualization, (newValue) => {
  serialStore.saveVisSettings();
});

// 初始化串口
serialStore.init();
</script>