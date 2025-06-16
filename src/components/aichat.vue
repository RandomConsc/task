<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search as ElIconSearch } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

// 初始化时加载对话
onMounted(async () => {
  await initDB()
  
  // 从localStorage恢复当前会话ID
  const savedId = localStorage.getItem('currentConversationId')
  if (savedId) {
    currentConversationId.value = savedId
    await loadMessages()
  } else {
    await initNewConversation()
  }
  
  await loadConversations()
})
const userStore = useUserStore()

// 类型定义
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status?: 'thinking' | 'error' | 'success'
  userId?: string
  conversationId: string
}

// 响应式状态
// 辅助函数
const createUserMessage = (content: string): ChatMessage => ({
  role: 'user',
  content,
  timestamp: Date.now(),
  userId: currentUserId.value,
  conversationId: currentConversationId.value
})

const createAssistantMessage = (content: string = '', status?: 'thinking' | 'error' | 'success'): ChatMessage => ({
  role: 'assistant',
  content,
  timestamp: Date.now(),
  userId: currentUserId.value,
  conversationId: currentConversationId.value,
  ...(status ? { status } : {})
})

// 对话会话类型
interface Conversation {
  id: string
  title: string
  createdAt: number
  messages: ChatMessage[]
  userId: string
}

// 对话元数据类型
interface ConversationMeta {
  conversationId: string
  userId: string
  title: string
  lastActive: number
  unread?: number
}

// 添加内存缓存
const messageCache = new Map<string, ChatMessage[]>()
const conversationCache = new Map<string, Conversation>()

const apiConfig = ref({
  key: 'sk-or09DryNvkcKaJaueflj3dCRrReoaP8W81xmWFS2sGlDQJj6',
  endpoint: 'https://api.moonshot.cn/v1',
  temperature: 0.3,
  maxTokens: 2000,
  retryCount: 3, // 添加重试次数
  retryDelay: 1000 // 重试延迟
})

const showConfig = ref(false)
const showHistory = ref(false)
const inputMessage = ref('')
const isLoading = ref(false)
const messages = ref<ChatMessage[]>([])

// 添加对话状态管理
const conversationState = reactive({
  current: null as Conversation | null,
  list: [] as ConversationMeta[],
  searchKeyword: '',
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0
  }
})

let currentConversationId = ref('')
const conversations = computed(() => conversationState.list)
const filteredConversations = computed(() => {
  return conversationState.list.filter(conv => 
    conv.title.includes(conversationState.searchKeyword)
  )
})

const toggleConversation = (id: string) => {
  loadConversation(id)
}

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  return `${Math.floor(diff / day)}天前`
}

// 初始化或创建新对话
const initNewConversation = async () => {
  // 保存当前对话
  if (currentConversationId.value && messages.value.length > 0) {
    await saveConversation()
  }
  
  // 创建新对话
  currentConversationId.value = Date.now().toString()
  messages.value = [{
    role: 'assistant',
    content: '您好！我是Kimi，由Moonshot AI提供的人工智能助手，擅长中英文对话。请问有什么可以帮助您？',
    timestamp: Date.now(),
    userId: currentUserId.value,
    conversationId: currentConversationId.value
  }]
  
  // 刷新历史对话列表
  await loadConversations()
}

