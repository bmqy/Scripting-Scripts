// 城市相关工具模块
/**
 * 默认城市，当无法获取位置时使用
 * 现在默认为空，获取不到城市时会发送通知
 */
export const DEFAULT_CITY = '';

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
 * @param options 配置选项
 * @param options.forceRefresh 是否强制刷新，清除缓存重新获取城市信息
 * @returns 用户城市名称
 */
export async function getUserCity(options?: { forceRefresh?: boolean }) {
  try {
    const { forceRefresh = false } = options || {};
    
    // 如果不强制刷新，尝试从缓存获取城市信息
    if (!forceRefresh) {
      const cachedCity = Storage.get('userCity');
      if (cachedCity) {
        console.log('从缓存获取城市信息:', cachedCity);
        return cachedCity;
      }
    } else {
      // 强制刷新时，清除缓存
      Storage.remove('userCity');
      console.log('清除城市缓存，强制重新获取');
    }

    try {
      // 使用Scripting App的Location API获取当前位置
      console.log('尝试使用Location API获取当前位置...');
      
      // 设置位置精度
      await Location.setAccuracy('hundredMeters');
      
      // 请求获取当前位置
      const locationInfo = await Location.requestCurrent();
      
      if (locationInfo) {
        console.log('获取位置信息成功:', locationInfo);
        
        // 使用反向地理编码获取地址信息
        const placemarks = await Location.reverseGeocode({
          location: locationInfo,
          locale: 'zh_CN'
        });
        
        if (placemarks && placemarks.length > 0) {
          const placemark = placemarks[0];
          console.log('获取地址信息成功:', placemark);
          
          // 提取城市名称
          // 根据placemark的实际结构来提取城市名
          // 这里是一个简化的实现，实际应用中需要根据具体情况调整
          let city = extractCityFromPlacemark(placemark);
          
          if (city) {
            console.log('提取到城市:', city);
            // 缓存城市信息
            Storage.set('userCity', city);
            return city;
          }
        }
      }
    } catch (geocodeError) {
      console.log('获取地理位置信息失败:', geocodeError);
      console.log('尝试使用IP或其他方式获取城市...');
    }
    
    console.log('无法获取城市信息，使用默认城市:', DEFAULT_CITY);
      
      // 如果默认城市为空，发送通知提示用户
      if (!DEFAULT_CITY) {
        try {
          console.log('发送通知提示用户给予定位权限');
          // 使用Notification API发送通知
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
          });
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
          });
        } catch (notificationError) {
          console.error('发送通知失败:', notificationError);
        }
      }
      
      return DEFAULT_CITY;
    }
}

/**
 * 从Placemark中提取城市名称
 * @param placemark 地址信息对象
 * @returns 城市名称
 */
function extractCityFromPlacemark(placemark) {
  // 根据placemark的实际结构来提取城市名
  // 这里是一个简化的实现，实际应用中需要根据具体情况调整
  if (placemark.city) {
    return placemark.city;
  } else if (placemark.addressDictionary && placemark.addressDictionary.City) {
    return placemark.addressDictionary.City;
  } else if (placemark.locality) {
    return placemark.locality;
  } else if (placemark.name) {
    // 尝试从名称中提取城市信息
    // 这里是一个简单的正则匹配，可能需要根据实际情况调整
    const cityMatch = placemark.name.match(/[省市]\s*([^市]+市|[^省]+省)/);
    if (cityMatch && cityMatch[1]) {
      return cityMatch[1];
    }
  }
  return null;
}
