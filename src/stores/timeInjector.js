
// 原有代码保持不变，增加时间格式化选项
export const injectCurrentTime = (format = 'full') => {
  const now = new Date();
  
  if (format === 'time') {
    return `当前精确时间：${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
  }
  
  if (format === 'date') {
    return `当前日期：${now.toLocaleDateString('zh-CN')}`;
  }
  
  // 默认完整格式
  return `当前精确时间：${formatDateTime(now)}`;
};

// 检测是否时间敏感问题（增强版）
export const isTimeSensitiveQuestion = (text) => {
  const timeKeywords = ['时间', '几点', '今天', '现在', '何时', '时候', '日期', '星期', '礼拜', '号'];
  return timeKeywords.some(keyword => text.includes(keyword));
};
/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化字符串
 */
const formatDateTime = (date) => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};