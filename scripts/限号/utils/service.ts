// 限号信息服务模块

import { Storage } from 'scripting'
import { DEFAULT_CITY, getUserCity, WEEK_DAYS } from './city'
import { CACHE_KEY_PREFIX, CacheData, fetchLimitNumbersFromNetwork } from './network'

/**
 * 获取一周的限行信息
 * @param options 配置选项
 * @param options.forceRefreshCity 是否强制刷新城市信息
 * @param options.forceRefresh 是否强制刷新数据（忽略缓存）
 * @returns 包含城市和一周限行信息的对象
 */
export async function getWeeklyLimitNumbers(options?: { forceRefreshCity?: boolean, forceRefresh?: boolean }): Promise<{
  city: string;
  weeklyLimitInfo: Array<{
    day: string;
    dayIndex: number;
    limitInfo: string;
    isToday: boolean;
  }>;
}> {
  try {
    const { forceRefreshCity = false, forceRefresh = false } = options || {};
    const city = await getUserCity({ forceRefresh: forceRefreshCity });
    const today = new Date();
    const todayIndex = today.getDay();
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const todayDate = new Date().toISOString().split('T')[0];
    
    console.log(`开始获取${city}一周限行信息，当前日期: ${todayDate}`);
    
    // 尝试从缓存获取数据
    let cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    
    // 缓存验证逻辑
    if (!forceRefresh && cachedData && cachedData.date === todayDate && cachedData.weeklyData) {
      console.log(`✓ 缓存有效，直接从缓存获取${city}一周限行信息`);
    } else {
      if (cachedData && cachedData.date !== todayDate) {
        console.log(`⚠️ 缓存日期(${cachedData.date})与当前日期(${todayDate})不一致，需要重新获取`);
      } else if (cachedData) {
        console.log(`⚠️ 缓存数据结构不完整，需要重新获取`);
      } else {
        console.log(`ℹ️  缓存不存在，需要从网络获取限号信息`);
      }
      
      console.log(`===== ${forceRefresh ? '强制刷新' : '新的一天首次获取'}：从百度搜索结果获取${city}一周限号信息 =====`);
      // 直接调用fetchLimitNumbersFromNetwork获取最新数据并更新缓存
      const result = await fetchLimitNumbersFromNetwork(city);
      
      // 重新从缓存获取更新后的数据
      cachedData = Storage.get<CacheData>(cacheKey);
      if (cachedData) {
        console.log('✓ 成功获取更新后的缓存数据');
      } else {
        console.log('⚠️ 更新后的缓存数据不存在或无法获取');
      }
    }
    
    // 打印缓存状态信息便于调试
    if (cachedData) {
      console.log(`缓存状态 - 日期: ${cachedData.date}, 一周数据: ${cachedData.weeklyData ? Object.keys(cachedData.weeklyData).length + '天' : '无'}`);
    } else {
      console.log(`缓存仍然为空，可能获取数据失败`);
    }
    
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
      
      // 获取限行信息的逻辑
      let limitInfo = '暂无信息';
      
      // 从缓存的weeklyData中获取数据
      if (cachedData && cachedData.weeklyData && cachedData.weeklyData[day]) {
        limitInfo = cachedData.weeklyData[day];
        console.log(`使用缓存数据 - ${day}: ${limitInfo}`);
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
export async function getLimitNumbers(options?: { forceRefreshCity?: boolean, forceRefresh?: boolean }): Promise<{city: string, limitInfo: string}> {
  try {
    const { forceRefreshCity = false, forceRefresh = false } = options || {};
    const city = await getUserCity({ forceRefresh: forceRefreshCity });
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const todayDate = new Date().toISOString().split('T')[0];
    
    console.log(`开始获取${city}限号信息，当前日期: ${todayDate}`);
    
    // 尝试从缓存获取限号信息
    const cachedData: CacheData | null = Storage.get<CacheData>(cacheKey);
    
    // 缓存验证逻辑：
    // 1. 检查是否强制刷新
    // 2. 检查缓存是否存在
    // 3. 检查缓存日期是否与当前日期一致
    // 4. 检查缓存中是否有当天的限号信息
    if (!forceRefresh && cachedData && cachedData.date === todayDate && cachedData.weeklyData) {
      // 获取当天是星期几
      const todayIndex = new Date().getDay();
      let todayWeekDay: string;
      if (todayIndex === 0) todayWeekDay = '周日';
      else if (todayIndex === 6) todayWeekDay = '周六';
      else todayWeekDay = WEEK_DAYS[todayIndex - 1];
      
      if (cachedData.weeklyData[todayWeekDay]) {
        console.log(`✓ 缓存有效，直接从缓存获取${city}${todayWeekDay}的限号信息`);
        return { city, limitInfo: cachedData.weeklyData[todayWeekDay] };
      } else {
        console.log(`⚠️ 缓存存在但缺少当天(${todayWeekDay})的限号信息，需要更新`);
      }
    } else if (cachedData) {
      if (cachedData.date !== todayDate) {
        console.log(`⚠️ 缓存日期(${cachedData.date})与当前日期(${todayDate})不一致，需要重新获取`);
      } else {
        console.log(`⚠️ 缓存数据结构不完整，需要重新获取`);
      }
    } else {
      console.log(`ℹ️  缓存不存在，需要从网络获取限号信息`);
    }
    
    // 缓存不存在或已过期或强制刷新，从网络获取限号信息
    console.log(`===== ${forceRefresh ? '强制刷新' : '新的一天首次获取'}：从百度搜索结果获取${city}限号信息 =====`);
    const result = await fetchLimitNumbersFromNetwork(city);
    const { todayData: limitInfo, weeklyData } = result;
    
    // 验证网络获取结果
    if (!limitInfo || limitInfo === '获取限号信息失败') {
      console.error(`❌ 从网络获取${city}限号信息失败`);
      // 尝试使用缓存数据作为备选（即使已过期）
      if (cachedData && cachedData.weeklyData) {
        const todayIndex = new Date().getDay();
        let todayWeekDay: string;
        if (todayIndex === 0) todayWeekDay = '周日';
        else if (todayIndex === 6) todayWeekDay = '周六';
        else todayWeekDay = WEEK_DAYS[todayIndex - 1];
        
        if (cachedData.weeklyData[todayWeekDay]) {
          console.log(`⚠️ 使用过期缓存作为备选方案，请注意数据可能不准确`);
          return { city, limitInfo: `${cachedData.weeklyData[todayWeekDay]} (数据可能已过期)` };
        }
      }
    }
    
    // 输出当天限号信息日志
    console.log(`\n===== 当天限号信息 =====`);
    console.log(`日期: ${new Date().toLocaleDateString()}`);
    console.log(`城市: ${city}`);
    console.log(`限号信息: ${limitInfo}`);
    console.log(`缓存状态: 已更新`);
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
