<script lang="ts" setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import draggable from 'vuedraggable'
import { 
  ElButton, ElScrollbar, ElDialog, ElForm, ElFormItem, ElInput, 
  ElTimePicker, ElCollapse, ElCollapseItem, ElDescriptions, 
  ElDescriptionsItem, ElMessageBox, ElSelect, ElOption, ElTabs, 
  ElTabPane, ElMessage 
} from 'element-plus'

import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { usePointStore } from '@/stores/point'
import type { Task } from '@/stores/task'
import times  from './time.vue'

// 安全处理主题设置 
const theme = computed({
  get: () => {
    if (!userStore.currentUser) {
      return 'light'
    }
    return userStore.currentUser.settings?.theme || 'light'
  },
  set: (value: 'light' | 'dark') => {
    if (!userStore.currentUser) {
      return
    }
    if (!userStore.currentUser.settings) {
      userStore.currentUser.settings = {
        theme: 'light',
        notifications: false
      }
    }
    userStore.currentUser.settings.theme = value
  }
})

// 安全处理通知设置
const notifications = computed({
  get: () => {
    if (!userStore.currentUser) {
      return false
    }
    return userStore.currentUser.settings?.notifications || false
  },
  set: (value: boolean) => {
    if (!userStore.currentUser) {
      return
    }
    if (!userStore.currentUser.settings) {
      userStore.currentUser.settings = {
        theme: 'light',
        notifications: false
      }
    }
    userStore.currentUser.settings.notifications = value
  }
})

// 初始化状态管理
const userStore = useUserStore()
const taskStore = useTaskStore()
const pointStore = usePointStore()

// 表单数据结构
const form = ref({
  name: '',
  start: '00:00',
  end: '23:59',
  point: 5,
  needtime: '每日',
  customNeedtime: '',
  tasktip: '无',
  type: 'short' as 'short' | 'long'
})

// 对话框可见状态控制
const shortDialogVisible = ref(false)
const longDialogVisible = ref(false)
const editDialogVisible = ref(false)
const storeDialogVisible = ref(false)

// 编辑表单数据结构
const editForm = ref({
  name: '',
  start: '00:00',
  end: '23:59',
  point: 5,
  needtime: '每日',
  customNeedtime: '',
  tasktip: '无',
  type: 'short' as 'short' | 'long',
  value: 0
})

// 当前编辑任务引用
const currentTask = ref<Task | null>(null)

// 初始化加载数据
onMounted(async () => {
  userStore.initFromLocalStorage()
  if (userStore.loggedIn) {
    await taskStore.loadFromIndexedDB()
    initTasks()
  }
})

// 点数变化动画状态
const isPointIncreased = ref(false)

// 打开编辑对话框
const openEditDialog = (task: Task) => {
  console.log('Edit button clicked', task)
  currentTask.value = task
  editForm.value = {
    name: task.name,
    start: task.start,
    end: task.end,
    point: task.point,
    needtime: task.needtime,
    customNeedtime: task.needtime === '自定义' ? task.needtime : '',
    tasktip: task.tasktip,
    type: task.type,
    value: task.value
  }
  editDialogVisible.value = true
}

// 提交编辑表单
const submitEditForm = async () => {
  if (!currentTask.value) return
  
  const updatedTask = {
    ...currentTask.value,
    name: editForm.value.name,
    start: editForm.value.start,
    end: editForm.value.end,
    point: editForm.value.point,
    needtime: editForm.value.needtime === '自定义' 
      ? editForm.value.customNeedtime 
      : editForm.value.needtime,
    tasktip: editForm.value.tasktip
  }

  const taskList = updatedTask.type === 'short' 
    ? taskStore.shortTasks 
    : taskStore.longTasks
  
  const index = taskList.value.findIndex((t: Task) => t.value === updatedTask.value)
  if (index !== -1) {
    taskList.value[index] = updatedTask
    editDialogVisible.value = false
    ElMessage.success('任务修改成功')
    initTasks()
    await new Promise(resolve => setTimeout(resolve, 50))
    await nextTick()
  }
   
}



