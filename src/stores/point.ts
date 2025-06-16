// point.ts
import { ref } from 'vue'
import { useTaskStore } from './task'
import { ElMessage, ElMessageBox } from 'element-plus'

// 商品项接口
export interface StoreItem {
  id: number
  name: string
  price: number
  description: string
}

/**
 * 点数商店状态管理
 */
export const usePointStore = () => {
  const taskStore = useTaskStore()
  
  // 商品列表数据
  const storeItems = ref<StoreItem[]>([
    {
      id: 1,
      name: '效率提升手册',
      price: 50,
      description: '每日任务奖励点数+20%'
    },
    {
      id: 2,
      name: '时间延长卡',
      price: 100,
      description: '任务期限延长24小时'
    }
  ])

  /**
   * 购买商品逻辑
   * @param item 要购买的商品项
   */
  const buyItem = async (item: StoreItem) => {
    // 检查点数是否足够
    if (taskStore.points.value.points < item.price) {
      ElMessage.error('点数不足，无法购买')
      return
    }

    try {
      // 显示确认对话框
      await ElMessageBox.confirm(
        `确定花费 ${item.price} 点购买【${item.name}】吗？`,
        '确认购买',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )

      // 更新点数信息
      taskStore.points.value.points -= item.price
      taskStore.points.value.details += `${new Date().toLocaleString()} 购买 ${item.name}\n`
      
      ElMessage.success(`成功购买 ${item.name}`)
    } catch (error) {
      // 用户取消购买时不执行操作
    }
  }

  /**
   * 添加商品
   * @param item 要添加的商品项
   */
  const addItem = (item: Omit<StoreItem, 'id'>) => {
    const newItem = {
      ...item,
      id: Math.max(...storeItems.value.map(i => i.id), 0) + 1
    }
    storeItems.value.push(newItem)
    ElMessage.success('商品添加成功')
  }

  /**
   * 删除商品
   * @param id 要删除的商品ID
   */
  const removeItem = (id: number) => {
    storeItems.value = storeItems.value.filter(item => item.id !== id)
    ElMessage.success('商品删除成功')
  }

  /**
   * 更新商品
   * @param item 要更新的商品项
   */
  const updateItem = (item: StoreItem) => {
    const index = storeItems.value.findIndex(i => i.id === item.id)
    if (index !== -1) {
      storeItems.value[index] = item
      ElMessage.success('商品更新成功')
    }
  }

  return {
    storeItems,
    buyItem,
    addItem,
    removeItem,
    updateItem
  }
}