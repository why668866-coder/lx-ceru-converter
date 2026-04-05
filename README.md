---

# 🎵 洛雪 ↔ 澜音 歌单互转工具

一个基于 Node.js 的命令行工具，实现 **洛雪音乐（LX Music）** 与 **澜音音乐（CeruMusic）** 之间的歌单双向转换，完全兼容澜音官方的 `.cmpl`/`.cpl` 加密格式。

## ✨ 主要特性

- ✅ **双向转换**：洛雪 → 澜音（生成 `.cmpl` 文件）、澜音 → 洛雪（生成 `.json` 文件）
- ✅ **支持多歌单**：洛雪 `playList_v2` 中的多个歌单可分别转换为独立的 `.cmpl` 文件，或合并为一个
- ✅ **文件夹整洁**：多歌单输出时自动创建以原文件名命名的文件夹，内部存放 `歌单名.cmpl`
- ✅ **完全兼容澜音格式**：采用 AES-256-CBC 加密（OpenSSL 兼容模式），密钥 `CeruMusic-PlaylistSecretKey`
- ✅ **支持新旧格式**：可读取澜音的 `.cmpl`（gzip 压缩加密）及旧版 `.cpl`（纯文本加密）
- ✅ **支持洛雪压缩包**：可直接读取洛雪导出的 `.lxmc`（gzip 压缩 JSON）

---

## 📦 安装

### 1. 安装 Node.js
确保系统已安装 **Node.js 16+**，可从 [nodejs.org](https://nodejs.org) 下载安装。

### 2. 下载脚本
将以下代码保存为 `converter.js`（代码见上一轮回答）。

### 3. 安装依赖
```bash
npm install crypto-js
```

> **注意**：如果 npm 环境损坏，请先重新安装 Node.js 或修复 npm。

---

## 🚀 使用方法

### 基本命令格式

```bash
# 洛雪 → 澜音
node converter.js <洛雪文件.json/.lxmc> [输出目录] [--merge]

# 澜音 → 洛雪
node converter.js <澜音文件.cmpl/.cpl> [输出.json]
```

---

### 📤 洛雪 → 澜音

#### 情况一：单歌单文件（如 `playListPart_v2` 格式）
```bash
node converter.js 我的歌单.json
```
- **输出**：在输入文件同目录下生成 `我的歌单.cmpl`
- **说明**：单歌单直接输出同名 `.cmpl` 文件，不创建文件夹。

#### 情况二：多歌单文件（`playList_v2` 格式，包含多个歌单）
```bash
node converter.js 收藏集.json
```
- **输出**：自动创建 `收藏集/` 文件夹，内部为每个歌单生成一个 `.cmpl` 文件，文件名 = 歌单名（非法字符自动替换为 `_`）。
- **示例**：  
  假设 `收藏集.json` 包含两个歌单“华语流行”和“欧美热歌”，则输出：
  ```
  收藏集/
  ├── 华语流行.cmpl
  └── 欧美热歌.cmpl
  ```

#### 情况三：强制合并所有歌单为一个 `.cmpl`
```bash
node converter.js 收藏集.json --merge
```
- **输出**：`收藏集.cmpl`（所有歌曲合并到一个数组，**丢失歌单边界**）

#### 情况四：指定输出目录
```bash
node converter.js 我的歌单.json ./output
```
- 单歌单时：`./output/我的歌单.cmpl`
- 多歌单时：`./output/我的歌单/` 文件夹

---

### 📥 澜音 → 洛雪

#### 转换单个 `.cmpl` 或 `.cpl` 文件
```bash
node converter.js 华语流行.cmpl
```
- **输出**：同目录下生成 `华语流行.json`（洛雪 `playListPart_v2` 格式）

#### 指定输出文件名
```bash
node converter.js 华语流行.cmpl restored.json
```

#### 支持旧版 `.cpl` 文件
```bash
node converter.js 旧版歌单.cpl 还原.json
```

---

## 📂 文件格式说明

| 文件类型 | 说明 | 扩展名 |
|---------|------|--------|
| 洛雪歌单（未压缩） | JSON 文本，结构为 `playListPart_v2` 或 `playList_v2` | `.json` |
| 洛雪歌单（压缩） | gzip 压缩的 JSON | `.lxmc` |
| 澜音歌单（新版） | AES 加密 → gzip 压缩 | `.cmpl` |
| 澜音歌单（旧版） | AES 加密（未压缩） | `.cpl` |

---

## 🔧 参数详解

| 参数 | 含义 | 适用方向 |
|------|------|----------|
| `--merge` | 强制将所有洛雪歌单合并为一个 `.cmpl` 文件 | 洛雪 → 澜音 |
| `[输出目录]` | 指定输出文件存放的目录（不指定则与输入文件同目录） | 洛雪 → 澜音 |
| `[输出.json]` | 指定输出的洛雪 JSON 文件路径 | 澜音 → 洛雪 |

---

## 📝 示例场景

### 场景1：将洛雪导出的多歌单批量转为澜音格式
```bash
node converter.js 我的最爱.json
```
输出文件夹 `我的最爱/` 内包含多个 `.cmpl` 文件，可直接导入澜音 App。

### 场景2：将澜音分享的 `.cmpl` 文件还原为洛雪歌单
```bash
node converter.js 周杰伦.cmpl  周杰伦.json
```
将生成的 `周杰伦.json` 放入洛雪音乐的歌单目录即可。

### 场景3：处理旧版洛雪 `.lxmc` 压缩歌单
```bash
node converter.js backup.lxmc   --merge
```
直接解压并转换为单个 `.cmpl` 文件。

---

## ⚠️ 注意事项

1. **必须安装 `crypto-js`**：运行前执行 `npm install crypto-js`。
2. **文件名特殊字符**：歌单名中的 `/ \ : * ? " < > |` 会被自动替换为 `_`。
3. **加密兼容性**：本工具使用的 AES 加密方式与澜音桌面端完全一致，生成的 `.cmpl` 文件可被澜音移动端/桌面端正常导入。
4. **多歌单合并**：使用 `--merge` 会丢失歌单边界，合并后的歌曲数组无歌单分类，导入澜音后显示为单个歌单。
5. **错误排查**：如果转换失败，请检查输入文件是否损坏、密钥是否正确（固定为 `CeruMusic-PlaylistSecretKey`）。

---

## 🛠️ 常见问题

### Q1：运行提示 `Cannot find module 'crypto-js'`
**A**：请先执行 `npm install crypto-js`。

### Q2：澜音导入 `.cmpl` 时提示“格式不正确”
**A**：确保使用的是最新版澜音 App（支持 `.cmpl`），或者尝试将文件扩展名改为 `.cpl`（旧版未压缩）再导入。

---

## 📄 许可

本工具为开源脚本，遵循 MIT 协议，可自由使用、修改、分发。

---

**Happy converting! 🎧**