// 计算属性：过滤当前用户的任务
const filteredShortTasks = ref<Task[]>([])
const filteredLongTasks = ref<Task[]>([])

const initTasks = () => {
  filteredShortTasks.value = taskStore.shortTasks.value.filter(t =>
    t.userId === userStore.currentUser?.id
  )
  filteredLongTasks.value = taskStore.longTasks.value.filter(t =>
    t.userId === userStore.currentUser?.id
  )
}

// 切换任务状态
const toggleTask = (type: 'short' | 'long', value: number) => {
  const taskList = type === 'short' ? taskStore.shortTasks.value : taskStore.longTasks.value
  const task = taskList.find(t => t.value === value)
  if (task) {
    const wasCompleted = task.completed
    taskStore.toggleTaskStatus(type as 'short' | 'long', value)
    
    // Only add points when task changes from incomplete to complete
    if (!wasCompleted && task.completed) {
      const lodpoints = taskStore.points.value.points
     
      taskStore.points.value.points += task.point
      taskStore.points.value.details += `${new Date().toLocaleString()} 完成任务 ${task.name} 获得 ${task.point} 点\n`
      const mwepoints = taskStore.points.value.points
      // 点数增加触发动画
       if(mwepoints > lodpoints) 
    isPointIncreased.value = true
    setTimeout(() => isPointIncreased.value = false, 500)
  }
    }
    
   
}

