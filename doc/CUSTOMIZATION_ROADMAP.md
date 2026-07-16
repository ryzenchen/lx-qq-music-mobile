# LX-Q 定制开发路线与更新日志

本文档用于跟踪 LX-Q 从网易云定制版逐步转向 QQ 音乐定制版的工作。每次功能修改都必须同步更新“进度表”和“更新日志”。

## 功能路线表

| 阶段 | 功能 | 计划内容 | 可行性 | 当前状态 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| 0 | LX-Q 基础版 | 更名为 LX-Q；搜索、推荐歌单、排行榜默认使用 QQ 音乐；保留其他源作为备用 | 已验证 | 已完成 | 新安装默认进入 QQ 音乐数据，APK 可独立安装运行 |
| 1 | QQ 登录 | 支持 QQ 扫码登录，视兼容性补充微信扫码；安全保存 Cookie/会话；提供登录状态与退出入口 | 高，但依赖非官方接口 | 待真机验证 | 手机扫码后显示账号状态；重启后会话仍有效；失效时有明确提示 |
| 2 | QQ 账号歌单 | 读取“我喜欢”、自建歌单和收藏歌单；查看歌单歌曲 | 高 | 未开始 | 登录后可刷新并打开 QQ 账号下的歌单，未登录时引导登录 |
| 3 | QQ 个性化推荐 | 接入个性化推荐歌单；调研并接入“猜你喜欢/每日推荐歌曲” | 中高 | 未开始 | 推荐内容与登录账号相关；刷新、缓存和错误状态正常 |
| 4 | 本地歌单回写 QQ | 本地歌曲匹配 QQ songmid；预览新增/缺失/冲突；创建或选择目标歌单；分批写入 | 中等、风险较高 | 未开始 | 默认只预览不写入；用户确认后上传；失败歌曲可导出报告；不误删云端歌曲 |
| 5 | 双语歌词 | 优先使用歌曲源自带翻译；缺失时跨源匹配翻译歌词；原文和中文按时间轴合并显示 | 高 | 未开始 | 外语歌曲有可用中文翻译时显示双语；匹配不可靠时保留原文且不串歌 |
| 6 | 稳定性与发布 | 登录过期处理、接口降级、隐私清理、回归测试、正式签名和发布流程 | 高 | 未开始 | 核心功能通过真机/模拟器测试；敏感 Cookie 不进入备份和日志 |

## 实施原则

1. 账号功能先只读、后写入；云端写操作默认要求二次确认。
2. Cookie、QQ 号和登录票据不写入日志，不同步到 WebDAV，不提交到 Git。
3. 本地歌单回写前必须展示差异，第一版只增加歌曲，不自动删除 QQ 云端歌曲。
4. 歌曲匹配至少使用歌名、歌手和时长；低置信度结果不自动写入。
5. 双语歌词优先使用平台已有翻译，跨源翻译必须校验歌曲身份和歌词时间轴。
6. 每个阶段完成后生成测试 APK，更新本文档，并提交到 `codex/my-changes` 分支。
7. 所有 LX-Q 测试 APK 必须启用 `LXQ_TEST_BUILD`，使用独立包名 `com.lxnetease.music.mobile.lxqtest`，不得覆盖或卸载上游原版。

## 技术审计摘要

- 项目现有网易云账号能力集中在 `src/utils/musicSdk/wy/user.js`、`dailyRec.js`、`src/store/user` 和首页的账号相关页面，尚未抽象成多平台账号层。
- QQ 音乐 SDK 位于 `src/utils/musicSdk/tx`，已具备搜索、公开歌单、排行榜、歌词和评论能力，但没有账号登录与个人歌单模块。
- QQ 歌词接口已经解析 `trans` 翻译歌词，播放内核也支持 translation 行；双语缺失主要发生在平台没有返回翻译的歌曲。
- 公开实现表明 QQ/微信扫码、个人歌单、“我喜欢”和推荐歌单能够通过 Cookie 会话实现；这些并非稳定的官方开放 API，需要保留失效和替换接口的维护空间。
- QQ 歌单反向写入有可参考的现有实现，但属于账号写操作，必须在只读链路稳定后单独验证。

## 更新日志

### 2026-07-15 — 修复 QQ 授权后状态无法回传

- 确认“一键登录”会把授权回调交给外部浏览器，浏览器 Cookie 与 LX-Q WebView 隔离，导致 App 登录状态无法刷新。
- 登录流程改为在 LX-Q 内直接显示腾讯官方 QQ 账号密码登录，授权回调和 QQ 音乐 Cookie 留在同一 WebView。
- 自动切换到“密码登录”表单，单手机用户无需扫描二维码；禁止 QQ 应用协议再次跳出到外部浏览器。
- LX-Q 不读取、不保存账号和密码；输入内容仅由腾讯官方登录页面处理。

### 2026-07-15 — QQ 登录移动端与单手机登录修复

- 登录页改为 QQ 音乐使用的腾讯官方移动 OAuth 页面，移除桌面网页的双层登录弹窗和 iframe 触控兼容问题。
- 支持腾讯登录页唤起本机 QQ 完成一键授权；只有一台手机时不再必须扫描屏幕上的二维码。
- 保留腾讯官方页面提供的账号登录备用方式，并启用 Android WebView 硬件渲染与嵌套滚动触控支持。
- 仅允许 QQ 官方应用协议交给 Android 系统处理；不读取、转发或记录授权链接参数、Cookie 和账号内容。

