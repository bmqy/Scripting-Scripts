// 城市相关工具模块
import { Notification } from 'scripting';
/**
 * 默认城市，当无法获取位置时使用
 * 现在默认为空，获取不到城市时会发送通知
 */
export const DEFAULT_CITY = '北京';

/**
 * 一周的日期数组
 */
export const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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
 * 带超时的异步操作包装器
 * @param promise 原始Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param fallbackValue 超时时的回退值
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log(`操作超时（${timeoutMs}ms），使用回退值`);
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
 * 获取用户所在城市
 * @param options 配置选项
 * @param options.forceRefresh 是否强制刷新，清除缓存重新获取城市信息
 * @returns 用户城市名称
 */
export async function getUserCity(options?: { forceRefresh?: boolean }) {
  try {
    const { forceRefresh = false } = options || {};
    
    // 检查是否有临时缓存（用于处理获取位置信息超时的情况）
    const tempCityKey = 'tempUserCity';
    const tempCityTimestampKey = 'tempUserCityTimestamp';
    const cachedTempCity = Storage.get<string>(tempCityKey);
    const cachedTempCityTimestamp = Storage.get<string>(tempCityTimestampKey);
    
    // 如果有临时缓存且未过期（30秒内），并且不是强制刷新，则使用临时缓存
    if (!forceRefresh && cachedTempCity && cachedTempCityTimestamp) {
      const now = Date.now();
      const tempCacheAge = now - parseInt(cachedTempCityTimestamp, 10);
      if (tempCacheAge < 30000) { // 30秒内
        console.log('从临时缓存获取城市信息:', cachedTempCity);
        return cachedTempCity;
      }
    }
    
    // 检查是否需要每天重新获取一次
    const cityCacheDateKey = 'userCityCacheDate';
    const cachedCity = Storage.get<string>('userCity');
    const cachedDate = Storage.get<string>(cityCacheDateKey);
    const today = new Date().toDateString(); // 获取当前日期的字符串表示（不含时间）
    
    // 如果不是强制刷新，并且缓存存在且日期是今天，则直接返回缓存的城市
    if (!forceRefresh && cachedCity && cachedDate && cachedDate === today) {
      console.log('从缓存获取城市信息（今日已更新）:', cachedCity);
      // 清除临时缓存，因为我们有了正式的缓存
      Storage.remove(tempCityKey);
      Storage.remove(tempCityTimestampKey);
      return cachedCity;
    }
    
    // 强制刷新或缓存已过期（不是今天的），清除相关缓存
    Storage.remove('userCity');
    Storage.remove(cityCacheDateKey);
    Storage.remove(tempCityKey);
    Storage.remove(tempCityTimestampKey);
    
    if (forceRefresh) {
      console.log('清除城市缓存，强制重新获取');
    } else if (cachedCity && cachedDate !== today) {
      console.log('城市缓存已过期（日期不匹配），重新获取');
    } else {
      console.log('首次运行或无有效缓存，尝试获取位置信息');
    }

    try {
      // 在小组件环境中，位置请求可能会卡住或需要较长时间
      // 因此添加超时处理，确保程序不会无限期等待
      const locationInfo = await withTimeout(
        (async () => {
          console.log('尝试使用Location API获取当前位置...');
          
          try {
            // 请求获取当前位置
            return await Location.requestCurrent();
          } catch (error) {
            console.log('位置请求失败:', error);
            return null;
          }
        })(), 
        30000, // 30秒超时
        null
      );
      
      if (locationInfo) {
        console.log('获取位置信息成功:', locationInfo);
        
        // 使用反向地理编码获取地址信息
        const placemarks = await withTimeout(
          Location.reverseGeocode({
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            locale: 'zh_CN'
          }),
          3000, // 3秒超时
          []
        );
        
        if (placemarks && placemarks.length > 0) {
          const placemark = placemarks[0];
          console.log('获取地址信息成功:', placemark);
          
          // 提取城市名称
          // 根据placemark的实际结构来提取城市名
          let city = placemark.locality || '';
          
          if (city) {
            console.log('提取到城市:', city);
            // 缓存城市信息和当前日期
            Storage.set('userCity', city);
            Storage.set('userCityCacheDate', new Date().toDateString());
            return city;
          }
        }
      }
    } catch (geocodeError) {
      console.log('获取地理位置信息失败:', geocodeError);
    }
    
    console.log('无法获取城市信息，使用默认城市:', DEFAULT_CITY);
      
      // 设置临时缓存，避免短时间内重复尝试获取位置信息
      Storage.set(tempCityKey, DEFAULT_CITY);
      Storage.set(tempCityTimestampKey, Date.now().toString());
      
      // 如果默认城市为空，发送通知提示用户
      if (!DEFAULT_CITY) {
        try {
          console.log('发送通知提示用户给予定位权限');
          // 使用Notification API发送通知
          await withTimeout(
            Notification.schedule({
              title: '限号查询',
              body: '无法获取您的城市信息，请检查定位权限并重试',
              subtitle: '位置服务不可用',
              interruptionLevel: 'active',
              actions: [
                {
                  title: '重试',
                  url: 'scripting://open?scriptName=限号'
                }
              ],
              tapAction: {
                type: 'runScript',
                scriptName: '限号'
              }
            }),
            2000, // 2秒超时
            null
          );
        } catch (notificationError) {
          console.error('发送通知失败:', notificationError);
        }
      }
      
      return DEFAULT_CITY;
    } catch (e) {
      console.error('获取城市信息失败:', e);
      
      // 如果默认城市为空，发送通知提示用户
      if (!DEFAULT_CITY) {
        try {
          console.log('发送通知提示用户给予定位权限');
          // 使用Notification API发送通知
          await withTimeout(
            Notification.schedule({
              title: '限号查询',
              body: '获取城市信息时发生错误，请检查定位权限并重试',
              subtitle: '位置服务错误',
              interruptionLevel: 'active',
              actions: [
                {
                  title: '重试',
                  url: 'scripting://open?scriptName=限号'
                }
              ],
              tapAction: {
                type: 'runScript',
                scriptName: '限号'
              }
            }),
            2000, // 2秒超时
            null
          );
        } catch (notificationError) {
          console.error('发送通知失败:', notificationError);
        }
      }
      
      return DEFAULT_CITY;
    }
}