// 删除任务
const deleteTask = async (type: 'short' | 'long', value: number) => {
  try {
    await ElMessageBox.confirm('确定删除该任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await taskStore.deleteTask(type as 'short' | 'long', value)
    initTasks()
    await new Promise(resolve => setTimeout(resolve, 50))
    await nextTick()
  } catch {
    // 取消删除
  }
}

const submitShortForm = async () => {
  if (!form.value.name.trim()) {
    ElMessage.error('请输入任务名称')
    return
  }
  
  try {
    await taskStore.addTask('short', {
      name: form.value.name,
      start: form.value.start,
      end: form.value.end,
      point: form.value.point,
      needtime: form.value.needtime === '自定义' ? form.value.customNeedtime : form.value.needtime,
      tasktip: form.value.tasktip,
      type: 'short'
    })
    
    shortDialogVisible.value = false
    form.value = {
      name: '',
      start: '00:00',
      end: '23:59',
      point: 5,
      needtime: '每日',
      customNeedtime: '',
      tasktip: '无',
      type: 'short'
    }
    initTasks()
    // 添加延迟确保DOM更新
    await new Promise(resolve => setTimeout(resolve, 50))
    await nextTick() // 确保Vue完成更新
  } catch (error) {
    ElMessage.error('添加任务失败')
  }
}

const submitLongForm = async () => {
  if (!form.value.name.trim()) {
    ElMessage.error('请输入任务名称')
    return
  }
  
  try {
    await taskStore.addTask('long', {
      name: form.value.name,
      start: form.value.start,
      end: form.value.end,
      point: form.value.point,
      needtime: form.value.needtime === '自定义' ? form.value.customNeedtime : form.value.needtime,
      tasktip: form.value.tasktip,
      type: 'long'
    })
    
    longDialogVisible.value = false
    form.value = {
      name: '',
      start: '00:00',
      end: '23:59',
      point: 5,
      needtime: '每日',
      customNeedtime: '',
      tasktip: '无',
      type: 'short'
    }
    initTasks()
    // 添加延迟确保DOM更新
    await new Promise(resolve => setTimeout(resolve, 50))
    await nextTick() // 确保Vue完成更新
  } catch (error) {
    ElMessage.error('添加任务失败')
  }
}

const handleDragEnd = (type: 'short' | 'long') => {
  if (type === 'short') {
    taskStore.updateTaskOrder('short', filteredShortTasks.value)
  } else {
    taskStore.updateTaskOrder('long', filteredLongTasks.value)
  }
  // 重新初始化确保数据同步
  initTasks()
}
</script>

<template>

  <!-- 主内容容器 -->
  <div class="container">
    <header>
      <h2>
        成就点数：
        <span :class="{ 'points-number': true, 'increase': isPointIncreased }">
          {{ taskStore.points.value.points }}P
        </span>
      </h2>
      <times />
    </header>

    <!-- 任务区域 -->
    <div class="content-boxes">
      <!-- 短期任务 -->
      <div class="task-box">
        <div class="task-header">
          <h4>短期任务</h4>
          <div class="task-actions">
             <el-button type="primary" @click="shortDialogVisible = true">
            添加任务
          </el-button>
          </div>
        </div>
        
        <el-scrollbar max-height="450px">
          <draggable 
            v-model="filteredShortTasks"
            item-key="value"
            handle=".drag-handle"
            animation="300"
            @end="() => handleDragEnd('short')"
          >
            <template #item="{ element: task }">
              <div class="card-container">
                <div 
                  :class="['status-box', { 'completed': task.completed }]" 
                  @click="toggleTask('short', task.value)"
                ></div>
                
                <div :class="['card', { 'completed': task.completed }]">
                  <el-collapse>
                    <el-collapse-item>
                      <template #title>
                        <div class="task-title">
                          <span>{{ task.name }}</span>
                          <span class="card-point">{{ task.point }}P</span>
                        </div>
                      </template>
                      
                      <el-descriptions :column="1" border>
                        <el-descriptions-item label="开始时间">{{ task.start }}</el-descriptions-item>
                        <el-descriptions-item label="结束时间">{{ task.end }}</el-descriptions-item>
                        <el-descriptions-item label="任务周期">{{ task.needtime }}</el-descriptions-item>
                        <el-descriptions-item label="备注说明">{{ task.tasktip }}</el-descriptions-item>
                      </el-descriptions>
                      
                      <div class="task-actions">
                        <el-button 
                          type="default" 
                          size="small"
                          @click="openEditDialog(task)"
                        >
                          修改
                        </el-button>
                        <el-button 
                          type="default" 
                          size="small"
                          @click="deleteTask('short', task.value)"
                        >
                          删除
                        </el-button>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>
                
                <div class="drag-handle">☰</div>
              </div>
            </template>
          </draggable>
        </el-scrollbar>
      </div>

      <!-- 长期任务 -->
      <div class="task-box">
        <div class="task-header">
          <h4>长期任务</h4>
          <div class="task-actions">
          <el-button type="primary" @click="longDialogVisible = true">
            添加任务
          </el-button>
        </div>
        </div>
        
        <el-scrollbar max-height="400px">
          <draggable 
            v-model="filteredLongTasks"
            item-key="value"
            handle=".drag-handle"
            animation="300"
            @end="() => handleDragEnd('long')"
          >
            <template #item="{ element: task }">
              <div :class="['card-container', { 'completed': task.completed }]">
                <div 
                  :class="['status-box', { 'completed': task.completed }]" 
                  @click="toggleTask('long', task.value)"
                ></div>
                
                <div :class="['card', { 'completed': task.completed }]">
                  <el-collapse>
                    <el-collapse-item>
                      <template #title>
                        <div class="task-title">
                          <span>{{ task.name }}</span>
                          <span class="card-point">{{ task.point }}P</span>
                        </div>
                      </template>
                      
                      <el-descriptions :column="1" border>
                        <el-descriptions-item label="开始时间">{{ task.start }}</el-descriptions-item>
                        <el-descriptions-item label="结束时间">{{ task.end }}</el-descriptions-item>
                        <el-descriptions-item label="任务周期">{{ task.needtime }}</el-descriptions-item>
                        <el-descriptions-item label="备注说明">{{ task.tasktip }}</el-descriptions-item>
                      </el-descriptions>
                      
                      <div class="task-actions">
                        <el-button 
                          type="default" 
                          size="small"
                          @click="openEditDialog(task)"
                        >
                          修改
                        </el-button>
                        <el-button 
                          type="default" 
                          size="small"
                          @click="deleteTask('long', task.value)"
                        >
                          删除
                        </el-button>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>
                
                <div class="drag-handle">☰</div>
              </div>
            </template>
          </draggable>
        </el-scrollbar>
      </div>
    </div>
  </div>

  <!-- 添加短期任务对话框 -->
  <el-dialog v-model="shortDialogVisible" title="添加短期任务" width="500px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="任务名称">
        <el-input v-model="form.name" placeholder="请输入任务名称" />
      </el-form-item>
      
      <el-form-item label="开始时间">
        <el-time-picker
          v-model="form.start"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择开始时间"
        />
      </el-form-item>
      
      <el-form-item label="结束时间">
        <el-time-picker
          v-model="form.end"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择结束时间"
        />
      </el-form-item>
      
      <el-form-item label="任务点数">
        <el-input-number v-model="form.point" :min="1" />
      </el-form-item>
      
      <el-form-item label="任务周期">
        <el-select v-model="form.needtime" placeholder="请选择周期">
          <el-option label="每日" value="每日" />
          <el-option label="每周" value="每周" />
          <el-option label="每月" value="每月" />
          <el-option label="自定义" value="自定义" />
        </el-select>
        <el-input 
          v-if="form.needtime === '自定义'"
          v-model="form.customNeedtime"
          placeholder="请输入周期（如：每3天）"
        />
      </el-form-item>
      
      <el-form-item label="任务备注">
        <el-input 
          v-model="form.tasktip"
          type="textarea"
          placeholder="请输入任务备注说明"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="shortDialogVisible = false">取消</el-button>
      <el-button 
        type="primary" 
        @click="submitShortForm"
      >
        确认添加
      </el-button>
    </template>
  </el-dialog>

  <!-- 编辑任务对话框 -->
  <el-dialog v-model="editDialogVisible" title="编辑任务" width="500px" v-if="currentTask">
    <el-form :model="editForm" label-width="80px">
      <el-form-item label="任务名称">
        <el-input v-model="editForm.name" placeholder="请输入任务名称" />
      </el-form-item>
      
      <el-form-item label="开始时间">
        <el-time-picker
          v-model="editForm.start"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择开始时间"
        />
      </el-form-item>
      
      <el-form-item label="结束时间">
        <el-time-picker
          v-model="editForm.end"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择结束时间"
        />
      </el-form-item>
      
      <el-form-item label="任务点数">
        <el-input-number v-model="editForm.point" :min="1" />
      </el-form-item>
      
      <el-form-item label="任务周期">
        <el-select v-model="editForm.needtime" placeholder="请选择周期">
          <el-option label="每日" value="每日" />
          <el-option label="每周" value="每周" />
          <el-option label="每月" value="每月" />
          <el-option label="自定义" value="自定义" />
        </el-select>
        <el-input 
          v-if="editForm.needtime === '自定义'"
          v-model="editForm.customNeedtime"
          placeholder="请输入周期（如：每3天）"
        />
      </el-form-item>
      
      <el-form-item label="任务备注">
        <el-input 
          v-model="editForm.tasktip"
          type="textarea"
          placeholder="请输入任务备注说明"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button 
        type="primary" 
        @click="submitEditForm"
      >
        确认修改
      </el-button>
    </template>
  </el-dialog>

  <!-- 添加长期任务对话框 -->
  <el-dialog v-model="longDialogVisible" title="添加长期任务" width="500px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="任务名称">
        <el-input v-model="form.name" placeholder="请输入任务名称" />
      </el-form-item>
      
      <el-form-item label="开始时间">
        <el-time-picker
          v-model="form.start"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择开始时间"
        />
      </el-form-item>
      
      <el-form-item label="结束时间">
        <el-time-picker
          v-model="form.end"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择结束时间"
        />
      </el-form-item>
      
      <el-form-item label="任务点数">
        <el-input-number v-model="form.point" :min="1" />
      </el-form-item>
      
      <el-form-item label="任务周期">
        <el-select v-model="form.needtime" placeholder="请选择周期">
          <el-option label="每日" value="每日" />
          <el-option label="每周" value="每周" />
          <el-option label="每月" value="每月" />
          <el-option label="自定义" value="自定义" />
        </el-select>
        <el-input 
          v-if="form.needtime === '自定义'"
          v-model="form.customNeedtime"
          placeholder="请输入周期（如：每3天）"
        />
      </el-form-item>
      
      <el-form-item label="任务备注">
        <el-input 
          v-model="form.tasktip"
          type="textarea"
          placeholder="请输入任务备注说明"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="longDialogVisible = false">取消</el-button>
      <el-button 
        type="primary" 
        @click="submitLongForm"
      >
        确认添加
      </el-button>
    </template>
  </el-dialog>
 
</template>


<style scoped>
.task-header{
  padding-bottom: 5px;
  margin: 0 0 10px 0;
  display: flex;
  padding-bottom: 3px;
}
.task-header h4 {
  width: 50%;
  text-align: left;
  margin: 0 ;
  padding-top: 5px;
  padding-left: 15%;
}

.task-actions {
  width: 50%;
  text-align: center;
}
 header {
  background: linear-gradient(135deg, #3a7bd5 0%, #00d2ff 100%);
  color: white;
  padding: 10px;
  display: flex;
  border-radius: 10px 10px  0 0;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}
.task-title {
  padding-left: 10%;
  display: grid;
  grid-template-columns: 1fr auto; /* 左列自适应，右列根据内容宽度 */
  align-items: center;
}
/* 数字变化动画样式 */
.points-number {
  display: inline-block;
  transition: all 0.5s ease; /* 平滑过渡动画 */
}

.points-number.increase {
  color: rgba(15, 222, 15, 0.701);
  font-weight: bold;
  transform: scale(1.2);
}

/* 新增拖拽手柄样式 */
.drag-handle {
  cursor: move;         /* 改变鼠标指针形状 */
  padding: 0 10px;
  user-select: none;    /* 禁止文本选择 */
  transition: color 0.2s; /* 颜色过渡效果 */
}

.drag-handle:hover {
  color: #409eff;
}


.card-container {
  padding: 2px 5px 2px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  margin: 8px 0 0px 0 ;
  transition: transform 0.3s; /* 添加拖拽动画 */
}


.content-boxes {
  display: flex;
  gap: 5px ;
}
.task-box {
  height: 100%;
  flex: 1;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 20px;
  background-color: #fff;
}
@media (max-width: 768px) {
  .content-boxes {
    flex-direction: column;
  }
}

.card-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(79,70,229,0.1);
}

.status-box.completed {
  border-radius: 12px;
  background-color: #67c23a;
  border-color: #67c23a;
  
}   

.status-box {
  width: 20px;
  height: 20px;
  margin-right: 15px; /* 移至最右边 */
  border: 2px solid #ebeef5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-box.completed::before {
  content: '✓';
  color: white;
  font-size: 12px;
}

.card {
  border-radius: 3px;
  flex: 1;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.card-point {
  margin-right: 8px;
  font-size: 18px;
  border-radius: 10px;
}



.el-collapse-item__header {
  font-size: 16px;
  font-weight: bold;
}

.el-collapse-item__wrap {
  border-top: none;
}

.el-descriptions {
  margin-top: 10px;
}

.el-descriptions-item__label {
  color: #909399;
}

.el-descriptions-item__content {
  color: #606266;
}


.store-item {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
</style>