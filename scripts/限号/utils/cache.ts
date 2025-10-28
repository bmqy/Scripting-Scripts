// 缓存管理模块
import { Constants, log, getTodayDateString, isCacheValid } from './common';
import { CacheData } from './types';

/**
 * 获取缓存键
 * @param city 城市名称
 * @returns 缓存键名
 */
export function getCacheKey(city: string): string {
  return `${Constants.CACHE_KEYS.PREFIX}${city}`;
}

/**
 * 从缓存中获取数据
 * @param city 城市名称
 * @returns 缓存数据或null
 */
export function getCachedData(city: string): CacheData | null {
  try {
    const cacheKey = getCacheKey(city);
    const cachedData = Storage.get<CacheData>(cacheKey);
    
    if (cachedData) {
      const today = getTodayDateString();
      
      if (isCacheValid(cachedData, today)) {
        log(`从缓存获取${city}限号信息（有效）`);
        return cachedData;
      } else {
        log(`缓存存在但已过期或日期不匹配，需要重新获取`);
      }
    }
    
    return null;
  } catch (e) {
    log(`从缓存获取数据失败: ${e}`, Constants.LOG_LEVELS.ERROR);
    return null;
  }
}

/**
 * 保存数据到缓存
 * @param city 城市名称
 * @param data 要保存的数据
 */
export function saveDataToCache(city: string, data: Omit<CacheData, 'timestamp' | 'date'>): void {
  try {
    const cacheKey = getCacheKey(city);
    const cacheData: CacheData = {
      ...data,
      timestamp: Date.now(),
      date: getTodayDateString()
    };
    
    Storage.set(cacheKey, cacheData);
    log(`已缓存${city}限号信息`);
  } catch (e) {
    log(`保存到缓存失败: ${e}`, Constants.LOG_LEVELS.ERROR);
  }
}

/**
 * 清除指定城市的缓存
 * @param city 城市名称
 */
export function clearCityCache(city: string): void {
  try {
    const cacheKey = getCacheKey(city);
    Storage.remove(cacheKey);
    log(`已清除${city}的缓存`);
  } catch (e) {
    log(`清除缓存失败: ${e}`, Constants.LOG_LEVELS.ERROR);
  }
}

/**
 * 清除所有限号相关缓存
 */
export function clearAllLimitCache(): void {
  try {
    // 获取所有存储键并过滤出限号相关的缓存键
    // 注意：根据Scripting App的API，可能需要特殊的方法来获取所有键
    // 这里假设可以通过某种方式获取所有存储键
    log('尝试清除所有限号相关缓存');
    
    // 如果API支持获取所有键，可以这样实现：
    // const allKeys = Storage.keys();
    // allKeys.forEach(key => {
    //   if (key.startsWith(Constants.CACHE_KEYS.PREFIX)) {
    //     Storage.remove(key);
    //   }
    // });
  } catch (e) {
    log(`清除所有缓存失败: ${e}`, Constants.LOG_LEVELS.ERROR);
  }
}