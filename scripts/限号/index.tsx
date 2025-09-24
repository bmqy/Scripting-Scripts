// 在主脚本中清除今日的限号缓存
// @ts-ignore - Storage在Scripting App环境中可用
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)