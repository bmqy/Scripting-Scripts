// 限号信息服务模块

import { getTodayDateKey } from './base'
import { DEFAULT_CITY, getUserCity } from './city'
import { CACHE_KEY_PREFIX, fetchLimitNumbersFromNetwork } from './network'

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
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // 标准的限行轮换规则（适用于大多数城市）
    const standardWeeklyRules = {
      '周一': '5和0',
      '周二': '1和6',
      '周三': '2和7',
      '周四': '3和8',
      '周五': '4和9',
      '周六': '不限行',
      '周日': '不限行'
    };
    
    // 获取一周的限行信息
    const weeklyLimitInfo = weekDays.map((day, index) => {
      // 检查是否是周末
      const isWeekend = index === 0 || index === 6;
      
      // 获取缓存键（只缓存工作日的限行信息）
      const date = new Date();
      const daysDiff = index - todayIndex;
      date.setDate(today.getDate() + daysDiff);
      const dateKey = date.toLocaleDateString();
      const cacheKey = `${CACHE_KEY_PREFIX}${city}_${dateKey}`;
      
      // 尝试从缓存获取
      const cachedInfo = Storage.get(cacheKey);
      if (cachedInfo) {
        return {
          day,
          dayIndex: index,
          limitInfo: cachedInfo,
          isToday: index === todayIndex
        };
      }
      
      // 如果没有缓存，使用标准规则
      let limitInfo = '';
      if (isWeekend) {
        // 周末通常不限行
        limitInfo = '不限行';
      } else if (day in standardWeeklyRules) {
        // 工作日使用标准轮换规则
        limitInfo = standardWeeklyRules[day as keyof typeof standardWeeklyRules];
      } else {
        limitInfo = '未找到';
      }
      
      return {
        day,
        dayIndex: index,
        limitInfo,
        isToday: index === todayIndex
      };
    });
    
    // 对于今天的信息，我们确保使用最新的数据
    if (weeklyLimitInfo[todayIndex]) {
      const todayData = await getLimitNumbers({ forceRefreshCity });
      weeklyLimitInfo[todayIndex].limitInfo = todayData.limitInfo;
    }
    
    return { city, weeklyLimitInfo };

  } catch (e) {
    console.error('获取一周限行信息失败:', e);
    
    // 返回默认数据
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const todayIndex = new Date().getDay();
    
    return {
      city: DEFAULT_CITY,
      weeklyLimitInfo: weekDays.map((day, index) => ({
        day,
        dayIndex: index,
        limitInfo: '获取失败',
        isToday: index === todayIndex
      }))
    };
  }
}
