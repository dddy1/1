# 手机模块（Phone）实施规划

> 目标：在酒馆中嵌入一个完整的"手机"界面，让用户可以以手机视角与角色交互。
> 进入后酒馆全屏，灵动岛作为常驻入口；手机内有多个 App，最核心的是 PP（捏他 QQ）。

---

## 一、技术选型

| 选型 | 方案 | 理由 |
|---|---|---|
| UI 框架 | **Vue 3** ESM CDN（`vue.esm-browser.prod.js`） | 不引入构建步骤；组件化便于多 App / 多页面管理；响应式天然契合手机的复杂状态 |
| 组件写法 | `defineComponent({ template: \`...\`, setup() {} })`，分文件 | 不依赖 `.vue` SFC，浏览器原生可执行 |
| 路由 | 自实现极简 router（`reactive({ stack: [] })` + `push/back`） | 需要支持 App 内栈式返回 + 跨 App 切换，vue-router 反而过重 |
| 状态管理 | `reactive()` + 模块化 store（`store/pp.js`、`store/wallet.js` 等） | 不需要 Pinia 那么重 |
| 持久化 | `extension_settings.ggg.phone` + IndexedDB（图库/表情包/动态图等大数据） | 与现有字体模块同款方案 |
| 与酒馆交互 | 监听 `MESSAGE_RECEIVED` / `CHAT_CHANGED` 等事件；自定义提示词通过 `generateRaw` 绕过酒馆原始流程 | |

---

## 二、目录结构

```
modules/phone/
├── phone.js                    主入口（注册、灵动岛、全屏壳、Vue 实例挂载）
├── phone.css                   全局样式（壳、灵动岛、动画）
├── shell/
│   ├── dynamic-island.js       灵动岛组件 + 单击/双击行为
│   ├── status-bar.js           手机顶部状态栏（时间/信号/电量）
│   └── fullscreen.js           全屏管理（隐藏酒馆 UI、撑满视口）
├── core/
│   ├── router.js               极简路由（栈式 + 跨 App）
│   ├── store.js                全局 store 工厂 + 持久化
│   ├── macro.js                酒馆宏 / 上下文工具（user 名称、char、世界书检测）
│   └── prompt.js               提示词组装 + 调用 generateRaw
├── apps/
│   ├── home/                   主页（APP 图标网格 + 美化小组件）
│   │   ├── index.js
│   │   └── home.css
│   ├── pp/                     PP（核心 App）
│   │   ├── index.js            App 入口 + 路由表
│   │   ├── pages/
│   │   │   ├── chats.js        Chats（聊天列表）
│   │   │   ├── chat-room.js    单个聊天界面
│   │   │   ├── contacts.js     Contacts（好友/分组/群组）
│   │   │   ├── discover.js     Discover（动态）
│   │   │   ├── profile.js      左滑用户面板
│   │   │   ├── friend.js       好友资料卡 + 角色设定
│   │   │   ├── settings.js     PP 内设置（开会员/钱包/装扮…）
│   │   │   └── ...
│   │   ├── components/         可复用组件（消息气泡、顶部栏、底部栏、动态卡片…）
│   │   ├── store.js            PP 专属 store（聊天记录、好友、动态、钱包…）
│   │   └── pp.css
│   ├── settings/               系统级设置（API、提示词条目、世界书条目导入…）
│   │   ├── index.js
│   │   └── components/         拖拽条目、API 设置、世界书选择器
│   ├── image-gen/              生图 —— 占位
│   ├── notebook/               小呱书 —— 占位
│   ├── og/                     OG —— 占位
│   └── go3/                    GO3 —— 占位
└── PHONE_PLAN.md               （本文档）
```

---

## 三、阶段拆分

> 每个阶段都能独立运行 / 验收。先把骨架立起来，再分轮填功能。

### Phase 0：骨架（本轮完成）
- [x] 加载 Vue 3 CDN
- [x] settings 面板「手机」标签页：启用开关、顶掉手机状态栏开关
- [x] 灵动岛：固定在视口顶部中央，跟随酒馆主题色
- [x] 灵动岛单击：隐藏/显示 `#top-bar`
- [x] 灵动岛双击：进入手机（全屏壳上升 + 隐藏酒馆 UI）；再双击退出
- [x] 全屏壳：Vue 实例挂载，渲染空的主页（占位 APP 图标网格）
- [x] 持久化：`settings.phone = { enabled, hideMobileStatusBar }`

### Phase 1：手机外观 + 路由 + 多入口形态
- [x] 极简路由（栈式 push/back + **右滑返回手势**：左边缘 24px 起拖动 ≥60px 触发 back）
- [x] 主页 APP 图标网格（时间/收藏/音乐/2x2 APP 网格 + 小组件）
- [x] **三种入口形态（开关切换）**：
  - `island`：灵动岛（顶部居中胶囊，默认）
  - `pc-floater`：PC 悬浮窗（贴 sheld 右 margin，可拖拽，位置持久化到 localStorage）
  - `mobile-ball`：移动端悬浮球（拖拽后自动吸附最近左 / 右页边）
  - 三种入口共用 `bindEntryGestures`：单击切顶栏，双击进/退手机
- [x] **始终全屏开关 `alwaysFullscreen`**：进手机时调浏览器 `requestFullscreen()` 撑掉浏览器顶/底栏
- [x] **状态栏**（`shell/status-bar.js`）：时间 + 信号/Wi-Fi 图标 + 电量百分比（用 `navigator.getBattery()`，不支持时隐藏）
- [x] **主题**（`core/theme.js`）：dark / light，CSS 变量 token（`--ggg-bg / --ggg-text / --ggg-card / --ggg-accent ...`），设置面板可选
- [x] **背景**（`core/background.js`）：默认取酒馆 `/api/backgrounds/all` 第一张；图库 → 「酒馆背景」Tab 点击图片即可设为手机背景，再次点橡皮擦清除回默认