// 分页加载对话
const loadConversations = async () => {
  try {
    await initDB()
    const { page, pageSize } = conversationState.pagination
    
    // 计算范围：最近1小时活跃的对话
    const range = IDBKeyRange.bound(
      [currentUserId.value, Date.now() - 3600000],
      [currentUserId.value, Date.now()],
      false,
      true
    )
    
    const transaction = db.value!.transaction('conversation_meta', 'readonly')
    const store = transaction.objectStore('conversation_meta')
    
    // 检查索引是否存在，不存在则回退到全表扫描
    let index
    try {
      index = store.index('by_user_time')
    } catch (e) {
      console.warn('Index not found, falling back to full scan')
      index = store
    }
    
    const request = index.openCursor(range, 'prev')
    
    const results: ConversationMeta[] = []
    let count = 0
    let skipped = 0
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        // 跳过前面的记录
        if (skipped < (page - 1) * pageSize) {
          skipped++
          cursor.continue()
          return
        }
        
        // 收集当前页的记录
        if (count < pageSize) {
          results.push(cursor.value)
          count++
          cursor.continue()
        }
      } else {
        // 更新状态
        conversationState.list = results
        conversationState.pagination.total = skipped + count
      }
    }
    
    request.onerror = (e) => {
      console.error('加载对话列表请求失败:', e)
      conversationState.list = []
    }
  } catch (e) {
    console.error('加载对话列表失败:', e)
    conversationState.list = []
  }
}

// 加载特定对话
const loadConversation = async (id: string) => {
  // 检查缓存
  if (conversationCache.has(id)) {
    const cached = conversationCache.get(id)!
    currentConversationId.value = id
    messages.value = cached.messages
    showHistory.value = false
    return
  }

  try {
    await initDB()
    const transaction = db.value!.transaction('conversations', 'readonly')
    const store = transaction.objectStore('conversations')
    const request = store.get(id)
    
    request.onsuccess = () => {
      if (request.result) {
        currentConversationId.value = id
        messages.value = request.result.messages
        // 更新缓存
        conversationCache.set(id, request.result)
        showHistory.value = false
      }
    }
  } catch (e) {
    console.error('加载对话失败:', e)
  }
}

// 保存当前对话
const saveConversation = async () => {
  if (!currentConversationId.value) return

  try {
    await initDB()
    // 保存当前会话ID到localStorage
    localStorage.setItem('currentConversationId', currentConversationId.value)
    const transaction = db.value!.transaction('conversations', 'readwrite')
    const store = transaction.objectStore('conversations')
    
    // 自动生成对话标题
    const firstUserMessage = messages.value.find(m => m.role === 'user')
    const title = firstUserMessage 
      ? firstUserMessage.content.slice(0, 20) 
      : `对话 ${new Date().toLocaleString()}`

    // 序列化messages数组
    const serializedMessages = messages.value.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      status: msg.status,
      userId: msg.userId,
      conversationId: msg.conversationId
    }))

    const conversation: Conversation = {
      id: currentConversationId.value,
      title,
      createdAt: Date.now(),
      messages: serializedMessages,
      userId: currentUserId.value
    }

    store.put(JSON.parse(JSON.stringify(conversation)))
    console.log('对话保存成功:', conversation)
  } catch (e) {
    console.error('保存对话失败:', e)
  }
}
const isMobile = computed(() => window.innerWidth < 768)
const db = ref<IDBDatabase | null>(null)
const currentUserId = computed(() => userStore.currentUser?.id || 'anonymous')
const isInitializingDB = ref(false)

// 初始化indexedDB (升级版本)
const initDB = () => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ai_chat_db', 5) // 版本升级到5
    
    request.onerror = () => {
      console.error('Failed to open indexedDB')
      reject()
    }
    
    request.onsuccess = () => {
      db.value = request.result
      resolve()
    }
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const transaction = (event.target as IDBOpenDBRequest).transaction
      
      if (!transaction) {
        throw new Error('Failed to get database transaction')
      }
      
      // 确保事务完成
      transaction.oncomplete = () => {
        console.log('Database upgrade completed')
      }

      // 新增对话元数据表
      if (!db.objectStoreNames.contains('conversation_meta')) {
        const metaStore = db.createObjectStore('conversation_meta', { 
          keyPath: 'conversationId',
          autoIncrement: false
        })
        // 统一索引命名
        metaStore.createIndex('by_user', 'userId')
        metaStore.createIndex('by_user_time', ['userId', 'lastActive'])
      }

      // 优化消息表结构
      if (db.objectStoreNames.contains('messages')) {
        db.deleteObjectStore('messages')
      }
      const messagesStore = db.createObjectStore('messages', {
        keyPath: ['conversationId', 'timestamp']
      })
      messagesStore.createIndex('by_conversation', 'conversationId')
      messagesStore.createIndex('by_user', 'userId') // 添加用户索引

      // 保留旧的conversations表
      if (!db.objectStoreNames.contains('conversations')) {
        const conversationsStore = db.createObjectStore('conversations', { keyPath: 'id' })
        conversationsStore.createIndex('by_user', 'userId')
      }
    }
  })
}

