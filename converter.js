#!/usr/bin/env node

/**
 * 洛雪音乐 ↔ 澜音音乐 歌单互转工具（完全兼容官方格式）
 * 
 * 洛雪 → 澜音：
 *   - 多歌单（>1）时：在输出目录下创建以输入文件名命名的文件夹，每个歌单生成独立的 .cmpl 文件，文件名 = 歌单名.cmpl
 *   - 单歌单或 --merge 时：直接输出单个 .cmpl 文件（不创建文件夹）
 * 
 * 澜音 → 洛雪：输出正确的 playListPart_v2 格式 JSON
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
let CryptoJS;
try {
  CryptoJS = require('crypto-js');
} catch (e) {
  console.error('❌ 请先安装 crypto-js：npm install crypto-js');
  process.exit(1);
}

const SECRET_KEY = 'CeruMusic-PlaylistSecretKey';

// ---------- 加密/解密（与澜音桌面端完全一致）----------
function encryptPlaylist(songArray) {
  const jsonStr = JSON.stringify(songArray);
  return CryptoJS.AES.encrypt(jsonStr, SECRET_KEY).toString();
}

function decryptPlaylist(cipherText) {
  const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
  const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedStr) throw new Error('解密失败，密码错误或数据损坏');
  return JSON.parse(decryptedStr);
}

// ---------- gzip 压缩/解压 ----------
function gzipBuffer(buf) {
  return zlib.gzipSync(buf);
}
function gunzipBuffer(buf) {
  return zlib.gunzipSync(buf);
}

// ---------- 洛雪歌单解析 ----------
function extractLxPlaylists(lxObj) {
  if (lxObj.type === 'playListPart_v2' && lxObj.data?.list) {
    return [{ name: lxObj.data.name || lxObj.name || '默认歌单', songs: lxObj.data.list }];
  }
  if (lxObj.type === 'playList_v2' && Array.isArray(lxObj.data)) {
    return lxObj.data.map(pl => ({
      name: pl.name || '未命名歌单',
      songs: pl.list || []
    })).filter(pl => pl.songs.length > 0);
  }
  if (lxObj.list && Array.isArray(lxObj.list)) {
    return [{ name: lxObj.name || '默认歌单', songs: lxObj.list }];
  }
  if (Array.isArray(lxObj)) {
    return [{ name: '默认歌单', songs: lxObj }];
  }
  throw new Error('无法识别的洛雪歌单格式');
}

function lxSongToCeruSong(lxSong) {
  const meta = lxSong.meta || {};
  return {
    songmid: meta.hash || meta.songId || lxSong.id || '',
    singer: lxSong.singer || '未知艺术家',
    name: lxSong.name || '未知歌曲',
    albumName: meta.albumName || '未知专辑',
    albumId: meta.albumId || '',
    source: lxSong.source || 'unknown',
    interval: lxSong.interval || '0:00',
    img: meta.picUrl || '',
    lrc: null,
    types: meta.qualitys || null,
    _types: meta._qualitys || null,
    typeUrl: {},
    url: ''
  };
}

function ceruSongToLxSong(ceruSong) {
  // 构建 meta 对象
  const meta = {
    songId: ceruSong.songmid || '',
    albumName: ceruSong.albumName || '',
    albumId: ceruSong.albumId || '',
    picUrl: ceruSong.img || '',
  };
  // 处理音质信息
  if (ceruSong.types) {
    if (Array.isArray(ceruSong.types)) {
      meta.qualitys = ceruSong.types;
    } else if (typeof ceruSong.types === 'object') {
      meta.qualitys = Object.entries(ceruSong.types).map(([type, info]) => ({
        type,
        size: info.size || '未知'
      }));
    }
  }
  if (ceruSong._types && typeof ceruSong._types === 'object') {
    meta._qualitys = ceruSong._types;
  }

  // 生成洛雪歌曲 id: source_songmid
  const source = ceruSong.source || 'unknown';
  const songmid = ceruSong.songmid || '';
  const songId = `${source}_${songmid}`;

  return {
    id: songId,
    name: ceruSong.name,
    singer: ceruSong.singer,
    source: source,
    interval: ceruSong.interval,
    meta: meta
  };
}

async function readLxFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = await fs.promises.readFile(filePath);
  let content;
  if (ext === '.lxmc') {
    content = zlib.gunzipSync(raw).toString('utf-8');
  } else {
    content = raw.toString('utf-8');
  }
  return JSON.parse(content);
}

/**
 * 洛雪 → 澜音
 * @param {string} inputPath       输入洛雪文件路径
 * @param {string|null} outputDir  输出目录（可选，默认自动创建文件夹）
 * @param {boolean} merge          是否合并所有歌单为一个文件
 * @returns {Promise<Array<{name: string, songCount: number, outputPath: string}>>}
 */
