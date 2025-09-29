// 网络请求和数据获取模块

import { CITY_WEEKEND_RULES, WEEK_DAYS } from './city'

/**
 * 缓存键前缀
 */
export const CACHE_KEY_PREFIX = 'limitNumbers_';

/**
 * 构建搜索URL - 优化版（使用更可靠的搜索URL格式）
 * @param city 城市名称
 * @returns 搜索URL
 */
export function buildSearchUrl(city: string): string {
  const searchWord = encodeURIComponent(`${city}限号`);
  // 使用更可靠的搜索URL格式，避免重定向问题
  const url = `https://m.baidu.com/s?word=${searchWord}&from=1000953h`;
  console.log(`构建搜索URL: ${url}`);
  return url;
}

/**
 * 从网络获取指定城市的限号信息 - 增强版（支持重试和处理重定向）
 * @param city 城市名称
 * @returns 限号信息字符串
 */
export async function fetchLimitNumbersFromNetwork(city: string): Promise<string> {
  try {
    console.log(`===== 开始从网络获取${city}限号信息 =====`);
    const maxRetries = 2;
    let retries = 0;
    let text = '';
    let response;
    
    // 重试机制
    let searchUrl = buildSearchUrl(city); // 将searchUrl定义在循环外部
    while (retries < maxRetries) {
      console.log(`准备发送请求到: ${searchUrl} (尝试${retries + 1}/${maxRetries})`);
      
      try {
        response = await fetch(searchUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP错误: ${response.status}`);
        }
        
        text = await response.text();
        console.log(`获取到HTML内容，长度: ${text.length}字符`);
        
        // 检查是否是重定向页面 - 优化版：使用更严格的判断条件
        // 仅在内容很短且包含重定向标记时才认为是重定向页面
        const isRedirectPage = 
          text.length < 1000 && 
          (text.includes('location.replace') || 
           text.includes('meta http-equiv="refresh"'));
            
        if (isRedirectPage) {
          console.log('检测到重定向页面，尝试使用备用URL...');
          retries++;
          // 根据重试次数使用不同的备用搜索URL
          if (retries === 1) {
            const alternativeUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}限号`)}&tn=02003390_42_hao_pg`;
            console.log(`使用备用URL 1: ${alternativeUrl}`);
            response = await fetch(alternativeUrl);
            text = await response.text();
            console.log(`备用URL 1获取到HTML内容，长度: ${text.length}字符`);
          } else if (retries === 2) {
            const alternativeUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}限行`)}&rn=10`;
            console.log(`使用备用URL 2: ${alternativeUrl}`);
            response = await fetch(alternativeUrl);
            text = await response.text();
            console.log(`备用URL 2获取到HTML内容，长度: ${text.length}字符`);
          }
        } else {
          // 不是重定向页面，退出重试循环
          break;
        }
      } catch (e) {
        console.error(`请求失败: ${e instanceof Error ? e.message : '未知错误'}`);
        retries++;
        if (retries >= maxRetries) {
          throw e; // 达到最大重试次数，抛出异常
        }
      }
    }
    
    // 检查内容是否有效
    const isStillRedirect = 
      text.length < 1000 && 
      (text.includes('location.replace') || 
       text.includes('meta http-equiv="refresh"'));
        
    if (text.length < 100 || isStillRedirect) {
      console.log('警告: 获取到的内容极短或仍然是重定向页面');
      // 不再使用内置模拟数据，直接返回获取失败
      throw new Error('百度搜索结果无效或为重定向页面');
    }
    
    const todayIndex = new Date().getDay();
    const todayWeekDay = WEEK_DAYS[todayIndex];
    
    let limitNumbers = '未找到限号信息';
    let timeInfo = '';

    // 增强的搜索模式列表
    const searchPatterns = [
      `今日限行尾号(${todayWeekDay})`,
      `今日限行(${todayWeekDay})`,
      `${city}今日限行尾号`,
      `${city}限行`,
      `今日限行`,
      `${city}今日限号`,
      `尾号限行`,
      `限行尾号`,
      `${todayWeekDay}\s*限行尾号`,
      `${todayWeekDay}\s*限行`,
      `限行\d+和\d+`,
      `${city}\s*限行\d+和\d+`,
    ];

    // 数字提取正则模式 - 增强以匹配百度搜索结果的格式
    const numberPatterns = [
      /限行\d+号/g,
      /限行\d+(?:、\d+)*号/g,
      /尾号限行\d+(?:、\d+)*/g,
      /尾号\d+(?:、\d+)*限行/g,
      /限行：?\d+(?:、\d+)*/g,
      /限号：?\d+(?:、\d+)*/g,
      /尾号[：:](?:\d+、)*\d+/g,
      /\d+(?:、\d+)*号限行/g,
      /\d+(?:,\d+)*号限行/g,
      /限\d+(?:、\d+)*/g,
      /[为是]\d+(?:、\d+)*/g,
      /(\d+和\d+)/g,
      /([^\d])(\d+和\d+)([^\d])/g,
      /限[行号][：:]?\s*(\d+和\d+)/g,
      /尾号\s*(\d+和\d+)/g,
      /(\d+和\d+)\s*限行/g,
      /(\d+和\d+)\s*尾号/g,
      /op_limited_num\">([\d和]+)<\/div>/g,
    ];

    // 单双号提取模式
    const oddEvenPatterns = [
      /单号限行/g,
      /双号限行/g,
      /单双号限行/g,
      /单号\s*[和与]\s*双号/g,
      /限\s*单\s*双\s*号/g,
    ];

    // 记录搜索情况用于调试
    console.log(`===== 开始提取限号信息 =====`);
    console.log(`根据网络搜索结果，中国大部分城市在正常情况下周末不限行，但部分城市在特定时期可能会临时调整政策`);
    console.log(`注：实际限行政策可能会根据当地交通状况和环境治理需要进行调整，请以官方发布为准`);
    console.log(`搜索城市: ${city}`);
    console.log(`搜索日期: ${new Date().toLocaleDateString()}, 星期${todayWeekDay}`);
    
    // 特殊处理：周末限行规则
    // 根据网络搜索结果分析，中国大部分城市在正常情况下周末不限行
    // 但部分城市在特定时期可能会临时调整政策，如成都在重大活动期间
    const isWeekend = todayIndex === 0 || todayIndex === 6; // 0是周日，6是周六
    
    // 检查是否是周末且该城市周末不限行
    // 如果城市在规则表中，则使用其配置；否则默认周末不限行
    const isWeekendNoLimit = CITY_WEEKEND_RULES[city] !== undefined ? CITY_WEEKEND_RULES[city] : true;
    
    if (isWeekend && isWeekendNoLimit) {
      limitNumbers = '不限行';
      console.log(`✓ 检测到周末，根据${city}的规则，${WEEK_DAYS[todayIndex]}不限行`);
      
      // 但仍然尝试提取时间段信息作为参考
      const timePatterns = [
        /限行时间[:：]?\s*/g,
        /限行时段[:：]?\s*/g,
        /限行时段为[:：]?\s*/g,
        /限行时间段[:：]?\s*/g,
        /\d{1,2}:\d{1,2}\s*[-–]\s*\d{1,2}:\d{1,2}/g,
        /\d{1,2}\:\d{1,2}\s*至\s*\d{1,2}\:\d{1,2}/g,
        /\d{1,2}\s*点\s*至\s*\d{1,2}\s*点/g,
        /\d{1,2}\s*时\s*至\s*\d{1,2}\s*时/g,
      ];
      
      console.log(`\n===== 尝试提取时间段信息 =====`);
      
      for (const timePattern of timePatterns) {
        const timeMatches = text.match(timePattern);
        if (timeMatches && timeMatches.length > 0) {
          const timeStartPos = text.indexOf(timeMatches[0]);
          if (timeStartPos !== -1) {
            const timeContext = text.substring(timeStartPos, Math.min(text.length, timeStartPos + 100));
            const cleanTimeContext = timeContext.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            
            const specificTimeMatches = cleanTimeContext.match(/\d{1,2}(?::\d{1,2})?\s*[-–至到]\s*\d{1,2}(?::\d{1,2})?/);
            if (specificTimeMatches && specificTimeMatches.length > 0) {
              timeInfo = specificTimeMatches[0];
              console.log(`✓ 提取工作日限行时间段信息: "${timeInfo}"`);
              break;
            }
          }
        }
      }
      
      // 直接返回结果，跳过后续提取逻辑
      if (timeInfo) {
        limitNumbers = `${limitNumbers} (工作日${timeInfo})`;
      }
      
      // 添加提示信息，说明这是基于普遍规则的判断，实际政策可能有变化
      console.log(`提示：本结果基于${city}的普遍限行规则，如有临时调整请以官方发布为准`);
      
      return limitNumbers;
    }

    // 1. 使用简单的字符串查找方法提取百度特有格式信息
    try {
      // 查找op_limited_num的开始位置
      const numStartTag = 'class="op_limited_num">';
      const numStartPos = text.indexOf(numStartTag);
      if (numStartPos !== -1) {
        // 查找结束标签的位置
        const numEndTag = '</div>';
        const numEndPos = text.indexOf(numEndTag, numStartPos + numStartTag.length);
        if (numEndPos !== -1) {
          // 提取限行数字
          limitNumbers = text.substring(numStartPos + numStartTag.length, numEndPos).trim();
          console.log(`✓ 提取百度特有格式的限行数字: ${limitNumbers}`);
          
          // 确保这是今日的限行信息
          const context = text.substring(Math.max(0, numStartPos - 100), Math.min(text.length, numEndPos + 100));
          if (!(context.includes(`今日`) || context.includes(`today`) || context.includes(todayWeekDay))) {
            limitNumbers = '未找到限号信息'; // 如果不是今日信息，重置
          } else {
            // 尝试提取时间段
            const timeStartTag = 'class="op_limited_time">';
            const timeStartPos = text.indexOf(timeStartTag);
            if (timeStartPos !== -1) {
              const timeEndPos = text.indexOf(numEndTag, timeStartPos + timeStartTag.length);
              if (timeEndPos !== -1) {
                timeInfo = text.substring(timeStartPos + timeStartTag.length, timeEndPos).trim();
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('提取百度特有格式信息时出错:', e);
    }

    // 2. 如果百度特有格式没有成功提取，尝试使用通用的正则匹配提取
    if (limitNumbers === '未找到限号信息' || !limitNumbers) {
      console.log(`
===== 使用通用正则提取限号信息 =====`);
      
      // 先尝试提取具体数字
      let hasFound = false;
      
      // 新增：先尝试从包含今日的完整句子中提取
      const todayFullSentencePattern = new RegExp(`今日\s*${todayWeekDay}\s*(?:限行|限号)(?:尾号)?[:：]?\s*([\d和、]+)`);
      const fullSentenceMatch = text.match(todayFullSentencePattern);
      if (fullSentenceMatch && fullSentenceMatch.length > 1) {
        limitNumbers = fullSentenceMatch[1].trim();
        console.log(`✓ 从完整句子中提取限行数字: ${limitNumbers}`);
        hasFound = true;
      }
      
      // 尝试使用现有的数字提取模式
      if (!hasFound) {
        for (const numberPattern of numberPatterns) {
          const numberMatches = text.match(numberPattern);
          if (numberMatches && numberMatches.length > 0) {
            // 提取匹配中的数字部分
            for (const match of numberMatches) {
              // 放宽条件：即使不包含今日，也尝试提取
              // 从匹配中提取数字部分
              const numberPart = match.replace(/[^\d和、]/g, '').trim();
              if (numberPart && numberPart.length > 0 && numberPart.length <= 10) { // 限制长度防止提取过长文本
                limitNumbers = numberPart;
                console.log(`✓ 从匹配中提取限行数字: ${limitNumbers}`);
                hasFound = true;
                break;
              }
            }
            if (hasFound) break;
          }
        }
      }
      
      // 如果没有找到具体数字，再检查是否有单双号限行
      if (!hasFound) {
        for (const oddEvenPattern of oddEvenPatterns) {
          const oddEvenMatches = text.match(oddEvenPattern);
          if (oddEvenMatches && oddEvenMatches.length > 0) {
            limitNumbers = oddEvenMatches[0];
            console.log(`✓ 检测到单双号限行: ${limitNumbers}`);
            hasFound = true;
            break;
          }
        }
      }
      
      // 新增：如果还是没找到，尝试从一周限行规则中提取当天的
      if (!hasFound && (city === '北京' || city === '北京市')) {
        console.log(`✓ 尝试从一周限行规则中提取${todayWeekDay}的限行信息`);
        // 匹配一周限行规则格式
        const weeklyPattern = /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)/;
        const weeklyMatch = text.match(weeklyPattern);
        if (weeklyMatch && weeklyMatch.length > 1) {
          const weekNumbers = weeklyMatch[1].split(/[、，,\s]+/).filter(item => item.includes('和'));
          if (weekNumbers.length >= 5 && todayIndex >= 1 && todayIndex <= 5) {
            // 周一到周五对应索引0-4
            limitNumbers = weekNumbers[todayIndex - 1];
            console.log(`✓ 从一周规则中提取${todayWeekDay}限行数字: ${limitNumbers}`);
            hasFound = true;
          }
        }
      }
    }
    
    // 3. 尝试从其他常见格式中提取
    if (limitNumbers === '未找到限号信息' || !limitNumbers) {
      console.log(`
===== 尝试从常见文本格式中提取 =====`);
      
      // 搜索特定的文本模式
      const todayPatterns = [
        new RegExp(`${todayWeekDay}\s*限行尾号[:：]?\s*(\d+(?:和\d+)*)`),
        new RegExp(`${todayWeekDay}\s*限号[:：]?\s*(\d+(?:和\d+)*)`),
        new RegExp(`今日\s*限行尾号[:：]?\s*(\d+(?:和\d+)*)`),
        new RegExp(`今日\s*限号[:：]?\s*(\d+(?:和\d+)*)`),
        new RegExp(`${city}\s*${todayWeekDay}\s*限行[:：]?\s*(\d+(?:和\d+)*)`),
      ];
      
      for (const pattern of todayPatterns) {
        const match = text.match(pattern);
        if (match && match.length > 1) {
          limitNumbers = match[1].trim();
          console.log(`✓ 从文本模式匹配中提取限行数字: ${limitNumbers}`);
          break;
        }
      }
    }
    
    // 如果所有提取方法都失败，返回明确的失败信息
    if (limitNumbers === '未找到限号信息' || !limitNumbers) {
      console.log(`
===== 所有提取方法失败，无法从百度搜索结果中获取限号信息 =====`);
      limitNumbers = '获取限号信息失败';
    }
    
    // 5. 最后尝试从response中提取时间信息
    if (!timeInfo) {
      const timePatterns = [
        /限行时间[:：]?\s*(\d{1,2}:\d{1,2}\s*[-–至]\s*\d{1,2}:\d{1,2})/,
        /限行时段[:：]?\s*(\d{1,2}:\d{1,2}\s*[-–至]\s*\d{1,2}:\d{1,2})/,
        /\d{1,2}:\d{1,2}\s*[-–至]\s*\d{1,2}:\d{1,2}\s*限行/,
      ];
      
      for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match) {
          timeInfo = match[match.length > 1 ? 1 : 0].trim();
          console.log(`✓ 提取到限行时间: ${timeInfo}`);
          break;
        }
      }
    }
    
    // 组合最终结果
    let finalResult = limitNumbers;
    if (timeInfo && limitNumbers !== '不限行') {
      finalResult = `${limitNumbers} (${timeInfo})`;
    }
    
    // 缓存结果
    Storage.set<string>(`${CACHE_KEY_PREFIX}${city}_${new Date().toLocaleDateString()}`, finalResult);
    console.log(`最终提取结果: ${finalResult}`);
    
    return finalResult;
  } catch (e) {
    console.error('获取限号信息失败:', e);
    return `获取${city}限号信息失败: ${e instanceof Error ? e.message : '未知错误'}`;
  }
}

/**
 * 从网络获取指定城市的一周限行信息 - 增强版
 * @param city 城市名称
 * @returns 一周限行信息对象
 */
export async function fetchWeeklyLimitNumbersFromNetwork(city: string): Promise<Record<string, string>> {
  try {
    console.log(`===== 开始从网络获取${city}一周限号信息 =====`);
    
    // 首先尝试获取当天的限号信息，这样可以重用现有的请求和内容处理逻辑
    const searchUrl = buildSearchUrl(city);
    let response = await fetch(searchUrl);
    let text = await response.text();
    
    // 构建一周限行信息对象
    const weeklyLimitInfo: Record<string, string> = {};
    
    // 特殊处理：北京的一周限行信息提取
    if (city === '北京市' || city === '北京') {
      console.log(`✓ 开始提取${city}一周限行信息`);
      
      // 提取北京特有的一周限行轮换规则格式
      const weeklyPatterns = [
        // 匹配 "星期一至星期五限行机动车车牌尾号分别为：4和9、5和0、1和6、2和7、3和8。" 格式
        /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)。/g,
        // 匹配 "周一至周五限行尾号：4和9、5和0、1和6、2和7、3和8" 格式
        /周一至周五限行尾号：([\d和、，,]+)/g,
        // 匹配 "尾号限行规则：周一 4和9，周二 5和0，周三 1和6，周四 2和7，周五 3和8" 格式
        /尾号限行规则：([\d和、，,\s一二三四五]+)/g,
        // 匹配 "周一限行尾号:4和9 周二限行尾号:5和0 周三限行尾号:1和6 周四限行尾号:2和7 周五限行尾号:3和8" 格式
        /周一限行尾号[:：](\d+和\d+)\s*周二限行尾号[:：](\d+和\d+)\s*周三限行尾号[:：](\d+和\d+)\s*周四限行尾号[:：](\d+和\d+)\s*周五限行尾号[:：](\d+和\d+)/g,
        // 增强格式：匹配 "周一至周五限行机动车车牌尾号分别为：4和9、5和0、1和6、2和7、3和8（机动车车牌尾号为英文字母的按0号管理）" 格式
        /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)（/g,
        // 增强格式：匹配 "周一限行尾号:4和9,周二限行尾号:5和0,周三限行尾号:1和6,周四限行尾号:2和7,周五限行尾号:3和8" 格式
        /周一限行尾号[:：](\d+和\d+)[,，]周二限行尾号[:：](\d+和\d+)[,，]周三限行尾号[:：](\d+和\d+)[,，]周四限行尾号[:：](\d+和\d+)[,，]周五限行尾号[:：](\d+和\d+)/g
      ];
      
      let hasFoundWeeklyPattern = false;
      
      for (const pattern of weeklyPatterns) {
        const match = text.match(pattern);
        if (match && match.length > 0) {
          console.log(`✓ 检测到一周限行规则模式: ${match[0].substring(0, 50)}...`);
          
          // 提取具体的限行尾号信息
          if (match.length >= 6) {
            // 处理最后一种格式（有明确的分组）
            weeklyLimitInfo['周一'] = match[1];
            weeklyLimitInfo['周二'] = match[2];
            weeklyLimitInfo['周三'] = match[3];
            weeklyLimitInfo['周四'] = match[4];
            weeklyLimitInfo['周五'] = match[5];
          } else {
            // 处理其他格式
            const tailNumbersText = match[1];
            // 分割限行尾号信息
            const tailNumbersArray = tailNumbersText.split(/[、，,\s]+/).filter(item => item.includes('和'));
            
            if (tailNumbersArray.length >= 5) {
              weeklyLimitInfo['周一'] = tailNumbersArray[0];
              weeklyLimitInfo['周二'] = tailNumbersArray[1];
              weeklyLimitInfo['周三'] = tailNumbersArray[2];
              weeklyLimitInfo['周四'] = tailNumbersArray[3];
              weeklyLimitInfo['周五'] = tailNumbersArray[4];
            }
          }
          
          hasFoundWeeklyPattern = Object.keys(weeklyLimitInfo).length >= 5;
          if (hasFoundWeeklyPattern) {
            break;
          }
        }
      }
      
      // 如果找到了一周限行规则，设置周末不限行
      if (hasFoundWeeklyPattern) {
        weeklyLimitInfo['周六'] = '不限行';
        weeklyLimitInfo['周日'] = '不限行';
        
        // 输出从百度结果中提取的本周每天限行信息
        console.log(`\n===== 从百度结果提取的本周限行信息 =====`);
        WEEK_DAYS.forEach(day => {
          console.log(`${day}: ${weeklyLimitInfo[day] || '未找到'}`);
        });
        console.log(`==================================`);
        
        // 缓存一周限行信息
        Storage.set<string>(`${CACHE_KEY_PREFIX}${city}_weekly_${new Date().toLocaleDateString()}`, JSON.stringify(weeklyLimitInfo));
        console.log(`已缓存${city}一周限行信息`);
      }
    }
    
    // 如果没有提取到一周限行信息，返回空对象
    if (Object.keys(weeklyLimitInfo).length === 0) {
      console.log(`未从百度结果中提取到完整的一周限行信息`);
    }
    
    return weeklyLimitInfo;
  } catch (e) {
    console.error(`获取${city}一周限号信息失败:`, e);
    return {};
  }
}
