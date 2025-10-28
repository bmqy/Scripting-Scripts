// 限号助手小组件 - 主文件
import { Circle, HStack, Image, RoundedRectangle, Spacer, Text, VStack, Widget, ZStack } from "scripting"
// 导入拆分出去的模块
import { getCurrentTime, getShortLimitInfo } from './utils/base'
import { getLimitNumbers, getWeeklyLimitNumbers } from './utils/service'

// 声明全局API

// 开发测试配置 - 控制是否强制刷新城市信息
// 设置为true可以清除城市缓存并重新获取
const FORCE_REFRESH_CITY = false;

/**
 * 创建并显示Widget
 */
async function createWidget() {
  try {
    // 获取小组件类型
    const family = Widget.family;
    let widgetView;
    let currentTime = getCurrentTime();
    
    // 根据不同的小组件类型选择不同的数据获取方式
    if (family === "systemMedium") { // 桌面中号小组件
      // 中号小组件需要获取一周的限行信息
      const weeklyLimitData = await getWeeklyLimitNumbers({ forceRefreshCity: FORCE_REFRESH_CITY });
      widgetView = createMediumWidgetView(weeklyLimitData, currentTime);
    } else {
      // 其他类型小组件只需要获取当天的限行信息
      const limitData = await getLimitNumbers({ forceRefreshCity: FORCE_REFRESH_CITY });
      
      // 根据不同的小组件类型创建不同的视图
      if (family === "accessoryCircular") {
        // 锁屏圆形小组件视图
        widgetView = createCircularWidgetView(limitData);
      } else {
        // 标准小组件视图 - Kindle墨水屏风格，优化布局
        // 特点：顶部左侧标题、右上角城市、右下角时间、中间突出显示限号信息
        widgetView = createStandardWidgetView(limitData, currentTime);
      }
    }

    // 显示Widget
    // 设置重载策略，在每天午夜12点刷新
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    Widget.present(widgetView, {
      policy: "after",
      date: tomorrow
    });

  } catch (e) {
    console.error('Widget运行失败:', e);
    
    // 获取小组件类型
    const family = Widget.family;
    
    // 根据小组件类型显示不同的错误信息
      if (family === "accessoryCircular") {
      // 锁屏圆形小组件错误视图
      Widget.present(
        <ZStack>
          <Text font={24} foregroundStyle="#ff0000">错误</Text>
        </ZStack>,
        {
          policy: "after",
          date: new Date(Date.now() + 1000 * 60 * 5) // 5分钟后重试
        }
      );
    } else if (family === "systemMedium") { // 桌面中号小组件
      // 中号小组件错误视图
      Widget.present(
        <ZStack>
          <RoundedRectangle fill="#ffffff" cornerRadius={12} />
          <VStack alignment="center" spacing={8} padding={15}>
            <Text font="caption" foregroundStyle="#ff0000">获取数据失败</Text>
            <Text font="caption2" foregroundStyle="#999999">
              {e instanceof Error ? e.message : '未知错误'}
            </Text>
          </VStack>
        </ZStack>,
        {
          policy: "after",
          date: new Date(Date.now() + 1000 * 60 * 5) // 5分钟后重试
        }
      );
    } else {
      // 标准小组件错误视图 - Kindle墨水屏风格
      Widget.present(
        <ZStack>
          <RoundedRectangle fill="#f5f5f5" cornerRadius={12} />
          <VStack alignment="center" spacing={8} padding={20}>
            
            <Text font="title" foregroundStyle="#707070">发生错误</Text>
            <Text font="body" foregroundStyle="#000000">{e instanceof Error ? e.message : '未知错误'}</Text>
          </VStack>
        </ZStack>,
        {
          policy: "after",
          date: new Date(Date.now() + 1000 * 60 * 5) // 5分钟后重试
        }
      );
    }
  }
}

/**
 * 创建标准小组件视图
 */
