<script setup>
import { ref, computed } from 'vue'
import { 
  ElButton, ElDialog, ElMessageBox, ElMessage 
} from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { usePointStore } from '@/stores/point'
import { routeLocationKey } from 'vue-router'
import { useRouter } from 'vue-router'
import Welcome from '@/views/Welcome.vue'
import Store from '@/views/Store.vue'

const userStore = useUserStore()
const taskStore = useTaskStore()
const pointStore = usePointStore()
const router = useRouter()
// 下滑面板状态
const showUserPanel = ref(false)

// 对话框控制
const storeDialogVisible = ref(false)
const settingsDialogVisible = ref(false)

// 主题设置
const theme = computed({
  get: () => {
    if (!userStore.currentUser) return 'light'
    return userStore.currentUser.settings?.theme || 'light'
  },
  set: (value) => {
    if (!userStore.currentUser) return
    if (!userStore.currentUser.settings) {
      userStore.currentUser.settings = {
        theme: 'light',
        notifications: false
      }
    }
    userStore.currentUser.settings.theme = value
  }
})


// 处理用户退出
const handleLogout = async () => {
  try {
    const result = await ElMessageBox.confirm(
      '退出前是否清除本地数据？',
      '提示',
      {
        confirmButtonText: '清除并退出',
        cancelButtonText: '仅退出',
        type: 'warning',
        distinguishCancelAndClose: true
      }
    )
    
    if (result === 'confirm') {
      // 用户选择"清除并退出"
      localStorage.clear()
      try {
        await indexedDB.deleteDatabase('TaskDB')
      } catch (dbError) {
        console.error('清除IndexedDB失败:', dbError)
      }
    }
    
    // 公共退出逻辑 - 无论选择哪种方式都会执行
    userStore.logout()
    window.location.href = '/Welcome'
    
  } catch (error) {
    if (error === 'cancel') {
      // 用户点击"仅退出"
      userStore.logout()
      window.location.href = '/Welcome'
    } else {
      console.error('退出流程失败:', error)
      ElMessage.error('退出失败，请重试')
    }
  }
}
</script>

<template>
  <header class="header">
    <nav >
      <!-- 左侧用户昵称 -->
      <div class="nav-left">
        <h2 style="text-align: left;">{{ userStore.currentUser?.nickname || '未登录用户' }}</h2>
      </div>
      

      <!-- 中间功能按钮 -->
      <div class="nav-center">
        <div class="panel-item" @click="$router.push('/Welcome')">
          <i class="fas fa-tasks"></i> 首页
        </div>
        <div class="panel-item" @click="$router.push('/')">
          <i class="fas fa-home"></i> 主页
        </div>
        <div class="panel-item" @click="$router.push('/store')">
          <i class="fas fa-home"></i> 商店
        </div>
        <div class="panel-item" @click="$router.push('/dashboard')">
          <i class="fas fa-chart-line"></i> 数据看板
        </div>
        <div class="panel-item" @click="$router.push('/Chat')">
          <i class="fas fa-robot"></i> AI助手
        </div>
      </div>

      <!-- 右侧用户头像 -->
      <div class="nav-right">
        <el-button @click="storeDialogVisible = true">点数商店</el-button>
        <el-button @click="settingsDialogVisible = true">用户设置</el-button>
        <template v-if="!userStore.loggedIn">
          <el-button @click="$router.push('/Login')">登录/注册</el-button>
          <el-button type="primary" @click="useAsTemporaryUser('临时用户')">
            直接使用
          </el-button>
        </template>
        <template v-else>
          <el-button @click="handleLogout">退出</el-button>
        </template>
        
        <div class="avatar-container" 
             @mouseenter="showUserPanel = true" 
             @mouseleave="showUserPanel = false">
          <el-avatar :src="userStore.currentUser?.avatar || 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
                     @click="$router.push('/profile')" />

          <!-- 用户面板 -->
          <transition name="fade">
            <div v-show="showUserPanel" class="user-panel">
            <div class="panel-item" @click="$router.push('/profile')">
              <i class="fas fa-user"></i> 个人中心
            </div>
            <div class="panel-item" @click="settingsDialogVisible = true">
              <i class="fas fa-cog"></i> 账号设置
            </div>
            <div class="panel-item" @click="handleLogout">
              <i class="fas fa-sign-out-alt"></i> 退出登录
            </div>
          </div>
        </transition>
      </div>
     </div>
      
      
    </nav>
  </header>

  <!-- 点数商店对话框 -->
  <el-dialog v-model="storeDialogVisible" title="点数商店" width="600px">
    <template v-if="Array.isArray(pointStore.storeItems)">
      <div v-for="item in pointStore.storeItems" :key="item.id" class="store-item">
        <h4>{{ item.name }} - {{ item.price }}点</h4>
        <p class="description">{{ item.description }}</p>
        <el-button 
          type="primary" 
          size="small"
          @click="pointStore.buyItem(item)"
          :disabled="taskStore.points.value.points < item.price"
        >
          立即购买
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 用户设置对话框 -->
  <el-dialog v-model="settingsDialogVisible" title="用户设置" width="400px">
    <el-form label-width="100px">
      <el-form-item label="界面主题">
        <el-select v-model="theme">
          <el-option label="浅色模式" value="light" />
          <el-option label="深色模式" value="dark" />
        </el-select>
      </el-form-item>
      <el-form-item label="消息通知">
        <el-switch 
          :model-value="userStore.currentUser?.settings?.notifications || false"
          @update:modelValue="val => {
            if (!userStore.currentUser?.settings) {
              userStore.currentUser.settings = { notifications: false }
            }
            userStore.currentUser.settings.notifications = val
          }"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="settingsDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="userStore.saveSettings()">保存</el-button>
    </template>
  </el-dialog>


</template>

<style scoped>
.header {
  background: rgba(255, 255, 255, 0.98);
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 60px;
  display: flex;
  align-items: center;
}

.header nav {
  width: 100%;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.nav-left {
  align-items: left;
  flex: 1;
  position: relative;
}

.nav-center {
  display: flex;
  gap: 15px;
}

.nav-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.avatar-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* 淡入淡出动画 */

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.user-panel {
  position: absolute;
  top: 60px;
  right: 0;
  background: white;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 20px 0 10px 0;
  min-width: 160px;
  z-index: 1000;
}

.user-panel::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 10px;
  background: transparent;
}

.header nav {
  display: flex;
  align-items: center;
  gap: 15px;
  position: relative;
}


.nav-link:hover {
  color: #007bff;
}

/* 下滑面板样式 */
.dropdown-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  z-index: 999;
  padding: 12px 0;
  margin: 0 auto;
  max-width: 1200px;
  border-radius: 0 0 8px 8px;
  transition: all 0.3s ease;
}

.panel-content {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 0 20px;
}

.panel-item {
  padding: 12px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.panel-item:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-content {
  display: flex;
  gap: 20px;
}

.panel-item {
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-item:hover {
  background: #f5f7fa;
  color: #409eff;
}

/* 下滑动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  text-decoration: none;
  color: #555;
  font-weight: 500;
  transition: color 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}

.header nav a:hover {
  color: #007bff;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.store-item {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
</style>
