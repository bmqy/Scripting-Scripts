// 网络请求和数据获取模块

import { CITY_WEEKEND_RULES, WEEK_DAYS } from './city'

/**
 * 将日期字符串转换为对应的星期几文本
 * @param dateString 日期字符串，格式为YYYY-MM-DD
 * @returns 星期几文本，如'周一'、'周二'等
 */
function getWeekDayText(dateString: string): string {
  const date = new Date(dateString);
  const dayIndex = date.getDay(); // 0-周日, 1-周一, ..., 6-周六
  
  // 根据JavaScript的getDay()返回值映射到WEEK_DAYS数组中的索引
  if (dayIndex === 0) return WEEK_DAYS[6]; // 周日对应WEEK_DAYS[6]
  return WEEK_DAYS[dayIndex - 1]; // 周一到周六对应WEEK_DAYS[0]到WEEK_DAYS[5]
}

/**
 * 缓存键前缀
 */
export const CACHE_KEY_PREFIX = 'limitNumbers_';

/**
 * 缓存数据结构
 */
export interface CacheData {
  todayData: string;          // 当天限号信息
  weeklyData: Record<string, string>; // 一周限号信息
  timestamp: number;      // 缓存时间戳
  date: string;           // 缓存日期（YYYY-MM-DD格式）
}

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
 * @returns 包含当天和一周限号信息的对象
 */
export async function fetchLimitNumbersFromNetwork(city: string): Promise<{todayData: string, weeklyData: Record<string, string>}> {
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
          response = await Context.fetch(searchUrl);
        
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
            response = await Context.fetch(alternativeUrl);
            text = await response.text();
            console.log(`备用URL 1获取到HTML内容，长度: ${text.length}字符`);
          } else if (retries === 2) {
            const alternativeUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(`${city}限行`)}&rn=10`;
            console.log(`使用备用URL 2: ${alternativeUrl}`);
            response = await Context.fetch(alternativeUrl);
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
    
    // 获取当前日期对象
    const currentDate = new Date();
    const todayIndex = currentDate.getDay(); // 0-6, 0表示星期日
    
    // 映射Date.getDay()的结果到WEEK_DAYS数组的索引
    // Date.getDay(): 0=星期日, 1=星期一, ..., 6=星期六
    // WEEK_DAYS数组索引: 0=周一, 1=周二, ..., 6=周日
    let weekDayIndex;
    if (todayIndex === 0) { // 星期日
      weekDayIndex = 6;
    } else if (todayIndex === 6) { // 星期六
      weekDayIndex = 5;
    } else { // 周一到周五
      weekDayIndex = todayIndex - 1;
    }
    
    const todayWeekDay = WEEK_DAYS[weekDayIndex];
    
    // 获取格式化的日期字符串
    const formattedDate = currentDate.toLocaleDateString();
    
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
    // 优化：优先匹配完整的"X和X"格式
    const numberPatterns = [
      // 优先匹配包含星期几的完整限号格式
      new RegExp(`今日\s*${todayWeekDay}\s*限行尾号[:：]?\s*(\d+和\d+)`, 'g'),
      new RegExp(`今日\s*${todayWeekDay}\s*限号[:：]?\s*(\d+和\d+)`, 'g'),
      new RegExp(`${todayWeekDay}\s*限行尾号[:：]?\s*(\d+和\d+)`, 'g'),
      new RegExp(`${todayWeekDay}\s*限号[:：]?\s*(\d+和\d+)`, 'g'),
      
      // 通用的"X和X"格式匹配
      /限[行号][：:]?\s*(\d+和\d+)/g,
      /尾号\s*(\d+和\d+)/g,
      /(\d+和\d+)\s*限行/g,
      /(\d+和\d+)\s*尾号/g,
      /([^\d])(\d+和\d+)([^\d])/g,
      /(\d+和\d+)/g,
      
      // 百度特有格式
      /op_limited_num\">([\d和]+)<\/div>/g,
      
      // 其他可能的格式
      /限行\d+和\d+号/g,
      /尾号限行\d+和\d+/g,
      /限行：?\d+和\d+/g,
      /限号：?\d+和\d+/g,
      /\d+和\d+号限行/g,
      /限\d+和\d+/g,
      /[为是]\d+和\d+/g,
      
      // 单数字格式（作为备选）
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
    console.log(`搜索日期: ${formattedDate}, 星期${todayWeekDay}`);
    
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
      
      // 直接返回结果对象，确保格式一致
      if (timeInfo) {
        limitNumbers = `${limitNumbers} (工作日${timeInfo})`;
      }
      
      // 添加提示信息，说明这是基于普遍规则的判断，实际政策可能有变化
      console.log(`提示：本结果基于${city}的普遍限行规则，如有临时调整请以官方发布为准`);
      
      // 确保返回格式一致，包含todayData和weeklyData
      return {
        todayData: limitNumbers,
        weeklyData: {}
      };
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

    // 2. 增强处理"不限行"的情况
    // 专门搜索包含"不限行"或"不限"的文本
    const noLimitPatterns = [
      new RegExp(`今日\s*${todayWeekDay}\s*(?:限行|限号)(?:尾号)?[:：]?\s*(不限行|不限)`),
      new RegExp(`今日\s*(不限行|不限)`),
      new RegExp(`${todayWeekDay}\s*(不限行|不限)`),
      new RegExp(`${city}\s*今日\s*(不限行|不限)`),
      new RegExp(`明日限行尾号\(${WEEK_DAYS[(todayIndex + 1) % 7]}\)[：:]*\s*(不限行|不限)`),
      // 新增：针对节假日不限行的特殊检测模式
      new RegExp(`${city}\s*${todayWeekDay}\s*不限行?`),
      new RegExp(`${todayWeekDay}\s*[:：]?\s*不限行?`),
      new RegExp(`${todayWeekDay}\s+不限`),
      new RegExp(`本周${todayWeekDay}\s+不限行?`),
      // 新增：特殊处理北京节假日不限行的情况
      new RegExp(`(?:节假日|法定节假日)\s*除外`),
      new RegExp(`(?:节假日|法定节假日)\s*不限行`)
    ];
    
    console.log(`
