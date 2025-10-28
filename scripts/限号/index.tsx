// 在主脚本中清除今日的限号缓存
import { scriptable } from 'scripting'
const { Storage } = scriptable
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)