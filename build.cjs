const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 项目根目录
const rootDir = process.cwd();
// scripts目录
const scriptsDir = path.join(rootDir, 'scripts');
// dist目录
const distDir = path.join(rootDir, 'dist');
// 缓存文件，用于记录上次打包的哈希值
const cacheFile = path.join(rootDir, '.build-cache.json');

// 确保dist目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 读取缓存
let cache = {};
if (fs.existsSync(cacheFile)) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (error) {
    console.warn('Failed to read cache file, starting fresh:', error.message);
    cache = {};
  }
}

// 计算目录的哈希值
function calculateDirHash(dirPath) {
  const files = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(scriptsDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const stat = fs.statSync(fullPath);
        files.push({
          path: relativePath,
          content: content,
          mtime: stat.mtimeMs
        });
      }
    }
  }
  
  walk(dirPath);
  // 按路径排序以确保一致性
  files.sort((a, b) => a.path.localeCompare(b.path));
  
  const hash = crypto.createHash('md5');
  for (const file of files) {
    hash.update(`${file.path}:${file.content}:${file.mtime}`);
  }
  
  return hash.digest('hex');
}

// 打包单个脚本
function buildScript(scriptName, scriptPath) {
  console.log(`Building script: ${scriptName}`);
  
  // 创建临时目录
  const tempDir = path.join(rootDir, '.temp', scriptName);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  // 复制脚本目录中的所有文件到临时目录
  const scriptFiles = fs.readdirSync(scriptPath, { withFileTypes: true });
  for (const file of scriptFiles) {
    const sourcePath = path.join(scriptPath, file.name);
    const targetPath = path.join(tempDir, file.name);
    if (file.isDirectory()) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
  
  // 创建zip文件
  const outputZip = path.join(distDir, `${scriptName}.zip`);
  const outputScripting = path.join(distDir, `${scriptName}.scripting`);
  
  // 根据操作系统使用不同的命令压缩文件
  if (process.platform === 'win32') {
    // PowerShell压缩，确保直接包含临时目录下的文件而不是临时目录本身
    execSync(`powershell -Command "Get-ChildItem -Path ${tempDir} | Compress-Archive -DestinationPath ${outputZip} -Force"`, {
      stdio: 'inherit'
    });
  } else {
    // Linux/Mac压缩，直接在临时目录内执行命令
    execSync(`zip -r ${outputZip} .`, {
      cwd: tempDir,
      stdio: 'inherit'
    });
  }
  
  // 重命名为.scripting文件
  if (fs.existsSync(outputScripting)) {
    fs.unlinkSync(outputScripting);
  }
  fs.renameSync(outputZip, outputScripting);
  
  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log(`Successfully built ${outputScripting}`);
}

// 主函数
function main() {
  try {
    // 检查scripts目录下的所有子目录
    const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
    const scriptDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({ name: entry.name, path: path.join(scriptsDir, entry.name) }));
    
    if (scriptDirs.length === 0) {
      console.log('No scripts found in the scripts directory.');
      return;
    }
    
    let hasUpdates = false;
    
    // 检查每个脚本目录是否有更新
    for (const { name, path: scriptPath } of scriptDirs) {
      const currentHash = calculateDirHash(scriptPath);
      const cachedHash = cache[name];
      
      // 如果没有缓存或者哈希值不匹配，说明有更新
      if (!cachedHash || cachedHash !== currentHash) {
        buildScript(name, scriptPath);
        cache[name] = currentHash;
        hasUpdates = true;
      } else {
        console.log(`No changes detected for script: ${name}`);
      }
    }
    
    // 保存缓存
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    
    if (!hasUpdates) {
        console.log('No scripts need to be updated.');
      }
      
      // Git提交操作已移至GitHub Actions工作流中
      // 详见 .github/workflows/build.yml 文件
    
    console.log('\nBuild process completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
