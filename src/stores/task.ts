// task.ts
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from './user'

// 任务接口定义
export interface Task {
  name: string         // 任务名称
  value: number        // 唯一标识符
  start: string        // 开始时间
  end: string          // 结束时间
  needtime: string     // 需要时间
  point: number        // 任务点数
  completed: boolean   // 完成状态
  tasktip: string      // 任务提示
  expanded: boolean    // 是否展开
  type: 'short' | 'long' // 任务类型
  period?: 'daily' | 'weekly' | 'monthly' | 'none' // 任务周期
  userId: string       // 关联用户ID
  lastReset?: string   // 上次重置时间
}

// 点数接口定义
export interface Point {
  points: number       // 总点数
  details: string      // 点数详情
  userId: string       // 关联用户ID
}

// 任务状态管理
export const useTaskStore = () => {
  const userStore = useUserStore()
  
  // 响应式状态
  const shortTasks = ref<Task[]>([])  // 短期任务列表
  const longTasks = ref<Task[]>([])   // 长期任务列表
  const points = ref<Point>({         // 点数系统
    points: 0,
    details: '',
    userId: ''
  })

  // IndexedDB操作
  const openDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('TaskDB', 1)

      // 数据库升级处理
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // 创建短期任务存储
        if (!db.objectStoreNames.contains('shortTasks')) {
          const store = db.createObjectStore('shortTasks', { keyPath: 'value' })
          store.createIndex('userId', 'userId', { unique: false })
        }
        
        // 创建长期任务存储
        if (!db.objectStoreNames.contains('longTasks')) {
          const store = db.createObjectStore('longTasks', { keyPath: 'value' })
          store.createIndex('userId', 'userId', { unique: false })
        }
        
        // 创建点数存储
        if (!db.objectStoreNames.contains('points')) {
          const store = db.createObjectStore('points', { keyPath: 'userId' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // 保存数据到IndexedDB
  const saveToIndexedDB = async () => {
    if (!userStore.currentUser) return

    try {
      const db = await openDB()
      const tx = db.transaction(['shortTasks', 'longTasks', 'points'], 'readwrite')
      
      // 保存短期任务
      shortTasks.value.forEach(task => {
        tx.objectStore('shortTasks').put({
          name: task.name,
          value: task.value,
          start: task.start,
          end: task.end,
          needtime: task.needtime,
          point: task.point,
          completed: task.completed,
          tasktip: task.tasktip,
          expanded: task.expanded,
          type: task.type,
          userId: userStore.currentUser?.id || ''
        })
      })
      
      // 保存长期任务
      longTasks.value.forEach(task => {
        tx.objectStore('longTasks').put({
          name: task.name,
          value: task.value,
          start: task.start,
          end: task.end,
          needtime: task.needtime,
          point: task.point,
          completed: task.completed,
          tasktip: task.tasktip,
          expanded: task.expanded,
          type: task.type,
          userId: userStore.currentUser?.id || ''
        })
      })
      
      // 保存点数
      tx.objectStore('points').put({
        points: points.value.points,
        details: points.value.details,
        userId: userStore.currentUser?.id || ''
      })

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
      })
    } catch (error) {
      console.error('保存到IndexedDB失败:', error)
      ElMessage.error('数据保存失败')
    }
  }

  // 从IndexedDB加载数据
  const loadFromIndexedDB = async () => {
    if (!userStore.currentUser) {
      
      return
    }

    try {
      const db = await openDB()
      
      // 并行加载任务数据
      const [shortTasksData, longTasksData] = await Promise.all([
        new Promise<Task[]>(resolve => {
          const tx = db.transaction('shortTasks', 'readonly')
          const request = tx.objectStore('shortTasks')
            .index('userId')
            .getAll(userStore.currentUser!.id)
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        }),
        new Promise<Task[]>(resolve => {
          const tx = db.transaction('longTasks', 'readonly')
          const request = tx.objectStore('longTasks')
            .index('userId')
            .getAll(userStore.currentUser!.id)
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })
      ])

      shortTasks.value = shortTasksData
      longTasks.value = longTasksData

      // 加载点数数据
      console.log('Loading points for user:', userStore.currentUser!.id)
      const savedPoints = await new Promise<Point>(resolve => {
        const tx = db.transaction('points', 'readonly')
        const request = tx.objectStore('points').get(userStore.currentUser!.id)
        request.onsuccess = () => {
          console.log('Points data loaded:', request.result)
          if (request.result) {
            resolve(request.result)
          } else {
            console.log('No points data found, initializing new')
            resolve({
              points: 0,
              details: '',
              userId: userStore.currentUser!.id
            })
          }
        }
        request.onerror = (e) => {
          console.error('Error loading points:', e)
          resolve({
            points: 0,
            details: '',
            userId: userStore.currentUser!.id
          })
        }
      })

      console.log('Setting points value:', savedPoints)
      points.value = savedPoints
    } catch (error) {
      console.error('从IndexedDB加载失败:', error)
      ElMessage.error('数据加载失败')
    }
  }

  // 自动保存机制
  watch([shortTasks, longTasks, points], () => {
    saveToIndexedDB()
  }, { deep: true })

  // 任务操作方法
  const addTask = async (type: 'short' | 'long', task: Partial<Omit<Task, 'value' | 'userId' | 'completed' | 'expanded'>>) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const taskList = type === 'short' ? shortTasks : longTasks
        const newTask: Task = {
          name: task.name || '',
          start: task.start || '00:00',
          end: task.end || '23:59',
          needtime: task.needtime || '每日',
          point: task.point || 0,
          tasktip: task.tasktip || '无',
          type: task.type || 'short',
          value: Date.now(),
          userId: userStore.currentUser?.id || '',
          expanded: false,
          completed: false
        }
        taskList.value.push(newTask)
        await saveToIndexedDB()
        ElMessage.success('任务添加成功')
        resolve()
      } catch (error) {
        console.error('添加任务失败:', error)
        ElMessage.error('任务添加失败')
        reject(error)
      }
    })
  }

  const deleteTask = async (type: 'short' | 'long', value: number) => {
    const taskList = type === 'short' ? shortTasks : longTasks
    const index = taskList.value.findIndex(t => t.value === value)
    if (index !== -1) {
      const taskToDelete = taskList.value[index]
      taskList.value.splice(index, 1)
      
      try {
        console.log('Deleting task from IndexedDB:', taskToDelete)
        const db = await openDB()
        const tx = db.transaction(type === 'short' ? 'shortTasks' : 'longTasks', 'readwrite')
        const request = tx.objectStore(type === 'short' ? 'shortTasks' : 'longTasks').delete(value)
        
        await new Promise((resolve, reject) => {
          request.onsuccess = () => {
            console.log('Task deleted successfully from IndexedDB')
            resolve(null)
          }
          request.onerror = (e) => {
            console.error('Error deleting task from IndexedDB:', e)
            reject(e)
          }
        })
        
        ElMessage.success('任务删除成功')
      } catch (error) {
        console.error('删除任务失败:', error)
        // 恢复删除的任务，因为保存失败
        taskList.value.splice(index, 0, taskToDelete)
        ElMessage.error('任务删除失败')
      }
    }
  }

  // 检查并重置周期性任务
  const checkAndResetTasks = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    const resetTasks = (tasks: Task[]) => {
      tasks.forEach(task => {
        if (task.period === 'daily' && task.lastReset !== today) {
          task.completed = false
          task.lastReset = today
          if (!task.completed) {
            points.value.points -= task.point
          }
        }
        // 可以添加weekly/monthly的逻辑
      })
    }

    resetTasks(shortTasks.value)
    resetTasks(longTasks.value)
  }

  // 每分钟检查一次任务状态
  setInterval(checkAndResetTasks, 60 * 1000)

  const toggleTaskStatus = (type: 'short' | 'long', value: number) => {
    const taskList = type === 'short' ? shortTasks.value : longTasks.value
    const task = taskList.find(t => t.value === value)
    if (task) {
      // 不直接修改点数，由定时任务统一处理
      task.completed = !task.completed
      ElMessage[task.completed ? 'success' : 'warning'](
        task.completed ? '任务已完成' : '任务已取消'
      )
    }
  }

  // 调试方法：检查IndexedDB中的点数数据
  const debugCheckPoints = async (userId: string) => {
    try {
      const db = await openDB()
      const tx = db.transaction('points', 'readonly')
      const request = tx.objectStore('points').get(userId)
      
      return new Promise<Point | null>(resolve => {
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => resolve(null)
      })
    } catch (error) {
      console.error('Debug check points failed:', error)
      return null
    }
  }

  const updateTaskOrder = (type: 'short' | 'long', newOrder: Task[]) => {
    const taskList = type === 'short' ? shortTasks : longTasks
    // 保留非当前用户的任务不变
    const otherUserTasks = taskList.value.filter(
      t => t.userId !== userStore.currentUser?.id
    )
    taskList.value = [...otherUserTasks, ...newOrder]
  }

  return {
    shortTasks,
    longTasks,
    points,
    loadFromIndexedDB,
    addTask,
    deleteTask,
    toggleTaskStatus,
    debugCheckPoints,
    checkAndResetTasks,
    updateTaskOrder
  }
}