
<script setup>
import { ref } from 'vue'
import { AlarmClock, TrendCharts, MagicStick } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { usePointStore } from '@/stores/point'
import { ElDialog, ElInput, ElButton } from 'element-plus'

const userStore = useUserStore()
const taskStore = useTaskStore()
const pointStore = usePointStore()
const router = useRouter()

const tempUserDialogVisible = ref(false)
const nicknameInput = ref('')

const useAsTemporaryUser = (nickname) => {
  userStore.useTemporaryUser(nickname)
  router.push('/')
}
</script>



<template>
  <div class="welcome-view">
    <div class="hero-section">
      <h1 class="welcome-title">欢迎来到智能规划小屋</h1>
      <p class="welcome-subtitle">您的个人效率管理中心</p>
      
      <div class="action-card">
        <el-input 
          v-model="nicknameInput" 
          placeholder="输入昵称快速开始"
          size="large"
          class="nickname-input"
        >
          <template #append>
            <el-button 
              type="primary" 
              @click="useAsTemporaryUser(nicknameInput || '临时用户')"

            >
              立即体验
            </el-button>
          </template>
        </el-input>


        <div class="divider">
          <span class="divider-text">或</span>
        </div>

        <div class="auth-options">
          <el-button 
            type="primary" 
            plain
            class="auth-button"
            @click="router.push('/Login')"
          >
            登录已有账号
          </el-button>
          <el-button 
            type="success" 
            plain
            class="auth-button"
            @click="router.push({ path: '/Login', query: { register: 'true' } })"
          >
            注册新账号
          </el-button>
        </div>
      </div>
    </div>

    <div class="feature-showcase">
      <el-row :gutter="20">
        <el-col :md="8" :sm="24">
          <div class="feature-card">
            <el-icon :size="60"><AlarmClock /></el-icon>

            <h3>智能任务管理</h3>
            <p>详细任务规划与激励机制</p>
          </div>
        </el-col>
        <el-col :md="8" :sm="24">
          <div class="feature-card">
            <el-icon :size="60"><TrendCharts/></el-icon>
            <h3>成长可视化</h3>
            <p>多维度的数据统计与分析</p>
          </div>
        </el-col>
        <el-col :md="8" :sm="24">
          <div class="feature-card">
            <el-icon :size="60"><MagicStick/></el-icon>
            <h3>AI训练助手</h3>
            <p>24小时在线的智能导师</p>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>



<style scoped lang="scss">
.welcome-view {
  min-height: 100vh;
  padding: 60px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

  .hero-section {
    text-align: center;
    margin-bottom: 80px;

    .welcome-title {
      font-size: 2.8rem;
      color: #2c3e50;
      margin-bottom: 1.2rem;
      letter-spacing: -0.5px;
    }

    .welcome-subtitle {
      font-size: 1.4rem;
      color: #7f8c8d;
      margin-bottom: 3rem;
    }
  }

  .action-card {
    max-width: 680px;
    margin: 0 auto;
    padding: 2.5rem;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px);

    .nickname-input {
      :deep(.el-input-group__append) {
        background-color: var(--el-color-primary);
        border: none;
        
        .el-button {
          color: white;
          padding: 0 28px;
        }
      }
    }
  }

  .divider {
    position: relative;
    margin: 2.5rem 0;
    height: 1px;
    
    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(to right, transparent, #dcdfe6, transparent);
    }

    .divider-text {
      position: relative;
      display: inline-block;
      padding: 0 1.2rem;
      background: white;
      color: #909399;
      font-size: 0.9rem;
      transform: translateY(-50%);
    }
  }

  .auth-options {
    display: flex;
    gap: 1.5rem;
    justify-content: center;

    .auth-button {
      flex: 1;
      max-width: 200px;
      padding: 12px 0;
      font-size: 1rem;
      border-radius: 8px;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }

  .feature-showcase {
    margin-top: 80px;
    padding: 0 20px;

    .feature-card {
      padding: 2.5rem 2rem;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.3);

      &:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
      }

      .el-icon {
        color: var(--el-color-primary);
        margin-bottom: 1.5rem;
        transition: transform 0.3s ease;
      }

      h3 {
        font-size: 1.5rem;
        color: #2c3e50;
        margin-bottom: 1rem;
      }

      p {
        color: #7f8c8d;
        line-height: 1.6;
        text-align: center;
        max-width: 240px;
      }
    }
  }
}

@media (max-width: 768px) {
  .welcome-view {
    padding: 40px 15px;

    .welcome-title {
      font-size: 2rem;
    }

    .welcome-subtitle {
      font-size: 1.1rem;
    }

    .action-card {
      padding: 1.5rem;
    }

    .feature-card {
      min-height: 220px;
      padding: 1.5rem;
      margin-bottom: 1rem;

      h3 {
        font-size: 1.3rem;
      }
    }

    .auth-options {
      flex-direction: column;
      gap: 1rem;

      .auth-button {
        max-width: none;
      }
    }
  }
}
</style>
