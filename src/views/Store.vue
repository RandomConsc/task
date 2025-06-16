<template>
  <div class="store-container">
    <h1>点数商店</h1>
    <div class="store-management">
      <el-button type="primary" @click="showAddDialog">添加商品</el-button>
    </div>
    <el-table :data="storeItems" style="width: 100%">
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="price" label="价格" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          <el-button size="small" type="success" @click="handleBuy(scope.row)">购买</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加/编辑商品对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商品' : '添加商品'">
      <el-form :model="currentItem">
        <el-form-item label="商品名称">
          <el-input v-model="currentItem.name" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="currentItem.price" :min="1" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="currentItem.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmItem">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePointStore } from '@/stores/point'
import { ElMessage } from 'element-plus'

const pointStore = usePointStore()
const storeItems = ref(pointStore.storeItems)

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentItem = ref({
  id: 0,
  name: '',
  price: 0,
  description: ''
})

const showAddDialog = () => {
  currentItem.value = { id: 0, name: '', price: 0, description: '' }
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (item) => {
  currentItem.value = { ...item }
  isEdit.value = true
  dialogVisible.value = true
}

const handleDelete = async (item) => {
  try {
    await ElMessageBox.confirm(
      `确定删除商品【${item.name}】吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    pointStore.removeItem(item.id)
  } catch (error) {
    // 用户取消删除
  }
}

const handleBuy = (item) => {
  pointStore.buyItem(item)
}

const confirmItem = () => {
  if (!currentItem.value.name || !currentItem.value.description) {
    ElMessage.error('请填写完整商品信息')
    return
  }

  if (isEdit.value) {
    pointStore.updateItem(currentItem.value)
  } else {
    pointStore.addItem(currentItem.value)
  }
  dialogVisible.value = false
}
</script>

<style scoped>
.store-container {
  padding: 20px;
}
.store-management {
  margin-bottom: 20px;
}
</style>
