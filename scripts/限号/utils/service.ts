// 限号信息服务模块

import { getTodayDateKey } from './base'
import { DEFAULT_CITY, getUserCity, WEEK_DAYS } from './city'
import { CACHE_KEY_PREFIX, fetchLimitNumbersFromNetwork } from './network'/**
 * 获取一周的限行信息
 * @param options 配置选项
 * @param options.forceRefreshCity 是否强制刷新城市信息
 * @returns 包含城市和一周限行信息的对象
 */
export async function getWeeklyLimitNumbers(options?: { forceRefreshCity?: boolean }): Promise<{
  city: string;
  weeklyLimitInfo: Array<{
    day: string;
    dayIndex: number;
    limitInfo: string;
    isToday: boolean;
  }>;
}> {
  try {
    const { forceRefreshCity = false } = options || {};
    const city = await getUserCity({ forceRefresh: forceRefreshCity });
    const today = new Date();
    const todayIndex = today.getDay();
    
    // 标准的限行轮换规则（适用于大多数城市）
    // 注意：不同城市的限行规则可能不同，这里采用北京的规则作为示例
    const standardWeeklyRules = {
      '周一': '5和0',
      '周二': '1和6',
      '周三': '2和7',
      '周四': '3和8',
      '周五': '4和9',
      '周六': '不限行',
      '周日': '不限行'
    };
    
    // 获取今天的实际限行信息，用于确定当前的限行轮换周期
    const todayLimitData = await getLimitNumbers({ forceRefreshCity });
    const todayLimitInfo = todayLimitData.limitInfo;
    
    // 初始化一周的限行信息数组
    const weeklyLimitInfo = WEEK_DAYS.map((day, index) => {
      // 根据星期几获取对应的限行信息
      let limitInfo = standardWeeklyRules[day] || '暂无信息';
      
      // 对于今天，使用实际获取到的限行信息
      if (index === todayIndex) {
        limitInfo = todayLimitInfo;
      }
      
      return {
        day,
        dayIndex: index,
        limitInfo,
        isToday: index === todayIndex
      };
    });
    
    return { city, weeklyLimitInfo };

  } catch (e) {
    console.error('获取一周限行信息失败:', e);
    
    // 返回默认数据
    const todayIndex = new Date().getDay();
    
    return {
      city: DEFAULT_CITY,
      weeklyLimitInfo: WEEK_DAYS.map((day, index) => ({
        day,
        dayIndex: index,
        limitInfo: '获取失败',
        isToday: index === todayIndex
      }))
    };
  }
}

/**
 * 获取限号信息（带缓存功能，仅在新的一天开始时重新获取）
 * @param options 配置选项
 * @param options.forceRefreshCity 是否强制刷新城市信息
 * @returns 包含城市和限号信息的对象
 */
export async function getLimitNumbers(options?: { forceRefreshCity?: boolean }): Promise<{city: string, limitInfo: string}> {
  try {
    const { forceRefreshCity = false } = options || {};
    const city = await getUserCity({ forceRefresh: forceRefreshCity });
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
