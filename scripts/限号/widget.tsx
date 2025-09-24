// 限号助手小组件 - 主文件
import { HStack, RoundedRectangle, Spacer, Text, VStack, Widget, ZStack } from "scripting"

// 声明Storage以避免与DOM类型冲突
declare const Storage: any;

// 导入拆分出去的模块
import { getCurrentTime, getShortLimitInfo } from './utils/base'
import { getLimitNumbers } from './utils/service'

/**
 * 创建并显示Widget
 */
async function createWidget() {
  try {
    // 并行获取时间和限号信息，提高性能
    const [currentTime, limitData] = await Promise.all([
      Promise.resolve(getCurrentTime()),
      getLimitNumbers()
    ]);

    // 创建Widget界面 - Kindle墨水屏风格，优化布局
    // 特点：顶部左侧标题、右上角城市、右下角时间、中间突出显示限号信息
    const widgetView = (
      <ZStack>
        {/* 模拟Kindle墨水屏的米白色背景 */}
        <RoundedRectangle fill="#f5f5f5" cornerRadius={12} />
        
        {/* 主容器 - 增加内边距防止内容被裁剪 */}
        <VStack padding={15} spacing={8} frame={{ maxWidth: Infinity, maxHeight: Infinity }}>
          {/* 顶部区域 - 简化标题显示，确保不出现省略号 */}
          <HStack spacing={8}>
            <Text font="caption" foregroundStyle="#707070" fontWeight="bold">限号助手</Text>
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
                            fontWeight="bold"
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
                            fontWeight="bold"
                            minScaleFactor={0.7}
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
    
    // 显示错误信息 - 同样采用Kindle墨水屏风格
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

// 启动Widget
createWidget();

