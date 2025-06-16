<script setup>
import task from '../components/Task.vue'
import aichat from '@/components/aichat.vue';
</script>

<template>
  <div class="task-container">
    <div class="taskbox1">
      <task />
    </div> 
    <div class="chatbox">
      <!-- 聊天区域内容 -->
       <aichat />
    </div>
  </div>
</template>

<style scoped>
/* 主容器样式 */
.task-container {
    margin-top: 60px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    max-width: 100%;
    padding: 8px 2px 10px 3px;
}

.taskbox1, .chatbox {
  max-height: 85vh;
  min-height: 85vh;
  flex: 1 1 300px;
  background-color: #fff;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .taskbox, .chatbox {
    flex: 1 1 100%;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.taskbox1, .chatbox {
  animation: fadeIn 0.5s ease-out;
}
</style>
