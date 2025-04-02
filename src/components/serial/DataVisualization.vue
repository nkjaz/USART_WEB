<template>
  <div class="serial-panel mt-4">
    <!-- 标题和控制按钮 -->
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-lg font-bold">数据可视化</h3>
      <div class="flex gap-2">
        <button class="btn btn-sm" :class="{ 'btn-secondary': chartType === 'line' }" @click="chartType = 'line'">
          折线图
        </button>
        <button class="btn btn-sm" :class="{ 'btn-info': chartType === 'bar' }" @click="chartType = 'bar'">
          柱状图
        </button>
        <button class="btn btn-sm" @click="clearData">
          清空数据
        </button>
        <button class="btn btn-sm btn-warning" @click="testToggleWarning">
          测试警告
        </button>
      </div>
    </div>

    <!-- 提示信息 - 只在低波特率时显示 -->
    <div v-if="isLowBaudRate || showTestWarning" class="alert alert-warning shadow-sm mb-2">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>提示：在低波特率模式下，可视化结果可能不准确。建议提高波特率或减少数据流量以获取更准确的图表。</span>
      </div>
    </div>

    <!-- 图表展示区域 -->
    <div class="chart-container bg-base-200 p-2 rounded-lg" style="height: 250px; position: relative;">
      <canvas ref="chartCanvas" style="width: 100%; height: 100%;"></canvas>
      <div v-if="!chartInstance || !chartInstance.value"
        class="absolute inset-0 flex items-center justify-center text-gray-500">
        <span>图表加载中...</span>
      </div>
    </div>

    <!-- 数据统计区域 -->
    <div class="stats shadow w-full mt-2">
      <div class="stat">
        <div class="stat-title">数据点数</div>
        <div class="stat-value text-sm">{{ dataPoints?.length || 0 }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">最小值</div>
        <div class="stat-value text-sm text-primary">{{ getMinValue() }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">最大值</div>
        <div class="stat-value text-sm text-secondary">{{ getMaxValue() }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">平均值</div>
        <div class="stat-value text-sm text-accent">{{ getAverageValue() }}</div>
      </div>
    </div>

    <!-- 调试信息 -->
    <div class="mt-2 text-xs opacity-50">
      当前波特率: {{ serialStore.baudRate }},
      类型: {{ typeof serialStore.baudRate }},
      连接状态: {{ serialStore.isConnected ? '已连接' : '未连接' }},
      是否低速: {{ isLowBaudRate }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount, watchEffect, nextTick } from 'vue';
import { useSerialStore } from '../../stores/serialStore';
import { Chart, registerables } from 'chart.js';

// 注册Chart.js所需组件
Chart.register(...registerables);

const serialStore = useSerialStore();
const chartCanvas = ref(null);
const chartInstance = ref(null);
const chartType = ref('line'); // 图表类型：'line' 或 'bar'
const dataPoints = ref([]); // 存储数据点
const maxDataPoints = 50; // 最多显示的数据点数
const showTestWarning = ref(false); // 测试显示警告

// 测试切换警告显示
const testToggleWarning = () => {
  showTestWarning.value = !showTestWarning.value;
  console.log('测试警告显示:', showTestWarning.value);
};

// 格式化数值，保留2位小数
const formatValue = (value) => {
  if (value === null || value === undefined) return '无数据';
  return Number(value).toFixed(2);
};

// 获取最小值
const getMinValue = () => {
  if (!dataPoints.value || dataPoints.value.length === 0) return '无数据';
  const min = Math.min(...dataPoints.value.map(point => point.y));
  return formatValue(min);
};

// 获取最大值
const getMaxValue = () => {
  if (!dataPoints.value || dataPoints.value.length === 0) return '无数据';
  const max = Math.max(...dataPoints.value.map(point => point.y));
  return formatValue(max);
};

// 获取平均值
const getAverageValue = () => {
  if (!dataPoints.value || dataPoints.value.length === 0) return '无数据';
  const sum = dataPoints.value.reduce((acc, point) => acc + point.y, 0);
  return formatValue(sum / dataPoints.value.length);
};

// 创建图表
const createChart = () => {
  try {
    // 1. 检查和准备Canvas元素
    if (!chartCanvas.value) {
      console.warn('图表Canvas元素不存在');
      return false;
    }

    // 确保Canvas尺寸正确
    const canvasEl = chartCanvas.value;
    const container = canvasEl.parentElement;

    if (container) {
      const containerStyle = getComputedStyle(container);
      const containerWidth = parseFloat(containerStyle.width);
      const containerHeight = parseFloat(containerStyle.height);

      // 手动设置Canvas尺寸，确保正确渲染
      canvasEl.width = containerWidth || 300;
      canvasEl.height = containerHeight || 200;

      console.log(`设置Canvas尺寸: ${canvasEl.width}x${canvasEl.height}`);
    }

    // 2. 清理旧图表实例
    if (chartInstance.value) {
      try {
        chartInstance.value.destroy();
      } catch (e) {
        console.warn('销毁旧图表实例失败:', e);
      }
      chartInstance.value = null;
    }

    // 3. 获取绘图上下文
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('无法获取Canvas 2D上下文');
      return false;
    }

    // 4. 清空画布，确保没有残留内容
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // 5. 准备数据
    // 确保有有效的数据数组
    if (!Array.isArray(dataPoints.value)) {
      console.warn('数据点不是数组，初始化为空数组');
      dataPoints.value = [];
    }

    // 初始没有数据，保持空数组
    if (dataPoints.value.length === 0) {
      dataPoints.value = [];
    }

    // 6. 准备图表数据
    const chartData = {
      labels: dataPoints.value.map((_, index) => index + 1),
      datasets: [{
        label: '接收数据',
        data: dataPoints.value.map(point => point.y),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3
      }]
    };

    // 7. 图表配置 - 调整为更简单的设置，减少潜在问题
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      responsiveAnimationDuration: 0, // 禁用调整大小动画
      animation: {
        duration: 0 // 初始禁用动画，确保首次渲染
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(200, 200, 200, 0.2)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true
        }
      }
    };

    // 8. 确保Chart.js正确注册
    if (!Chart.defaults) {
      console.error('Chart.js未正确初始化，重新注册组件');
      Chart.register(...registerables);
    }

    // 9. 创建新图表 - 使用try-catch包装
    try {
      chartInstance.value = new Chart(ctx, {
        type: chartType.value,
        data: chartData,
        options: chartOptions
      });

      // 10. 验证图表是否成功创建
      if (!chartInstance.value || !chartInstance.value.ctx) {
        throw new Error('图表实例创建后验证失败');
      }

      console.log('图表创建成功，类型:', chartType.value);

      // 延迟启用动画
      setTimeout(() => {
        if (chartInstance.value && chartInstance.value.options) {
          chartInstance.value.options.animation = {
            duration: 300
          };
        }
      }, 1000);

      return true;
    } catch (chartError) {
      console.error('创建Chart实例时出错:', chartError);

      // 尝试回退到最简单的图表配置
      try {
        console.log('尝试使用简化配置创建图表');
        chartInstance.value = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [1, 2, 3, 4, 5],
            datasets: [{
              label: '测试数据',
              data: [10, 20, 30, 25, 15],
              borderColor: 'blue'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });

        console.log('使用简化配置创建图表成功');
        return true;
      } catch (fallbackError) {
        console.error('即使使用简化配置也无法创建图表:', fallbackError);
        return false;
      }
    }
  } catch (error) {
    console.error('图表初始化过程出错:', error);
    return false;
  }
};

