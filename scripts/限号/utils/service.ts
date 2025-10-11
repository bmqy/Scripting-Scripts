// 限号信息服务模块

import { getTodayDateKey } from './base'
import { DEFAULT_CITY, getUserCity, WEEK_DAYS } from './city'
import { CACHE_KEY_PREFIX, fetchLimitNumbersFromNetwork, fetchWeeklyLimitNumbersFromNetwork, CacheData } from './network'

/**
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
    
    // 首先尝试从缓存获取一周限行信息
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    
    // 定义一周限行信息对象
    let weeklyLimitInfoFromCache: Record<string, string> = {};
    let todayLimitInfoFromCache = '';
    
    // 如果缓存存在且日期匹配，使用缓存数据
    if (cachedData && cachedData.date === getTodayDateKey()) {
      console.log(`从缓存获取${city}一周限行信息`);
      weeklyLimitInfoFromCache = cachedData.weeklyData || {};
      todayLimitInfoFromCache = cachedData.todayData || '';
    }
    
    // 从网络获取一周限行信息（作为备用）
    let weeklyLimitInfoFromNetwork: Record<string, string> = {};
    try {
      weeklyLimitInfoFromNetwork = await fetchWeeklyLimitNumbersFromNetwork(city);
    } catch (e) {
      console.error('获取一周限行信息失败:', e);
    }
    
    // 获取今天的实际限行信息
    const todayLimitData = await getLimitNumbers({ forceRefreshCity });
    const todayLimitInfo = todayLimitData.limitInfo;
    
    // 初始化一周的限行信息数组
    const weeklyLimitInfo = WEEK_DAYS.map((day, index) => {
      // 明确的日期转换逻辑
      let weekDayIndex: number;
      if (todayIndex === 0) {  // 今天是周日
        weekDayIndex = 6;  // 对应WEEK_DAYS[6] = '周日'
      } else if (todayIndex === 1) {  // 今天是周一
        weekDayIndex = 0;  // 对应WEEK_DAYS[0] = '周一'
      } else if (todayIndex === 2) {  // 今天是周二
        weekDayIndex = 1;  // 对应WEEK_DAYS[1] = '周二'
      } else if (todayIndex === 3) {  // 今天是周三
        weekDayIndex = 2;  // 对应WEEK_DAYS[2] = '周三'
      } else if (todayIndex === 4) {  // 今天是周四
        weekDayIndex = 3;  // 对应WEEK_DAYS[3] = '周四'
      } else if (todayIndex === 5) {  // 今天是周五
        weekDayIndex = 4;  // 对应WEEK_DAYS[4] = '周五'
      } else {  // 今天是周六 (todayIndex === 6)
        weekDayIndex = 5;  // 对应WEEK_DAYS[5] = '周六'
      }
      
      // 如果是今天，使用实际获取的限行信息
      let limitInfo = '暂无信息';
      if (index === weekDayIndex) {
        // 如果有缓存的当天数据且不为空，优先使用
        if (todayLimitInfoFromCache && todayLimitInfoFromCache !== '暂无信息') {
          limitInfo = todayLimitInfoFromCache;
        } else {
          limitInfo = todayLimitInfo;
        }
      }
      // 否则，优先使用缓存中的一周限行信息
      else if (weeklyLimitInfoFromCache && weeklyLimitInfoFromCache[day]) {
        limitInfo = weeklyLimitInfoFromCache[day];
      }
      // 最后，使用从网络获取的一周限行信息
      else if (weeklyLimitInfoFromNetwork && weeklyLimitInfoFromNetwork[day]) {
        limitInfo = weeklyLimitInfoFromNetwork[day];
      }
      
      return {
          day,
          dayIndex: index,
          limitInfo,
          isToday: index === weekDayIndex
        };
    });
    
    // 输出最终确定的一周限行信息
    console.log(`\n===== 最终确定的一周限行信息 =====`);
    weeklyLimitInfo.forEach(item => {
      console.log(`${item.day}${item.isToday ? ' (今天)' : ''}: ${item.limitInfo}`);
    });
    console.log(`================================`);
    
    return { city, weeklyLimitInfo };

  } catch (e) {
    console.error('获取一周限行信息失败:', e);
    
    // 返回错误数据
    const today = new Date();
    const todayIndex = today.getDay();
    // 明确的日期转换逻辑
    let weekDayIndex: number;
    if (todayIndex === 0) {  // 今天是周日
      weekDayIndex = 6;  // 对应WEEK_DAYS[6] = '周日'
    } else if (todayIndex === 1) {  // 今天是周一
      weekDayIndex = 0;  // 对应WEEK_DAYS[0] = '周一'
    } else if (todayIndex === 2) {  // 今天是周二
      weekDayIndex = 1;  // 对应WEEK_DAYS[1] = '周二'
    } else if (todayIndex === 3) {  // 今天是周三
      weekDayIndex = 2;  // 对应WEEK_DAYS[2] = '周三'
    } else if (todayIndex === 4) {  // 今天是周四
      weekDayIndex = 3;  // 对应WEEK_DAYS[3] = '周四'
    } else if (todayIndex === 5) {  // 今天是周五
      weekDayIndex = 4;  // 对应WEEK_DAYS[4] = '周五'
    } else {  // 今天是周六 (todayIndex === 6)
      weekDayIndex = 5;  // 对应WEEK_DAYS[5] = '周六'
    }
    
    return {
      city: DEFAULT_CITY,
      weeklyLimitInfo: WEEK_DAYS.map((day, index) => ({
        day,
        dayIndex: index,
        limitInfo: '获取失败',
        isToday: index === weekDayIndex
      }))
    };
  }
}

/**
 * 获取限号信息（带缓存功能，仅在新的一天开始时重新获取）
 * @param options 配置选项
 * @returns 包含城市和限号信息的对象
 */
