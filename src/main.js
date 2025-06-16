import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import router from './router'
import { useUserStore } from '@/stores/user'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
   .use(ElementPlus)
   .use(router)

// Initialize user state from localStorage
const userStore = useUserStore()
userStore.initFromLocalStorage()

app.mount('#app')
