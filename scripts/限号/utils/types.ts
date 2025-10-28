// 类型定义文件

/**
 * 城市配置接口
 */
export interface CityConfig {
  /** 默认城市名称 */
  DEFAULT_CITY: string;
  /** 一周的星期名称数组 */
  WEEK_DAYS: string[];
  /** 周末是否限行配置 */
  WEEKEND_LIMIT_CONFIG: Record<string, boolean>;
}

/**
 * 获取城市选项接口
 */
export interface GetCityOptions {
  /** 是否强制刷新城市信息 */
  forceRefresh?: boolean;
}

/**
 * 位置信息接口
 */
export interface LocationInfo {
  /** 城市名称 */
  city: string;
  /** 位置信息 */
  location: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 解析结果接口
 */
export interface ParseResult {
  /** 当天限号信息 */
  todayData: string;
  /** 一周限号信息 */
  weeklyData: Record<string, string>;
}

/**
 * 缓存数据接口
 */
export interface CacheData {
  /** 当天限号信息 */
  todayData: string;
  /** 一周限号信息 */
  weeklyData: Record<string, string>;
  /** 缓存时间戳 */
  timestamp: number;
  /** 缓存日期（YYYY-MM-DD格式） */
  date: string;
}

/**
 * 日志级别类型
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * 常量配置接口
 */
export interface ConstantsConfig {
  /** 缓存键名配置 */
  CACHE_KEYS: {
    /** 缓存前缀 */
    PREFIX: string;
    /** 临时位置缓存键 */
    TEMP_LOCATION: string;
    /** 城市缓存键 */
    CITY: string;
  };
  /** 缓存有效期（毫秒） */
  CACHE_EXPIRY: number;
  /** 临时位置缓存有效期（毫秒） */
  TEMP_LOCATION_EXPIRY: number;
  /** 重试次数 */
  RETRY_COUNT: number;
  /** 请求超时时间（毫秒） */
  REQUEST_TIMEOUT: number;
  /** 日志级别 */
  LOG_LEVELS: Record<string, LogLevel>;
  /** 日志是否启用 */
  LOG_ENABLED: boolean;
}

/**
 * 每周限行信息项接口
 */
export interface WeeklyLimitItem {
  /** 星期几 */
  day: string;
  /** 星期索引 */
  dayIndex: number;
  /** 限行信息 */
  limitInfo: string;
  /** 是否是今天 */
  isToday: boolean;
}

/**
 * 每周限行信息响应接口
 */
export interface WeeklyLimitResponse {
  /** 城市名称 */
  city: string;
  /** 一周限行信息数组 */
  weeklyLimitInfo: WeeklyLimitItem[];
}

/**
 * 限号信息响应接口
 */
export interface LimitInfoResponse {
  /** 城市名称 */
  city: string;
  /** 限行信息 */
  limitInfo: string;
}