// 工具函数模块

/**
 * 获取当前时间，格式化为HH:MM:SS
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 获取格式化的今天日期，用于缓存键名
 */
export function getTodayDateKey(): string {
  return new Date().toLocaleDateString();
}

/**
 * 简化限号信息，确保不会出现省略号
 * @param limitInfo 原始限号信息
 * @returns 简化后的限号信息
 */
export function getShortLimitInfo(limitInfo: string): string {
  // 移除所有省略号
  let shortInfo = limitInfo.replace(/…/g, '').replace(/\.\.\./g, '').replace(/…/g, '');
  
  // 简化常见短语
  if (shortInfo.includes('不限行')) {
    return '不限行';
  }
  
  // 提取核心数字信息，只返回数字部分，不包含"和"字
  const numberMatch = shortInfo.match(/(\d+)[和与](\d+)/);
  if (numberMatch && numberMatch.length >= 3) {
    // 返回两个数字，用逗号分隔
    return `${numberMatch[1]},${numberMatch[2]}`;
  }
  
  // 处理单双号限行情况
  if (shortInfo.includes('单号') || shortInfo.includes('双号')) {
    // 对于单双号限行，返回数字表示（1=单号，2=双号）
    return shortInfo.includes('单号') ? '1' : '2';
  }
  
  // 处理其他情况
  if (shortInfo.includes('未找到') || shortInfo.length === 0) {
    return '暂无信息';
  }
  
  // 限制长度，确保显示完整
  return shortInfo.length > 6 ? shortInfo.substring(0, 6) : shortInfo;
}