export async function getLimitNumbers(options?: { forceRefreshCity?: boolean }): Promise<{city: string, limitInfo: string}> {
  try {
    const { forceRefreshCity = false } = options || {};
    const city = await getUserCity({ forceRefresh: forceRefreshCity });
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const todayDateKey = getTodayDateKey();
    
    // 尝试从缓存获取限号信息
    const cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    if (cachedData && cachedData.date === todayDateKey && cachedData.todayData) {
      console.log(`从缓存获取${city}限号信息`);
      return { city, limitInfo: cachedData.todayData };
    }
    
    // 缓存不存在或已过期，从网络获取限号信息
    console.log(`===== 每天第一次获取：从百度搜索结果获取${city}限号信息 =====`);
    const limitInfo = await fetchLimitNumbersFromNetwork(city);
    
    // 保存到缓存
    if (limitInfo && limitInfo !== '获取限号信息失败') {
      // 如果已有缓存且日期相同，保留原有weeklyData
      if (cachedData && cachedData.date === todayDateKey) {
        const updatedCacheData: CacheData = {
          date: todayDateKey,
          todayData: limitInfo,
          weeklyData: cachedData.weeklyData || {}
        };
        Storage.set(cacheKey, updatedCacheData);
      } else {
        // 新建或更新缓存
        const newCacheData: CacheData = {
          date: todayDateKey,
          todayData: limitInfo,
          weeklyData: {}
        };
        Storage.set(cacheKey, newCacheData);
      }
      console.log(`已缓存${city}当天限号信息`);
    }
    
    // 输出当天限号信息日志
    console.log(`\n===== 当天限号信息 =====`);
    console.log(`日期: ${new Date().toLocaleDateString()}`);
    console.log(`城市: ${city}`);
    console.log(`限号信息: ${limitInfo}`);
    console.log(`====================`);
    
    return { city, limitInfo };

  } catch (e) {
    console.error('获取限号信息失败:', e);
    return { city: DEFAULT_CITY, limitInfo: '获取限号信息失败' };
  }
}
