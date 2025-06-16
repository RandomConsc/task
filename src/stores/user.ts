// user.ts
import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'


// Add explicit type exports
export interface UserStore {
  currentUser: Ref<User | null>
  loggedIn: Ref<boolean>
  users: Ref<User[]>
  initFromLocalStorage: () => void
  useTemporaryUser: (nickname: string) => void
  register: (userData: {username: string; nickname: string; password: string}) => Promise<User>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  saveSettings: () => Promise<void>
}


// 用户接口定义
export interface User {
  id: string          // 用户唯一ID
  username: string    // 用户账号
  nickname: string    // 用户昵称
  password: string    // 用户密码
  settings?: {        // 用户设置（可选）
    theme: 'light' | 'dark' // 主题设置
    notifications: boolean  // 通知开关
  }
}

// 用户状态管理存储
export const useUserStore = defineStore('user', () => {
  // 响应式状态
  const currentUser = ref<User | null>(null)  // 当前用户
  const loggedIn = ref(false)                 // 登录状态
  const users = ref<User[]>([])               // 所有用户数组

  // 初始化方法：从localStorage加载用户状态
  const initFromLocalStorage = () => {
    const savedUsers = localStorage.getItem('users')
    const savedCurrentUser = localStorage.getItem('currentUser')
    
    if (savedUsers) {
      users.value = JSON.parse(savedUsers)
    }
    
    if (savedCurrentUser) {
      const user = JSON.parse(savedCurrentUser)
      // Add comprehensive type checking
      if (typeof user === 'object' && user !== null) {
        if (!user.id) {
          user.id = user.username === 'temp_user' ? 'temp_user' : `user_${Date.now()}`
        }
        // Validate settings.theme
        if (user.settings?.theme && !['light', 'dark'].includes(user.settings.theme)) {
          user.settings.theme = 'light'
        }
        currentUser.value = user as User
        loggedIn.value = true
      }
    }
  }

  // 使用临时用户
  const useTemporaryUser = (nickname: string) => {
    const tempUser: User = {
      id: 'temp_user',
      username: 'temp_user',
      password: 'temp_password',
      nickname,
      settings: {
        theme: 'light' as const,
        notifications: true
      }
    }
    
    // 保存用户数据
    currentUser.value = tempUser
    users.value = [...users.value.filter(u => u.id !== 'temp_user'), tempUser]
    localStorage.setItem('users', JSON.stringify(users.value))
    localStorage.setItem('currentUser', JSON.stringify(tempUser))
    loggedIn.value = true
    
  }

  // 用户注册
  const register = (userData: {username: string; nickname: string; password: string}) => {
    // 验证必需参数
    if (!userData.password) {
      ElMessage.error('密码不能为空')
      return Promise.reject(new Error('密码不能为空'))
    }
    
    // 实时检查账号是否已存在
    const savedUsers = localStorage.getItem('users')
    if (savedUsers) {
      const existingUsers = JSON.parse(savedUsers) as User[]
      if (existingUsers.some(u => u.username === userData.username)) {
        ElMessage.error(`账号 ${userData.username} 已存在`)
        return Promise.reject(new Error('账号已存在'))
      }
    }

    const userId = `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    const newUser: User = {
      id: userId,
      username: userData.username,
      nickname: userData.nickname,
      password: userData.password
    }
    
    try {
      // 保存新用户并更新存储
      users.value = [...users.value, newUser]
      localStorage.setItem('users', JSON.stringify(users.value))
      localStorage.setItem('currentUser', JSON.stringify(newUser))
      
      ElMessage.success(`注册成功，请登录您的账号 ${newUser.nickname}`)
      return Promise.resolve(newUser)
    } catch (error) {
      console.error('注册失败:', error)
      ElMessage.error('注册失败，请重试')
      return Promise.reject(error)
    }
  }

  // 用户登录
  const login = async (username: string, password: string) => {
    console.log('开始登录流程，用户名:', username)
    // 验证必需参数
    if (!password) {
      ElMessage.error('密码不能为空')
      return Promise.reject(new Error('密码不能为空'))
    }
    
    // 模拟异步登录验证
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        console.log('正在验证用户:', username)
        // 从存储加载用户数据
        const savedUsers = localStorage.getItem('users')
        console.log('本地存储的用户数据:', savedUsers)
        const userList = savedUsers ? JSON.parse(savedUsers) : users.value
        const user = userList.find((u: User) => u.username === username)
        
        if (user) {
          if (user.password === password) {
            console.log('验证成功，准备更新用户状态:', user)
            currentUser.value = user
            loggedIn.value = true
            localStorage.setItem('currentUser', JSON.stringify(user))
            console.log('用户状态更新完成，当前用户:', currentUser.value)
            ElMessage.success(`欢迎回来，${user.nickname}`)
            resolve()
          } else {
            console.log('密码验证失败')
            ElMessage.error('密码错误')
            reject()
          }
        } else {
          console.log('用户不存在:', username)
          ElMessage.error('用户不存在')
          reject()
        }
      }, 500)
    })
  }

  // 用户登出
  const logout = () => {
    console.log('执行登出操作，清除当前用户状态')
    currentUser.value = null
    loggedIn.value = false
    localStorage.removeItem('currentUser')
    localStorage.removeItem('currentConversationId')
    console.log('登出完成，当前用户状态:', {
      currentUser: currentUser.value,
      loggedIn: loggedIn.value
    })
  }

  // 保存用户设置
  const saveSettings = async () => {
    if (!currentUser.value) {
      throw new Error('未登录用户无法保存设置')
    }
    
    try {
      currentUser.value.settings = currentUser.value.settings || {
        theme: 'light',
        notifications: true
      }
      localStorage.setItem('currentUser', JSON.stringify(currentUser.value))
      ElMessage.success('设置保存成功')
    } catch (error) {
      console.error('保存设置失败:', error)
      ElMessage.error('设置保存失败')
      throw error
    }
  }

  return {
    currentUser,
    loggedIn,
    initFromLocalStorage,
    useTemporaryUser,
    register,
    login,
    logout,
    saveSettings
  }
})