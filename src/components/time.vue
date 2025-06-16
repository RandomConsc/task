<script setup lang="ts">
import { onUnmounted } from 'vue'

let timerId: ReturnType<typeof setInterval>

function updateTime() {
    const now = new Date();
    
    // 格式化时间
    const timeStr = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // 格式化日期
    const dateOptions: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long' as const
    };
    const dateStr = now.toLocaleDateString('zh-CN', dateOptions);
    
    // 更新显示
    const timeElement = document.getElementById('current-time')
    const dateElement = document.getElementById('current-date')
    if (timeElement && dateElement) {
        timeElement.textContent = timeStr
        dateElement.textContent = dateStr
    }
}

// 初始更新时间
updateTime();
// 每秒更新一次
timerId = setInterval(updateTime, 1000);

// 组件卸载时清理定时器
onUnmounted(() => {
    clearInterval(timerId)
})
</script>
<template>
        <div class="real-time">
            <div class="time" id="current-time">00:00:00</div>
             <div class="date" id="current-date">2025年8月24日 星期日</div>
            </div>
</template>

<style scoped> 
        .real-time {
            border-radius: 12px;
            padding: 3px;
            text-align: center;
            min-width: 200px;
            backdrop-filter: blur(5px);
        }
        
        .real-time .time {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 5px;
            font-family: 'Courier New', monospace;
        }
        
        .real-time .date {
            font-size: 16px;
            opacity: 0.9;
        }
        
</style>