// 从indexedDB加载消息
const loadMessages = async () => {
  try {
    await initDB()
    const transaction = db.value!.transaction(['messages', 'conversations'], 'readonly')
    const messagesStore = transaction.objectStore('messages')
    const conversationsStore = transaction.objectStore('conversations')
    
    // 同时加载消息和完整对话
    const messagesRequest = messagesStore.index('by_conversation').getAll(IDBKeyRange.only(currentConversationId.value))
    const conversationRequest = conversationsStore.get(currentConversationId.value)
    
    const results = await Promise.all([
      new Promise<ChatMessage[]>(resolve => {
        messagesRequest.onsuccess = () => resolve(messagesRequest.result || [])
      }),
      new Promise<Conversation | undefined>(resolve => {
        conversationRequest.onsuccess = () => resolve(conversationRequest.result)
      })
    ])
    const [savedMessages, conversation] = results as [ChatMessage[], Conversation | undefined]
    
    // 优先使用完整对话中的消息，否则使用单独保存的消息
    const loadedMessages = (conversation as Conversation & {messages?: ChatMessage[]})?.messages || savedMessages
    
    if (loadedMessages.length > 0) {
      // 确保按时间排序且包含所有必要字段
      messages.value = loadedMessages
        .sort((a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp)
        .map((msg: ChatMessage) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          status: msg.status || 'success',
          userId: msg.userId || currentUserId.value,
          conversationId: msg.conversationId || currentConversationId.value
        }))
    } else {
      // 默认欢迎消息
      messages.value = [{
        role: 'assistant',
        content: '您好！我是Kimi，由Moonshot AI提供的人工智能助手，擅长中英文对话。请问有什么可以帮助您？',
        timestamp: Date.now(),
        userId: currentUserId.value,
        conversationId: currentConversationId.value,
        status: 'success'
      }]
    }
  } catch (e) {
    console.error('Error loading messages:', e)
    messages.value = [{
      role: 'assistant',
      content: '您好！我是Kimi，由Moonshot AI提供的人工智能助手，擅长中英文对话。请问有什么可以帮助您？',
      timestamp: Date.now(),
      userId: currentUserId.value,
      conversationId: currentConversationId.value
    }]
  }
}

// 保存消息到indexedDB（优化版）
let saveTimeout: number | null = null
const saveMessages = async (immediate = false) => {
  // 防抖处理，500ms内多次调用只保存一次
  if (saveTimeout && !immediate) {
    clearTimeout(saveTimeout)
  }
  
  const saveOperation = async () => {
    try {
      await initDB()
      const transaction = db.value!.transaction('messages', 'readwrite')
      const store = transaction.objectStore('messages')
      
      await new Promise<void>((resolve) => {
        // 只保存最后20条消息，避免存储过多历史数据
        const messagesToSave = messages.value.slice(-20).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          status: msg.status,
          userId: userStore.currentUser?.id || 'anonymous', // 确保使用最新用户ID
          conversationId: msg.conversationId
        }))
        
        // 清除当前对话的旧消息
        const clearRequest = store.index('by_conversation').openCursor(IDBKeyRange.only(currentConversationId.value))
        
        clearRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            try {
              cursor.delete()
            } catch (e) {
              console.error('删除消息失败:', e)
            }
            cursor.continue()
          } else {
            // 批量保存消息
            messagesToSave.forEach(msg => {
              store.put({ ...msg, userId: currentUserId.value })
            })
            resolve()
          }
        }
        
        clearRequest.onerror = () => {
          console.error('清除旧消息失败:', clearRequest.error)
          resolve()
        }
      })
    } catch (e) {
      console.error('保存消息时出错:', e)
    }
  }

  if (immediate) {
    await saveOperation()
  } else {
    saveTimeout = setTimeout(saveOperation, 500) as unknown as number
  }
}

