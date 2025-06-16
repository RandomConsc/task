<script setup>
import { ref, reactive, onMounted, nextTick, computed } from 'vue';
import { fetchDeepSeekResponse } from '@/stores/deepseekApi';
import { isTimeSensitiveQuestion, injectCurrentTime } from '@/stores/timeInjector';
import { AI_ROLES, getDefaultRole } from '@/stores/aiRoles';
import { useUserStore } from '@/stores/user';
import { 
  loadChatHistory, 
  saveChatHistory, 
  loadSelectedRole, 
  saveSelectedRole,
  getCurrentSessionId,
  getAllSessions,
  createNewSession,
  deleteSession
} from '@/stores/storage'; // 更新导入

const userStore = useUserStore();

const userInput = ref('');
const isLoading = ref(false);
const messages = reactive([]);
const currentOperation = ref(null);
const messagesContainer = ref(null);
const inputField = ref(null);
const availableRoles = ref(AI_ROLES);
const serviceStatus = reactive({
  api: 'checking',
  storage: 'checking',
  auth: 'checking'
});

// 初始化选中的角色（从本地存储读取）
const selectedRoleId = ref(loadSelectedRole() || 'default');

// 计算当前角色配置
const currentRole = computed(() => {
  return availableRoles.value.find(r => r.id === selectedRoleId.value) || getDefaultRole();
});

