// 通用工具函数和常量定义
import { ConstantsConfig, CacheData, LogLevel } from './types';

/**
 * 常量定义
 */
export const Constants: ConstantsConfig = {
  // 缓存相关常量
  CACHE_EXPIRY_HOURS: 6, // 缓存有效期（小时）
  TEMP_CACHE_EXPIRY_MS: 30000, // 临时缓存有效期（30秒）
  MAX_RETRIES: 2, // 网络请求最大重试次数
  REQUEST_TIMEOUT_MS: 10000, // 网络请求超时时间（10秒）
  
  // 缓存键名
  CACHE_KEYS: {
    PREFIX: 'limitNumbers_',
    USER_CITY: 'userCity',
    CITY_CACHE_DATE: 'userCityCacheDate',
    TEMP_USER_CITY: 'tempUserCity',
    TEMP_USER_CITY_TIMESTAMP: 'tempUserCityTimestamp'
  },
  
  // 日志级别
  LOG_LEVELS: {
    DEBUG: 'debug' as LogLevel,
    INFO: 'info' as LogLevel,
    ERROR: 'error' as LogLevel
  }
};

/**
 * 带超时的异步操作包装器
 * @template T 泛型参数
 * @param promise 原始Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param fallbackValue 超时时的回退值
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      log('操作超时，使用回退值', Constants.LOG_LEVELS.INFO);
      resolve(fallbackValue);
    }, timeoutMs);
    
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      () => {
        clearTimeout(timeoutId);
        resolve(fallbackValue);
      }
    );
  });
}

/**
 * 统一的错误处理函数
 * @param error 错误对象
 * @param fallbackValue 错误发生时的回退值
 * @param errorType 错误类型描述
 * @returns 回退值
 */
export function handleError<T>(error: any, fallbackValue: T, errorType: string = '未知错误'): T {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log(`${errorType}错误: ${errorMessage}`, Constants.LOG_LEVELS.ERROR);
  return fallbackValue;
}

/**
 * 增强的错误处理函数，适用于Promise链
 * @param fallbackValue 错误发生时的回退值
 * @param errorType 错误类型描述
 * @returns 错误处理函数
 */
export function createErrorHandler<T>(fallbackValue: T, errorType: string = '未知错误') {
  return (error: any): T => handleError(error, fallbackValue, errorType);
}

/**
 * 日志输出函数，支持日志级别控制
 * @param message 日志消息
 * @param level 日志级别
 */
export function log(message: string, level: LogLevel = Constants.LOG_LEVELS.INFO): void {
  // 在实际环境中可以根据环境变量控制日志输出
  const shouldLog = true; // 可以替换为配置项
  
  if (shouldLog) {
    const timestamp = new Date().toLocaleTimeString();
    switch (level) {
      case Constants.LOG_LEVELS.ERROR:
        console.error(`[${timestamp}] ERROR: ${message}`);
        break;
      case Constants.LOG_LEVELS.DEBUG:
        console.debug(`[${timestamp}] DEBUG: ${message}`);
        break;
      default:
        console.log(`[${timestamp}] INFO: ${message}`);
    }
  }
}

/**
 * 将数字索引的星期转换为WEEK_DAYS数组的索引
 * @param todayIndex getDay()返回的索引（0=周日，1=周一，...，6=周六）
 * @returns WEEK_DAYS数组的索引（0=周一，1=周二，...，6=周日）
 */
export function getWeekDayIndex(todayIndex: number): number {
  // 周日(0) -> 6, 周一(1) -> 0, 周二(2) -> 1, ..., 周六(6) -> 5
  return todayIndex === 0 ? 6 : todayIndex - 1;
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD格式）
 * @returns 日期字符串
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 检查缓存是否有效
 * @param cachedData 缓存数据
 * @param dateString 要检查的日期字符串
 * @returns 缓存是否有效
 */
export function isCacheValid(cachedData: CacheData | null, dateString: string): boolean {
  if (!cachedData || !cachedData.date || cachedData.date !== dateString) {
    return false;
  }
  
  // 检查缓存是否过期（超过指定小时数）
  if (cachedData.timestamp) {
    const cacheAge = Date.now() - cachedData.timestamp;
    if (cacheAge > Constants.CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
      return false;
    }
  }
  
  return true;
}