# Style Skills System Design

**Status**: Approved | **Date**: 2026-05-17

## Scope

A "style skill" system that lets users provide a web novel sample (参考范文), have AI analyze and extract the writing style, save it as a reusable skill, and invoke it during AI-assisted writing to match that style.

Three aspects:
1. **Input** — provide sample text from chapters, external files, or paste
2. **Analysis** — AI extracts a structured style profile (风格画像) plus retains original excerpts
3. **Invocation** — select a style skill in the AI panel to inject into the system prompt for any AI mode

## Data Model

New table `style_skills`:

```sql
CREATE TABLE IF NOT EXISTS style_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'paste',  -- 'chapter' | 'file' | 'paste'
  source_text TEXT DEFAULT '',
  style_profile TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
);
```

Style skills are scoped to a novel (novel_id). `source_text` holds the original sample, `style_profile` holds the AI-generated description. `is_default` marks the auto-selected skill in the AI panel.

## IPC Channels

All handlers in `src/main/ipc/styles.ts`, registered in `src/main/index.ts`.

| Channel | Input | Output | Notes |
|---------|-------|--------|-------|
| `style:analyze` | `{ apiKey, model, baseUrl, provider, sourceText }` | string (style profile) | Calls AI with analysis prompt, returns generated profile text |
| `style:create` | `{ novel_id, name, source_type, source_text, style_profile }` | StyleSkill object | |
| `style:list` | `novelId` | StyleSkill[] | List all skills for a novel |
| `style:get` | `skillId` | StyleSkill | Includes source_text and style_profile |
| `style:update` | `skillId, { name?, style_profile?, is_default? }` | void | If setting is_default=1, clear other skills' is_default first |
| `style:delete` | `skillId` | void | |

### AI Analysis Prompt

Sent to the configured AI provider with the sample text:

```
请分析以下网文章节的写作风格，从以下维度提炼风格画像：
1. 句式特点：句子长短偏好、句式变化、段落结构
2. 语言风格：用词习惯（古风/现代/口语化）、修辞手法偏好
3. 叙事节奏：快慢交替方式、悬念密度、场景切换频率
4. 对话风格：对话占比、对话长短、语气特点
5. 描写特点：环境描写、心理描写、动作描写的比重和风格
6. 情感基调：整体情绪氛围（热血/沉稳/悲情/轻松等）

请输出简洁的风格画像描述（200字以内），便于后续 AI 模仿此风格写作。
```

## ai:sendMessage Extension

`ai:sendMessage` gains an optional `styleSkillId?: number` parameter:

```
If styleSkillId is provided:
  1. Query style_skills for name + style_profile
  2. Append to system prompt:
     "请模仿以下写作风格：\n【风格名称】{name}\n【风格描述】{style_profile}"
  3. Style prompt coexists with existing context injection
     (characters, world settings, outlines)
```

## UI Design

### StyleSkillManager Component (New)

`src/renderer/components/Editor/StyleSkillManager.tsx`

**List view:**
- Shows all style skills for the current novel
- Each item: name, source type badge, creation date, default star
- "+ 新建" button at top
- Click item to edit

**Edit/Create view:**
- Name input
- Source type tabs: 章节 / 粘贴 / 文件
- Source text area (collapsible for long text)
- "AI 分析风格" button — calls style:analyze
- Style profile textarea (editable, pre-filled by AI)
- "设为默认" checkbox
- Save / Cancel buttons

### RightPanel Integration

New tab "风格" (🚀 icon) in RightPanel's tab bar, alongside AI / 笔记 / 大纲.

### AI Panel Style Selector

In the AI tab of RightPanel, between the mode selector and the context injection toggle, add:

- Dropdown showing all style skills for the novel
- Default skill (is_default=1) is pre-selected with ⭐ indicator
- "无风格" option to disable style injection
- Small hint text below: "📌 已注入 '{name}' 风格到 system prompt"

## Files Summary

| File | Action |
|------|--------|
| `src/main/database/index.ts` | Add style_skills CREATE TABLE |
| `src/main/ipc/styles.ts` | **New** — register all style IPC handlers |
| `src/main/ipc/ai.ts` | Modify — ai:sendMessage accepts styleSkillId |
| `src/main/index.ts` | Modify — call registerStyleHandlers |
| `src/preload/index.ts` | Modify — add style API bridge, update sendMessage |
| `src/preload/index.d.ts` | Modify — add StyleSkill type, update ApiType |
| `src/renderer/types.ts` | Modify — add StyleSkill interface |
| `src/renderer/components/Editor/StyleSkillManager.tsx` | **New** — CRUD management UI |
| `src/renderer/components/Editor/RightPanel.tsx` | Modify — add style tab + style selector in AI tab |

## Architecture

```
User provides sample text
        ↓
StyleSkillManager → style:analyze → AI generates style_profile
        ↓
style:create → stored in style_skills table
        ↓
RightPanel AI tab → user selects style skill
        ↓
ai:sendMessage({ ...styleSkillId }) → main process injects style into system prompt
        ↓
AI responds in the selected writing style
```

## Edge Cases

- **Empty source text**: Disable "AI 分析" button, show hint "请先提供范文"
- **AI analysis fails**: Show error message, allow manual entry of style profile
- **Set default clears others**: When updating a skill's is_default to 1, set all other skills for that novel to is_default=0
- **Deleting default skill**: Next available skill (if any) does not auto-become default — user must explicitly set one
- **No style skills exist**: Style selector shows "暂无风格技能，去创建" with link to style tab
