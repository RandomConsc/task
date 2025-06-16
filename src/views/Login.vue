<template>
  <div class="login-container">
    <div class="login-card">
      <div class="left-panel">
        <h2>欢迎回来</h2>
        <p class="subtitle">登录您的智能训练小屋账户</p>
        
        <el-form 
          :model="loginForm" 
          :rules="rules" 
          ref="loginFormRef"
          class="login-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="用户名"
              prefix-icon="el-icon-user"
              clearable
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="密码"
              prefix-icon="el-icon-lock"
              show-password
            />
          </el-form-item>
          
          <el-form-item>
            <el-button 
              type="primary" 
              class="login-btn"
              @click="submitForm"
              :loading="loading"
            >
              登录
            </el-button>
          </el-form-item>
        </el-form>
        
        <div class="footer-links">
          <router-link to="/register">注册新账户</router-link>
          <router-link to="/forgot-password">忘记密码?</router-link>
        </div>
      </div>
      
      <div class="right-panel">
        <div class="illustration">
          <img src="@/assets/login-illustration.svg" alt="Login Illustration">
        </div>
        <h3>智能训练小屋</h3>
        <p>您的个人效率管理中心</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const loginFormRef = ref()

const loginForm = ref({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const submitForm = () => {
  loginFormRef.value.validate((valid: boolean) => {
    if (valid) {
      loading.value = true
      userStore.login(loginForm.value.username, loginForm.value.password)
        .then(() => {
          router.push('/')
          ElMessage.success('登录成功')
        })
        .catch((error) => {
          ElMessage.error(error.message || '登录失败')
        })
        .finally(() => {
          loading.value = false
        })
    }
  })
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.login-card {
  display: flex;
  width: 900px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.left-panel {
  flex: 1;
  padding: 60px 50px;
}

.right-panel {
  flex: 1;
  background: linear-gradient(135deg, #6b73ff 0%, #000dff 100%);
  color: white;
  padding: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

h2 {
  font-size: 28px;
  margin-bottom: 10px;
  color: #333;
}

.subtitle {
  color: #666;
  margin-bottom: 40px;
}

.login-form {
  margin-top: 40px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  margin-top: 10px;
}

.footer-links {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.footer-links a {
  color: #666;
  text-decoration: none;
  transition: color 0.3s;
}

.footer-links a:hover {
  color: #6b73ff;
}

.illustration {
  width: 300px;
  margin-bottom: 30px;
}

.illustration img {
  width: 100%;
  height: auto;
}

.right-panel h3 {
  font-size: 24px;
  margin-bottom: 10px;
}

.right-panel p {
  font-size: 16px;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .login-card {
    flex-direction: column;
    width: 100%;
  }
  
  .right-panel {
    display: none;
  }
}
</style>