// 初始化加载消息
initDB().then(loadMessages)

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const processStream = async (reader: ReadableStreamDefaultReader, controller: ReadableStreamDefaultController) => {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('data: ')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      try {
        const trimmed = chunk.trim()
        if (!trimmed || trimmed === '[DONE]') continue
        
        const data = JSON.parse(trimmed)
        const content = data.choices[0]?.delta?.content || ''
        
        controller.enqueue(content)
      } catch (e) {
        console.warn('解析流数据失败:', e)
      }
    }
  }
}

const callAIAPI = async (message: string, attempt = 1) => {
  if (!apiConfig.value.key) {
    ElMessage.warning('请先配置API密钥')
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`${apiConfig.value.endpoint}/chat/completions`, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.value.key}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [
          {
            role: 'system',
            content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。'
          },
          { role: 'user', content: message }
        ],
        temperature: apiConfig.value.temperature,
        max_tokens: apiConfig.value.maxTokens,
        stream: true
      })
    })

    clearTimeout(timeoutId)
    
    if (!response.ok) {
      if (response.status === 429 && attempt < apiConfig.value.retryCount) {
        await new Promise(resolve => setTimeout(resolve, apiConfig.value.retryDelay))
        return callAIAPI(message, attempt + 1)
      }
      throw new Error(`${response.status} ${response.statusText}`)
    }

    const stream = new ReadableStream({
      async start(controller) {
        await processStream(response.body!.getReader(), controller)
        controller.close()
      }
    })

    return stream
  } catch (error) {
    console.error('API调用失败:', error)
    ElMessage.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
    return null
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }

  // 如果没有当前对话，创建一个新对话
  if (!currentConversationId.value) {
    await initNewConversation()
  }

  // 检查消息长度
  if (inputMessage.value.length > 2000) {
    ElMessage.warning('消息过长，请缩短内容')
    return
  }

  // 保存用户消息
  const userMessage = createUserMessage(inputMessage.value)
  messages.value = [...messages.value, userMessage]
  
  // 添加AI思考中消息
  const aiMessage = createAssistantMessage('', 'thinking')
  messages.value = [...messages.value, aiMessage]
  
  // 立即保存当前对话
  await saveConversation()
  
  const message = inputMessage.value
  inputMessage.value = ''
  isLoading.value = true
  await nextTick()
  scrollToBottom()

  try {
    const stream = await callAIAPI(message)
    if (!stream) return

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const content = typeof value === 'string' ? value : decoder.decode(value)
      messages.value[messages.value.length - 1].content += content
      messages.value[messages.value.length - 1].status = 'success'
      await nextTick()
      scrollToBottom()
    }
    } catch (error) {
      messages.value.pop()
      messages.value.push({
        role: 'assistant',
        content: '请求处理失败，请检查网络连接或API配置',
        timestamp: Date.now(),
        status: 'error',
        userId: currentUserId.value,
        conversationId: ''
      })
      // 强制立即保存
      await saveConversation()
      await saveMessages(true)
    } finally {
      isLoading.value = false
      scrollToBottom()
    }
    
    // 确保最终保存成功
    try {
      await saveConversation()
      await saveMessages(true)
    } catch (e) {
      console.error('最终保存失败:', e)
    }
}

const scrollToBottom = () => {
  const container = document.querySelector('.chat-content') as HTMLElement
  if (container) {
    container.scrollTop = container.scrollHeight + 100
  }
}