### Phase 2：PP 主体框架
- [x] PP 三大页签：Chats / Contacts / Discover（底部 `bottombar` 切换 + 未读角标）
- [x] 顶部栏 `topbar`（左头像 / 中标题 / 右搜索+加号）
- [x] 备忘录搜索框（输入框 UI 已就位；手机 tag → 提示词写入留 Phase 3 再实现）
- [x] 左滑面板 `profile-panel`（user 头像/昵称/签名/PP ID + 钱包/会员入口卡片 + 装扮/收藏/开发者/设置列表）
- [x] PP 数据 `store.js`：me / friends / groups / chats / wallet / vip / decorations / favorites（落 `settings.phone.pp`，深 watch 自动持久化）

### Phase 3：聊天系统（核心难点）
- [ ] 聊天列表（头像/昵称/时间/未读/预览，群聊显示发言人）
- [ ] 聊天界面（顶栏、消息列表、输入栏、底部多功能条）
- [ ] **消息气泡渲染管线**：
  - 普通文本 / 语音（含转文字）/ 双语 / 图片 / 表情包 / 撤回 / 转账 / 系统消息 / 引用
  - 一条一条弹出（按内容长度算延迟，期间显示「正在输入中」）
- [ ] 长按消息 → 表态 / 撤回 / 收藏 / 删除 / 引用
- [ ] 底部多功能条：语音输入 / 发送图片 / 转账 / 原始文本 / 表情包
- [ ] **聊天记录 ↔ 酒馆 chat 同步**：每条 PP 消息绑定一条酒馆消息，保证刷新后还在
- [ ] 回车 = 发送（不换行）

### Phase 4：Contacts + Friend
- [ ] 分组：特别关心 / 好友 / 群组（长按分组操作）
- [ ] 好友资料卡：备注、设定（可从世界书导入条目）、char 时区/地点/天气、主动发消息开关 + 间隔

### Phase 5：Discover（动态）
- [ ] 动态时间线（编号倒序 1 在最底下 / 最新在最上）
- [ ] 单条动态：头像/昵称/可见性/正文/图片/赞踩评论转发
- [ ] 评论区（同样有编号、赞踩回复）
- [ ] 发动态入口
- [ ] 留言（弹窗通知）

### Phase 6：钱包 / 会员 / 装扮 / 收藏 / 开发者
- [ ] 钱包：默认 3 元，记录收支，开关「装扮免费」
- [ ] 会员：vip/svip/年 svip/大会员（纯花钱）
- [ ] 装扮：主题/气泡/字体（不做头像挂件）
- [ ] 收藏：按好友分组展示，可挂到主页小组件
- [ ] 开发者选项：作弊（全场免费）、实时 CSS 编辑、导入/导出表情包

### Phase 7：系统设置 App
- [ ] API 设置（默认沿用酒馆，可独立配置）
- [ ] 提示词条目编辑器（拖拽排序、注入位置）
- [ ] 世界书条目导入（支持检测当前角色 + 所有世界书）
- [ ] 翻译/语音转文字默认行为；user 时区/地点/天气

### Phase 8：弹窗机制（rp 时的灵动岛通知）
- [ ] 监听酒馆当前消息
- [ ] 判定「滑过该条 35%」时弹出灵动岛通知
- [ ] 单击通知 → 直接跳转到 PP 对应聊天

### Phase 9：占位 App 逐个填（生图 / 小呱书 / OG / GO3）

---

## 四、关键设计决策（待确认）

1. **Vue 加载源**：暂用 `https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.esm-browser.prod.js`。
   离线/国内可达性差时改为本地 vendor。
2. **聊天记录与酒馆 chat 的关系**：PP 消息内联到酒馆消息的 `extra.guagua_pp` 字段（每条消息一份元信息），刷新后从酒馆 chat 读回。这样不另开一个数据源，也能蹭酒馆的存档/同步。
3. **好友关系检测**：用户提到的 `{{//xxx}}` 静默宏 —— 经测能渲染但内容不会进上下文。第一版采用更明确的方案：在 `card.data.extensions.guagua` 写入手机相关元数据（user/char 在某开场白中是不是好友），由作者卡内置；同时支持手机内手动设置覆盖。
4. **绕过酒馆发送**：用 `SillyTavern.getContext().generateRaw({ prompt, ... })` 直发；上下文由我们自己拼装，按用户在系统设置里勾的条目顺序注入。

---

## 五、与现有模块的边界

| 现有模块 | 与手机的关系 |
|---|---|
| ui-custom / custom-css | 手机内不受其影响（手机壳用独立的 CSS 作用域 `#ggg-phone-shell`） |
| font | 手机内可独立选择字体（设置 → 装扮 → 字体） |
| world-info-sheet | 手机系统设置里复用「世界书条目选择」逻辑 |
| gallery | 手机里的图片库（聊天图片、动态图片）独立存在 IndexedDB，不混入 |

---

## 六、本轮（Phase 0）交付物

1. `modules/phone/phone.js` —— 主入口
2. `modules/phone/phone.css` —— 灵动岛 + 全屏壳样式
3. `modules/phone/shell/dynamic-island.js` —— 灵动岛组件
4. `modules/phone/shell/fullscreen.js` —— 全屏管理
5. `modules/phone/core/vue-loader.js` —— Vue ESM 加载器
6. `modules/phone/apps/home/index.js` —— 空主页（APP 图标占位）
7. `settings.html` —— 「手机」面板：启用开关 + 顶掉手机状态栏开关 + 占位说明
8. `index.js` —— 注册 `initPhone()` + 持久化 `settings.phone`
