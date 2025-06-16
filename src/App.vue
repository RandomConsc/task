<template>
  <NavBar v-if="showNavBar"/>
  <router-view />
</template>

<script>
import NavBar from './components/NavBar.vue'
import Welcome from './views/welcome.vue';

export default {
  name: 'App',
  components: {
    NavBar
  },
    computed: {
       // 不需要显示导航栏的路由名称数组
      showNavBar() {
    const routers = ['/Welcome', '/Login','/register' ]    // 定义不需要显示导航栏的路由名称数组
    const Routername  = this.$route.path    // 获取当前路由路径
    return !routers.includes(Routername)      // 检查当前路由是否不在隐藏路由数组中
    
  }
    } 
    
  }

</script>

<style>
/* 全局样式 */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