const clearChat = async () => {
  await ElMessageBox.confirm('确定要清空对话历史吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  
  messages.value = [{
    role: 'assistant',
    content: '对话已重置，请问有什么可以帮助您？',
    timestamp: Date.now(),
    userId: currentUserId.value,
    conversationId: currentConversationId.value
  }]
  
  await saveMessages()
}

const quickReplies = [
  '如何制定学习计划？',
  '推荐时间管理方法',
  '怎样提高工作效率？'
]

const insertQuickReply = (reply: string) => {
  inputMessage.value = reply
}
</script>

<template>
  <div class="chat-container">
    <!-- 主内容区 -->
    <div class="chat-main">
    <div class="chat-header">
      <h3>Kimi 智能助手</h3>
      <div class="header-actions">
        <el-button link @click="initNewConversation()" icon="el-icon-plus">
          新建对话
        </el-button>
        <el-button link @click="showHistory = true" icon="el-icon-time">
          历史对话
        </el-button>
        <el-button link @click="showConfig = true" icon="el-icon-setting">
          API设置
        </el-button>
        <el-button link @click="clearChat" icon="el-icon-delete">
          清空对话
        </el-button>
      </div>
    </div>

    <div class="chat-content">
      <div v-for="(msg, index) in messages" :key="index" 
           :class="['message', msg.role, msg.status]">
        <div class="avatar">
          <img v-if="msg.role === 'assistant'" 
               src="https://api.moonshot.cn/favicon.ico" 
               alt="Kimi">
          <img v-else src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjM2MzdBIiBkPSJNMTIgMkM2LjQ3OSAyIDIgNi40NzkgMiAxMnM0LjQ3OSAxMCAxMCAxMHMxMC00LjQ3OSAxMC0xMFMxNy41MjEgMiAxMiAyem0wIDJjMi4yMTEgMCA0IDI4MCA0IDYgMCAxLjEwNC0uODk2IDItMiAyaC00Yy0xLjEwNCAwLTItLjg5Ni0yLTJzLjg5Ni0yIDItMmgxdi0yaC0xYy0xLjEwNCAwLTItLjg5Ni0yLTJzLjg5Ni0yIDItMmg0YzEuMTA0IDAgMiAuODk2IDIgMnMtLjg5NiAyLTIgMmgtMXYyaDFjMS4xMDQgMCAyIC44OTYgMiAycy0uODk2IDItMiAyaC00Yy0xLjEwNCAwLTItLjg5Ni0yLTJzLjg5Ni0yIDItMmgxdjJoLTFjLTEuMTA0IDAtMiAuODk2LTIgMnMuODk2IDIgMiAyaDRjMS4xMDQgMCAyLS44OTYgMi0yczAtNi0yLTZoLTRjLTEuMTA0IDAtMiAuODk2LTIgMnMuODk2IDIgMiAyaDF2MmgtMWMtMS4xMDQgMC0yIC44OTYtMiAycy44OTYgMiAyIDJoNGMxLjEwNCAwIDItLjg5NiAyLTJzMC02LTItNnoiLz48L3N2Zz4=" 
               alt="User">
        </div>
        <div class="bubble">
          <div v-if="msg.status === 'thinking'" class="thinking">
            <div class="dot-flashing"></div>
          </div>
          <div v-else class="content">
            <div v-html="msg.content.replace(/\n/g, '<br>')"></div>
            <div class="footer">
              <span class="time">{{ formatTime(msg.timestamp) }}</span>
              <el-button v-if="msg.role === 'user'" 
                         size="small" 
                         link
                         @click="inputMessage = msg.content; sendMessage()">
                重试
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!inputMessage" class="quick-replies">
      <el-tag v-for="(reply, idx) in quickReplies" :key="idx" 
              type="info" effect="plain" @click="insertQuickReply(reply)">
        {{ reply }}
      </el-tag>
    </div>

    <div class="input-area">
      <el-input v-model="inputMessage" type="textarea" :rows="isMobile ? 1 : 2"
                placeholder="输入您的问题..." resize="none"
                @keyup.enter.native.prevent="sendMessage"
                :disabled="isLoading">
        <template #append>
          <el-button type="primary" @click="sendMessage" :loading="isLoading">
            发送
          </el-button>
        </template>
      </el-input>
    </div>

    <el-dialog v-model="showHistory" title="历史对话" width="90%" :lock-scroll="false">
      <el-table :data="conversations" style="width: 100%" @row-click="loadConversation">
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="createdAt" label="时间" 
          :formatter="(row: Conversation) => new Date(row.createdAt).toLocaleString()" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" @click.stop="loadConversation(scope.row.id)">继续</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="showConfig" title="API配置" width="90%" :lock-scroll="false">
      <el-form label-width="100px">
        <el-form-item label="API密钥">
          <el-input v-model="apiConfig.key" show-password />
        </el-form-item>
        <el-form-item label="温度值">
          <el-slider v-model="apiConfig.temperature" :min="0" :max="1" :step="0.1" />
        </el-form-item>
        <el-form-item label="最大长度">
          <el-input-number v-model="apiConfig.maxTokens" :min="100" :max="8000" />
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

.sidebar {
  background: #fff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-box {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conv-item {
  padding: 12px;
  cursor: pointer;
  transition: background 0.3s;
  border-bottom: 1px solid #f5f7fa;
}

.conv-item:hover {
  background: rgba(64, 158, 255, 0.1);
}

.conv-item.active {
  background: rgba(64, 158, 255, 0.15);
}

.conv-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.conv-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;
}

