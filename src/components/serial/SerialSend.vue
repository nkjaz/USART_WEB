<template>
  <div class="serial-panel">
    <!-- 发送区域标题和格式选择 -->
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-lg font-bold">发送数据</h3>
      
      <!-- 发送格式选择 -->
      <div class="flex gap-2">
        <button 
          class="btn btn-sm"
          :class="{'btn-secondary': serialStore.txFormat === DATA_FORMAT.ASCII}"
          @click="serialStore.setTxFormat(DATA_FORMAT.ASCII)"
        >
          ASCII
        </button>
        <button 
          class="btn btn-sm"
          :class="{'btn-info': serialStore.txFormat === DATA_FORMAT.HEX}"
          @click="serialStore.setTxFormat(DATA_FORMAT.HEX)"
        >
          HEX
        </button>
      </div>
    </div>
    
    <!-- 数据输入区域 - 固定高度 -->
    <div class="form-control">
      <div class="input-group relative">
        <textarea 
          class="textarea textarea-bordered w-full resize-none font-mono" 
          style="height: 100px; max-height: 100px;"
          placeholder="输入要发送的数据..."
          v-model="inputText"
          :disabled="!serialStore.isConnected"
          @keydown.ctrl.enter="sendData"
        ></textarea>
        
        <!-- 历史记录下拉图标 -->
        <div class="absolute right-2 top-2 dropdown dropdown-end z-10" v-if="serialStore.sendHistory.length > 0">
          <label tabindex="0" class="btn btn-sm btn-circle btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </label>
          <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-80 max-h-60 overflow-y-auto">
            <li class="menu-title">
              <span>发送历史</span>
            </li>
            <li v-for="(item, index) in serialStore.sendHistory" :key="index">
              <a @click="useHistoryItem(item)" class="font-mono text-sm truncate">{{ item }}</a>
            </li>
            <li class="menu-title pt-2">
              <button class="btn btn-xs btn-error w-full" @click="serialStore.clearSendHistory()">清空历史</button>
            </li>
          </ul>
        </div>
      </div>
      
      <!-- 验证提示 -->
      <div v-if="inputError" class="text-error text-sm mt-1">{{ inputError }}</div>
      
      <!-- 输入提示 -->
      <label class="label">
        <span class="label-text-alt">
          <template v-if="serialStore.txFormat === DATA_FORMAT.HEX">
            请输入十六进制数据，例如: 7E 01 02 03 7E
          </template>
          <template v-else>
            按Ctrl+Enter快速发送
          </template>
        </span>
      </label>
    </div>
    
    <!-- 发送按钮 -->
    <div class="flex justify-between items-center mt-2">
      <div class="flex flex-col gap-2">
        <div class="form-control">
          <label class="label cursor-pointer">
            <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="autoSend" :disabled="!serialStore.isConnected" />
            <span class="label-text ml-2">自动发送</span>
          </label>
          <input 
            type="number" 
            class="input input-bordered input-sm w-24" 
            placeholder="间隔(ms)" 
            v-model="autoSendInterval"
            :disabled="!autoSend || !serialStore.isConnected"
            min="100"
            max="60000"
          />
        </div>
        
        <!-- 换行符选项 -->
        <div class="form-control">
          <label class="label">
            <span class="label-text text-sm">发送后追加:</span>
          </label>
          <div class="btn-group">
            <button 
              class="btn btn-xs w-20" 
              :class="lineEndingType === 'NONE' ? 'bg-green-500 hover:bg-green-600 text-white' : 'btn-ghost'" 
              @click="lineEndingType = 'NONE'"
              title="不附加任何换行符"
            >
              无追加
            </button>
            <button 
              class="btn btn-xs w-14" 
              :class="lineEndingType === 'LF' ? 'bg-green-500 hover:bg-green-600 text-white' : 'btn-ghost'" 
              @click="lineEndingType = 'LF'"
              title="仅附加LF（Line Feed）"
            >
              \n
            </button>
            <button 
              class="btn btn-xs w-14" 
              :class="lineEndingType === 'CR' ? 'bg-green-500 hover:bg-green-600 text-white' : 'btn-ghost'" 
              @click="lineEndingType = 'CR'"
              title="仅附加CR（Carriage Return）"
            >
              \r
            </button>
            <button 
              class="btn btn-xs w-14" 
              :class="lineEndingType === 'LFCR' ? 'bg-green-500 hover:bg-green-600 text-white' : 'btn-ghost'" 
              @click="lineEndingType = 'LFCR'"
              title="附加LF后跟CR"
            >
              \n\r
            </button>
            <button 
              class="btn btn-xs w-14" 
              :class="lineEndingType === 'CRLF' ? 'bg-green-500 hover:bg-green-600 text-white' : 'btn-ghost'" 
              @click="lineEndingType = 'CRLF'"
              title="附加CR后跟LF（常见于Windows环境）"
            >
              \r\n
            </button>
          </div>
        </div>
      </div>
      
      <button 
        class="btn btn-primary" 
        :disabled="!serialStore.isConnected || !isValidInput"
        @click="sendData"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        发送
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useSerialStore, DATA_FORMAT } from '../../stores/serialStore';
import { isValidHexString } from '../../utils/dataConverter';

