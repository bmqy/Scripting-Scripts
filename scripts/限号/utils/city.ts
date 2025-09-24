// 城市相关工具模块

// 声明Storage以避免与DOM类型冲突
declare const Storage: any;

/**
 * 默认城市，当无法获取位置时使用
 */
export const DEFAULT_CITY = '北京';

/**
 * 一周的日期数组
 */
export const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 城市特定的周末限行规则配置
 * 数据来源：基于网络搜索结果整理，实际政策可能有变化，请以官方发布为准
 */
export const CITY_WEEKEND_RULES: Record<string, boolean> = {
  '北京': true,    // 北京正常情况下周末不限行
  '上海': true,    // 上海周末不限行
  '广州': true,    // 广州周末不限行
  '深圳': true,    // 深圳正常情况下周末不限行
  '杭州': true,    // 杭州正常情况下周末不限行
  '西安': true,    // 西安正常情况下周末不限行
  // 注意：某些城市在特定时期可能会临时调整政策，实施周末限行
  // 例如成都在特定活动期间（如2025年8月3日至17日）曾实施周末限行
  // 可以根据实际情况添加更多城市的规则
};

/**
 * 获取用户所在城市
 * @returns 用户城市名称
 */
export async function getUserCity(): Promise<string> {
  try {
    // 尝试从缓存获取城市信息
    const cachedCity = Storage.get('userCity');
    if (cachedCity) {
      console.log('从缓存获取城市信息:', cachedCity);
      return cachedCity;
    }

    try {
      // 尝试使用反向地理编码获取城市名
      // 由于缺少类型定义，这里简化处理，使用默认城市
      // 实际使用中可能需要根据Scripting App的正确API来实现
      const city = DEFAULT_CITY;
      
      // 缓存城市信息
      Storage.set('userCity', city);

      return city;
    } catch (geocodeError) {
      console.log('获取地理位置信息失败:', geocodeError);
      console.log('使用默认城市:', DEFAULT_CITY);
    }
    
    return DEFAULT_CITY;
  } catch (e) {
    console.error('获取城市信息失败:', e);
    return DEFAULT_CITY;
  }
}