中文 | [English](README.md)

# Photo

基于 Tauri 2 + Vanilla JS 构建的轻量级桌面照片管理工具。

## 功能

- **照片网格** — 按修改时间浏览文件夹中的所有照片
- **淘片模式** — 单张审阅，配合键盘快捷键快速评分与标记
- **文件夹面板** — 以工作区形式管理多级文件夹结构
- **灯箱** — 全屏查看，支持前后导航
- **元数据面板** — 读取 EXIF 信息（相机、ISO、光圈、快门、焦距、GPS）
- **评分** — 1–5 星评分（键盘：`1`–`5`）
- **颜色标签** — 红 / 黄 / 绿 / 蓝 / 紫
- **旗标 / 排除** — 标记保留或丢弃（`P` / `X`）
- **筛选** — 按评分、标签或旗标过滤网格
- **重命名** — 就地重命名，自动同步 sidecar 元数据
- **在 Finder 中显示** — 在系统文件管理器中打开照片所在位置

元数据（评分、标签、旗标）保存在每个文件夹内的 `.photo_meta.json` sidecar 文件中，原始照片文件不会被修改。

### 支持格式

`JPG` `JPEG` `PNG` `WebP` `HEIC` `HEIF` `TIFF` `TIF` `GIF` `BMP` `AVIF`

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳层 | [Tauri 2](https://tauri.app) |
| 后端 | Rust（`walkdir`、`kamadak-exif`、`serde_json`） |
| 前端 | 原生 HTML / CSS / JavaScript（无框架） |

## 开发

**前置依赖：** [Rust](https://rustup.rs) · [Node.js](https://nodejs.org)

```bash
# 安装 JS 依赖
npm install

# 启动开发服务器（热重载）
npm run tauri dev

# 构建发布版本
npm run tauri build
```

## 许可证

[MIT](LICENSE)
