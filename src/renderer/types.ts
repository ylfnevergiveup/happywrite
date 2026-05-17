export interface Novel {
  id: number
  title: string
  description: string
  cover_path: string
  created_at: string
  updated_at: string
}

export interface Volume {
  id: number
  novel_id: number
  title: string
  sort_order: number
  created_at: string
}

export interface Chapter {
  id: number
  novel_id: number
  volume_id: number | null
  volume_title?: string
  title: string
  content: string
  word_count: number
  sort_order: number
  status: string
  notes: string
  created_at: string
  updated_at: string
}

export interface CharacterType {
  id: number
  novel_id: number
  name: string
  aliases: string
  role: string
  description: string
  avatar_path: string
  attributes: string
  relationships: string
  created_at: string
  updated_at: string
}

export interface OutlineNode {
  id: number
  novel_id: number
  parent_id: number | null
  title: string
  description: string
  type: string
  sort_order: number
  chapter_id: number | null
  created_at: string
  updated_at: string
}

export interface WorldSetting {
  id: number
  novel_id: number
  category: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface StyleSkill {
  id: number
  novel_id: number
  name: string
  source_type: string
  source_text: string
  style_profile: string
  is_default: number
  created_at: string
}
