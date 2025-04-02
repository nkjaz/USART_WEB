<template>
  <div class="app-container" :class="{ 'loaded': pageLoaded }">
    <!-- 背景图片层 -->
    <div class="fixed inset-0 z-0" :class="{ 'dark-mode-bg': isDarkMode }" :style="{
      opacity: bgOpacity,
      backgroundImage: `url(${currentBgUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      transition: 'all 0.8s ease'
    }"></div>

    <!-- 内容层 -->
    <div class="container mx-auto p-4 max-w-[1200px] min-h-screen flex flex-col relative z-10">
      <header class="my-4 flex items-center justify-between">
        <!-- 
          Logo区域 - 左侧 
          点击5次可切换背景图片
        -->
        <div class="flex-shrink-0 transition-transform duration-300 hover:scale-110 cursor-pointer"
          @click="handleLogoClick">
          <!-- 用户logo图片 -->
          <img src="./assets/images/logo.png" alt="Logo"
            class="h-14 w-auto object-contain filter drop-shadow-md rounded-sm" />
          <!-- 点击计数显示 - 开发时可取消注释 -->
          <!-- <div class="text-xs mt-1 text-center">{{logoClickCount % 5}}/5</div> -->
        </div>

        <!-- 标题区域 - 居中 -->
        <div class="flex-grow text-center">
          <h1 class="text-3xl font-bold text-primary drop-shadow-md">网页串口助手</h1>
          <p class="text-base-content opacity-80">无需下载，在浏览器中直接操作串口设备</p>
        </div>

        <!-- 右侧预留区域，保持平衡 -->
        <div class="flex-shrink-0 w-12"></div>
      </header>

      <main class="flex-1 flex flex-col md:flex-row gap-4">
        <!-- 左侧 - 设置面板 -->
        <div class="w-full md:w-1/4 self-start sticky top-4">
          <SerialSettings />
        </div>

        <!-- 右侧 - 功能区 -->
        <div class="w-full md:w-3/4 flex flex-col gap-4">
          <!-- 顶部 - 数据记录 -->
          <div class="flex-grow h-[400px]">
            <SerialLog />
          </div>

          <!-- 底部 - 数据发送 -->
          <div class="mt-4">
            <SerialSend />
          </div>

          <!-- 数据可视化 - 根据开关状态显示 -->
          <div v-if="serialStore.showVisualization && serialStore.isConnected" class="mt-4">
            <DataVisualization />
          </div>
        </div>
      </main>

      <footer class="py-4 mt-4 text-center text-base-content opacity-70 text-sm">
        <div class="flex justify-center items-center mb-2 gap-2">
          <span class="text-xs">背景透明度:</span>
          <button @click="decreaseBgOpacity" class="btn btn-xs btn-outline">-</button>
          <div class="bg-base-300 h-2 w-20 rounded-full overflow-hidden">
            <div class="bg-primary h-full" :style="{ width: `${bgOpacity * 100}%` }"></div>
          </div>
          <button @click="increaseBgOpacity" class="btn btn-xs btn-outline">+</button>
          <span class="text-xs ml-1">{{ Math.round(bgOpacity * 100) }}%</span>
        </div>
        <div class="flex justify-center items-center mb-2">
          <span class="text-xs opacity-60">提示: 点击左上角logo 5次可切换背景图片 (当前: {{ currentBgIndex +
            1 }}/{{ backgroundImages.length }})</span>
        </div>
        <p>© {{ new Date().getFullYear() }} 网页串口助手 | 基于Web Serial API</p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import SerialSettings from './components/serial/SerialSettings.vue';
import SerialLog from './components/serial/SerialLog.vue';
import SerialSend from './components/serial/SerialSend.vue';
import DataVisualization from './components/serial/DataVisualization.vue';
import { useSerialStore } from './stores/serialStore';
import { ref, onMounted, watch, computed } from 'vue';

// 导入所有背景图片
import bg1 from './assets/images/background1.png';
import bg2 from './assets/images/background2.jpg';
import bg3 from './assets/images/background3.jpg';
import bg4 from './assets/images/background4.jpg';
import bg5 from './assets/images/background5.jpg';

const serialStore = useSerialStore();

// 背景图片列表
const backgroundImages = [
  bg1,
  bg2,
  bg3,
  bg4,
  bg5
];

// 当前背景图片索引
const currentBgIndex = ref(0);

// 点击计数器
const logoClickCount = ref(0);

// 背景图片透明度设置，可以根据需要调整 (0.0 - 1.0)
const bgOpacity = ref(0.25); // 增加透明度，使背景更加明显

// 页面加载动画控制
const pageLoaded = ref(false);

// 是否为深色模式
const isDarkMode = computed(() => {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
});

// 当前背景图片URL
const currentBgUrl = computed(() => {
  return backgroundImages[currentBgIndex.value];
});

// 处理logo点击事件
const handleLogoClick = () => {
  logoClickCount.value++;

  // 每点击5次切换一次背景
  if (logoClickCount.value % 5 === 0) {
    // 循环切换到下一个背景
    currentBgIndex.value = (currentBgIndex.value + 1) % backgroundImages.length;

    // 保存当前背景索引到本地存储
    try {
      localStorage.setItem('currentBgIndex', currentBgIndex.value.toString());
    } catch (e) {
      console.error('保存背景图片索引失败:', e);
    }
  }
};

// 加载保存的设置
onMounted(() => {
  // 尝试从本地存储加载透明度设置
  try {
    const savedOpacity = localStorage.getItem('bgOpacity');
    if (savedOpacity !== null) {
      bgOpacity.value = parseFloat(savedOpacity);
    }

    // 加载背景图片索引
    const savedBgIndex = localStorage.getItem('currentBgIndex');
    if (savedBgIndex !== null) {
      currentBgIndex.value = parseInt(savedBgIndex);
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }

  // 页面加载完成后的小延迟，使动画更平滑
  setTimeout(() => {
    pageLoaded.value = true;
  }, 100);
});

// 监听透明度变化并保存
watch(bgOpacity, (newValue) => {
  try {
    localStorage.setItem('bgOpacity', newValue.toString());
  } catch (e) {
    console.error('保存背景透明度设置失败:', e);
  }
});

// 增加/减少透明度的方法
const increaseBgOpacity = () => {
  if (bgOpacity.value < 1.0) {
    bgOpacity.value = Math.min(1.0, bgOpacity.value + 0.05);
  }
};

const decreaseBgOpacity = () => {
  if (bgOpacity.value > 0.0) {
    bgOpacity.value = Math.max(0.0, bgOpacity.value - 0.05);
  }
};
</script>

<style scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  position: relative;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.6s ease;
}

.app-container.loaded {
  opacity: 1;
  transform: translateY(0);
}

/* 
 * 背景图片设置指南：
 * 1. 背景图片会自动循环切换
 * 2. 点击logo 5次可以手动切换到下一张背景
 * 3. 如果要调整背景透明度，使用底部的透明度控制器
 */

/* 增强卡片和容器的样式 */
:deep(.serial-card),
:deep(.card-body) {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

:deep(.serial-card:hover),
:deep(.card-body:hover) {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

/* 适应深色主题 */
@media (prefers-color-scheme: dark) {

  :deep(.serial-card),
  :deep(.card-body) {
    background-color: rgba(30, 30, 42, 0.75);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  :deep(.serial-card:hover),
  :deep(.card-body:hover) {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
}

/* 深色模式下的背景滤镜 */
.dark-mode-bg {
  filter: brightness(0.7) contrast(1.2) !important;
}
</style>
