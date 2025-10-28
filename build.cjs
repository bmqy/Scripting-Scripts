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
  try {
    console.log(`Calculating hash for directory: ${dirPath}`);
    const files = [];
    
    function walk(currentPath) {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      console.log(`Found ${entries.length} entries in: ${currentPath}`);
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(scriptsDir, fullPath);
          console.log(`Reading file for hash calculation: ${relativePath}`);
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
    
    console.log(`Processing ${files.length} files for hash calculation`);
    const hash = crypto.createHash('md5');
    for (const file of files) {
      hash.update(`${file.path}:${file.content}:${file.mtime}`);
    }
    
    const digest = hash.digest('hex');
    console.log(`Directory hash calculated: ${digest}`);
    return digest;
  } catch (error) {
    console.error(`Error calculating directory hash:`, error);
    throw error;
  }
}

// 打包单个脚本
function buildScript(scriptName, scriptPath) {
  console.log(`Building script: ${scriptName}`);
  
  // 验证脚本路径存在
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script directory not found: ${scriptPath}`);
  }
  
  // 创建临时目录
  const tempDir = path.join(rootDir, '.temp', scriptName);
  console.log(`Using temporary directory: ${tempDir}`);
  
  // 确保dist目录存在
  if (!fs.existsSync(distDir)) {
    console.log(`Creating dist directory: ${distDir}`);
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // 清理旧的临时目录
  if (fs.existsSync(tempDir)) {
    console.log(`Removing existing temporary directory: ${tempDir}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 复制脚本目录中的所有文件到临时目录
    console.log(`Copying files from ${scriptPath} to ${tempDir}`);
    const scriptFiles = fs.readdirSync(scriptPath, { withFileTypes: true });
    console.log(`Found ${scriptFiles.length} entries in script directory`);
    
    for (const file of scriptFiles) {
      const sourcePath = path.join(scriptPath, file.name);
      const targetPath = path.join(tempDir, file.name);
      
      if (file.isDirectory()) {
        console.log(`Starting to copy directory: ${file.name}`);
        try {
          // 确保目标目录存在
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
            console.log(`Created target directory: ${targetPath}`);
          }
          
          // 获取目录下的所有文件
          const dirContents = fs.readdirSync(sourcePath, { withFileTypes: true });
          console.log(`Directory ${file.name} contains ${dirContents.length} entries`);
          
          // 逐个复制目录中的文件
          for (const entry of dirContents) {
            const entrySourcePath = path.join(sourcePath, entry.name);
            const entryTargetPath = path.join(targetPath, entry.name);
            
            if (entry.isDirectory()) {
              console.log(`Recursively copying subdirectory: ${entry.name}`);
              fs.cpSync(entrySourcePath, entryTargetPath, { recursive: true });
            } else {
              console.log(`Copying file in directory: ${entry.name}`);
              fs.copyFileSync(entrySourcePath, entryTargetPath);
            }
          }
          console.log(`Successfully copied directory: ${file.name}`);
        } catch (copyError) {
          console.error(`Error copying directory ${file.name}:`, copyError);
          throw copyError;
        }
      } else {
        console.log(`Copying file: ${file.name}`);
        try {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`Successfully copied file: ${file.name}`);
        } catch (copyError) {
          console.error(`Error copying file ${file.name}:`, copyError);
          throw copyError;
        }
      }
    }
    
    // 创建zip文件
    const outputZip = path.join(distDir, `${scriptName}.zip`);
    const outputScripting = path.join(distDir, `${scriptName}.scripting`);
    
    console.log(`Preparing to create archive file: ${outputZip}`);
    
    // 根据操作系统使用不同的命令压缩文件
    if (process.platform === 'win32') {
      // PowerShell压缩，确保直接包含临时目录下的文件而不是临时目录本身
      console.log(`Using PowerShell to compress files: ${tempDir} -> ${outputZip}`);
      execSync(`powershell -Command "Get-ChildItem -Path \"${tempDir}\" | Compress-Archive -DestinationPath \"${outputZip}\" -Force"`, {
        stdio: 'inherit'
      });
    } else {
      // Linux/Mac压缩，直接在临时目录内执行命令
      console.log(`Using zip command to compress files in: ${tempDir}`);
      execSync(`zip -r ${outputZip} .`, {
        cwd: tempDir,
        stdio: 'inherit'
      });
    }
  
    // 检查zip文件是否创建成功
    if (!fs.existsSync(outputZip)) {
      throw new Error(`Failed to create zip file: ${outputZip}`);
    }
    
    // 重命名为.scripting文件
    console.log(`Renaming file: ${outputZip} -> ${outputScripting}`);
    if (fs.existsSync(outputScripting)) {
      console.log(`Removing existing scripting file: ${outputScripting}`);
      fs.unlinkSync(outputScripting);
    }
    fs.renameSync(outputZip, outputScripting);
    
    // 检查scripting文件是否创建成功
    if (!fs.existsSync(outputScripting)) {
      throw new Error(`Failed to create scripting file: ${outputScripting}`);
    }
    
    console.log(`Scripting file created successfully: ${outputScripting}`);
    
    // 验证文件大小
    const fileStats = fs.statSync(outputScripting);
    console.log(`Scripting file size: ${fileStats.size} bytes`);
    
  } catch (error) {
    console.error(`Detailed error during script ${scriptName} build:`, error);
    throw error; // 重新抛出错误，保持退出码
  } finally {
    // 清理临时目录
    try {
      if (fs.existsSync(tempDir)) {
        console.log(`Cleaning up temporary directory: ${tempDir}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error(`Error during cleanup:`, cleanupError);
    }
  }
  
  console.log(`Script build completed successfully: ${scriptName}`);
}

// 主函数
function main() {
  console.log('Starting build process...');
  console.log(`Root directory: ${rootDir}`);
  console.log(`Scripts directory: ${scriptsDir}`);
  console.log(`Dist directory: ${distDir}`);
  console.log(`Cache file: ${cacheFile}`);
  
  try {
    // 检查scripts目录是否存在
    if (!fs.existsSync(scriptsDir)) {
      console.error(`Scripts directory not found: ${scriptsDir}`);
      process.exit(1);
    }
    
    // 检查scripts目录下的所有子目录
    console.log('Scanning scripts directory for subdirectories...');
    const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
    const scriptDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({ name: entry.name, path: path.join(scriptsDir, entry.name) }));
    
    console.log(`Found ${scriptDirs.length} script directories`);
    
    if (scriptDirs.length === 0) {
      console.log('No scripts found in the scripts directory.');
      return;
    }
    
    let hasUpdates = false;
    
    // 检查每个脚本目录是否有更新
    for (const { name, path: scriptPath } of scriptDirs) {
      console.log(`\nProcessing script: ${name}`);
      console.log(`Script path: ${scriptPath}`);
      
      try {
        const currentHash = calculateDirHash(scriptPath);
        const cachedHash = cache[name];
        
        console.log(`Current hash: ${currentHash}`);
        console.log(`Cached hash: ${cachedHash || 'Not found'}`);
        
        // 如果没有缓存或者哈希值不匹配，说明有更新
        if (!cachedHash || cachedHash !== currentHash) {
          console.log(`Changes detected, building script: ${name}`);
          buildScript(name, scriptPath);
          cache[name] = currentHash;
          hasUpdates = true;
        } else {
          console.log(`No changes detected for script: ${name}, skipping build`);
        }
      } catch (scriptError) {
        console.error(`Error processing script ${name}:`, scriptError);
        throw scriptError; // 继续抛出错误以中断构建流程
      }
    }
    
    // 保存缓存
    console.log('\nSaving build cache...');
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
      console.log(`Cache saved successfully to: ${cacheFile}`);
    } catch (cacheError) {
      console.error('Failed to save cache file:', cacheError);
      // 不抛出错误，因为缓存保存失败不应该影响构建结果
    }
    
    if (!hasUpdates) {
      console.log('No scripts need to be updated.');
    }
      
    // Git提交操作已移至GitHub Actions工作流中
    // 详见 .github/workflows/build.yml 文件
    
    console.log('\nBuild process completed successfully.');
  } catch (error) {
    console.error('\nDetailed error during build process:', error);
    console.error('Build process failed.');
    process.exit(1);
  }
}

// 执行主函数
main();