const serialStore = useSerialStore();

// 输入文本
const inputText = ref('');
// 自动发送
const autoSend = ref(false);
const autoSendInterval = ref(1000);
// 换行符类型
const lineEndingType = ref('NONE'); // NONE, LF, CR, LFCR, CRLF
let autoSendTimer = null;

// 输入错误信息
const inputError = computed(() => {
  if (!inputText.value || inputText.value.trim() === '') return '';
  
  if (serialStore.txFormat === DATA_FORMAT.HEX && !isValidHexString(inputText.value)) {
    return '格式错误: 请输入有效的十六进制数据';
  }
  
  return '';
});

// 判断输入是否有效
const isValidInput = computed(() => {
  if (!inputText.value || inputText.value.trim() === '') return false;
  
  if (serialStore.txFormat === DATA_FORMAT.HEX) {
    return isValidHexString(inputText.value);
  }
  
  return true;
});

// 监听输入文本变化，绑定到store
watch(inputText, (newValue) => {
  serialStore.inputText = newValue;
});

// 监听store中的输入文本变化
watch(() => serialStore.inputText, (newValue) => {
  inputText.value = newValue;
});

// 获取换行符
const getLineEnding = () => {
  switch (lineEndingType.value) {
    case 'LF': return '\n';
    case 'CR': return '\r';
    case 'LFCR': return '\n\r';
    case 'CRLF': return '\r\n';
    case 'NONE':
    default: return '';
  }
};

// 发送数据
const sendData = () => {
  if (!serialStore.isConnected || !isValidInput.value) return;
  
  // 获取换行符
  const lineEnding = getLineEnding();
  let dataToSend = inputText.value;
  
  // 根据不同的数据格式添加换行符
  if (serialStore.txFormat === DATA_FORMAT.HEX && lineEnding) {
    // 对于HEX格式，需要将换行符转换为十六进制
    const lineEndingHex = Array.from(new TextEncoder().encode(lineEnding))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
    
    // 在原始十六进制数据后追加换行符的十六进制表示
    dataToSend = dataToSend.trim() + ' ' + lineEndingHex;
  } else if (lineEnding) {
    // 对于ASCII格式，直接追加换行符
    dataToSend += lineEnding;
  }
  
  // 在自动发送模式下保留输入框文本
  serialStore.sendData(dataToSend, autoSend.value);
};

// 监听自动发送状态
watch(autoSend, (newValue) => {
  if (newValue) {
    startAutoSend();
  } else {
    stopAutoSend();
  }
});

// 开始自动发送
const startAutoSend = () => {
  if (!serialStore.isConnected || !isValidInput.value) {
    autoSend.value = false;
    return;
  }
  
  stopAutoSend(); // 先停止之前的定时器
  
  // 获取用户设置的间隔时间，确保在有效范围内
  const interval = Math.max(100, Math.min(60000, autoSendInterval.value));
  
  // 设置定时器进行循环发送
  autoSendTimer = setInterval(() => {
    if (serialStore.isConnected && isValidInput.value) {
      sendData(); // 发送函数已经设置为在自动发送模式下保留文本
    } else {
      stopAutoSend(); // 如果条件不满足，停止自动发送
    }
  }, interval);
  
  // 如果是第一次勾选自动发送，立即发送一次
  // 注意: 我们在watch的回调中检测到autoSend变为true时已经调用了startAutoSend
  // 此时做一次立即发送
  if (isValidInput.value && serialStore.isConnected) {
    sendData();
  }
};

// 停止自动发送
const stopAutoSend = () => {
  if (autoSendTimer) {
    clearInterval(autoSendTimer);
    autoSendTimer = null;
  }
};

// 监听自动发送间隔变化
watch(autoSendInterval, (newValue) => {
  if (autoSend.value) {
    startAutoSend();
  }
});

// 使用历史记录项
const useHistoryItem = (text) => {
  inputText.value = text;
};

// 清理定时器
onBeforeUnmount(() => {
  stopAutoSend();
});
</script> 