===== 尝试检测"不限行"情况 =====`);
    for (let i = 0; i < noLimitPatterns.length; i++) {
      const noLimitPattern = noLimitPatterns[i];
      console.log(`✓ 尝试不限行模式${i+1}/${noLimitPatterns.length}：${noLimitPattern}`);
      const noLimitMatch = text.match(noLimitPattern);
      if (noLimitMatch && noLimitMatch.length > 1) {
        console.log(`✓ 不限行模式${i+1}匹配成功：${noLimitMatch[0].substring(0, 100)}...`);
        limitNumbers = noLimitMatch[1].trim();
        console.log(`✓ 检测到${todayWeekDay}不限行信息: ${limitNumbers}`);
        break;
      } else if (noLimitMatch && noLimitMatch.length === 1) {
        // 处理没有捕获组的匹配，比如节假日除外的情况
        console.log(`✓ 不限行模式${i+1}匹配成功（无捕获组）：${noLimitMatch[0].substring(0, 100)}...`);
        
        // 特殊处理：如果匹配到'节假日除外'或'法定节假日除外'，不要直接判定为不限行
        if (noLimitMatch[0].includes('节假日除外') || noLimitMatch[0].includes('法定节假日除外')) {
            console.log(`⚠️ 检测到'节假日除外'规则，不直接判定为不限行，继续尝试其他提取方法`);
            continue; // 继续尝试其他模式
        } else {
            limitNumbers = '不限行';
            console.log(`✓ 检测到${todayWeekDay}不限行信息: ${limitNumbers}`);
            break;
        }
      } else {
        console.log(`✗ 不限行模式${i+1}未匹配到任何内容`);
      }
    }
    
    // 先尝试提取具体数字
    let hasFound = false;
    
    // 3. 如果百度特有格式没有成功提取，尝试使用通用的正则匹配提取
    // 但如果已经检测到不限行信息，则不再尝试其他提取方法
    if ((limitNumbers === '未找到限号信息' || !limitNumbers) && limitNumbers !== '不限行') {
      console.log(`
