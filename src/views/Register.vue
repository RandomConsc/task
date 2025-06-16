<template>
  <div class="register-container">
    <div class="register-card">
      <div class="left-panel">
        <h2>创建账户</h2>
        <p class="subtitle">加入智能训练小屋社区</p>
        
        <el-form 
          :model="registerForm" 
          :rules="rules" 
          ref="registerFormRef"
          class="register-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="registerForm.username"
              placeholder="用户名"
              prefix-icon="el-icon-user"
              clearable
            />
          </el-form-item>
          
          <el-form-item prop="nickname">
            <el-input
              v-model="registerForm.nickname"
              placeholder="用户昵称"
              prefix-icon="el-icon-user-solid"
              clearable
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input
              v-model="registerForm.password"
              type="password"
              placeholder="密码"
              prefix-icon="el-icon-lock"
              show-password
            />
          </el-form-item>
          
          <el-form-item prop="confirmPassword">
            <el-input
              v-model="registerForm.confirmPassword"
              type="password"
              placeholder="确认密码"
              prefix-icon="el-icon-lock"
              show-password
            />
          </el-form-item>
          
          <el-form-item>
            <el-button 
              type="primary" 
              class="register-btn"
              @click="submitForm"
              :loading="loading"
            >
              注册
            </el-button>
          </el-form-item>
        </el-form>
        
        <div class="footer-links">
          <span>已有账户?</span>
          <router-link to="/login">立即登录</router-link>
        </div>
      </div>
      
      <div class="right-panel">
        <div class="illustration">
          <img src="@/assets/register-illustration.svg" alt="Register Illustration">
        </div>
        <h3>开始您的效率之旅</h3>
        <p>加入数千名已经提升效率的用户</p>
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
const registerFormRef = ref()

const registerForm = ref({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

const validatePassword = (rule: any, value: string, callback: Function) => {
  if (value === '') {
    callback(new Error('请输入密码'))
  } else if (value.length < 6) {
    callback(new Error('密码长度不能少于6位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule: any, value: string, callback: Function) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.value.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 16, message: '长度在 3 到 16 个字符', trigger: 'blur' }
  ],
  nickname: [
    { required: true, message: '请输入用户昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { validator: validatePassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const submitForm = () => {
  registerFormRef.value.validate((valid: boolean) => {
    if (valid) {
      loading.value = true
      userStore.register({
        username: registerForm.value.username,
        nickname: registerForm.value.nickname,
        password: registerForm.value.password
      })
        .then(() => {
          ElMessage.success('注册成功')
          router.push('/')
        })
        .catch((error) => {
          ElMessage.error(error.message || '注册失败')
        })
        .finally(() => {
          loading.value = false
        })
    }
  })
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.register-card {
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

.register-form {
  margin-top: 20px;
}

.register-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  margin-top: 10px;
}

.footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  gap: 8px;
}

.footer-links span {
  color: #666;
}

.footer-links a {
  color: #6b73ff;
  text-decoration: none;
  font-weight: 500;
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
  .register-card {
    flex-direction: column;
    width: 100%;
  }
  
  .right-panel {
    display: none;
  }
}
</style>