async function convertLxToCeru(inputPath, outputDir = null, merge = false) {
  const lxObj = await readLxFile(inputPath);
  const playlists = extractLxPlaylists(lxObj);
  if (!playlists.length) throw new Error('未找到任何歌单');

  const inputBaseName = path.basename(inputPath, path.extname(inputPath));
  const inputDir = path.dirname(inputPath);
  let finalOutputDir;
  const results = [];

  if (merge || playlists.length === 1) {
    // 单个输出文件
    if (outputDir) {
      finalOutputDir = outputDir;
    } else {
      finalOutputDir = inputDir;
    }
    await fs.promises.mkdir(finalOutputDir, { recursive: true });
    
    const allSongs = merge ? playlists.flatMap(pl => pl.songs) : playlists[0].songs;
    const ceruSongs = allSongs.map(lxSongToCeruSong);
    const encrypted = encryptPlaylist(ceruSongs);
    const compressed = gzipBuffer(Buffer.from(encrypted, 'utf-8'));
    const outFileName = `${inputBaseName}.cmpl`;
    const outPath = path.join(finalOutputDir, outFileName);
    await fs.promises.writeFile(outPath, compressed);
    results.push({
      name: merge ? '合并歌单' : playlists[0].name,
      songCount: ceruSongs.length,
      outputPath: outPath
    });
  } else {
    // 多个歌单：创建子文件夹
    let parentDir;
    if (outputDir) {
      parentDir = outputDir;
    } else {
      parentDir = inputDir;
    }
    const subFolderName = inputBaseName;
    finalOutputDir = path.join(parentDir, subFolderName);
    await fs.promises.mkdir(finalOutputDir, { recursive: true });
    
    for (const pl of playlists) {
      const ceruSongs = pl.songs.map(lxSongToCeruSong);
      const encrypted = encryptPlaylist(ceruSongs);
      const compressed = gzipBuffer(Buffer.from(encrypted, 'utf-8'));
      let safeName = pl.name.replace(/[\\/:*?"<>|]/g, '_');
      if (!safeName) safeName = '未命名';
      const outPath = path.join(finalOutputDir, `${safeName}.cmpl`);
      await fs.promises.writeFile(outPath, compressed);
      results.push({
        name: pl.name,
        songCount: ceruSongs.length,
        outputPath: outPath
      });
    }
  }
  return results;
}

/**
 * 澜音 → 洛雪
 * @param {string} inputPath   .cmpl 或 .cpl 文件
 * @param {string|null} outputPath 输出 JSON 路径，默认自动生成
 * @returns {Promise<{songCount: number, outputPath: string}>}
 */
async function convertCeruToLx(inputPath, outputPath = null) {
  const ext = path.extname(inputPath).toLowerCase();
  const raw = await fs.promises.readFile(inputPath);
  let decrypted;
  if (ext === '.cmpl') {
    const decompressed = gunzipBuffer(raw);
    const encryptedText = decompressed.toString('utf-8');
    decrypted = decryptPlaylist(encryptedText);
  } else if (ext === '.cpl') {
    const encryptedText = raw.toString('utf-8');
    decrypted = decryptPlaylist(encryptedText);
  } else {
    throw new Error('仅支持 .cmpl 或 .cpl 文件');
  }
  if (!Array.isArray(decrypted)) throw new Error('解密后数据不是数组');

  const lxSongs = decrypted.map(ceruSongToLxSong);
  const playlistName = path.basename(inputPath, ext);
  const lxPlaylist = {
    type: 'playListPart_v2',
    data: {
      id: `import_${Date.now()}`,
      name: playlistName,
      list: lxSongs
    }
  };
  if (!outputPath) {
    const base = path.basename(inputPath, ext);
    outputPath = path.join(path.dirname(inputPath), `${base}.json`);
  }
  await fs.promises.writeFile(outputPath, JSON.stringify(lxPlaylist, null, 2));
  return { songCount: lxSongs.length, outputPath };
}

// ---------- 命令行入口 ----------
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log(`
用法:
  洛雪 → 澜音: node converter.js <洛雪.json/.lxmc> [输出目录] [--merge]
  澜音 → 洛雪: node converter.js <澜音.cmpl/.cpl> [输出.json]

说明:
  - 默认多歌单（>1）时：在输出目录下创建“原文件名”文件夹，每个歌单独立输出为 歌单名.cmpl。
  - 单歌单或 --merge 时：直接输出单个 .cmpl 文件（不创建子文件夹）。
  - 输出目录可选，不指定则使用输入文件所在目录。
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const second = args[1];
  const third = args[2];

  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 文件不存在 - ${inputPath}`);
    process.exit(1);
  }

  const ext = path.extname(inputPath).toLowerCase();

  try {
    if (ext === '.cmpl' || ext === '.cpl') {
      let outputJson = second && !second.startsWith('--') ? second : null;
      const result = await convertCeruToLx(inputPath, outputJson);
      console.log(`✅ 转换成功: 澜音 → 洛雪`);
      console.log(`   歌曲数量: ${result.songCount}`);
      console.log(`   输出文件: ${result.outputPath}`);
    } else if (ext === '.json' || ext === '.lxmc') {
      let outputDir = null;
      let merge = false;
      if (second === '--merge') {
        merge = true;
      } else if (second && second !== '--merge') {
        outputDir = second;
        if (third === '--merge') merge = true;
      }
      const results = await convertLxToCeru(inputPath, outputDir, merge);
      console.log(`✅ 转换成功: 洛雪 → 澜音`);
      if (results.length === 1) {
        console.log(`   歌曲数量: ${results[0].songCount}`);
        console.log(`   输出文件: ${results[0].outputPath}`);
      } else {
        console.log(`   共生成 ${results.length} 个歌单文件，保存在文件夹: ${path.dirname(results[0].outputPath)}`);
        for (const r of results) {
          console.log(`   - ${r.name} (${r.songCount}首) → ${path.basename(r.outputPath)}`);
        }
      }
    } else {
      console.error(`错误: 不支持的文件类型 "${ext}"`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ 转换失败: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { convertLxToCeru, convertCeruToLx };