===== 使用通用正则提取限号信息 =====`);
      
      // 优先：从一周限行规则中提取当天的（对北京等有固定轮换规则的城市）
      if (city === '北京' || city === '北京市') {
        console.log(`✓ 优先从一周限行规则中提取${todayWeekDay}的限行信息`);
        // 匹配一周限行规则格式 - 增强版，匹配更多格式
        const weeklyPatterns = [
          /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)/,
          /周一至周五限行尾号：([\d和、，,]+)/,
          /星期一至星期五限行尾号分别为([\d和、，,]+)/,
          /周一至周五限行机动车车牌尾号分别为([\d和、，,]+)/,
          /本周尾号限行[\s\S]*?周一([\d和]+).*?周二([\d和]+).*?周三([\d和]+).*?周四([\d和]+).*?周五([\d和]+)/,
          /周一([\d和]+).*?周二([\d和]+).*?周三([\d和]+).*?周四([\d和]+).*?周五([\d和]+)/
        ];
        
        for (let i = 0; i < weeklyPatterns.length; i++) {
          const weeklyPattern = weeklyPatterns[i];
          console.log(`✓ 尝试一周规则模式${i+1}/${weeklyPatterns.length}：${weeklyPattern}`);
          const weeklyMatch = text.match(weeklyPattern);
          if (weeklyMatch && weeklyMatch.length > 1) {
            // 输出匹配的详细信息
            console.log(`✓ 一周规则匹配成功：模式${i+1}=${weeklyPattern}, 完整匹配内容=${weeklyMatch[0].substring(0, 100)}...`);
            console.log(`✓ 提取的分组内容：${JSON.stringify(weeklyMatch.slice(1))}`);
            
            // 处理提取的一周限行规则文本
            let weekNumbersText = weeklyMatch[1].replace(/[。，,）（]/g, '').trim();
            // 确保文本格式正确
            if (weekNumbersText.endsWith('；') || weekNumbersText.endsWith('；')) {
              weekNumbersText = weekNumbersText.slice(0, -1);
            }
            
            console.log(`✓ 提取的一周规则文本：${weekNumbersText}`);
            
            // 特殊处理：如果是从完整的一周规则匹配中提取的
            if (weeklyMatch.length > 5) {
              // 匹配模式是提取周一到周五分别的限行号
              if (todayIndex >= 1 && todayIndex <= 5) {
                const dayIndex = todayIndex;
                // 检查每个工作日是否有不限行的情况
                const dayLimit = weeklyMatch[dayIndex].replace(/[。，,)（]/g, '').trim();
                console.log(`✓ 提取的${WEEK_DAYS[todayIndex]}限行信息：${dayLimit}`);
                if (dayLimit === '不限' || dayLimit === '不限行') {
                  limitNumbers = dayLimit;
                } else if (dayLimit.includes('和') || /^\d{1,2}$/.test(dayLimit)) {
                  limitNumbers = dayLimit;
                }
                console.log(`✓ 从完整一周规则中提取${WEEK_DAYS[todayIndex]}限行数字: ${limitNumbers}`);
                hasFound = true;
                break;
              }
            }
            
            // 分割限行尾号信息
            const weekNumbers = weekNumbersText.split(/[、，,\s]+/).filter(item => item && (item.includes('和') || item.length >= 2 || item.includes('不限')));
            console.log(`✓ 分割后的一周限行信息：${JSON.stringify(weekNumbers)}`);
            
            if (weekNumbers.length >= 5 && todayIndex >= 1 && todayIndex <= 5) {
              // 周一到周五对应索引0-4
              limitNumbers = weekNumbers[todayIndex - 1];
              // 确保是完整的"X和X"格式或"不限行"格式
              if (limitNumbers.includes('和') || limitNumbers.includes('不限')) {
                console.log(`✓ 从一周规则中提取${todayWeekDay}限行数字: ${limitNumbers}`);
                hasFound = true;
                break;
              }
            }
          } else {
            console.log(`✗ 模式${i+1}未匹配到任何内容`);
          }
          if (hasFound) break;
        }
      }
      
      // 第二优先级：从包含今日的完整句子中提取
      if (!hasFound) {
        console.log(`✓ 尝试从包含今日的完整句子中提取`);
        // 使用更精确的模式匹配完整的"X和X"格式
        const todayFullSentencePattern = new RegExp(`今日\s*${todayWeekDay}\s*(?:限行|限号)(?:尾号)?[:：]?\s*(\d+和\d+|不限行|不限)`);
        console.log(`✓ 使用模式：${todayFullSentencePattern}`);
        const fullSentenceMatch = text.match(todayFullSentencePattern);
        if (fullSentenceMatch && fullSentenceMatch.length > 1) {
          console.log(`✓ 完整句子匹配成功：${fullSentenceMatch[0].substring(0, 100)}...`);
          limitNumbers = fullSentenceMatch[1].trim();
          console.log(`✓ 从完整句子中提取限行数字: ${limitNumbers}`);
          hasFound = true;
        } else {
          console.log(`✗ 未匹配到包含今日的完整句子`);
        }
      }
      
      // 第三优先级：尝试使用现有的数字提取模式，但优先选择包含"和"的完整匹配
      if (!hasFound) {
        console.log(`✓ 尝试使用数字提取模式`);
        let bestMatch = '';
        let bestMatchPattern = null;
        let bestMatchSource = '';
        
        for (let i = 0; i < numberPatterns.length; i++) {
          const numberPattern = numberPatterns[i];
          console.log(`✓ 尝试数字模式${i+1}/${numberPatterns.length}：${numberPattern}`);
          const numberMatches = text.match(numberPattern);
          
          if (numberMatches && numberMatches.length > 0) {
            console.log(`✓ 数字模式${i+1}匹配到${numberMatches.length}个结果`);
            
            for (const match of numberMatches) {
              const numberPart = match.replace(/[^\d和、]/g, '').trim();
              console.log(`  - 匹配项: "${match}", 提取的数字部分: "${numberPart}"`);
              
              // 优先选择包含"和"的完整匹配
              if (numberPart && numberPart.includes('和') && numberPart.length <= 10) {
                bestMatch = numberPart;
                bestMatchPattern = numberPattern;
                bestMatchSource = match;
                console.log(`  ✓ 找到更优匹配：${numberPart}`);
                break;
              } else if (numberPart && numberPart.length > 0 && numberPart.length <= 10 && !bestMatch) {
                bestMatch = numberPart; // 作为备选
                bestMatchPattern = numberPattern;
                bestMatchSource = match;
                console.log(`  ✓ 找到备选匹配：${numberPart}`);
              }
            }
            
            if (bestMatch) {
              console.log(`✓ 已找到最佳匹配，提前退出`);
              break;
            }
          } else {
            console.log(`✗ 数字模式${i+1}未匹配到任何内容`);
          }
        }
        
        if (bestMatch) {
          limitNumbers = bestMatch;
          console.log(`✓ 从匹配中提取限行数字: ${limitNumbers} (模式: ${bestMatchPattern}, 原始匹配: "${bestMatchSource}")`);
          hasFound = true;
        } else {
          console.log(`✗ 所有数字模式均未找到匹配`);
        }
      }
      
      // 如果没有找到具体数字，再检查是否有单双号限行
      if (!hasFound) {
        console.log(`✓ 尝试检测单双号限行`);
        for (let i = 0; i < oddEvenPatterns.length; i++) {
          const oddEvenPattern = oddEvenPatterns[i];
          console.log(`✓ 尝试单双号模式${i+1}/${oddEvenPatterns.length}：${oddEvenPattern}`);
          const oddEvenMatches = text.match(oddEvenPattern);
          if (oddEvenMatches && oddEvenMatches.length > 0) {
            console.log(`✓ 单双号模式${i+1}匹配成功：${oddEvenMatches[0]}`);
            limitNumbers = oddEvenMatches[0];
            console.log(`✓ 检测到单双号限行: ${limitNumbers}`);
            hasFound = true;
            break;
          } else {
            console.log(`✗ 单双号模式${i+1}未匹配到任何内容`);
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
        new RegExp(`${todayWeekDay}\s*限行尾号[:：]?\s*(\d+(?:和\d+)*|不限行|不限)`),
        new RegExp(`${todayWeekDay}\s*限号[:：]?\s*(\d+(?:和\d+)*|不限行|不限)`),
        new RegExp(`今日\s*限行尾号[:：]?\s*(\d+(?:和\d+)*|不限行|不限)`),
        new RegExp(`今日\s*限号[:：]?\s*(\d+(?:和\d+)*|不限行|不限)`),
        new RegExp(`${city}\s*${todayWeekDay}\s*限行[:：]?\s*(\d+(?:和\d+)*|不限行|不限)`),
      ];
      
      for (let i = 0; i < todayPatterns.length; i++) {
        const pattern = todayPatterns[i];
        console.log(`✓ 尝试常见格式模式${i+1}/${todayPatterns.length}：${pattern}`);
        const match = text.match(pattern);
        if (match && match.length > 1) {
          console.log(`✓ 常见格式模式${i+1}匹配成功：${match[0].substring(0, 100)}...`);
          limitNumbers = match[1].trim();
          console.log(`✓ 从文本模式匹配中提取限行数字: ${limitNumbers}`);
          break;
        } else {
          console.log(`✗ 常见格式模式${i+1}未匹配到任何内容`);
        }
      }
    }
    
    // 如果所有提取方法都失败，返回明确的失败信息
    if (limitNumbers === '未找到限号信息' || !limitNumbers) {
      console.log(`
