// 工具函数模块

/**
 * 格式化日期为中文格式
 * @param date 日期对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekDay = weekDays[date.getDay()];
  
  return `${year}年${month}月${day}日 ${weekDay}`;
}

/**
 * 简化限号信息
 * @param limitInfo 原始限号信息
 * @returns 简化后的限号信息
 */
export function getSimplifiedLimitInfo(limitInfo: string): string {
  // 简化限号信息，只保留核心内容
  const simplified = limitInfo.replace(/限行|限号|尾号/g, '');
  return simplified.trim() || limitInfo;
}

/**
 * 获取当前时间
 * @returns 当前时间字符串
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 获取格式化的今天日期，用于缓存键名
 */
export function getTodayDateKey(): string {
  return new Date().toLocaleDateString();
}

/**
 * 获取简短的限号信息
 * @param limitInfo 原始限号信息
 * @returns 简短的限号信息
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