function createStandardWidgetView(limitData: any, currentTime: string) {
  return (
    <ZStack>
      {/* 模拟Kindle墨水屏的米白色背景 */}
      <RoundedRectangle fill="#f5f5f5" cornerRadius={12} />
      
      {/* 主容器 - 增加内边距防止内容被裁剪 */}
      <VStack padding={15} spacing={8} frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
        {/* 顶部区域 - 简化标题显示，确保不出现省略号 */}
        <HStack spacing={8}>
          <Text font="caption" foregroundStyle="#707070" fontWeight="semibold">限号助手</Text>
          <Spacer />
          <Text font="caption" foregroundStyle="#909090">{limitData.city}</Text>
        </HStack>
        
        {/* 核心限号信息区域 - 居中显示，优化间距确保完整显示 */}
        <Spacer />
        <VStack alignment="center" padding={{ vertical: 0 }}>
          {/* 根据内容类型调整字体大小和样式 */}
          {/* 使用大字体并添加缩放属性，确保在小尺寸小组件上也能完整显示 */}
            {/* 将限号信息拆分为数字和逗号，使用不同的字体大小显示 */}
            <HStack alignment="bottom" spacing={8} frame={{ maxWidth: Infinity }}>
              {
                // 处理限号信息，分离数字和逗号
                (() => {
                  const limitText = getShortLimitInfo(limitData.limitInfo);
                  
                  // 检查是否包含逗号的双数字情况
                  if (limitText.includes(',')) {
                    const [firstNum, secondNum] = limitText.split(',');
                    return (
                      <>
                        <Text 
                          font={60} 
                          foregroundStyle="#000000" 
                          fontWeight="semibold"
                          minScaleFactor={0.7}
                        >
                          {firstNum}
                        </Text>
                        <Text 
                          font="caption2" 
                          foregroundStyle="#000000" 
                          fontWeight="bold"
                          padding={{ bottom: 5 }}
                        >
                          ,
                        </Text>
                        <Text 
                          font={60} 
                          foregroundStyle="#000000" 
                          fontWeight="semibold"
                          minScaleFactor={0.5}
                        >
                          {secondNum}
                        </Text>
                      </>
                    );
                  }
                  
                  // 单数字或其他情况，直接显示
                  return (
                    <Text 
                      font={60} 
                      foregroundStyle="#000000" 
                      fontWeight="bold" 
                      frame={{ maxWidth: Infinity }}
                      minScaleFactor={0.5}
                    >
                      {limitText}
                    </Text>
                  );
                })()
              }
            </HStack>
        </VStack>
        <Spacer />
        
        {/* 底部更新时间区域 - 右下角显示，只显示时间 */}
        <Spacer />
        <HStack>
          <Spacer />
          <Text font="caption" foregroundStyle="#909090">
            更新: {currentTime}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

/**
 * 创建中号小组件视图 - 按星期显示每一天的限行信息
 */
function createMediumWidgetView(weeklyLimitData: any, currentTime: string) {
  const { city, weeklyLimitInfo } = weeklyLimitData;
  
  // 计算当前日期范围 - 显示本周一到周日
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0-6, 0是周日
  
  // 计算本周一的日期
  const startDate = new Date(today);
  // 如果今天是周日，需要特殊处理（因为getDay()返回0）
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setDate(today.getDate() + daysToMonday);
  
  // 计算本周日的日期（在周一的基础上加6天）
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  // 格式化日期范围显示
  const dateRange = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日-${endDate.getMonth() + 1}月${endDate.getDate()}日`;
  
  return (
    <ZStack>
      {/* 背景 */}
      <RoundedRectangle fill="#ffffff" cornerRadius={12} />
      
      {/* 主容器 - 优化垂直布局，确保主体信息居中 */}
      <VStack spacing={6} padding={15} frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
        {/* 顶部标题和城市信息 */}
        <HStack spacing={8} frame={{ maxWidth: Infinity }}>
          <Text font="caption" foregroundStyle="#707070" fontWeight="bold">限号助手</Text>
          <Spacer />
          <Text font="caption" foregroundStyle="#909090">{city}</Text>
        </HStack>
        
        {/* 增加顶部间隔，使日期范围文本位置更靠下 */}
        <Spacer minLength={4} />
        
        {/* 日期范围 */}
        <Text font="caption" foregroundStyle="#909090" multilineTextAlignment="leading">
          本周尾号限行（{dateRange}）
        </Text>
        
        {/* 增加小间隔，让内容更好地分组 */}
        <Spacer minLength={2} />
        
        {/* 星期限行信息行 - 主体内容 */}
        <HStack spacing={5} frame={{ maxWidth: Infinity }}>
          {weeklyLimitInfo.map((dayInfo: any) => {
            // 处理限行信息文本
            let limitText = getShortLimitInfo(dayInfo.limitInfo);
            // 将逗号替换为"和"
            limitText = limitText.replace(',', '和');
            
            // 根据是否为今天设置不同的样式
            if (dayInfo.isToday) {
              return (
                <VStack alignment="center" spacing={2} frame={{ maxWidth: 'infinity' }}>
                  {/* 星期 */}
                  <Text font="caption2" foregroundStyle="#007AFF" fontWeight="bold">
                    {dayInfo.day}
                  </Text>
                  {/* 限行信息 */}
                  <Text font="caption2" foregroundStyle="#007AFF" fontWeight="bold">
                    {limitText === '不限行' ? '不限' : limitText}
                  </Text>
                </VStack>
              );
            } else {
              return (
                <VStack alignment="center" spacing={2} frame={{ maxWidth: 'infinity' }}>
                  {/* 星期 */}
                  <Text font="caption2" foregroundStyle="#333333">
                    {dayInfo.day}
                  </Text>
                  {/* 限行信息 */}
                  <Text font="caption2" foregroundStyle="#333333">
                    {limitText === '不限行' ? '不限' : limitText}
                  </Text>
                </VStack>
              );
            }})}
        </HStack>
        
        {/* 增加底部间隔，确保内容居中 */}
        <Spacer minLength={8} />
        
        {/* 底部更新时间 - 调整为靠右对齐 */}
        <HStack frame={{ maxWidth: Infinity }}>
          <Spacer />
          <Text font="caption2" foregroundStyle="#999999">
            更新: {currentTime}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

/**
 * 创建圆形小组件视图
 */
function createCircularWidgetView(limitData: any) {
  const limitText = getShortLimitInfo(limitData.limitInfo);
  
  return (
    <ZStack>
      {/* 圆形背景 - 使用白色增强对比度 */}
      <Circle fill="#ffffff" />
      
      {/* 中心显示限号信息 */}
      <VStack alignment="center" spacing={2}>
        {/* 汽车图标 - 使用黑色增强可见性 */}
        <Image systemName="car.fill" foregroundStyle="#000000" />
        
        {/* 根据内容调整字体大小 - 减小不限行文字大小，保持数字大小不变 */}
        <Text 
          font={limitText === '不限行' ? 18 : 24} 
          foregroundStyle="#000000" 
          fontWeight="bold"
          minScaleFactor={0.5}
        >
          {limitText === '不限行' ? '不限' : limitText}
        </Text>
      </VStack>
    </ZStack>
  );
}

// 启动Widget
createWidget();

