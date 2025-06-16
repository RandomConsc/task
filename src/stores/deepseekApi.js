import { injectCurrentTime } from '@/stores/timeInjector';
import { AI_ROLES } from '@/stores/aiRoles';

// 验证API配置
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

if (!API_KEY) {
  console.error('DeepSeek API key is not configured. Please set VITE_DEEPSEEK_API_KEY in .env file');
}

// 测试API端点可用性
export const checkApiAvailability = async () => {
  try {
    const response = await fetch(API_URL, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * 调用 DeepSeek-R1 API
 * @param {Array} messageHistory - 消息历史记录
 * @param {string} userMessage - 用户新消息
 * @param {boolean} isTimeSensitive - 是否时间敏感型问题
 * @param {string} roleId - 当前AI角色ID
 * @returns {Promise} - API 响应
 */
export const fetchDeepSeekResponse = async (
  messageHistory, 
  userMessage, 
  isTimeSensitive = false,
  roleId = 'default'
) => {
  // 获取当前角色配置
  const roleConfig = AI_ROLES.find(r => r.id === roleId) || AI_ROLES[0];
  
  // 构建消息数组
  const messages = [
    // 系统角色提示词
    { role: 'system', content: roleConfig.systemPrompt },
    ...messageHistory
  ];
  
  // 添加时间注入的系统消息
  if (isTimeSensitive) {
    messages.push({
      role: 'system',
      content: injectCurrentTime()
    });
  }

  // 添加用户新消息
  messages.push({ role: 'user', content: userMessage });

  let retryCount = 0;
  const maxRetries = 2;
  let lastError = null;

  while (retryCount <= maxRetries) {
    try {
      // 检查网络连接
      if (!navigator.onLine) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
          messages: messages,
          temperature: roleConfig.temperature,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `API错误: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        operation: parseOperation(data.choices[0].message.content)
      };
    } catch (error) {
      lastError = error;
      console.error(`API调用失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // 如果是网络错误或5xx错误，等待后重试
      if (retryCount < maxRetries && 
          (error.message.includes('网络') || 
           (error.message.includes('API错误') && error.message.match(/5\d{2}/)))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
        continue;
      }
      
      break;
    }
  }

  // 根据错误类型返回不同的错误消息
  let errorMessage = '服务暂时不可用，请稍后再试';
  if (lastError) {
    if (lastError.message.includes('网络')) {
      errorMessage = lastError.message;
    } else if (lastError.message.includes('API错误: 429')) {
      errorMessage = '请求过于频繁，请稍后再试';
    } else if (lastError.message.includes('API错误: 5')) {
      errorMessage = '服务器内部错误，请稍后再试';
    } else if (lastError.message.includes('API错误: 4')) {
      errorMessage = '请求参数错误，请联系管理员';
    }
  }

  return {
    content: errorMessage,
    operation: null,
    isError: true
  };
};
/**
 * 解析AI响应中的操作指令
 * @param {string} content - AI返回内容
 * @returns {Object|null} - 结构化操作指令
 */
const parseOperation = (content) => {
  try {
    const match = content.match(/<!--\s*({.*?})\s*-->/s);
    return match ? JSON.parse(match[1]) : null;
  } catch {
    return null;
  }
};