// 更新图表，带有增强的错误处理和重试机制
const updateChart = () => {
  // 如果没有数据，不更新图表
  if (!dataPoints.value || dataPoints.value.length === 0) {
    console.log('没有数据点，不更新图表');
    return;
  }

  // 如果没有Canvas元素，不能更新图表
  if (!chartCanvas.value) {
    console.warn('Canvas元素不存在，无法更新图表');
    return;
  }

  try {
    // 如果图表实例不存在，创建新图表
    if (!chartInstance.value) {
      console.log('图表实例不存在，创建新图表');
      const created = createChart();
      if (!created) {
        console.warn('创建图表失败，延迟重试');
        setTimeout(() => {
          console.log('重试创建图表');
          createChart();
        }, 500);
      }
      return;
    }

    // 打印当前数据点信息，帮助调试
    console.log(`更新图表，当前数据点数量: ${dataPoints.value.length}，最新值: ${dataPoints.value.length > 0 ? dataPoints.value[dataPoints.value.length - 1].y : 'N/A'}`);

    // 安全地更新图表数据
    try {
      // 确保图表实例有效
      if (!chartInstance.value.data) {
        throw new Error('图表实例数据无效');
      }

      // 更新标签
      chartInstance.value.data.labels = dataPoints.value.map((_, index) => index + 1);

      // 确保datasets数组存在并有效
      if (!chartInstance.value.data.datasets ||
        !Array.isArray(chartInstance.value.data.datasets) ||
        chartInstance.value.data.datasets.length === 0) {

        console.log('图表数据集不存在，创建新数据集');
        chartInstance.value.data.datasets = [{
          label: '接收数据',
          data: [],
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 3
        }];
      }

      // 使用深拷贝更新数据，避免引用问题
      const dataValues = dataPoints.value.map(point => Number(point.y));
      chartInstance.value.data.datasets[0].data = [...dataValues];

      // 执行图表更新，使用定时器避免可能的渲染问题
      setTimeout(() => {
        try {
          if (chartInstance.value) {
            chartInstance.value.update();
            console.log('图表更新成功');
          }
        } catch (delayedUpdateError) {
          console.error('延迟更新图表失败:', delayedUpdateError);
          // 最后的挽救尝试 - 重新创建图表
          setTimeout(() => createChart(), 200);
        }
      }, 0);
    } catch (dataUpdateError) {
      console.error('更新图表数据时出错:', dataUpdateError);

      // 尝试重置再更新
      setTimeout(() => {
        try {
          if (chartInstance.value) {
            // 重置数据，但保留图表实例
            chartInstance.value.data = {
              labels: dataPoints.value.map((_, index) => index + 1),
              datasets: [{
                label: '接收数据',
                data: dataPoints.value.map(point => point.y),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2
              }]
            };
            chartInstance.value.update();
          }
        } catch (resetError) {
          console.error('重置图表数据失败:', resetError);
          // 最后尝试重新创建图表
          chartInstance.value = null;
          createChart();
        }
      }, 100);
    }
  } catch (error) {
    console.error('图表更新过程出错:', error);

    // 如果整个更新流程失败，销毁图表并重新创建
    setTimeout(() => {
      try {
        if (chartInstance.value) {
          try {
            chartInstance.value.destroy();
            console.log('已销毁失败的图表实例');
          } catch (e) {
            console.warn('销毁图表失败:', e);
          }
          chartInstance.value = null;
        }

        console.log('重新创建图表');
        const success = createChart();
        if (success) {
          console.log('图表重建成功');
        } else {
          console.error('图表重建失败');
        }
      } catch (rebuildError) {
        console.error('图表重建过程出错:', rebuildError);
      }
    }, 300);
  }
};

