const DB_NAME = 'ai_chat_db';
const DB_VERSION = 5;
const STORE_NAME = 'conversations';

let db = null;

// 初始化数据库
const initDB = (forceRecreate = false) => {
  return new Promise((resolve, reject) => {
    if (db && !forceRecreate) return resolve(db);
    
    // 如果强制重建，先删除旧数据库
    if (forceRecreate) {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      deleteRequest.onsuccess = () => {
        console.log('旧数据库已删除，准备重建');
        openNewDatabase(resolve, reject);
      };
      deleteRequest.onerror = (event) => {
        console.error('删除数据库失败:', event.target.error);
        openNewDatabase(resolve, reject);
      };
    } else {
      openNewDatabase(resolve, reject);
    }
  });
};

function openNewDatabase(resolve, reject) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('数据库打开失败', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 创建或升级对象存储
      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        // 创建所有必需索引
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('roleId', 'roleId', { unique: false });
      } else {
        // 升级现有对象存储
        store = event.target.transaction.objectStore(STORE_NAME);
        
        // 确保所有索引存在
        const requiredIndexes = [
          { name: 'sessionId', keyPath: 'sessionId', options: { unique: false } },
          { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
          { name: 'roleId', keyPath: 'roleId', options: { unique: false } }
        ];
        
        requiredIndexes.forEach(index => {
          if (!store.indexNames.contains(index.name)) {
            store.createIndex(index.name, index.keyPath, index.options);
          }
        });
      }
    };
  }
// 获取当前会话ID（用于单会话应用）
export const getCurrentSessionId = () => {
  // 从 localStorage 获取或生成新的会话ID
  let sessionId = localStorage.getItem('current_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}`;
    localStorage.setItem('current_session_id', sessionId);
  }
  return sessionId;
};

// 保存对话历史到 IndexedDB
export const saveChatHistory = async (messages, userId = null) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const sessionId = getCurrentSessionId();
    userId = userId || (typeof window !== 'undefined' && localStorage.getItem('currentUser') 
      ? JSON.parse(localStorage.getItem('currentUser'))?.id 
      : null);
    
    // 获取当前会话的最后一条记录
    const lastRecord = await new Promise((resolve) => {
      const index = store.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId), 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        resolve(cursor ? cursor.value : null);
      };
    });
    
    // 只保存最近50条消息
    const messagesToSave = messages.slice(-50);
    
    if (lastRecord) {
      // 更新现有记录
      lastRecord.messages = messagesToSave;
      lastRecord.timestamp = Date.now();
      store.put(lastRecord);
    } else {
      // 创建新记录
      store.add({
        sessionId,
        messages: messagesToSave,
        timestamp: Date.now(),
        roleId: localStorage.getItem('selected_ai_role') || 'default',
        userId
      });
    }
  } catch (error) {
    console.error('保存对话历史失败:', error);
    
    // 回退到 localStorage
    try {
      localStorage.setItem('chat_history', JSON.stringify(messages.slice(-50)));
    } catch (e) {
      console.error('localStorage 回退失败:', e);
    }
  }
};

// 从 IndexedDB 加载对话历史
export const loadChatHistory = async (userId = null) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const sessionId = getCurrentSessionId();
    userId = userId || (typeof window !== 'undefined' && localStorage.getItem('currentUser') 
      ? JSON.parse(localStorage.getItem('currentUser'))?.id 
      : null);
    
    return new Promise((resolve) => {
      const index = store.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId), 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // 如果提供了userId，只返回匹配的记录
          if (userId && cursor.value.userId !== userId) {
            resolve([]);
          } else {
            resolve(cursor.value.messages || []);
          }
        } else {
          resolve([]);
        }
      };
      
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('加载对话历史失败:', error);
    
    // 回退到 localStorage
    try {
      const saved = localStorage.getItem('chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('localStorage 回退失败:', e);
      return [];
    }
  }
};

// 获取所有会话历史（用于未来扩展）
export const getAllSessions = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    return new Promise((resolve) => {
      const request = index.openCursor(null, 'prev');
      const sessions = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          sessions.push({
            id: cursor.value.id,
            sessionId: cursor.value.sessionId,
            timestamp: cursor.value.timestamp,
            preview: cursor.value.messages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .slice(-2)
              .map(m => m.content.substring(0, 50))
          });
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return [];
  }
};

// 切换会话
export const switchSession = async (sessionId) => {
  localStorage.setItem('current_session_id', sessionId);
  return loadChatHistory();
};

// 创建新会话
export const createNewSession = () => {
  const newSessionId = `session_${Date.now()}`;
  localStorage.setItem('current_session_id', newSessionId);
  return [];
};

// 删除会话
export const deleteSession = async (sessionId) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('sessionId');
    
    return new Promise((resolve) => {
      const request = index.openCursor(IDBKeyRange.only(sessionId));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      
      request.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error('删除会话失败:', error);
    return false;
  }
};

// 保存当前选择的角色
export const saveSelectedRole = (roleId) => {
  localStorage.setItem('selected_ai_role', roleId);
  
  // 更新当前会话的角色信息
  saveChatHistory([...document.currentChatMessages || []])
    .catch(e => console.error('更新会话角色失败', e));
};

// 读取当前选择的角色
export const loadSelectedRole = () => {
  return localStorage.getItem('selected_ai_role') || 'default';
};