.chat-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 18px;
  color: #1a1a1a;
}

.chat-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: #fafafa;
  max-height: calc(100% - 60px);
}

.message {
  display: flex;
  margin-bottom: 20px;
  gap: 12px;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: #eee;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bubble {
  max-width: min(75%, 680px);
  padding: 12px 16px;
  text-align: left;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
  transition: all 0.3s;
}

.message.user .bubble {
  background: #409eff;
  color: white;
}

.message-actions {
  position: absolute;
  top: 4px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.bubble:hover .message-actions {
  opacity: 1;
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: all 0.5s ease;
}

.message-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.message-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.content {
  line-height: 1.6;
  font-size: 14px;
}

.footer {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: rgba(0,0,0,0.6);
}

.message.user .footer {
  color: rgba(255,255,255,0.8);
}

.quick-replies {
  margin-bottom: -5px;
  padding: 10px 5px 5px 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: #fff;
  border-top: 1px solid #eee;
}

.input-area {
  padding: 10px;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
}

.thinking {
  padding: 8px 0;
  min-height: 24px;
}

.dot-flashing {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: #409eff;
  animation: dotFlashing 1s infinite linear alternate;
}

.dot-flashing::before,
.dot-flashing::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background-color: #409eff;
  animation: dotFlashing 1s infinite linear alternate;
}

.dot-flashing::before {
  left: -15px;
  animation-delay: 0s;
}

.dot-flashing::after {
  left: 15px;
  animation-delay: 0.5s;
}

@keyframes dotFlashing {
  0% { background-color: #409eff; }
  50%, 100% { background-color: rgba(64,158,255,0.2); }
}

@media (max-width: 768px) {
  .chat-container {
    grid-template-columns: 1fr;
    position: relative;
  }

  .sidebar {
    position: absolute;
    width: 280px;
    height: 100%;
    z-index: 10;
    transform: translateX(-100%);
    transition: transform 0.3s;
  }

  .sidebar.collapsed {
    transform: translateX(0);
  }

  .chat-header {
    padding: 8px 12px;
  }
  
  .bubble {
    max-width: 85%;
  }
  
  .input-area {
    padding: 12px;
  }

  .message-actions {
    opacity: 1 !important;
  }
}
</style>