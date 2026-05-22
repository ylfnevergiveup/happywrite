import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'

interface FileImportResult {
  success: boolean
  error?: string
  content?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  charCount?: number
}

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.epub']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_CHAR_COUNT = 500000 // ~100k words

function extractEpubText(filePath: string): string {
  const zip = new AdmZip(filePath)
  const entries = zip.getEntries()

  // EPUB content is typically in .xhtml or .html files inside OEBPS or similar dirs
  const contentEntries = entries.filter(
    (e) => !e.isDirectory &&
      (e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.html') || e.entryName.endsWith('.htm')) &&
      !e.entryName.includes('nav') &&
      !e.entryName.includes('toc')
  )

  // Sort by entry name to maintain chapter order
  contentEntries.sort((a, b) => a.entryName.localeCompare(b.entryName))

  const parts: string[] = []
  for (const entry of contentEntries) {
    const html = entry.getData().toString('utf-8')
    // Strip HTML tags
    const text = html
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (text.length > 10) {
      parts.push(text)
    }
  }

  return parts.join('\n\n---\n\n')
}

export function registerImportHandlers(ipc: typeof ipcMain) {
  ipc.handle('import:openFile', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入文件进行拆书分析',
      filters: [
        {
          name: '文档文件',
          extensions: ['txt', 'md', 'markdown', 'epub'],
        },
        { name: '文本文件', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'EPUB 电子书', extensions: ['epub'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '用户取消' } as FileImportResult
    }

    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase()

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        success: false,
        error: `不支持的文件类型 ${ext}。支持的类型: .txt, .md, .epub`,
        fileName: path.basename(filePath),
      } as FileImportResult
    }

    try {
      const stat = fs.statSync(filePath)

      if (stat.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)。最大支持 10MB。`,
          fileName: path.basename(filePath),
          fileSize: stat.size,
        } as FileImportResult
      }

      let content: string

      if (ext === '.epub') {
        content = extractEpubText(filePath)
      } else {
        content = fs.readFileSync(filePath, 'utf-8')
      }

      // Trim if too long
      if (content.length > MAX_CHAR_COUNT) {
        content = content.slice(0, MAX_CHAR_COUNT) + '\n\n[文件过长，已截取前50万字进行分析...]'
      }

      return {
        success: true,
        content,
        fileName: path.basename(filePath),
        fileType: ext === '.epub' ? 'EPUB 电子书' : ext === '.md' || ext === '.markdown' ? 'Markdown' : '纯文本',
        fileSize: stat.size,
        charCount: content.length,
      } as FileImportResult
    } catch (e: any) {
      return {
        success: false,
        error: `读取文件失败: ${e?.message || String(e)}`,
        fileName: path.basename(filePath),
      } as FileImportResult
    }
  })
}
