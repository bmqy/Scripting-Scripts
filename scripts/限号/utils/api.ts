// API请求模块
import { Constants, log, withTimeout, handleError } from './common';

/**
 * 构建搜索URL - 优化版（使用更可靠的搜索URL格式）
 * @param city 城市名称
 * @returns 搜索URL
 */
export function buildSearchUrl(city: string): string {
  const searchWord = encodeURIComponent(`${city}限号`);
  // 使用更可靠的搜索URL格式，避免重定向问题
  const url = `https://m.baidu.com/s?word=${searchWord}&from=1000953h`;
  log(`构建搜索URL: ${url}`);
  return url;
}

/**
 * 获取备用搜索URL
 * @param city 城市名称
 * @param retryIndex 重试索引（从0开始）
 * @returns 备用搜索URL
 */
export function getAlternativeSearchUrl(city: string, retryIndex: number): string {
  switch (retryIndex) {
    case 0:
      return `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}限号`)}&tn=02003390_42_hao_pg`;
    case 1:
      return `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}限行`)}&rn=10`;
    default:
      return `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}今日限号`)}&rn=10`;
  }
}

/**
 * 检查是否是重定向页面
 * @param htmlContent HTML内容
 * @returns 是否是重定向页面
 */
export function isRedirectPage(htmlContent: string): boolean {
  return htmlContent.length < 1000 && 
         (htmlContent.includes('location.replace') || 
          htmlContent.includes('meta http-equiv="refresh"'));
}

/**
 * 发送网络请求，支持重试机制
 * @param url 请求URL
 * @param options 请求选项
 * @returns 响应文本内容
 */
export async function fetchWithRetry(
  url: string,
  options?: { retries?: number }
): Promise<string> {
  const { retries = Constants.MAX_RETRIES } = options || {};
  let currentRetries = 0;
  let text = '';
  
  while (currentRetries <= retries) {
    try {
      log(`发送请求到: ${url} (尝试${currentRetries + 1}/${retries + 1})`);
      
      // 使用withTimeout包装fetch请求，确保有超时控制
      const response = await withTimeout(
        fetch(url),
        Constants.REQUEST_TIMEOUT_MS,
        null
      );
      
      if (!response) {
        throw new Error('请求超时');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      text = await response.text();
      log(`获取到HTML内容，长度: ${text.length}字符`);
      
      // 检查是否是重定向页面
      if (isRedirectPage(text)) {
        log('检测到重定向页面，尝试使用备用URL...');
        currentRetries++;
        if (currentRetries <= retries) {
          url = getAlternativeSearchUrl(url.match(/wd=([^&]+)/)?.[1] || '', currentRetries - 1);
          continue;
        }
      }
      
      // 成功获取内容，退出循环
      break;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : '未知错误';
        log(`请求失败: ${errorMessage}`);
        handleError(e, 'fetchWithRetry');
      currentRetries++;
      if (currentRetries > retries) {
        throw e; // 达到最大重试次数，抛出异常
      }
      
      // 重试前短暂等待
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return text;
}