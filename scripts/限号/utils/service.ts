// 限号信息服务模块

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
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const todayDate = new Date().toISOString().split('T')[0]; // 计算今天的日期
    
    console.log(`开始获取${city}一周限行信息`);
    console.log(`当前日期: ${todayDate}`);
    
    // 从缓存获取数据
    let cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    
    // 检查缓存是否存在且日期是否是今天
    if (cachedData) {
      console.log(`缓存数据存在，缓存日期: ${cachedData.date}`);
      
      // 核心修复：检查缓存日期是否与今天一致，不一致则需要重新获取
      if (cachedData.date !== todayDate) {
        console.log(`缓存日期(${cachedData.date})与当前日期(${todayDate})不一致，需要重新获取数据`);
        cachedData = null; // 清除缓存引用，强制重新获取
      } else {
        console.log(`缓存日期有效，使用缓存数据`);
      }
    } else {
      console.log('缓存数据不存在，需要重新获取');
    }
    
    // 如果缓存不存在或已过期，调用getLimitNumbers获取最新数据
    if (!cachedData) {
      console.log(`调用getLimitNumbers获取最新数据`);
      await getLimitNumbers({ forceRefreshCity });
      // 重新从缓存获取更新后的数据
      cachedData = Storage.get<CacheData>(cacheKey);
      if (cachedData) {
        console.log(`成功获取更新后的缓存数据，新缓存日期: ${cachedData.date}`);
      } else {
        console.log('更新后的缓存数据不存在或无法获取');
      }
    }
    
    // 打印缓存状态信息便于调试
    if (cachedData) {
      console.log(`缓存状态 - 日期: ${cachedData.date}, 当天数据: ${cachedData.todayData}, 一周数据: ${cachedData.weeklyData ? Object.keys(cachedData.weeklyData).length + '天' : '无'}`);
    } else {
      console.log(`缓存仍然为空，可能获取数据失败`);
    }
    
    // 初始化一周的限行信息数组
    const weeklyLimitInfo = WEEK_DAYS.map((day, index) => {
      // 直接根据day名称映射，避免索引转换错误
      // isToday判断：如果是今天（根据getDay()返回值），则标记为今天
      let isToday = false;
      // JavaScript的getDay()：0-周日, 1-周一, 2-周二, 3-周三, 4-周四, 5-周五, 6-周六
      if (todayIndex === 0 && day === '周日') isToday = true;
      else if (todayIndex === 1 && day === '周一') isToday = true;
      else if (todayIndex === 2 && day === '周二') isToday = true;
      else if (todayIndex === 3 && day === '周三') isToday = true;
      else if (todayIndex === 4 && day === '周四') isToday = true;
      else if (todayIndex === 5 && day === '周五') isToday = true;
      else if (todayIndex === 6 && day === '周六') isToday = true;
      
      // 获取限行信息的逻辑
      let limitInfo = '暂无信息';
      
      // 首先尝试从缓存中获取数据
      if (cachedData) {
        // 今天的数据优先使用todayData
        if (isToday && cachedData.todayData) {
          limitInfo = cachedData.todayData;
          console.log(`使用当天缓存数据 - ${day}: ${limitInfo}`);
        }
        // 非今天的数据从weeklyData获取
        else if (cachedData.weeklyData && cachedData.weeklyData[day]) {
          limitInfo = cachedData.weeklyData[day];
          console.log(`使用一周缓存数据 - ${day}: ${limitInfo}`);
        }
      }
      
      return {
          day,
          dayIndex: index,
          limitInfo,
          isToday
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
    
    return {
      city: DEFAULT_CITY,
      weeklyLimitInfo: WEEK_DAYS.map((day) => {
        // 直接根据day名称映射，避免索引转换错误
        let isToday = false;
        if (todayIndex === 0 && day === '周日') isToday = true;
        else if (todayIndex === 1 && day === '周一') isToday = true;
        else if (todayIndex === 2 && day === '周二') isToday = true;
        else if (todayIndex === 3 && day === '周三') isToday = true;
        else if (todayIndex === 4 && day === '周四') isToday = true;
        else if (todayIndex === 5 && day === '周五') isToday = true;
        else if (todayIndex === 6 && day === '周六') isToday = true;
        
        return {
          day,
          dayIndex: WEEK_DAYS.indexOf(day),
          limitInfo: '获取失败',
          isToday
        };
      })
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
    const todayDate = new Date().toISOString().split('T')[0];
    
    console.log(`开始获取${city}限号信息，当前日期: ${todayDate}`);
    
    // 尝试从缓存获取限号信息
    const cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    
    // 核心修复：严格检查缓存日期是否与今天一致
    if (cachedData) {
      console.log(`缓存数据存在，缓存日期: ${cachedData.date}`);
      
      // 只有当缓存日期与今天一致且有有效数据时才使用缓存
      if (cachedData.date === todayDate && cachedData.todayData) {
        console.log(`缓存有效，使用缓存中的限号信息`);
        return { city, limitInfo: cachedData.todayData };
      } else if (cachedData.date !== todayDate) {
        console.log(`缓存日期(${cachedData.date})与当前日期(${todayDate})不一致，需要重新获取`);
      } else {
        console.log(`缓存数据不完整，需要重新获取`);
      }
    } else {
      console.log('缓存数据不存在，需要从网络获取');
    }
    
    // 缓存不存在或已过期/无效，从网络获取限号信息
    console.log(`===== 从百度搜索结果获取${city}限号信息 =====`);
    const result = await fetchLimitNumbersFromNetwork(city);
    const { todayData: limitInfo, weeklyData } = result;
    
    // 验证结果并记录日志
    if (limitInfo && limitInfo !== '获取限号信息失败') {
      console.log(`成功获取并缓存${city}当天和一周限号信息`);
    }
    
    // 输出当天限号信息日志
    console.log(`\n===== 当天限号信息 =====`);
    console.log(`日期: ${new Date().toLocaleDateString()}`);
    console.log(`城市: ${city}`);
    console.log(`限号信息: ${limitInfo}`);
    console.log(`====================`);
    
    // 如果获取到了一周限行信息，额外输出一周信息日志
    if (Object.keys(weeklyData).length > 0) {
      console.log(`\n===== 一周限行信息 =====`);
      for (const [day, info] of Object.entries(weeklyData)) {
        console.log(`${day}: ${info}`);
      }
      console.log(`====================`);
    }
    
    return { city, limitInfo };

  } catch (e) {
    console.error('获取限号信息失败:', e);
    return { city: DEFAULT_CITY, limitInfo: '获取限号信息失败' };
  }
}