// 清空数据
const clearData = () => {
  dataPoints.value = [];
  updateChart();
};

// 监听日志条目变化
watch(() => serialStore.logEntries, (newEntries, oldEntries = []) => {
  // 确保oldEntries不是undefined
  const previousEntries = oldEntries || [];

  // 当有新的日志条目时
  if (newEntries.length > previousEntries.length) {
    // 查找新添加的数值型条目
    const newNumericEntries = newEntries.slice(previousEntries.length)
      .filter(entry => {
        return (entry.dataType === 'numeric' ||
          (typeof entry.data === 'string' && /^-?\d+(\.\d+)?$/.test(entry.data.trim()))) &&
          entry.direction === 'rx'; // 只处理接收到的数据
      });

    // 处理新的数值型条目
    newNumericEntries.forEach(entry => {
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
        console.log('添加可视化数据点:', value);
        // 添加新的数据点
        dataPoints.value.push({
          x: new Date().getTime(),
          y: value
        });

        // 限制数据点数量
        if (dataPoints.value.length > maxDataPoints) {
          dataPoints.value = dataPoints.value.slice(-maxDataPoints);
        }

        // 更新图表
        updateChart();
      }
    });
  }
}, { deep: true, immediate: true });

// 使用watchEffect替代watch，更安全地处理数据变化
watchEffect(() => {
  try {
    // 确保serialStore.logEntries存在且是数组
    if (!serialStore.logEntries || !Array.isArray(serialStore.logEntries)) {
      console.warn('serialStore.logEntries不存在或不是数组');
      return;
    }

    // 获取当前长度
    const currentLength = serialStore.logEntries.length;

    // 如果没有数据，直接返回
    if (currentLength === 0) return;

    // 获取最新添加的条目（最多处理5个以避免性能问题）
    const lastIndex = Math.max(0, currentLength - 5);
    const recentEntries = serialStore.logEntries.slice(lastIndex);

    // 筛选数值型条目
    const numericEntries = recentEntries.filter(entry => {
      return entry && (
        (entry.dataType === 'numeric') ||
        (typeof entry.data === 'string' && /^-?\d+(\.\d+)?$/.test(String(entry.data).trim()))
      ) && entry.direction === 'rx';
    });

    // 处理新的数值型条目
    if (numericEntries.length > 0) {
      let hasNewDataPoints = false;

      numericEntries.forEach(entry => {
        // 确保entry是有效对象
        if (!entry) return;

        let value;

        if (entry.details && typeof entry.details.value === 'number') {
          value = entry.details.value;
        } else if (entry.data !== undefined) {
          try {
            value = parseFloat(String(entry.data).trim());
          } catch (e) {
            console.warn('无法解析数值:', entry.data, e);
            value = null;
          }
        }

        if (value !== null && !isNaN(value)) {
          console.log('添加可视化数据点:', value);

          // 检查是否已存在相同的数据点（避免重复）
          const isDuplicate = dataPoints.value.some(point =>
            Math.abs(point.y - value) < 0.0001 &&
            (new Date().getTime() - point.x) < 1000
          );

          if (!isDuplicate) {
            // 添加新的数据点
            dataPoints.value.push({
              x: new Date().getTime(),
              y: value
            });
            hasNewDataPoints = true;
          }
        }
      });

      // 限制数据点数量
      if (dataPoints.value.length > maxDataPoints) {
        dataPoints.value = dataPoints.value.slice(-maxDataPoints);
      }

      // 只有在有新数据点时更新图表
      if (hasNewDataPoints) {
        updateChart();
      }
    }
  } catch (error) {
    console.error('处理数据时出错:', error);
  }
});

