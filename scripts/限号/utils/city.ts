// 城市相关工具模块
import { Notification } from 'scripting';
import { Constants, withTimeout, log, getTodayDateString } from './common';
import { CityConfig as CityConfigType, GetCityOptions, LocationInfo } from './types';

/**
 * 默认城市，当无法获取位置时使用
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
};

/**
 * 城市相关配置
 */
export const CityConfig: CityConfigType = {
  DEFAULT_CITY,
  WEEK_DAYS,
  CITY_WEEKEND_RULES
};

/**
 * 获取用户所在城市
 * @param options 配置选项
 * @param options.forceRefresh 是否强制刷新，清除缓存重新获取城市信息
 * @returns 用户城市名称
 */
export async function getUserCity(options?: GetCityOptions): Promise<string> {
  try {
    const { forceRefresh = false } = options || {};
    
    const { TEMP_USER_CITY, TEMP_USER_CITY_TIMESTAMP, USER_CITY, CITY_CACHE_DATE } = Constants.CACHE_KEYS;
    
    // 检查是否有临时缓存（用于处理获取位置信息超时的情况）
    const cachedTempCity = Storage.get<string>(TEMP_USER_CITY);
    const cachedTempCityTimestamp = Storage.get<string>(TEMP_USER_CITY_TIMESTAMP);
    
    // 如果有临时缓存且未过期，并且不是强制刷新，则使用临时缓存
    if (!forceRefresh && cachedTempCity && cachedTempCityTimestamp) {
      const now = Date.now();
      const tempCacheAge = now - parseInt(cachedTempCityTimestamp, 10);
      if (tempCacheAge < Constants.TEMP_CACHE_EXPIRY_MS) {
        log(`从临时缓存获取城市信息: ${cachedTempCity}`);
        return cachedTempCity;
      }
    }
    
    // 检查是否需要每天重新获取一次
    const cachedCity = Storage.get<string>(USER_CITY);
    const cachedDate = Storage.get<string>(CITY_CACHE_DATE);
    const today = new Date().toDateString();
    
    // 如果不是强制刷新，并且缓存存在且日期是今天，则直接返回缓存的城市
    if (!forceRefresh && cachedCity && cachedDate && cachedDate === today) {
      log(`从缓存获取城市信息（今日已更新）: ${cachedCity}`);
      // 清除临时缓存，因为我们有了正式的缓存
      Storage.remove(TEMP_USER_CITY);
      Storage.remove(TEMP_USER_CITY_TIMESTAMP);
      return cachedCity;
    }
    
    // 强制刷新或缓存已过期，清除相关缓存
    Storage.remove(USER_CITY);
    Storage.remove(CITY_CACHE_DATE);
    Storage.remove(TEMP_USER_CITY);
    Storage.remove(TEMP_USER_CITY_TIMESTAMP);
    
    if (forceRefresh) {
      console.log('清除城市缓存，强制重新获取');
    } else if (cachedCity && cachedDate !== today) {
      console.log('城市缓存已过期（日期不匹配），重新获取');
    } else {
      console.log('首次运行或无有效缓存，尝试获取位置信息');
    }

    // 尝试获取用户位置
    // 设置超时，避免位置获取时间过长
    const locationInfo = await withTimeout(
      Location.requestCurrent(),
      Constants.REQUEST_TIMEOUT_MS,
      null
    );

    if (!locationInfo) {
      // 如果获取位置超时或失败，使用默认城市
      log(`获取位置超时或失败，使用默认城市: ${DEFAULT_CITY}`);
      // 保存临时缓存
      Storage.set(TEMP_USER_CITY, DEFAULT_CITY);
      Storage.set(TEMP_USER_CITY_TIMESTAMP, Date.now().toString());
      
      // 如果默认城市为空，发送通知提示用户
      if (!DEFAULT_CITY) {
        try {
          log('发送通知提示用户给予定位权限');
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
          log(`发送通知失败: ${notificationError}`, Constants.LOG_LEVELS.ERROR);
        }
      }
      
      return DEFAULT_CITY;
    }

    log(`成功获取位置: 纬度${locationInfo.latitude}, 经度${locationInfo.longitude}`);

    // 尝试根据位置信息获取城市名称
    // 设置超时，避免反向地理编码时间过长
    const placemarks = await withTimeout(
      Location.reverseGeocode({
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        locale: 'zh_CN'
      }),
      Constants.REQUEST_TIMEOUT_MS,
      []
    );

    if (!placemarks || placemarks.length === 0) {
      // 如果反向地理编码失败，使用默认城市
      log(`反向地理编码失败，使用默认城市: ${DEFAULT_CITY}`);
      // 保存临时缓存
      Storage.set(TEMP_USER_CITY, DEFAULT_CITY);
      Storage.set(TEMP_USER_CITY_TIMESTAMP, Date.now().toString());
      return DEFAULT_CITY;
    }

    // 从反向地理编码结果中提取城市名称
    const placemark = placemarks[0];
    log(`获取地址信息成功: ${JSON.stringify(placemark)}`);
    
    // 提取城市名称
    let city = placemark.locality || placemark.subAdministrativeArea || '';
    
    // 移除"市"、"特别行政区"等后缀
    if (city) {
      city = city.replace(/市$|特别行政区$|区$|省$/, '');
    }

    if (city) {
      log(`提取到城市: ${city}`);
      // 缓存城市信息和当前日期
      Storage.set(USER_CITY, city);
      Storage.set(CITY_CACHE_DATE, today);
      // 清除临时缓存
      Storage.remove(TEMP_USER_CITY);
      Storage.remove(TEMP_USER_CITY_TIMESTAMP);
      return city;
    }
    
    log(`无法从地址信息中提取城市，使用默认城市: ${DEFAULT_CITY}`);
      
    // 设置临时缓存，避免短时间内重复尝试获取位置信息
    Storage.set(TEMP_USER_CITY, DEFAULT_CITY);
    Storage.set(TEMP_USER_CITY_TIMESTAMP, Date.now().toString());
    
    return DEFAULT_CITY;
    } catch (e) {
      log(`获取城市信息失败: ${e}`, Constants.LOG_LEVELS.ERROR);
      
      // 如果默认城市为空，发送通知提示用户
      if (!DEFAULT_CITY) {
        try {
          log('发送通知提示用户给予定位权限');
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
          log(`发送通知失败: ${notificationError}`, Constants.LOG_LEVELS.ERROR);
        }
      }
      
      return DEFAULT_CITY;
  }
}
