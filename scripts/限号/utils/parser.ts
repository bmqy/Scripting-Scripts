// 数据解析模块
import { log } from './common';
import { WEEK_DAYS } from './city';
import { ParseResult } from './types';

/**
 * 从HTML内容中提取限号信息
 * @param htmlContent HTML内容
 * @param city 城市名称
 * @returns 解析结果
 */
export function parseLimitInfo(htmlContent: string, city: string): ParseResult {
  const result: ParseResult = {
    todayData: '获取限号信息失败',
    weeklyData: {}
  };
  
  try {
    log(`开始解析${city}限号信息`);
    
    // 首先尝试提取当天限号信息
    const todayLimitInfo = extractTodayLimitInfo(htmlContent, city);
    if (todayLimitInfo) {
      result.todayData = todayLimitInfo;
    }
    
    // 尝试提取一周限号信息
    const weeklyLimitInfo = extractWeeklyLimitInfo(htmlContent);
    if (Object.keys(weeklyLimitInfo).length > 0) {
      result.weeklyData = weeklyLimitInfo;
    }
    
    // 如果没有提取到当天信息但有一周信息，尝试从一周信息中获取当天信息
    if (result.todayData === '获取限号信息失败' && Object.keys(result.weeklyData).length > 0) {
      const today = new Date().getDay();
      const todayIndex = today === 0 ? 6 : today - 1; // 转换为WEEK_DAYS索引
      const todayWeekDay = WEEK_DAYS[todayIndex];
      
      if (result.weeklyData[todayWeekDay]) {
        result.todayData = result.weeklyData[todayWeekDay];
      }
    }
    
    // 特殊情况处理：如果解析失败，尝试使用备用解析方法
    if (result.todayData === '获取限号信息失败' && Object.keys(result.weeklyData).length === 0) {
      log('使用备用解析方法');
      const alternativeResult = alternativeParseMethod(htmlContent);
      if (alternativeResult.todayData) {
        result.todayData = alternativeResult.todayData;
      }
      if (Object.keys(alternativeResult.weeklyData).length > 0) {
        result.weeklyData = alternativeResult.weeklyData;
      }
    }
    
    log(`解析结果 - 当天限号: ${result.todayData}`);
    log(`解析结果 - 一周限号: ${JSON.stringify(result.weeklyData)}`);
    
    return result;
  } catch (e) {
    log(`解析限号信息失败: ${e}`, 'error');
    return result;
  }
}

/**
 * 提取当天限号信息
 * @param htmlContent HTML内容
 * @param city 城市名称
 * @returns 当天限号信息
 */
function extractTodayLimitInfo(htmlContent: string, city: string): string {
  // 各种可能的限号信息格式的正则表达式
  const regexPatterns = [
    // 格式1: "限尾号1和6" 或 "限行尾号1和6"
    /[限尾号|限行尾号]([\d一二三四五六七八九])([和与])([\d一二三四五六七八九])/,
    // 格式2: "限行尾号1,6" 或 "限号1,6"
    /[限行尾号|限号]([\d一二三四五六七八九]),([\d一二三四五六七八九])/,
    // 格式3: "今日限1和6" 或 "今日限行1和6"
    /今日[限|限行]([\d一二三四五六七八九])([和与])([\d一二三四五六七八九])/,
    // 格式4: "尾号限行：1,6" 或 "尾号限行:1,6"
    /尾号限行[：:]([\d一二三四五六七八九]),([\d一二三四五六七八九])/,
    // 格式5: 不限行情况
    /不限行|限行取消/i,
    // 格式6: 单双号限行
    /[单双]号限行/i
  ];
  
  for (const pattern of regexPatterns) {
    const match = htmlContent.match(pattern);
    if (match) {
      if (match[0].includes('不限') || match[0].includes('取消')) {
        return '不限行';
      } else if (match[0].includes('单号')) {
        return '单号限行';
      } else if (match[0].includes('双号')) {
        return '双号限行';
      } else if (match.length >= 4) {
        // 处理两个数字的情况
        const num1 = convertChineseNumber(match[1]);
        const num2 = convertChineseNumber(match[3]);
        return `限行尾号${num1}和${num2}`;
      } else if (match.length >= 3) {
        // 处理逗号分隔的情况
        const num1 = convertChineseNumber(match[1]);
        const num2 = convertChineseNumber(match[2]);
        return `限行尾号${num1}和${num2}`;
      }
    }
  }
  
  return '';
}

/**
 * 提取一周限号信息
 * @param htmlContent HTML内容
 * @returns 一周限号信息对象
 */
function extractWeeklyLimitInfo(htmlContent: string): Record<string, string> {
  const weeklyInfo: Record<string, string> = {};
  
  // 尝试提取包含周一到周日的表格或文本
  for (const day of WEEK_DAYS) {
    // 查找每个星期几对应的限号信息
    const dayPattern = new RegExp(`${day}[：:，,\s]*(不限行|单双号限行|\d[和与]\d|\d,\d)`, 'i');
    const match = htmlContent.match(dayPattern);
    
    if (match && match[1]) {
      let limitInfo = match[1];
      
      // 标准化限号信息格式
      if (limitInfo.includes('不限')) {
        weeklyInfo[day] = '不限行';
      } else if (limitInfo.includes('单双')) {
        weeklyInfo[day] = '单双号限行';
      } else {
        // 处理数字格式
        limitInfo = limitInfo.replace(/,/g, '和').replace(/与/g, '和');
        weeklyInfo[day] = `限行尾号${limitInfo}`;
      }
    }
  }
  
  return weeklyInfo;
}

/**
 * 备用解析方法
 * @param htmlContent HTML内容
 * @returns 解析结果
 */
function alternativeParseMethod(htmlContent: string): ParseResult {
  const result: ParseResult = {
    todayData: '',
    weeklyData: {}
  };
  
  // 尝试从script标签中提取数据
  const scriptRegex = /var\s+data\s*=\s*(\{[^}]+\})/;
  const scriptMatch = htmlContent.match(scriptRegex);
  
  if (scriptMatch && scriptMatch[1]) {
    try {
      // 尝试解析JSON数据
      const data = JSON.parse(scriptMatch[1]);
      // 这里需要根据实际的JSON结构进行处理
      // 由于不知道具体结构，这里只是示例
      log('从script标签中提取到JSON数据');
    } catch (e) {
      log('解析script标签中的JSON数据失败', 'error');
    }
  }
  
  // 尝试直接查找数字组合
  const numberRegex = /([\d一二三四五六七八九])([和与,])([\d一二三四五六七八九])/;
  const numberMatch = htmlContent.match(numberRegex);
  
  if (numberMatch) {
    const num1 = convertChineseNumber(numberMatch[1]);
    const num2 = convertChineseNumber(numberMatch[3]);
    result.todayData = `限行尾号${num1}和${num2}`;
  }
  
  return result;
}

/**
 * 将中文数字转换为阿拉伯数字
 * @param num 中文数字或阿拉伯数字
 * @returns 阿拉伯数字字符串
 */
function convertChineseNumber(num: string): string {
  const chineseNumbers: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9'
  };
  
  return chineseNumbers[num] || num;
}