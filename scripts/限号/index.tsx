// 在主脚本中清除今日的限号缓存
import * as scripting from "scripting"
const { Storage } = scripting
Storage.remove(`limitNumbers_${new Date().toLocaleDateString()}`)