### 2026-07-15 — 修复 QQ 登录入口

- 修复移动版 QQ 音乐首页没有登录入口的问题。
- 登录 WebView 改用 QQ 音乐桌面个人中心，并自动触发站内官方登录按钮。
- 禁止登录弹窗打开外部多窗口，QQ/微信扫码过程保留在应用内 QQ 域名页面中。
- 注入脚本只查找并点击“登录”控件，不读取 Cookie、账号或页面表单内容。

### 2026-07-15 — 独立安装包策略

- 后续 Release 测试包固定启用 `LXQ_TEST_BUILD` 构建开关。
- LX-Q 使用独立 application ID，可与原版同时安装并分别保存数据。
- 后续只更新 LX-Q 测试应用，不再尝试覆盖或卸载原版。

### 2026-07-15 — QQ 登录第一版（开发中）

- 新增设置页 QQ 音乐登录状态、登录入口、状态刷新和退出登录。
- 登录过程使用 QQ 音乐网页与 Android WebView Cookie 沙盒，不把 QQ Cookie 加入应用设置。
- 账号模块只允许读取 `uin`、`qqmusic_uin`、`qm_keyst`、`wxunionid`、`wxrefresh_token` 白名单字段。
- Cookie 不进入 AsyncStorage 设置、WebDAV、全量备份或 Git；代码禁止输出 Cookie 值。
- 清理原网易云网页登录中直接打印 Cookie 消息的调试日志，降低其他账号票据泄露风险。
- Release 测试 APK 构建成功，进入真机登录流程验证。
- 下一步：真机验证 QQ/微信扫码流程，再接入登录态 API 校验和个人歌单读取。

### 2026-07-15 — 路线规划与可行性审计

- 建立长期功能路线表、验收标准和安全原则。
- 确认 QQ 扫码登录、个人歌单读取和推荐歌单具备实现基础。
- 确认本地歌单反向写入可研究实现，但需要差异预览、歌曲匹配和失败报告保护。
- 确认播放器已有双语歌词显示链路，后续重点为缺失翻译时的跨源补译。

### 2026-07-15 — LX-Q 基础版

- App 名称改为 LX-Q。
- 搜索、推荐歌单和排行榜默认切换到 QQ 音乐。
- 桌面组件、默认下载目录、权限提示和关于页面同步更名。
- 保留酷我、酷狗、网易云、咪咕等来源作为备用源。
- 生成可独立运行的 Release 测试 APK。
- 为 Android 构建增加国内依赖镜像，提高构建成功率。
### 2026-07-15 - QQ QR login native flow
- Replaced the ineffective in-app WebView login page with a native QQ QR login panel.
- The panel generates a QQ Music QR code, saves it to the phone picture folder for single-phone scanning, and polls the official QQ login result in the background.
- After confirmation in QQ, the app writes only the returned QQ Music session cookies to Android CookieManager, then refreshes the visible login status.
- Sensitive qrsig/cookie values remain in memory or the system cookie store only; they are not logged, added to app settings, backed up, synced, or committed.

### 2026-07-15 - QQ QR callback handoff fix
- After QQ reports QR login success, LX-Q now opens the official callback URL in a hidden in-app WebView so Android WebView/CookieManager can receive the final QQ Music cookies.
- Kept the QR token and callback details out of logs, app settings, backups, sync data, and commits.
- The manual confirmation button now rechecks local login state without surfacing misleading network errors while callback cookies are still being received.
- Expanded the local login-state detector to accept QQ Music's alternate cookie names such as qqmusic_key, musickey, p_skey, musicid, and ptui_loginuin.
- Aggressive fallback: after QR confirmation, LX-Q now runs the login_jump, QQ Music OAuth authorize URL, and QQ Music profile URL in an in-app WebView, and mirrors returned cookies across QQ Music related domains.
- Fixed the aggressive OAuth WebView layout so the authorization handoff area renders at full modal width instead of collapsing to a 1px vertical line.
- Fixed modal touch handling for non-background-close dialogs so the in-app QQ Music authorization WebView can receive taps and gestures.

### 2026-07-15 - QQ manual web login flow
- Removed the QR-code-first login UI after real-device testing showed the QR confirmation chain was unreliable on a single phone.
- The QQ Music login modal now opens the official QQ Music OAuth/manual login page directly, so the user can complete login inside the embedded web page.
- After manual login, LX-Q only checks Android WebView/CookieManager for a local QQ Music login state and refreshes the app status when it is detected.
- QQ cookies and authorization details remain in the local Android cookie store only; they are not logged, written to settings, backed up, synced, or committed.

### 2026-07-16 - QQ account playlists and recommendations phase 2/3
- Added a QQ Music account API layer for logged-in user playlists, collected playlists, daily/private recommendation candidates, and recommended playlists.
- Switched the My Playlist page from the previous NetEase-only data source to QQ Music account playlists, with a login prompt when QQ auth is missing.
- Switched the Daily Recommendation songs tab to QQ Music recommendation songs; when the private daily playlist cannot be detected, it falls back to songs from a QQ recommended playlist so playback can still be tested.
- Switched the Daily Recommendation playlists tab to QQ Music recommended playlists and kept playlist details on the existing QQ Music detail/playback path.
- Removed the old global request URL/body debug printing so account playlist responses, cookies, and recommendation payloads are not written to logs.
