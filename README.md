# HappyWrite - AI 驱动的网文写作助手

HappyWrite 是一款桌面端网文写作软件，深度集成 AI 能力，帮助作者从灵感到完稿高效创作。支持树形大纲与思维导图双视图规划、多模型 AI 辅助写作、角色世界观管理等功能。

## 功能特性

### 写作核心
- **富文本编辑器** — 基于 TipTap，支持标题层级、粗斜体、下划线等格式
- **卷/章管理** — 树形目录，拖拽排序，灵活组织长篇结构
- **自动保存** — 1.5 秒防抖自动保存，不怕丢失内容
- **专注模式** — `Ctrl/Cmd+Shift+F` 隐藏所有面板，沉浸式写作
- **字数统计** — 中英文混合计数，每日字数目标追踪，写作热力图

### AI 写作助手
- **6 种 AI 模式** — 续写、润色、灵感、人物生成、全文审稿、章节摘要
- **审稿模式** — AI 从节奏、人物一致性、情节逻辑、表达优化、总体评价 5 个维度给出建议
- **摘要模式** — 一键生成章节摘要，可直接保存到笔记
- **智能上下文注入** — 自动将角色设定、世界观、大纲信息注入 AI 请求，让回复更贴合故事
- **会话管理** — AI 对话历史保存、切换、删除，支持多线并行讨论

### 多模型支持
内置 **13 个国内外主流大模型**，开箱即用：

| 分类 | 提供商 |
|------|--------|
| 国际 | Claude (Anthropic), OpenAI, Google Gemini, Mistral, Groq |
| 国内 | DeepSeek, 通义千问 (Qwen), 智谱 GLM, 月之暗面 (Kimi), 百川, 豆包, MiniMax |
| 其他 | 自定义 OpenAI 兼容接口 |

### 大纲规划
- **双视图** — 树形大纲（缩进式层级）与思维导图（React Flow 可视化）一键切换
- **思维导图** — 自动布局、拖拽改变层级、缩放平移、小地图导航、右键菜单
- **节点类型** — 故事弧 / 幕 / 章 / 场景，颜色编码一目了然
- **章节关联** — 大纲节点可关联到具体章节

### 内容管理
- **角色管理** — 姓名、别名、角色定位、详细描述、属性、关系
- **世界观设定** — 按分类组织地理、魔法体系、势力等设定
- **章节笔记** — 每章独立笔记区，随手记录灵感碎片
- **全局搜索** — `Ctrl/Cmd+P` 跨章节搜索
- **导出** — TXT / EPUB 格式导出

### 其他
- **暗色模式** — 明暗主题切换
- **写作统计** — 每日字数、连续写作天数
- **模板系统** — 角色/设定等可复用模板

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript |
| 编辑器 | TipTap (基于 ProseMirror) |
| 样式 | Tailwind CSS + CSS 变量主题 |
| 数据库 | SQLite (better-sqlite3, WAL 模式) |
| AI 集成 | Anthropic Messages API + OpenAI 兼容 API |
| 思维导图 | @xyflow/react (React Flow) |
| 构建 | electron-vite + Vite 5 |
| 打包 | electron-builder |

## 快速开始

### 前置要求
- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone git@github.com:ylfnevergiveup/happywrite.git
cd happywrite

# 安装依赖
npm install

# 启动开发模式（热重载）
npm run dev

# 生产构建
npm run build
```

### 配置 AI

1. 启动应用后，点击左下角设置图标
2. 在「AI 配置」中选择提供商（默认 DeepSeek）
3. 填入对应平台的 API Key
4. 选择模型，点击保存

> 如果没有 API Key，推荐先使用 DeepSeek（国内访问稳定，价格低廉）或通义千问。

## 项目结构

```
src/
├── main/                   # Electron 主进程
│   ├── index.ts            # 应用入口，窗口管理
│   ├── database/index.ts   # SQLite 初始化 & Schema
│   └── ipc/                # IPC 处理器
│       ├── ai.ts           # AI 请求 & 会话管理
│       ├── novels.ts       # 小说 CRUD
│       ├── volumes.ts      # 卷 CRUD
│       ├── chapters.ts     # 章节 CRUD
│       ├── characters.ts   # 角色 CRUD
│       ├── outlines.ts     # 大纲节点 CRUD
│       ├── worldSettings.ts
│       ├── settings.ts     # 应用设置
│       ├── stats.ts        # 写作统计
│       ├── search.ts       # 全局搜索
│       ├── export.ts       # TXT/EPUB 导出
│       └── templates.ts    # 模板管理
├── preload/                # 预加载脚本
│   └── index.ts            # contextBridge API
└── renderer/               # 渲染进程 (React)
    ├── App.tsx             # 根组件 & 布局
    ├── assets/index.css    # 全局样式 & CSS 变量
    ├── types.ts            # 前端类型定义
    └── components/
        ├── Editor/         # 编辑器 & 右侧面板
        ├── OutlineManager/ # 大纲（树形 + 导图）
        ├── Sidebar/        # 左侧导航栏
        ├── Settings/       # 设置对话框
        ├── CharacterManager/
        └── GlobalSearch.tsx
```

## 架构

```
┌─────────────────────────────────────────────────┐
│                    Renderer (React)              │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐ │
│  │ Sidebar  │ │  Editor   │ │  RightPanel    │ │
│  │  ·Novels │ │  ·TipTap  │ │  ·AI Chat      │ │
│  │  ·Chaps  │ │  ·Toolbar │ │  ·Notes        │ │
│  │  ·Views  │ │           │ │  ·Outline Tree │ │
│  └──────────┘ └───────────┘ └────────────────┘ │
│              ↕ window.api (IPC invoke)           │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│              Preload (contextBridge)             │
│    Typed API: novel, chapter, ai, outline, ...   │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│              Main Process                       │
│  ┌───────────┐  ┌────────────────────────────┐ │
│  │ Electron  │  │  SQLite (better-sqlite3)   │ │
│  │ Window    │  │  ·WAL mode                 │ │
│  │ IPC Mgmt  │  │  ·Foreign keys             │ │
│  └───────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 开发

### 添加新的 IPC 通道

需要修改 3 个文件：
1. `src/main/ipc/<domain>.ts` — 注册 `ipc.handle('channel:name', ...)`
2. `src/preload/index.ts` — 添加 bridge 方法
3. 渲染进程组件中调用 `window.api.<domain>.<method>()`

### 添加新的 AI 提供商

编辑 `src/main/ipc/ai.ts`：
- 在 `Provider` 类型联合中添加新 provider
- 在 `providerDefaults` 中添加 baseUrl 和模型列表
- 编辑 `src/renderer/components/Settings/SettingsDialog.tsx` 添加 UI 选项
- 如果使用 OpenAI 兼容 API，无需额外代码

## License

MIT

---

**HappyWrite** — 让 AI 成为你的创作伙伴，而不是替代你的笔。
