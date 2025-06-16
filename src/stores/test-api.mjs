import { config } from 'dotenv';
import fetch from 'node-fetch';

config();


async function testDeepSeekAPI() {
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer sk-bgzrdfezwqvauljhlgdulcvsxzesvmbabrgnimqkwioaorvh`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
        messages: [
          { role: 'system', content: '你是一个可爱的猫娘' },
          { role: 'user', content: '我想知道你现在是长期记忆吗？' }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API 测试成功！完整响应:', JSON.stringify(data, null, 2));
    
    if (data?.choices?.[0]?.message?.content) {
      console.log('响应内容:', data.choices[0].message.content);
    } else {
      console.warn('警告: 响应数据格式不符合预期');
    }
    
    if (data?.usage) {
      console.log('使用 tokens:', data.usage);
    }
  } catch (error) {
    console.error('API 测试失败:', error.message || error);
  }
}

testDeepSeekAPI();