// 初始化加载 - 改为异步
onMounted(async () => {
  let retryCount = 0;
  const maxRetries = 2;
  
  // 检查用户状态
  if (!userStore.currentUser && !userStore.loggedIn) {
    try {
      // 尝试创建临时用户
      await userStore.useTemporaryUser('临时用户');
    } catch (error) {
      console.error('创建临时用户失败:', error);
      messages.push({
        role: 'system',
        content: '系统初始化失败，请刷新页面重试',
        isSystem: true,
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
  
  const initializeChat = async () => {
    try {
      // 检查API配置
      console.log('当前加载的环境变量:', import.meta.env);
      if (!import.meta.env.VITE_DEEPSEEK_API_KEY) {
        addSystemMessage(`
          API配置缺失，请按以下步骤操作：
          1. 确认已在项目根目录(d:\\competition\\aitask)创建.env文件
          2. 文件内容应为: VITE_DEEPSEEK_API_KEY=your_actual_key
          3. 确保文件名是.env而不是.env.txt
          4. 重启开发服务器(npm run dev)
          
          调试信息:
          - 当前环境变量: ${JSON.stringify(import.meta.env)}
          - 文件路径: d:\\competition\\aitask\\.env
        `);
        serviceStatus.api = 'unavailable';
        return;
      }

      // 检查API可用性
      const isApiAvailable = await checkApiAvailability();
      if (!isApiAvailable) {
        addSystemMessage('API服务不可用，请检查网络连接或API配置');
        serviceStatus.api = 'unavailable';
        return;
      }

      // 初始化存储系统
      await initDB();
      
      // 加载历史消息
      const savedMessages = await loadChatHistory(userStore.currentUser?.id);
      if (savedMessages?.length > 0) {
        messages.push(...savedMessages);
      } else {
        // 添加初始系统消息
        addSystemMessage(currentRole.value.systemPrompt);
      }
      
      // 服务状态检查
      // 使用组件级别的serviceStatus变量

      // 检查API服务
      try {
        const startTime = Date.now();
        const pingResponse = await fetchDeepSeekResponse([], 'ping', false, 'default');
        if (!pingResponse || !pingResponse.content) {
          throw new Error('Invalid API response');
        }
        serviceStatus.api = 'healthy';
        console.log(`API服务响应时间: ${Date.now() - startTime}ms`);
      } catch (error) {
        serviceStatus.api = 'unavailable';
        console.error('API服务检查失败:', {
          error: error.message,
          endpoint: window.API_ENDPOINT,
          timestamp: new Date().toISOString()
        });
        
        // 提供详细错误信息
        addSystemMessage(`
          AI服务连接失败:
          ${error.message.includes('Network') ? '网络连接异常' : '服务响应异常'}
          请检查网络或稍后重试
        `);
        
        // 不阻止继续操作，进入降级模式
      }

      // 检查存储系统
      try {
        const testRecord = {
          sessionId: 'test_session',
          messages: [],
          timestamp: Date.now()
        };
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await new Promise((resolve, reject) => {
          const request = store.add(testRecord);
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
        await new Promise((resolve, reject) => {
          const request = store.delete(IDBKeyRange.only(testRecord.sessionId));
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
      } catch (error) {
        console.error('存储系统检查失败:', {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        addSystemMessage('本地存储初始化失败，请刷新页面重试');
        return;
      }
      
      // 保存引用用于存储更新
      document.currentChatMessages = messages;
      
      // 聚焦输入框
      if (inputField.value) {
        await nextTick();
        inputField.value.focus();
      }
      
      // 加载会话列表
      await loadSessions();
    } catch (error) {
      console.error('初始化失败:', error);
      
      // 如果是索引错误且未达到最大重试次数，尝试重建数据库
      if (error.name === 'NotFoundError' && retryCount < maxRetries) {
        retryCount++;
        console.log('尝试重建数据库...');
        await initDB(true); // 强制重建数据库
        return initializeChat(); // 重试初始化
      }
      
      // 确保至少显示默认系统消息
      if (messages.length === 0) {
        addSystemMessage(currentRole.value.systemPrompt);
      }
    }
  };
  
  await initializeChat();
});

// 添加系统消息
const addSystemMessage = (content, isTimeInjector = false) => {
  messages.push({
    role: 'system',
    content: content,
    isSystem: true,
    isTimeInjector: isTimeInjector,
    timestamp: new Date().toISOString()
  });
  saveChatHistory(messages, userStore.currentUser?.id);
};

// 切换角色
const changeRole = () => {
  saveSelectedRole(selectedRoleId.value);
  
  // 添加角色切换通知
  addSystemMessage(`已切换到角色: ${currentRole.value.name}`);
  
  // 更新系统提示词
  messages.find(m => m.role === 'system' && !m.isTimeInjector).content = currentRole.value.systemPrompt;
    saveChatHistory(messages, userStore.currentUser?.id);
};

// 清空对话历史
const clearHistory = () => {
  if (confirm('确定要清空对话历史吗？')) {
    messages.splice(0, messages.length);
    addSystemMessage(currentRole.value.systemPrompt);
    localStorage.removeItem('ai_chat_history');
  }
};

// 渲染内容（保留操作指令注释）
const renderContent = (content) => {
  return content.replace(/<!--.*?-->/gs, match => {
    return `<span class="operation-comment">${match}</span>`;
  });
};

// 发送消息
const sendMessage = async () => {
  const text = userInput.value.trim();
  if (!text || isLoading.value) return;
  
  // 检查用户状态
  if (!userStore.currentUser && !userStore.loggedIn) {
    try {
      await userStore.useTemporaryUser('临时用户');
    } catch (error) {
      console.error('创建临时用户失败:', error);
      messages.push({
        role: 'system',
        content: '无法创建会话，请刷新页面重试',
        isSystem: true,
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
  
  // 添加用户消息
  messages.push({ 
    role: 'user', 
    content: text,
    timestamp: new Date().toISOString()
  });
  saveChatHistory(messages);
  
  // 清空输入框
  userInput.value = '';
  isLoading.value = true;
  
  // 滚动到底部
  scrollToBottom();
  
  try {
    // 检测时间敏感问题
    const isTimeSensitive = isTimeSensitiveQuestion(text);
    
    // 如果需要时间注入，添加系统消息
    if (isTimeSensitive) {
      addSystemMessage(injectCurrentTime(), true);
    }
    
    // 调用API（过滤掉时间注入消息）
    const apiMessages = messages.filter(m => !m.isTimeInjector);
    const response = await fetchDeepSeekResponse(
      apiMessages,
      text,
      isTimeSensitive,
      selectedRoleId.value
    );
    
    // 更新服务状态
    serviceStatus.api = response.isError ? 'unavailable' : 'healthy';
    
    // 添加AI响应
    messages.push({
      role: 'assistant',
      content: response.content,
      operation: response.operation,
      timestamp: new Date().toISOString(),
      isError: response.isError
    });
    saveChatHistory(messages, userStore.currentUser?.id);
    
    // 如果有操作指令
    if (response.operation) {
      currentOperation.value = response.operation;
    }
  } catch (error) {
    console.error('请求处理失败:', error);
    serviceStatus.api = 'unavailable';
    
    // 使用API返回的错误消息或默认消息
    const errorMessage = error.message || '处理请求时出错';
    
    messages.push({
      role: 'assistant',
      content: errorMessage,
      timestamp: new Date().toISOString(),
      isError: true
    });
     await saveChatHistory(messages, userStore.currentUser?.id);
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
};


const sessions = ref([]);

const currentSessionId = ref(getCurrentSessionId());
const loadSessions = async () => {
  sessions.value = await getAllSessions();
};
const isActiveSession = (session) => {
  return session.sessionId === currentSessionId.value;
};
const switchToSession = async (session) => {
  currentSessionId.value = session.sessionId;
  localStorage.setItem('current_session_id', session.sessionId);
  
  // 清空当前消息并加载新会话
  messages.splice(0, messages.length);
  const sessionMessages = await loadChatHistory();
  messages.push(...sessionMessages);
};
const createNewSessionHandler = async () => {
  try {
    currentSessionId.value = createNewSession();
    messages.splice(0, messages.length);
    await addSystemMessage(currentRole.value.systemPrompt);
    await loadSessions();
  } catch (error) {
    console.error('创建新会话失败:', error);
  }
};
const deleteSessionHandler = async (session) => {
  if (confirm(`确定删除该会话吗？`)) {
    try {
      await deleteSession(session.sessionId);
      if (session.sessionId === currentSessionId.value) {
        createNewSessionHandler();
      }
      await loadSessions();
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  }
};
// 初始化时加载会话列表
onMounted(() => {
  loadSessions();
});
// 执行操作
const executeOperation = () => {
  alert(`执行操作：${JSON.stringify(currentOperation.value, null, 2)}`);
  // 这里添加实际的任务修改逻辑
  currentOperation.value = null;
};

// 换行处理
const newLine = () => {
  userInput.value += '\n';
};

// 重试连接
const retryConnection = async () => {
  serviceStatus.api = 'checking';
  
  try {
    const startTime = Date.now();
    const pingResponse = await fetchDeepSeekResponse([], 'ping', false, 'default');
    if (!pingResponse || !pingResponse.content) {
      throw new Error('Invalid API response');
    }
    serviceStatus.api = 'healthy';
    console.log(`API服务响应时间: ${Date.now() - startTime}ms`);
  } catch (error) {
    serviceStatus.api = 'unavailable';
    console.error('API服务检查失败:', {
      error: error.message,
      endpoint: window.API_ENDPOINT,
      timestamp: new Date().toISOString()
    });
  }
};

// 复制消息内容
const copyMessage = (content) => {
  navigator.clipboard.writeText(content)
    .then(() => {
      console.log('消息已复制到剪贴板');
    })
    .catch(err => {
      console.error('复制失败:', err);
    });
};

// 格式化时间显示
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};
</script>

<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="logo-container">
        <div class="logo">
          <i class="fas fa-brain"></i>
        </div>
        <div class="logo-text">DeepSeek AI</div>
      </div>
      
      <button class="new-chat-btn" @click="createNewSessionHandler">
        <i class="fas fa-plus"></i> 新对话
      </button>
      
      <div class="history-title">对话历史</div>
      <div class="history-container">
        <div v-for="session in sessions" 
             :key="session.id"
             :class="{ active: isActiveSession(session) }"
             @click="switchToSession(session)"
             class="history-item">
          <i class="fas fa-comment"></i>
          {{ session.preview.join(' | ') }}
        </div>
      </div>
      
      <div class="sidebar-footer">
        <div class="settings-item">
          <i class="fas fa-cog"></i> 设置
        </div>
        <div class="settings-item">
          <i class="fas fa-user"></i> 我的账户
        </div>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 头部 -->
      <div class="header">
        <div class="model-selector">
          <i class="fas fa-robot"></i>
          {{ currentRole.name }} 模型
        </div>
        <div class="header-actions">
          <button class="header-btn" @click="retryConnection">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="header-btn" @click="clearHistory">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <!-- 聊天区域 -->
      <div class="chat-container" ref="messagesContainer">
        <!-- 欢迎消息 -->
        <div v-if="messages.length === 0" class="welcome-section">
          <h1 class="welcome-title">欢迎使用 DeepSeek AI</h1>
          <p class="welcome-subtitle">我可以帮助您解答问题、生成内容、分析数据以及提供创意灵感</p>
        </div>
        
        <!-- 消息列表 -->
        <div class="message-list">
          <template v-if="messages.length === 0">
            <div class="welcome-section">
              <h1 class="welcome-title">欢迎使用 DeepSeek AI</h1>
              <p class="welcome-subtitle">我可以帮助您解答问题、生成内容、分析数据以及提供创意灵感</p>
              
              <div class="features-grid">
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fas fa-lightbulb"></i>
                  </div>
                  <h3 class="feature-title">创意生成</h3>
                  <p class="feature-desc">生成文章、故事、诗歌等创意内容</p>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fas fa-code"></i>
                  </div>
                  <h3 class="feature-title">编程助手</h3>
                  <p class="feature-desc">帮助编写、调试和解释代码</p>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon">
                    <i class="fas fa-book"></i>
                  </div>
                  <h3 class="feature-title">学习辅导</h3>
                  <p class="feature-desc">解释复杂概念，提供学习资源</p>
                </div>
              </div>
            </div>
          </template>
          
          <template v-else>
            <div v-for="(msg, index) in messages" :key="index" class="message">
              <div v-if="msg.role === 'system' && !msg.isTimeInjector" class="system-message">
                <div class="avatar system-avatar">
                  <i class="fas fa-cog"></i>
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <div class="sender-name">系统指令</div>
                    <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                  </div>
                  <div class="message-text">{{ msg.content }}</div>
                </div>
              </div>
              
              <div v-else-if="msg.isTimeInjector" class="system-message">
                <div class="avatar time-avatar">
                  <i class="fas fa-clock"></i>
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <div class="sender-name">时间注入</div>
                    <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                  </div>
                  <div class="message-text">{{ msg.content }}</div>
                </div>
              </div>
              
              <div v-else :class="['message-bubble', msg.role]">
                <div class="avatar" :class="msg.role + '-avatar'">
                  <i :class="msg.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <div class="sender-name">{{ msg.role === 'user' ? '您' : 'DeepSeek AI' }}</div>
                    <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                  </div>
                  <div class="message-text" v-html="renderContent(msg.content)"></div>
                  <div v-if="msg.operation" class="operation-badge">
                    <i class="fas fa-code"></i> 检测到操作指令
                  </div>
                  <div class="message-actions">
                    <button class="action-btn" @click="copyMessage(msg.content)">
                      <i class="fas fa-copy"></i> 复制
                    </button>
                    <button v-if="msg.role === 'assistant'" class="action-btn">
                      <i class="fas fa-thumbs-up"></i> 赞
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-container">
        <div class="input-box">
          <div class="text-input-container">
            <textarea 
              v-model="userInput" 
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.shift.enter="newLine"
              placeholder="输入您的问题或指令..."
              ref="inputField"
              class="text-input"
              rows="1"
            ></textarea>
            <button @click="sendMessage" :disabled="isLoading" class="send-button">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
          <div class="input-footer">
            按 Enter 发送，Shift + Enter 换行 | DeepSeek AI 可能会生成不准确的信息
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

:root {
  --primary-color: #4a6fa5;
  --secondary-color: #6c9bcf;
  --light-bg: #f9fafb;
  --card-bg: #ffffff;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
  --user-bubble: #e6f7ff;
  --ai-bubble: #f0f4f8;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --disabled-color: #d1d5db;
}

/* 应用容器 */
.app-container {
  display: flex;
  height: 100vh;
  background-color: var(--light-bg);
}

/* 侧边栏样式 */
.sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 20px 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.logo-container {
  display: flex;
  align-items: center;
  padding: 0 10px 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.logo i {
  color: white;
  font-size: 20px;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.new-chat-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 25px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(79, 114, 205, 0.2);
}

.new-chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(79, 114, 205, 0.3);
}

.new-chat-btn i {
  margin-right: 10px;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 15px;
  padding: 0 10px;
}

.history-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 5px;
}

.history-item {
  padding: 12px 15px;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.history-item:hover {
  background-color: rgba(108, 155, 207, 0.1);
}

.history-item.active {
  background-color: rgba(108, 155, 207, 0.15);
  color: var(--primary-color);
  font-weight: 500;
}

.history-item i {
  margin-right: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.history-item.active i {
  color: var(--primary-color);
}

.sidebar-footer {
  padding: 20px 10px 5px;
  border-top: 1px solid var(--border-color);
}

.settings-item {
  padding: 12px 15px;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.settings-item:hover {
  background-color: rgba(108, 155, 207, 0.1);
}

.settings-item i {
  margin-right: 12px;
  font-size: 16px;
  color: var(--text-secondary);
}

/* 主内容区样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 18px 30px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--card-bg);
}

.model-selector {
  display: flex;
  align-items: center;
  background: rgba(108, 155, 207, 0.1);
  padding: 8px 16px;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
}

.model-selector i {
  margin-right: 8px;
}

.header-actions {
  display: flex;
}

.header-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--light-bg);
  color: var(--text-secondary);
  border: none;
  margin-left: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background-color: var(--border-color);
  color: var(--primary-color);
}

/* 聊天区域 */
.chat-container {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.welcome-section {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
  padding: 40px 0;
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 20px;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 40px;
  line-height: 1.6;
}

.message-list {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.message {
  padding: 25px 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
}

.message-bubble {
  display: flex;
  margin-bottom: 20px;
}

.system-message {
  display: flex;
  margin-bottom: 20px;
  align-items: center;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}

.ai-avatar {
  background: linear-gradient(135deg, #10b981, #34d399);
}

.system-avatar {
  background: linear-gradient(135deg, #6b7280, #9ca3af);
}

.time-avatar {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
}

.avatar i {
  color: white;
  font-size: 18px;
}

.message-content {
  flex: 1;
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.sender-name {
  font-weight: 600;
  font-size: 16px;
}

.message-time {
  font-size: 13px;
  color: var(--text-secondary);
  margin-left: 15px;
}

.message-text {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
}

.user .message-text {
  background-color: var(--user-bubble);
  padding: 12px 16px;
  border-radius: 18px 18px 0 18px;
}

.assistant .message-text {
  background-color: var(--ai-bubble);
  padding: 12px 16px;
  border-radius: 18px 18px 18px 0;
}

.operation-badge {
  font-size: 14px;
  color: var(--success-color);
  margin-top: 10px;
  display: flex;
  align-items: center;
}

.operation-badge i {
  margin-right: 6px;
}

/* 输入区域 */
.input-container {
  padding: 20px 30px;
  background-color: var(--card-bg);
  border-top: 1px solid var(--border-color);
}

.input-box {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
}

.text-input-container {
  position: relative;
}

.text-input {
  width: 100%;
  min-height: 60px;
  max-height: 200px;
  padding: 18px 65px 18px 20px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  font-size: 16px;
  resize: none;
  outline: none;
  background-color: var(--light-bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
}

.text-input:focus {
  border-color: var(--secondary-color);
  box-shadow: 0 2px 10px rgba(108, 155, 207, 0.2);
}

.send-button {
  position: absolute;
  right: 15px;
  bottom: 15px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.send-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(79, 114, 205, 0.3);
}

.send-button:disabled {
  background: var(--disabled-color);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.input-footer {
  display: flex;
  justify-content: center;
  margin-top: 15px;
  color: var(--text-secondary);
  font-size: 13px;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--light-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--secondary-color);
}


</style>