===== 所有提取方法失败，无法从百度搜索结果中获取限号信息 =====`);
      console.log(`✗ 提取失败原因分析：可能百度页面格式已更改或未包含明确的限号信息`);
      console.log(`✗ 建议检查搜索URL和提取模式是否需要更新`);
      limitNumbers = '获取限号信息失败';
    }
    
    // 输出最终结果分析
    console.log(`
===== 限号信息提取分析总结 =====`);
    console.log(`✓ 提取方法链：${hasFound ? '成功' : '失败'}`);
    console.log(`✓ 最终提取结果：${limitNumbers}`);
    console.log(`✓ 提取日期：${new Date().toLocaleDateString()}`);
    console.log(`✓ 搜索城市：${city}`);
    console.log(`✓ 星期几：${todayWeekDay}`);
    
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
    
    // 缓存结果 - 统一优化版
    // 获取现有缓存
    let cacheData: CacheData | null = null;
    const cacheKey = `${CACHE_KEY_PREFIX}${city}`;
    const todayDate = new Date().toISOString().split('T')[0]; // 预先计算今天的日期
    
    try {
      cacheData = Storage.get<CacheData>(cacheKey);
      // 验证缓存日期是否有效（是否是今天）
      if (cacheData && cacheData.date !== todayDate) {
        // 不是今天的数据，保留weeklyData但重置其他字段
        console.log(`检测到缓存日期为${cacheData.date}，当前日期为${todayDate}，将重置为今天的数据`);
        // 保留weeklyData但确保日期是今天
        const preservedWeeklyData = cacheData.weeklyData || {};
        cacheData = { weeklyData: preservedWeeklyData } as CacheData;
      }
    } catch (e) {
      console.error('获取缓存数据失败:', e);
      cacheData = null;
    }
    
    // 准备新的缓存数据，确保日期总是今天
    const newCacheData: CacheData = {
      todayData: finalResult, // 初始设置为网络提取结果
      weeklyData: {},
      timestamp: Date.now(),
      date: todayDate // 使用预先计算的今天日期
    };
    
    // 如果有现有缓存，保留其中的weeklyData（如果存在）
    if (cacheData && Object.keys(cacheData.weeklyData).length > 0) {
      newCacheData.weeklyData = cacheData.weeklyData;
      console.log(`保留了缓存中已有的一周限行信息`);
    }
    
    // 统一尝试获取一周限行信息，无论是否有缓存
    try {
      const weeklyInfo = await fetchWeeklyLimitNumbersFromNetwork(city);
      if (Object.keys(weeklyInfo).length > 0) {
        newCacheData.weeklyData = weeklyInfo;
        console.log(`成功获取并更新了一周限行信息`);
        
        // 优先使用weeklyData中今天的数据更新todayData，确保数据一致性
        const todayWeekDay = getWeekDayText(todayDate);
        if (weeklyInfo[todayWeekDay] && weeklyInfo[todayWeekDay] !== '不限行') {
          console.log(`优先使用weeklyData中今天(${todayWeekDay})的数据更新todayData`);
          newCacheData.todayData = weeklyInfo[todayWeekDay];
          // 如果有时间信息，也需要加上
          if (timeInfo && newCacheData.todayData !== '不限行') {
            newCacheData.todayData = `${newCacheData.todayData} (${timeInfo})`;
          }
        }
      } else if (Object.keys(newCacheData.weeklyData).length === 0) {
        console.log(`未能获取一周限行信息，缓存中将保留空对象`);
      }
    } catch (e) {
      console.error('获取一周限行信息时出错，将使用现有缓存（如果有）:', e);
    }
    
    // 统一保存缓存数据，直接存储JSON对象，不使用字符串转换
    Storage.set<CacheData>(cacheKey, newCacheData);
    
    // 根据是否有旧缓存来输出不同的日志信息
    if (cacheData) {
      console.log(`已更新${city}缓存中的限号信息（当天和一周数据）`);
    } else {
      console.log(`已创建${city}新的限号信息缓存（当天和一周数据）`);
    }
    
    console.log(`最终提取结果: ${finalResult}`);
    
    // 返回包含当天和一周限行信息的对象
    return {
      todayData: newCacheData.todayData, // 返回更新后的数据，确保与缓存一致
      weeklyData: newCacheData.weeklyData
    };
  } catch (e) {
    console.error('获取限号信息失败:', e);
    return {
      todayData: `获取${city}限号信息失败: ${e instanceof Error ? e.message : '未知错误'}`,
      weeklyData: {}
    };
  }
}

/**
 * 从网络获取指定城市的一周限行信息 - 通用增强版
 * @param city 城市名称
 * @returns 一周限行信息对象
 */
export async function fetchWeeklyLimitNumbersFromNetwork(city: string): Promise<Record<string, string>> {
  try {
    console.log(`===== 开始从网络获取${city}一周限号信息 =====`);
    
    // 首先尝试获取当天的限号信息，这样可以重用现有的请求和内容处理逻辑
    const searchUrl = buildSearchUrl(city);
    let response = await Context.fetch(searchUrl);
    let text = await response.text();
    
    // 构建一周限行信息对象
    const weeklyLimitInfo: Record<string, string> = {};
    
    // 通用一周限行规则提取模式（适用于所有城市）
    let hasFoundWeeklyPattern = false;
    
    // 通用一周限行规则提取模式（适用于大多数城市）
    const weeklyPatterns = [
      // 匹配 "星期一至星期五限行机动车车牌尾号分别为：4和9、5和0、1和6、2和7、3和8" 格式
      /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)(?:[。）]|$)/,
      // 匹配 "周一至周五限行尾号：4和9、5和0、1和6、2和7、3和8" 格式
      /周一至周五限行尾号：([\d和、，,]+)/,
      // 匹配 "尾号限行规则：周一 4和9，周二 5和0，周三 1和6，周四 2和7，周五 3和8" 格式
      /尾号限行规则：([\d和、，,\s一二三四五]+)/,
      // 匹配 "周一限行尾号:4和9 周二限行尾号:5和0 周三限行尾号:1和6 周四限行尾号:2和7 周五限行尾号:3和8" 格式
      /周一限行尾号[:：](\d+和\d+)\s*周二限行尾号[:：](\d+和\d+)\s*周三限行尾号[:：](\d+和\d+)\s*周四限行尾号[:：](\d+和\d+)\s*周五限行尾号[:：](\d+和\d+)/,
      // 增强格式：匹配 "星期一至星期五限行机动车车牌尾号分别为：4和9、5和0、1和6、2和7、3和8（机动车车牌尾号为英文字母的按0号管理）" 格式
      /星期一至星期五限行机动车车牌尾号分别为：([\d和、，,]+)（/,
      // 增强格式：匹配 "周一限行尾号:4和9,周二限行尾号:5和0,周三限行尾号:1和6,周四限行尾号:2和7,周五限行尾号:3和8" 格式
      /周一限行尾号[:：](\d+和\d+)[,，]周二限行尾号[:：](\d+和\d+)[,，]周三限行尾号[:：](\d+和\d+)[,，]周四限行尾号[:：](\d+和\d+)[,，]周五限行尾号[:：](\d+和\d+)/
    ];
    
    for (const pattern of weeklyPatterns) {
      const match = pattern.exec(text);
      if (match && match.length > 0) {
        console.log(`✓ 检测到一周限行规则模式: ${match[0].substring(0, 50)}...`);
        
        // 提取具体的限行尾号信息
        if (match.length >= 6) {
          // 处理有明确分组的格式
          weeklyLimitInfo['周一'] = match[1];
          weeklyLimitInfo['周二'] = match[2];
          weeklyLimitInfo['周三'] = match[3];
          weeklyLimitInfo['周四'] = match[4];
          weeklyLimitInfo['周五'] = match[5];
        } else {
          // 处理其他格式
          const tailNumbersText = match[1].replace(/[。，,)（]/g, '').trim();
          // 特殊处理：如果文本中包含完整的一周描述
          if (tailNumbersText.includes('周一') || tailNumbersText.includes('星期二')) {
            // 尝试直接提取每个工作日的限行信息
            const weekdayPatterns = {
              '周一': /周一[:：]?\s*([\d和]+)/,
              '周二': /周二[:：]?\s*([\d和]+)/,
              '周三': /周三[:：]?\s*([\d和]+)/,
              '周四': /周四[:：]?\s*([\d和]+)/,
              '周五': /周五[:：]?\s*([\d和]+)/
            };
            
            for (const [day, pattern] of Object.entries(weekdayPatterns)) {
              const dayMatch = tailNumbersText.match(pattern);
              if (dayMatch && dayMatch.length > 1) {
                weeklyLimitInfo[day] = dayMatch[1].trim();
              }
            }
          } else {
            // 标准的逗号/顿号分隔格式
          const tailNumbersArray = tailNumbersText.split(/[、，,\s]+/).filter(item => item && (item.includes('和') || item.length >= 2));
          
          if (tailNumbersArray.length >= 5) {
            weeklyLimitInfo['周一'] = tailNumbersArray[0];
            weeklyLimitInfo['周二'] = tailNumbersArray[1];
            weeklyLimitInfo['周三'] = tailNumbersArray[2];
            weeklyLimitInfo['周四'] = tailNumbersArray[3];
            weeklyLimitInfo['周五'] = tailNumbersArray[4];
          }
          // 特殊情况：如果是整个星期的描述，需要从文本中提取真正的尾号信息
          else if (tailNumbersText.includes('分别为：')) {
            const startIndex = tailNumbersText.indexOf('分别为：') + 4;
            const cleanText = tailNumbersText.substring(startIndex).replace(/[。，,)（]/g, '').trim();
            const cleanNumbersArray = cleanText.split(/[、，,\s]+/).filter(item => item && (item.includes('和') || item.length >= 2));
            
            if (cleanNumbersArray.length >= 5) {
              weeklyLimitInfo['周一'] = cleanNumbersArray[0];
              weeklyLimitInfo['周二'] = cleanNumbersArray[1];
              weeklyLimitInfo['周三'] = cleanNumbersArray[2];
              weeklyLimitInfo['周四'] = cleanNumbersArray[3];
              weeklyLimitInfo['周五'] = cleanNumbersArray[4];
            }
          }
          }
        }
        
        hasFoundWeeklyPattern = Object.keys(weeklyLimitInfo).length >= 5;
        if (hasFoundWeeklyPattern) {
          break;
        }
      }
    }
    
    // 如果通用提取失败，尝试使用直接提取法（适用于各种城市）
    if (!hasFoundWeeklyPattern) {
      try {
        // 先尝试找到"分别为："这个关键词
        let startIndex = text.indexOf('分别为：');
        
        if (startIndex > -1) {
          // 从"分别为："后面开始提取
          let tailInfo = text.substring(startIndex + 4);
          
          // 清理文本，移除括号和其他特殊字符
          tailInfo = tailInfo.replace(/[（）\(\)]/g, '').trim();
          
          // 找到可能的结束位置
          const possibleEndChars = ['.', '。', '；', ';', '，', ',', '\n'];
          let endIndex = tailInfo.length;
          
          for (const char of possibleEndChars) {
            const index = tailInfo.indexOf(char);
            if (index > 0 && index < endIndex) {
              endIndex = index;
            }
          }
          
          if (endIndex > 0) {
            tailInfo = tailInfo.substring(0, endIndex).trim();
          }
          
          // 分割成每天的限行信息
          const dailyLimits = tailInfo.split(/[、，,\s]+/).filter((item: string) => 
            item && (item.includes('和') || (item.length >= 2 && /^\d+[和\d]*$/.test(item)))
          );
          
          // 映射到对应的星期
          if (dailyLimits.length >= 5) {
            weeklyLimitInfo['周一'] = dailyLimits[0];
            weeklyLimitInfo['周二'] = dailyLimits[1];
            weeklyLimitInfo['周三'] = dailyLimits[2];
            weeklyLimitInfo['周四'] = dailyLimits[3];
            weeklyLimitInfo['周五'] = dailyLimits[4];
            hasFoundWeeklyPattern = true;
          }
        } else {
          // 如果没有找到"分别为："，尝试其他常见关键词
          const keywords = ['限行尾号', '尾号限行', '限号规则'];
          for (const keyword of keywords) {
            startIndex = text.indexOf(keyword);
            if (startIndex > -1) {
              // 从关键词后面开始提取一段合理长度的文本
              let tailInfo = text.substring(startIndex + keyword.length, startIndex + 200);
              
              // 清理文本
              tailInfo = tailInfo.replace(/[（）\(\)]/g, '').trim();
              
              // 尝试直接提取数字对
              const numberPairs = tailInfo.match(/\d+和\d+/g) || [];
              
              if (numberPairs.length >= 5) {
                weeklyLimitInfo['周一'] = numberPairs[0];
                weeklyLimitInfo['周二'] = numberPairs[1];
                weeklyLimitInfo['周三'] = numberPairs[2];
                weeklyLimitInfo['周四'] = numberPairs[3];
                weeklyLimitInfo['周五'] = numberPairs[4];
                hasFoundWeeklyPattern = true;
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log('直接提取法失败:', e.message);
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
    }
    
    // 如果没有提取到一周限行信息，返回空对象
    if (Object.keys(weeklyLimitInfo).length === 0) {
      console.log(`未从百度结果中提取到完整的一周限行信息`);
    }
    
    return weeklyLimitInfo;
  } catch (e) {
    console.error(`获取${city}一周限号信息失败:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}
