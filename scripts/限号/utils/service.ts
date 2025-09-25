// 限号信息服务模块

import { getUserCity, DEFAULT_CITY } from './city';
import { CACHE_KEY_PREFIX, fetchLimitNumbersFromNetwork } from './network';
import { getTodayDateKey } from './base';

// 声明Storage以避免与DOM类型冲突
declare const Storage: any;

/**
 * 获取限号信息（带缓存功能，仅在新的一天开始时重新获取）
 * @returns 包含城市和限号信息的对象
 */
export async function getLimitNumbers(): Promise<{city: string, limitInfo: string}> {
  try {
    const city = await getUserCity();
    const cacheKey = `${CACHE_KEY_PREFIX}${city}_${getTodayDateKey()}`;
    
    // 尝试从缓存获取限号信息
    const cachedLimitInfo = Storage.get(cacheKey);
    if (cachedLimitInfo) {
      console.log(`从缓存获取${city}限号信息`);
      return { city, limitInfo: cachedLimitInfo };
    }
    
    // 缓存不存在，从网络获取限号信息
    console.log(`从网络获取${city}限号信息`);
    const limitInfo = await fetchLimitNumbersFromNetwork(city);
    
    // 保存到缓存
    if (limitInfo && limitInfo !== '获取限号信息失败') {
      Storage.set(cacheKey, limitInfo);
      console.log(`已缓存${city}限号信息`);
    }
    
    return { city, limitInfo };

  } catch (e) {
    console.error('获取限号信息失败:', e);
    return { city: DEFAULT_CITY, limitInfo: '获取限号信息失败' };
  }
}