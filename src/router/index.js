import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/views/Home.vue';
import Welcome from '@/views/Welcome.vue';
import Login from '@/views/Login.vue';
import Register from '@/views/Register.vue';
import Dashboard from '@/views/Dashboard.vue';
import Chat from '@/views/Chat.vue';
import Store from '@/views/Store.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/welcome', name: 'Welcome', component: Welcome },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/Chat', name: 'Chat', component: Chat },
  { path: '/store', name: 'Store', component: Store },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 首次访问检查
router.beforeEach((to, from, next) => {
  const isFirstVisit = !localStorage.getItem('hasVisited');
  if (isFirstVisit && to.path !== '/Welcome') {
    localStorage.setItem('hasVisited', 'true');
    next('/Welcome');
  } else {
    next();
  }
});

export default router;
