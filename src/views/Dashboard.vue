<template>
  <div class="dashboard-container">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <div class="stats-cards">
          <el-skeleton-item variant="rect" style="height: 80px; margin-bottom: 20px;" />
          <el-skeleton-item variant="rect" style="height: 80px; margin-bottom: 20px;" />
          <el-skeleton-item variant="rect" style="height: 80px; margin-bottom: 20px;" />
          <el-skeleton-item variant="rect" style="height: 80px; margin-bottom: 20px;" />
        </div>
        <div class="charts-row">
          <el-skeleton-item variant="rect" style="height: 350px; margin-bottom: 20px;" />
          <el-skeleton-item variant="rect" style="height: 350px; margin-bottom: 20px;" />
        </div>
        <el-skeleton-item variant="rect" style="height: 400px;" />
      </template>
      
      <template #default>
        <!-- 顶部统计卡片 -->
        <div class="stats-cards">
          <el-card shadow="hover" class="stat-card">
            <div class="card-content">
              <div class="icon-box" style="background-color: #6b73ff20;">
                <el-icon color="#6b73ff" :size="24"><List /></el-icon>
              </div>
              <div class="text">
                <div class="title">总任务数</div>
                <div class="value">{{ stats.totalTasks }}</div>
              </div>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="stat-card">
            <div class="card-content">
              <div class="icon-box" style="background-color: #00c29220;">
                <el-icon color="#00c292" :size="24"><Check /></el-icon>
              </div>
              <div class="text">
                <div class="title">已完成</div>
                <div class="value">{{ stats.completedTasks }}</div>
              </div>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="stat-card">
            <div class="card-content">
              <div class="icon-box" style="background-color: #fec10720;">
                <el-icon color="#fec107" :size="24"><Clock /></el-icon>
              </div>
              <div class="text">
                <div class="title">完成率</div>
                <div class="value">{{ stats.completionRate }}%</div>
              </div>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="stat-card">
            <div class="card-content">
              <div class="icon-box" style="background-color: #fb967820;">
                <el-icon color="#fb9678" :size="24"><Medal /></el-icon>
              </div>
              <div class="text">
                <div class="title">总点数</div>
                <div class="value">{{ stats.totalPoints }}</div>
              </div>
            </div>
          </el-card>
        </div>
        
        <!-- 图表区域 -->
        <div class="charts-row">
          <el-card shadow="hover" class="chart-card">
            <template #header>
              <div class="chart-header">任务状态分布</div>
            </template>
            <div class="chart-container">
              <el-empty v-if="allTasks.length === 0" description="暂无任务数据" />
              <div v-else style="height: 300px;">
                <!-- 这里应该是echarts图表 -->
                <div class="mock-chart" style="background-color: #f5f7fa; height: 100%;">
                  <div class="mock-text">任务状态分布图表</div>
                </div>
              </div>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="chart-card">
            <template #header>
              <div class="chart-header">任务类型分布</div>
            </template>
            <div class="chart-container">
              <el-empty v-if="allTasks.length === 0" description="暂无任务数据" />
              <div v-else style="height: 300px;">
                <!-- 这里应该是echarts图表 -->
                <div class="mock-chart" style="background-color: #f5f7fa; height: 100%;">
                  <div class="mock-text">任务类型分布图表</div>
                </div>
              </div>
            </div>
          </el-card>
        </div>
        
        <!-- 近期任务 -->
        <el-card shadow="hover" class="recent-tasks">
          <template #header>
            <div class="tasks-header">近期任务详情</div>
          </template>
          <el-empty v-if="recentTasks.length === 0" description="暂无近期任务" />
            <el-table v-else :data="recentTasks" style="width: 100%" :fit="true">
            <el-table-column prop="name" label="任务名称" min-width="100 " align="center"/>
            <el-table-column prop="type" label="类型" width="90" align="center">
              <template #default="{row}">
                <el-tag :type="row.type === 'short' ? '' : 'success'">
                  {{ row.type === 'short' ? '短期' : '长期' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{row}">
                <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
                  {{ row.status === 'completed' ? '已完成' : '进行中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="point" label="点数" width="80" align="center" />
            <el-table-column prop="date" label="日期" width="100" align="center" />
            <el-table-column label="操作" width="100" align="center">
              <template #default>
                <el-button size="small">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
    </el-skeleton>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { User, Check, Clock, Star, List, Medal, Trophy, DataAnalysis } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import { usePointStore } from '@/stores/point'
import { ElMessage } from 'element-plus'

const taskStore = useTaskStore()
const pointStore = usePointStore()
const loading = ref(true)

// 加载数据
onMounted(async () => {
  try {
    await taskStore.loadFromIndexedDB()
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('数据加载失败')
  } finally {
    loading.value = false
  }
})

// 合并短期和长期任务
const allTasks = computed(() => [
  ...taskStore.shortTasks.value,
  ...taskStore.longTasks.value
])

// 最近5个任务(按日期排序)
const recentTasks = computed(() => {
  return [...allTasks.value]
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
    .slice(0, 5)
    .map(task => ({
      name: task.name,
      type: task.type,
      status: task.completed ? 'completed' : 'in-progress',
      point: task.point,
      date: task.start.split('T')[0]
    }))
})

// 统计数据
const stats = computed(() => {
  const completedTasks = allTasks.value.filter(t => t.completed).length
  const totalTasks = allTasks.value.length
  const totalPoints = allTasks.value.reduce((sum, task) => sum + task.point, 0)
  const avgPoints = totalTasks > 0 ? Math.round(totalPoints / totalTasks) : 0
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    totalTasks,
    completedTasks,
    avgPoints,
    completionRate,
    totalPoints: taskStore.points.value.points
  }
})

// 任务类型分布
const taskTypeData = computed(() => {
  const shortCount = taskStore.shortTasks.value.length
  const longCount = taskStore.longTasks.value.length
  return [
    { value: shortCount, name: '短期任务' },
    { value: longCount, name: '长期任务' }
  ]
})

// 任务状态分布
const taskStatusData = computed(() => {
  const completed = allTasks.value.filter(t => t.completed).length
  const inProgress = allTasks.value.length - completed
  return [
    { value: completed, name: '已完成' },
    { value: inProgress, name: '进行中' }
  ]
})
</script>

<style scoped>
.dashboard-container {
  margin-top: 60px;
  padding: 20px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 10px;
  border: none;
}

.card-content {
  display: flex;
  align-items: center;
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.text {
  flex: 1;
}

.title {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  border-radius: 10px;
  border: none;
}

.chart-header {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.mock-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.mock-text {
  color: #999;
  font-size: 16px;
}

.recent-tasks {
  border-radius: 10px;
  border: none;
  
  margin-top: 20px;
}

.tasks-header {
  font-size: 16px;
  text-align: center;
  color: #333;
  padding: 16px 20px;
}

.recent-tasks :deep(.el-card__body) {
  padding: 0;
}

.recent-tasks :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: #f5f7fa;
}

.recent-tasks :deep(.el-table th) {
  background-color: #f5f7fa;
  font-weight: 500;
}

.recent-tasks :deep(.el-table td) {
  padding: 12px 0;
}

.recent-tasks :deep(.el-table .cell) {
  padding-left: 20px;
  padding-right: 20px;
}

@media (max-width: 1200px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .charts-row {
    gap: 12px;
  }
  
  .recent-tasks :deep(.el-table td) {
    padding: 8px 0;
  }
  
  .recent-tasks :deep(.el-table .cell) {
    padding-left: 12px;
    padding-right: 12px;
  }
  
  .icon-box {
    width: 40px;
    height: 40px;
    margin-right: 12px;
  }
  
  .value {
    font-size: 20px;
  }
}
</style>