// 首次加载时检查现有数据
const initializeWithExistingData = () => {
  // 如果当前已有数值型数据，加载它们
  const existingNumericEntries = serialStore.logEntries
    .filter(entry => {
      return (entry.dataType === 'numeric' ||
        (typeof entry.data === 'string' && /^-?\d+(\.\d+)?$/.test(entry.data.trim()))) &&
        entry.direction === 'rx';
    })
    .slice(-maxDataPoints); // 只取最近的数据

  if (existingNumericEntries.length > 0) {
    existingNumericEntries.forEach(entry => {
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
        dataPoints.value.push({
          x: new Date().getTime(),
          y: value
        });
      }
    });

    // 如果有数据，更新图表
    if (dataPoints.value.length > 0) {
      updateChart();
    }
  }
  // 如果没有现有数据，保持图表为空
};

// 监听图表类型变化
watch(chartType, (newType) => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }
  chartInstance.value = null;
  createChart();
});

// 组件挂载时创建图表
onMounted(() => {
  try {
    console.log('数据可视化组件挂载');

    // 确保dataPoints初始化为空数组
    if (!Array.isArray(dataPoints.value)) {
      dataPoints.value = [];
    }

    // 确保在DOM完全渲染后初始化图表
    nextTick(() => {
      console.log('开始创建图表');

      // 检查Canvas元素
      if (!chartCanvas.value) {
        console.error('Canvas元素不存在，可能DOM未完全加载');
        // 延迟检查Canvas并创建图表
        setTimeout(() => {
          if (chartCanvas.value) {
            console.log('延迟后找到Canvas元素，开始创建图表');
            createChart();
          } else {
            console.error('无法找到Canvas元素，无法创建图表');
          }
        }, 500);
        return;
      }

      // 检查Canvas是否在可见区域内
      const canvasRect = chartCanvas.value.getBoundingClientRect();
      console.log('Canvas元素尺寸:', canvasRect.width, 'x', canvasRect.height);

      // 如果Canvas尺寸为0，可能是容器问题
      if (canvasRect.width === 0 || canvasRect.height === 0) {
        console.warn('Canvas元素尺寸为0，可能导致图表无法渲染');
        // 强制设置Canvas尺寸
        chartCanvas.value.style.width = '100%';
        chartCanvas.value.style.height = '100%';
      }

      // 添加窗口大小改变监听（使用防抖函数）
      let resizeTimeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (chartInstance.value) {
            try {
              chartInstance.value.resize();
            } catch (e) {
              console.warn('窗口大小改变，重建图表');
              createChart();
            }
          }
        }, 100);
      };

      // 设置一个全局窗口大小调整监听器
      window.addEventListener('resize', handleResize);

      // 首次创建图表尝试
      const chartCreated = createChart();

      // 如果创建失败，多次重试，逐渐增加延迟
      if (!chartCreated) {
        console.warn('首次创建图表失败，将进行多次重试');

        // 第一次重试
        setTimeout(() => {
          if (!chartInstance.value) {
            console.log('第1次重试创建图表');
            const success = createChart();

            // 第二次重试
            if (!success) {
              setTimeout(() => {
                console.log('第2次重试创建图表');
                // 重置Canvas元素
                if (chartCanvas.value) {
                  const parent = chartCanvas.value.parentNode;
                  if (parent) {
                    const oldCanvas = chartCanvas.value;
                    const newCanvas = document.createElement('canvas');
                    parent.replaceChild(newCanvas, oldCanvas);
                    chartCanvas.value = newCanvas;
                  }
                }
                createChart();
              }, 800);
            }
          }
        }, 400);
      }

      // 初始化数据（确保图表已创建完成）
      const initializeData = () => {
        if (chartInstance.value) {
          console.log('图表已创建，初始化数据');

          try {
            // 确保serialStore初始化完成
            if (serialStore.logEntries && Array.isArray(serialStore.logEntries)) {
              initializeWithExistingData();
            }

            // 确保图表更新
            updateChart();

          } catch (e) {
            console.error('初始化数据时出错:', e);
          }
        } else {
          console.warn('图表尚未创建，延迟初始化数据');
          setTimeout(initializeData, 500);
        }
      };

      // 延迟初始化数据，确保图表已创建
      setTimeout(initializeData, 600);
    });
  } catch (error) {
    console.error('挂载数据可视化组件时出错:', error);
    // 尝试恢复
    setTimeout(() => {
      try {
        createChart();
      } catch (e) {
        console.error('尝试恢复失败:', e);
      }
    }, 1000);
  }
});

// 定义handleResize函数，防止onBeforeUnmount中出现未定义错误
const handleResize = () => {
  if (chartInstance.value) {
    chartInstance.value.resize();
  }
};

// 清理函数，组件销毁时执行
onBeforeUnmount(() => {
  // 清理图表
  if (chartInstance.value) {
    try {
      chartInstance.value.destroy();
    } catch (e) {
      console.warn('销毁图表失败:', e);
    }
    chartInstance.value = null;
  }

  // 移除resize监听
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 250px !important;
  width: 100% !important;
  display: block;
}

.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>