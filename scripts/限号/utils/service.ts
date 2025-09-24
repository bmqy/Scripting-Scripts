// 限号信息服务模块

import { getUserCity, DEFAULT_CITY } from './city';
import { CACHE_KEY_PREFIX, fetchLimitNumbersFromNetwork } from './network';
import { getTodayDateKey } from './base';

// 声明Storage以避免与DOM类型冲突
declare const Storage: any;

/**
 * 获取限号信息（开发阶段：先清除缓存直接从网络获取）
 * @returns 包含城市和限号信息的对象
 */
export async function getLimitNumbers(): Promise<{city: string, limitInfo: string}> {
  try {
    const city = await getUserCity();
    const cacheKey = `${CACHE_KEY_PREFIX}${city}_${getTodayDateKey()}`;
    
    // 开发阶段临时措施：先清除缓存，每次都从网络获取最新信息
    Storage.remove(cacheKey);
    console.log(`开发阶段：已清除缓存，将直接从网络获取${city}限号信息`);
    
    // 直接从网络获取限号信息
    console.log(`从网络获取${city}限号信息`);
    const limitInfo = await fetchLimitNumbersFromNetwork(city);
    
    return { city, limitInfo };

  } catch (e) {
    console.error('获取限号信息失败:', e);
    return { city: DEFAULT_CITY, limitInfo: '获取限号信息失败' };
  }
}