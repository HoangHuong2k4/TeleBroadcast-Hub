import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, Edit2, Eye, Image as ImageIcon, ToggleLeft, ToggleRight,
  Sparkles, X, AlertCircle, CheckCircle, Copy, Check,
  Bold, Italic, Underline, Strikethrough, Code, Quote, Smile, EyeOff,
  Download, Link, CheckCircle2, Upload, FileText, RefreshCw, Search,
  Filter, User as UserIcon, Layers, ExternalLink, ZoomIn, MessageSquare
} from 'lucide-react'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'

// ─── Helper: Clean Snippet for Table View ────────────────────────────────────
function cleanSnippet(text) {
  if (!text) return 'Nội dung trống'
  return text
    .replace(/\[\d{15,}\]/g, '') // Bỏ ID custom emoji thô [5384215120169682553]
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/<[^>]+>/g, '') // Bỏ HTML tags
    .replace(/\{([^{}|]+)(?:\|[^{}|]+)*\}/g, '$1') // Lấy biến thể đầu tiên của spintax
    .replace(/\s+/g, ' ')
    .trim() || 'Nội dung kịch bản (Custom Emoji)'
}

// ─── Helper: insert HTML tag around selection ───────────────────────────────
function wrapSelection(textarea, openTag, closeTag) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const val = textarea.value
  const selected = val.substring(start, end)
  if (!selected) return null
  const newVal = val.substring(0, start) + openTag + selected + closeTag + val.substring(end)
  return { newVal, cursor: start + openTag.length + selected.length + closeTag.length }
}

// ─── Helper: render HTML tags for preview ──────────────────────────────────
function renderPreviewHTML(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const tags = ['b', 'i', 'u', 's', 'code', 'blockquote', 'pre']
  tags.forEach(t => {
    html = html
      .replace(new RegExp(`&lt;${t}&gt;`, 'g'), `<${t}>`)
      .replace(new RegExp(`&lt;/${t}&gt;`, 'g'), `</${t}>`)
  })
  html = html
    .replace(/&lt;tg-spoiler&gt;/g, '<span class="tg-spoiler">')
    .replace(/&lt;\/tg-spoiler&gt;/g, '</span>')
  html = html.replace(
    /&lt;tg-emoji emoji-id=&quot;(\d+)&quot;&gt;([\s\S]*?)&lt;\/tg-emoji&gt;/g,
    '<span class="tg-emoji-preview" title="Custom Emoji: $1">$2</span>'
  )
  html = html.replace(/\n/g, '<br/>')
  return html
}

// ─── Import từ Telegram Modal ────────────────────────────────────────────
function ImportFromTelegramModal({ onImport, onClose }) {
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!link.trim()) return
    try {
      setLoading(true)
      setResult(null)
      const res = await api.post('/import/from-link', { link: link.trim() })
      setResult(res.data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUse = () => {
    onImport(result.html)
    onClose()
    toast.success('Đã import nội dung!')
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-green-700/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Download size={18} className="text-green-400" />
            Import từ Telegram
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 mb-4 text-xs text-gray-400 space-y-1">
          <p>📌 <strong className="text-gray-300">Cách 1:</strong> Copy link tin nhắn từ Telegram (chuột phải → "Copy Message Link")</p>
          <p>📌 <strong className="text-gray-300">Cách 2:</strong> Mở tin nhắn trên Telegram Web → copy URL trên thanh địa chỉ</p>
          <p className="text-green-400">✅ Userbot sẽ tự fetch và giữ nguyên toàn bộ định dạng + custom emoji</p>
        </div>

        <form onSubmit={handleFetch} className="space-y-3">
          <div>
            <label className="label">Link tin nhắn Telegram</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="https://t.me/channel/123 hoặc https://t.me/c/1234/456"
                value={link}
                onChange={e => setLink(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={loading || !link.trim()} className="btn-primary px-4">
                <Link size={16} />
                {loading ? 'Fetch...' : 'Fetch'}
              </button>
            </div>
          </div>
        </form>

        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {result.stats?.total_entities > 0 && (
                <span className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded text-gray-300">
                  {result.stats.total_entities} entities
                </span>
              )}
              {result.stats?.custom_emoji > 0 && (
                <span className="text-xs bg-purple-900/30 border border-purple-700/40 px-2 py-1 rounded text-purple-300">
                  ✨ {result.stats.custom_emoji} custom emoji
                </span>
              )}
              {result.stats?.bold > 0 && (
                <span className="text-xs bg-blue-900/30 border border-blue-700/40 px-2 py-1 rounded text-blue-300">
                  <strong>B</strong> {result.stats.bold} bold
                </span>
              )}
            </div>

            <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 max-h-48 overflow-auto">
              <div
                className="text-sm text-gray-200 whitespace-pre-wrap telegram-preview"
                dangerouslySetInnerHTML={{ __html: renderPreviewHTML(result.html) }}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Đóng</button>
              <button onClick={handleUse} className="btn-primary flex-1">
                <CheckCircle2 size={16} />
                Áp dụng vào kịch bản
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal Import Kịch Bản Từ File JSON ─────────────────────────────────────
function ImportTemplatesModal({ onClose, onSuccess }) {
  const [jsonText, setJsonText] = useState('')
  const [parsedItems, setParsedItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result)
        const items = Array.isArray(parsed) ? parsed : (parsed.templates || [])
        setParsedItems(items)
        setJsonText(JSON.stringify(items, null, 2))
        setError('')
      } catch (err) {
        setError('File JSON không hợp lệ: ' + err.message)
      }
    }
    reader.readAsText(f)
  }

  const handleTextChange = (val) => {
    setJsonText(val)
    if (!val.trim()) {
      setParsedItems([])
      setError('')
      return
    }
    try {
      const parsed = JSON.parse(val)
      const items = Array.isArray(parsed) ? parsed : (parsed.templates || [])
      setParsedItems(items)
      setError('')
    } catch (err) {
      setError('Chuỗi JSON chưa đúng: ' + err.message)
      setParsedItems([])
    }
  }

  const handleImport = async () => {
    if (parsedItems.length === 0) return toast.error('Không có kịch bản hợp lệ để nhập')
    try {
      setLoading(true)
      const res = await api.post('/templates/import', { templates: parsedItems })
      toast.success(res.message || `Đã nhập thành công ${res.imported} kịch bản`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload size={16} className="text-blue-400" />
              Nhập kịch bản từ file JSON
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Tải file .json xuất từ hệ thống hoặc dán mã JSON trực tiếp</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Cách 1: Tải file .json</label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Cách 2: Hoặc dán JSON trực tiếp</label>
          <textarea
            rows={4}
            value={jsonText}
            onChange={e => handleTextChange(e.target.value)}
            placeholder='[{"name": "Tin KM 1", "content": "Nội dung..."}, ...]'
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {parsedItems.length > 0 && (
          <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
            <div className="text-xs font-bold text-emerald-400">
              ✅ Tìm thấy {parsedItems.length} kịch bản sẵn sàng nhập:
            </div>
            <div className="space-y-1">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/80 px-2 py-1 rounded">
                  <span className="font-semibold truncate max-w-[180px]">{item.name || `Kịch bản ${idx + 1}`}</span>
                  <span className="text-gray-500 font-mono truncate max-w-[200px]">{item.content ? item.content.slice(0, 35) + '...' : 'Trống'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-800">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || parsedItems.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <Upload size={14} />
            {loading ? 'Đang nhập...' : `Nhập ${parsedItems.length} kịch bản`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom Emoji Dialog ────────────────────────────────────────────────────
function EmojiIdDialog({ onInsert, onClose }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState([])
  const [fallback, setFallback] = useState('⭐')

  const parseIds = (text) => {
    const ids = new Set()
    const patterns = [/\[(\d{15,})\]/g, /(?<!\d)(\d{15,})(?!\d)/g, /emoji-id="(\d+)"/g]
    for (const re of patterns) {
      let m; while ((m = re.exec(text)) !== null) ids.add(m[1])
    }
    return [...ids]
  }

  useEffect(() => { setParsed(parseIds(raw)) }, [raw])

  const handleInsert = (id) => {
    onInsert(`<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`)
  }
  const handleInsertAll = () => {
    onInsert(parsed.map(id => `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`).join(' '))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-purple-700/50 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-xl">✨</span> Custom Emoji Premium
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Dán ID emoji hoặc đoạn text CMS</label>
            <textarea
              className="input h-32 font-mono text-xs resize-none"
              placeholder={"Dán ID dạng:\n5384215120169682553\n[5386505875336744038]\nHoặc paste cả đoạn CMS có nhiều ID..."}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Ký tự fallback hiển thị</label>
            <input
              className="input"
              placeholder="⭐"
              value={fallback}
              onChange={e => setFallback(e.target.value || '⭐')}
            />
          </div>
          {parsed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-green-400">✅ Phát hiện {parsed.length} custom emoji ID</p>
                <button onClick={handleInsertAll} className="btn-primary text-xs py-1 px-3">Chèn tất cả</button>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 space-y-1 max-h-40 overflow-auto">
                {parsed.map(id => (
                  <div key={id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-purple-300 truncate">ID: {id}</span>
                    <button
                      onClick={() => { handleInsert(id); onClose() }}
                      className="btn-secondary py-0.5 px-2 text-xs flex-shrink-0"
                    >
                      Chèn
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Formatting Toolbar ─────────────────────────────────────────────────────
function FormatToolbar({ textareaRef, onChange }) {
  const [showEmojiDialog, setShowEmojiDialog] = useState(false)

  const applyFormat = useCallback((openTag, closeTag) => {
    const ta = textareaRef.current
    if (!ta) return
    const result = wrapSelection(ta, openTag, closeTag)
    if (!result) return toast('Hãy bôi đen text trước', { icon: '👆' })
    onChange(result.newVal)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(result.cursor, result.cursor)
    })
  }, [textareaRef, onChange])

  const insertAtCursor = useCallback((text) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const newVal = ta.value.substring(0, start) + text + ta.value.substring(start)
    onChange(newVal)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + text.length, start + text.length)
    })
  }, [textareaRef, onChange])

  const btns = [
    { icon: <Bold size={14} />, label: 'Bold', open: '<b>', close: '</b>' },
    { icon: <Italic size={14} />, label: 'Italic', open: '<i>', close: '</i>' },
    { icon: <Underline size={14} />, label: 'Underline', open: '<u>', close: '</u>' },
    { icon: <Strikethrough size={14} />, label: 'Strikethrough', open: '<s>', close: '</s>' },
    { icon: <EyeOff size={14} />, label: 'Spoiler', open: '<tg-spoiler>', close: '</tg-spoiler>' },
    { icon: <Code size={14} />, label: 'Code', open: '<code>', close: '</code>' },
    { icon: <Quote size={14} />, label: 'Blockquote', open: '<blockquote>', close: '</blockquote>' },
  ]

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap bg-gray-800/80 border border-gray-700 rounded-t-xl px-2.5 py-1.5">
        {btns.map(b => (
          <button
            key={b.label}
            type="button"
            title={b.label}
            onClick={() => applyFormat(b.open, b.close)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            {b.icon}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-700 mx-1" />
        <button
          type="button"
          title="Custom Emoji Premium"
          onClick={() => setShowEmojiDialog(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 transition-colors text-xs font-medium"
        >
          <Smile size={14} />
          <span>Custom Emoji</span>
          <span className="text-[10px] bg-purple-700/40 text-purple-300 px-1 rounded">✨</span>
        </button>
        <div className="ml-auto text-xs text-gray-500 hidden sm:block">Bôi đen → bấm định dạng</div>
      </div>
      {showEmojiDialog && (
        <EmojiIdDialog
          onInsert={insertAtCursor}
          onClose={() => setShowEmojiDialog(false)}
        />
      )}
    </>
  )
}

// ─── Modal Xem Thử Spintax Trực Tiếp ─────────────────────────────────────────
function SpintaxPreviewModal({ content, onClose }) {
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedIdx, setCopiedIdx] = useState(null)

  const fetchPreviews = async () => {
    try {
      setLoading(true)
      const res = await api.post('/templates/preview-spintax', { content })
      setPreviews(res.data?.previews || [content])
    } catch (err) {
      toast.error('Lỗi phân tích Spintax: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (content) fetchPreviews()
  }, [content])

  const copyText = (txt, idx) => {
    navigator.clipboard.writeText(txt)
    setCopiedIdx(idx)
    toast.success('Đã sao chép nội dung!')
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-xl border border-yellow-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Xem Thử Biến Thể Spintax</h3>
              <p className="text-[11px] text-gray-400">Mỗi lần gửi tin, hệ thống sẽ ngẫu nhiên chọn một biến thể</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPreviews}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded-xl transition-colors"
              title="Quay biến thể mới"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs">Đang sinh biến thể Spintax...</div>
          ) : (
            previews.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    Biến thể #{idx + 1}
                  </span>
                  <button
                    onClick={() => copyText(item, idx)}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {copiedIdx === idx ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copiedIdx === idx ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
                <div
                  className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed telegram-preview"
                  dangerouslySetInnerHTML={{ __html: renderPreviewHTML(item) }}
                />
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Xem Trước Kịch Bản Chuẩn Telegram ──────────────────────────────
function TemplatePreviewModal({ template, onClose }) {
  const [previews, setPreviews] = useState([])
  const [hasSpintax, setHasSpintax] = useState(false)
  const [activeVariant, setActiveVariant] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadVariants = () => {
    setLoading(true)
    api.post('/templates/preview-spintax', { content: template.content })
      .then(res => {
        setPreviews(res.data?.previews || [template.content])
        setHasSpintax(res.data?.hasSpintax || false)
        setActiveVariant(0)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadVariants()
  }, [template.content])

  const currentText = previews[activeVariant] || template.content

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Eye size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate max-w-[260px]">{template.name}</h3>
              <p className="text-[11px] text-gray-400">Xem trước kịch bản hiển thị Telegram</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hasSpintax && (
              <button
                onClick={loadVariants}
                disabled={loading}
                title="Xoay tạo biến thể Spintax mới"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-700/40 rounded-xl text-xs font-medium transition-colors"
              >
                <Sparkles size={13} className={loading ? 'animate-spin' : ''} />
                <span>Xoay biến thể</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {hasSpintax && previews.length > 1 && (
          <div className="flex items-center gap-1.5 px-5 pt-3 pb-1 border-b border-gray-800/80 bg-gray-950/40">
            <span className="text-[11px] text-gray-500 mr-1">Biến thể:</span>
            {previews.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveVariant(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeVariant === idx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                Bản #{idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 bg-gray-950/60">
          <div className="bg-[#182533] border border-[#243447] rounded-2xl p-4 shadow-xl max-w-md mx-auto">
            <div className="flex items-center gap-2.5 mb-3 pb-2.5 border-b border-[#2b3e55]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow">
                {(template.name || 'TG').substring(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[240px]">
                  {template.name}
                </div>
                <div className="text-[10px] text-blue-300">Kênh / Nhóm Telegram</div>
              </div>
            </div>

            <div className="bg-[#2b5278] rounded-2xl p-3.5 text-white shadow-md space-y-2">
              {template.image_path && (
                <div className="rounded-xl overflow-hidden bg-black/40 border border-white/10 mb-2">
                  <img
                    src={`/uploads/${template.image_path}`}
                    alt="Template attachment"
                    className="w-full max-h-56 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              {loading ? (
                <div className="py-8 text-center text-xs text-blue-200">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-300" />
                  Đang phân tích kịch bản...
                </div>
              ) : (
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap font-sans break-words telegram-preview"
                  dangerouslySetInnerHTML={{ __html: renderPreviewHTML(currentText) }}
                />
              )}

              <div className="text-[10px] text-blue-200 text-right pt-1 font-mono">
                12:00 ✓✓
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-gray-900/90 text-xs text-gray-500">
          <span>
            {hasSpintax ? '✨ Cú pháp Spintax tự động xoay ngẫu nhiên khi phát' : '📄 Bài viết cố định (không dùng Spintax)'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Phóng To Ảnh ────────────────────────────────────────────────────
function ImageZoomModal({ imageSrc, title, onClose }) {
  if (!imageSrc) return null
  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80] flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl p-2"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full z-10 transition-colors"
        >
          <X size={18} />
        </button>
        <img
          src={imageSrc}
          alt={title || 'Image preview'}
          className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain mx-auto"
        />
        {title && (
          <p className="text-center text-xs text-gray-400 mt-2 font-medium">{title}</p>
        )}
      </div>
    </div>
  )
}

// ─── Template Create / Edit Modal ──────────────────────────────────────────
function TemplateModal({ template, users, currentUser, defaultUserId, onClose, onSuccess }) {
  const isEdit = !!template
  const isAdmin = currentUser?.role === 'admin'
  const [form, setForm] = useState({
    name: template?.name || '',
    content: template?.content || '',
    is_active: template?.is_active ?? 1,
    user_id: template?.user_id || defaultUserId || currentUser?.id || 1,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(
    template?.image_path ? `/uploads/${template.image_path}` : null
  )
  const [removeImage, setRemoveImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSpintaxTester, setShowSpintaxTester] = useState(false)
  const [showRawPreview, setShowRawPreview] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const textareaRef = useRef(null)

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.content.trim()) {
      return toast.error('Vui lòng điền đủ tên kịch bản và nội dung')
    }
    try {
      setLoading(true)
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('content', form.content)
      fd.append('is_active', form.is_active ? '1' : '0')
      if (isAdmin && form.user_id) {
        fd.append('user_id', String(form.user_id))
      }
      if (imageFile) fd.append('image', imageFile)
      if (removeImage) fd.append('remove_image', '1')

      if (isEdit) {
        await api.put(`/templates/${template.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success('Đã cập nhật kịch bản')
      } else {
        await api.post('/templates', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success('Đã tạo kịch bản mới')
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div>
              <h2 className="font-bold text-white text-lg flex items-center gap-2">
                <FileText size={20} className="text-blue-400" />
                {isEdit ? 'Chỉnh Sửa Kịch Bản' : 'Tạo Kịch Bản Mới'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Thiết lập nội dung bài đăng chuẩn Telegram, hỗ trợ Spintax & gắn ảnh
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 px-3 py-1.5 rounded-xl transition-colors font-medium"
              >
                <Download size={14} />
                Import Telegram
              </button>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Tên kịch bản <span className="text-rose-400">*</span></label>
                <input
                  className="input"
                  placeholder="Ví dụ: Chợ Mới - Rao Bán Dịch Vụ"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              {isAdmin && users && users.length > 0 && (
                <div>
                  <label className="label flex items-center gap-1.5">
                    <UserIcon size={13} className="text-purple-400" />
                    Thuộc Người Dùng (Phân quyền)
                  </label>
                  <select
                    className="input bg-gray-800 text-white"
                    value={form.user_id || ''}
                    onChange={e => setForm(f => ({ ...f, user_id: parseInt(e.target.value) }))}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.username} ({u.username} - ID: {u.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Nội dung bài viết <span className="text-rose-400">*</span></label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRawPreview(v => !v)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <Eye size={13} />
                    {showRawPreview ? 'Ẩn preview' : 'Preview định dạng'}
                  </button>
                  <button
                    type="button"
                    onClick={() => form.content && setShowSpintaxTester(true)}
                    className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 font-medium"
                  >
                    <Sparkles size={13} />
                    Xem trước Spintax
                  </button>
                </div>
              </div>

              {/* Formatting Toolbar */}
              <FormatToolbar
                textareaRef={textareaRef}
                onChange={(val) => setForm(f => ({ ...f, content: val }))}
              />

              <textarea
                ref={textareaRef}
                className="input h-56 resize-none font-mono text-xs leading-relaxed rounded-t-none border-t-0"
                placeholder={`{Chào|Hi|Hello} mọi người! 👋\n\n<b>Sản phẩm nổi bật:</b>\n✅ Dịch vụ uy tín - <i>Bảo hành chu đáo</i>\n✅ Giá rẻ thị trường\n\n<tg-spoiler>🔥 Khuyến mãi sốc hôm nay</tg-spoiler>\n\nLiên hệ ngay: @username`}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
              />

              {showRawPreview && form.content && (
                <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 mb-1 font-medium">📱 Preview hiển thị text Telegram:</p>
                  <div
                    className="text-gray-100 text-xs whitespace-pre-wrap leading-relaxed telegram-preview"
                    dangerouslySetInnerHTML={{ __html: renderPreviewHTML(form.content) }}
                  />
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span>💡 <code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-300 font-mono">{'{ Chào | Hello }'}</code> Spintax</span>
                <span>• <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300 font-mono">{'<b>'}</code> Bold</span>
                <span>• <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300 font-mono">{'<i>'}</code> Italic</span>
                <span>• <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300 font-mono">{'<u>'}</code> Underline</span>
                <span>• <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300 font-mono">{'<tg-spoiler>'}</code> Ẩn</span>
              </div>
            </div>

            {/* Ảnh đính kèm */}
            <div>
              <label className="label">Ảnh đính kèm bài viết</label>
              {imagePreview ? (
                <div className="relative inline-block mt-1">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-auto rounded-xl border border-gray-700 object-cover shadow"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 rounded-full p-1 text-white shadow"
                    title="Gỡ ảnh này"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-4 text-gray-400 hover:text-blue-400 transition-colors w-fit">
                  <ImageIcon size={18} />
                  <span className="text-xs font-medium">Tải ảnh lên (JPG/PNG, gửi kèm bài viết)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>

            {/* Trạng thái toggle */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: f.is_active ? 0 : 1 }))}
                className="focus:outline-none"
              >
                {form.is_active
                  ? <ToggleRight size={26} className="text-emerald-400" />
                  : <ToggleLeft size={26} className="text-gray-600" />
                }
              </button>
              <span className="text-xs text-gray-300 font-medium">
                {form.is_active ? 'Đang bật – Kịch bản sẽ được quay ngẫu nhiên khi gửi' : 'Đang tắt – Kịch bản bị tạm dừng'}
              </span>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-gray-800">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Hủy
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật kịch bản' : 'Tạo kịch bản mới'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showSpintaxTester && form.content && (
        <SpintaxPreviewModal content={form.content} onClose={() => setShowSpintaxTester(false)} />
      )}
      {showImport && (
        <ImportFromTelegramModal
          onImport={(html) => setForm(f => ({ ...f, content: html }))}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  )
}

// ─── Main Component: Templates Page (Compact, Sleek & Modern Table) ──────────
export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserFilter, setSelectedUserFilter] = useState('all') // 'all' or user_id
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)
  const [activeSpintaxContent, setActiveSpintaxContent] = useState(null)

  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

  const fetchUsers = async () => {
    if (!isAdmin) return
    try {
      const res = await api.get('/users')
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data)
      }
    } catch (_) {}
  }

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await api.get('/templates')
      setTemplates(res.data || [])
    } catch (err) {
      toast.error('Lỗi tải kịch bản: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
    fetchUsers()
  }, [])

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      // User filter
      if (isAdmin && selectedUserFilter !== 'all') {
        if (Number(tpl.user_id) !== Number(selectedUserFilter)) return false
      }

      // Status filter
      if (statusFilter === 'active' && !tpl.is_active) return false
      if (statusFilter === 'inactive' && tpl.is_active) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = (tpl.name || '').toLowerCase().includes(q)
        const contentMatch = (tpl.content || '').toLowerCase().includes(q)
        const ownerMatch = (tpl.owner_name || tpl.owner_username || '').toLowerCase().includes(q)
        if (!nameMatch && !contentMatch && !ownerMatch) return false
      }

      return true
    })
  }, [templates, selectedUserFilter, statusFilter, searchQuery, isAdmin])

  // Stats
  const stats = useMemo(() => {
    const total = templates.length
    const active = templates.filter(t => t.is_active).length
    const withImage = templates.filter(t => t.image_path).length
    const withSpintax = templates.filter(t => /\{[^{}]*\|[^{}]*\}/.test(t.content || '')).length
    return { total, active, inactive: total - active, withImage, withSpintax }
  }, [templates])

  // Single Actions
  const handleToggle = async (tpl) => {
    try {
      const newStatus = tpl.is_active ? 0 : 1
      await api.put(`/templates/${tpl.id}`, { is_active: newStatus })
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, is_active: newStatus } : t))
      toast.success(newStatus ? `Đã bật "${tpl.name}"` : `Đã tắt "${tpl.name}"`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (tpl) => {
    if (!confirm(`Bạn có chắc muốn xóa kịch bản "${tpl.name}"?`)) return
    try {
      await api.delete(`/templates/${tpl.id}`)
      toast.success('Đã xóa kịch bản thành công')
      setTemplates(prev => prev.filter(t => t.id !== tpl.id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(tpl.id)
        return next
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDuplicate = async (tpl) => {
    try {
      const res = await api.post(`/templates/${tpl.id}/duplicate`)
      if (res.success && res.data) {
        toast.success(`Đã nhân bản kịch bản thành "${res.data.name}"!`)
        fetchTemplates()
      }
    } catch (err) {
      toast.error('Lỗi nhân bản: ' + err.message)
    }
  }

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredTemplates.map(t => t.id)))
    }
  }

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkToggle = async (active) => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      await api.patch('/templates/bulk-toggle', { ids, is_active: active ? 1 : 0 })
      toast.success(active ? `Đã bật ${ids.length} kịch bản` : `Đã tắt ${ids.length} kịch bản`)
      setTemplates(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_active: active ? 1 : 0 } : t))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Xác nhận xóa vĩnh viễn ${selectedIds.size} kịch bản đã chọn?`)) return
    try {
      const ids = Array.from(selectedIds)
      await api.post('/templates/bulk-delete', { ids })
      toast.success(`Đã xóa ${ids.length} kịch bản`)
      setTemplates(prev => prev.filter(t => !ids.includes(t.id)))
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get('/templates/export')
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `kich_ban_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success(`Đã xuất ${res.total || res.templates?.length || 0} kịch bản thành công!`)
    } catch (err) {
      toast.error('Lỗi xuất kịch bản: ' + err.message)
    }
  }

  return (
    <div className="space-y-4 max-w-full">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Quản Lý Kịch Bản Tin Nhắn
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 font-mono">
                {templates.length} bài
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Kho bài viết tự động phát — hỗ trợ Spintax quay ngẫu nhiên & gắn ảnh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-medium transition-colors"
            title="Xuất file JSON"
          >
            <Download size={13} className="text-blue-400" />
            Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-medium transition-colors"
            title="Nhập file JSON"
          >
            <Upload size={13} className="text-emerald-400" />
            Import
          </button>
          <button
            onClick={() => {
              setEditTemplate(null)
              setShowModal(true)
            }}
            className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 shadow"
          >
            <Plus size={15} />
            Tạo Kịch Bản Mới
          </button>
        </div>
      </div>

      {/* Filter Toolbar: User Tabs + Search + Status Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        {/* Left: User filter tabs (Admin) or Search */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {isAdmin && (
            <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800/90 text-xs flex-shrink-0">
              <button
                onClick={() => setSelectedUserFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedUserFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Tất cả ({templates.length})
              </button>
              <button
                onClick={() => setSelectedUserFilter(1)}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  selectedUserFilter === 1
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-purple-300'
                }`}
              >
                👑 Hương
                <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full">
                  {templates.filter(t => Number(t.user_id) === 1).length}
                </span>
              </button>
              <button
                onClick={() => setSelectedUserFilter(2)}
                className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  selectedUserFilter === 2
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-emerald-300'
                }`}
              >
                👤 Hiệp
                <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full">
                  {templates.filter(t => Number(t.user_id) === 2).length}
                </span>
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Tìm theo tên kịch bản, nội dung..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Status Filter Pills */}
        <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800/90 text-xs flex-shrink-0 self-start md:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Tất cả ({templates.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Đang bật ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              statusFilter === 'inactive' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Đang tắt ({stats.inactive})
          </button>
        </div>
      </div>

      {/* Floating Batch Actions Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-30 bg-blue-950/95 border border-blue-600/50 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs text-blue-200 font-semibold">
            <CheckCircle2 size={15} className="text-blue-400" />
            <span>Đã chọn <strong className="text-white font-bold">{selectedIds.size}</strong> kịch bản:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors shadow"
            >
              <ToggleRight size={14} />
              Bật
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-semibold transition-colors shadow"
            >
              <ToggleLeft size={14} />
              Tắt
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors shadow"
            >
              <Trash2 size={13} />
              Xóa
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1 text-gray-400 hover:text-white text-xs"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Compact Modern Data Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <RefreshCw size={22} className="animate-spin mx-auto text-blue-400" />
            <p className="text-xs">Đang tải danh sách kịch bản...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-14 text-center space-y-2.5">
            <AlertCircle size={36} className="text-gray-600 mx-auto" />
            <p className="text-gray-400 text-xs font-medium">Không tìm thấy kịch bản nào phù hợp</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedUserFilter('all')
                setStatusFilter('all')
              }}
              className="px-3 py-1 bg-gray-800 text-gray-300 rounded-xl text-xs hover:bg-gray-700"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-gray-950 border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredTemplates.length}
                      onChange={toggleSelectAll}
                      className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-2 w-12 text-center">ID</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Tên Kịch Bản</th>
                  <th className="py-2.5 px-2 w-14 text-center">Ảnh</th>
                  <th className="py-2.5 px-3 min-w-[260px]">Nội Dung Bài Viết (Xem Nhanh)</th>
                  {isAdmin && <th className="py-2.5 px-3 w-28 text-center">Người Tạo</th>}
                  <th className="py-2.5 px-2 w-24 text-center">Trạng Thái</th>
                  <th className="py-2.5 px-3 w-32 text-right pr-4">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-xs">
                {filteredTemplates.map((tpl, index) => {
                  const isChecked = selectedIds.has(tpl.id)
                  const hasSpintax = /\{[^{}]*\|[^{}]*\}/.test(tpl.content || '')
                  const ownerIsAdmin = tpl.user_id === 1 || tpl.owner_username === 'admin'
                  const readableText = cleanSnippet(tpl.content)

                  return (
                    <tr
                      key={tpl.id}
                      className={`transition-colors hover:bg-gray-800/40 ${
                        isChecked ? 'bg-blue-950/25' : ''
                      } ${!tpl.is_active ? 'opacity-65' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(tpl.id)}
                          className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-2.5 px-2 text-center text-gray-500 font-mono text-[11px]">
                        #{tpl.id}
                      </td>

                      {/* Tên Kịch Bản & Tag */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span
                            onClick={() => setPreviewTemplate(tpl)}
                            className="font-semibold text-white text-xs hover:text-blue-400 cursor-pointer transition-colors truncate max-w-[200px]"
                            title={tpl.name}
                          >
                            {tpl.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasSpintax && (
                              <span
                                onClick={() => setActiveSpintaxContent(tpl.content)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-purple-950/80 border border-purple-800/50 text-purple-300 font-medium cursor-pointer hover:bg-purple-900"
                                title="Bấm xem thử các biến thể Spintax"
                              >
                                <Sparkles size={9} />
                                Spintax
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500 font-mono">
                              {new Date(tpl.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Thumbnail Ảnh */}
                      <td className="py-2.5 px-2 text-center">
                        {tpl.image_path ? (
                          <div
                            onClick={() => setZoomImage({ url: `/uploads/${tpl.image_path}`, title: tpl.name })}
                            className="relative group inline-block cursor-pointer"
                            title="Bấm để phóng to ảnh"
                          >
                            <img
                              src={`/uploads/${tpl.image_path}`}
                              alt={tpl.name}
                              className="w-8 h-8 rounded-lg object-cover border border-gray-700 group-hover:border-blue-400 group-hover:scale-110 transition-all shadow-sm mx-auto"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                              <ZoomIn size={12} className="text-white" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-600">—</span>
                        )}
                      </td>

                      {/* Nội Dung Rút Gọn (Đã lọc mã custom emoji rác) */}
                      <td className="py-2.5 px-3">
                        <div
                          onClick={() => setPreviewTemplate(tpl)}
                          className="text-xs text-gray-300 hover:text-blue-300 cursor-pointer transition-colors leading-relaxed line-clamp-1 font-sans"
                          title="Bấm để xem đầy đủ giả lập tin nhắn Telegram"
                        >
                          {readableText}
                        </div>
                      </td>

                      {/* Người Tạo (Admin View) */}
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            ownerIsAdmin
                              ? 'bg-purple-950/70 border border-purple-800/50 text-purple-300'
                              : 'bg-emerald-950/70 border border-emerald-800/50 text-emerald-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ownerIsAdmin ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                            {ownerIsAdmin ? 'Hương' : 'Hiệp'}
                          </span>
                        </td>
                      )}

                      {/* Trạng Thái Toggle */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleToggle(tpl)}
                          className="focus:outline-none transition-transform active:scale-95 inline-flex"
                          title={tpl.is_active ? 'Bấm để Tắt' : 'Bấm để Bật'}
                        >
                          {tpl.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 border border-emerald-800/50 text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Bật
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                              Tắt
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Thao Tác Nhanh */}
                      <td className="py-2.5 px-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewTemplate(tpl)}
                            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Xem trước tin nhắn Telegram"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDuplicate(tpl)}
                            className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Nhân bản kịch bản"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => setEditTemplate(tpl)}
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(tpl)}
                            className="p-1 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Xóa kịch bản"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info bar */}
        <div className="bg-gray-950 px-4 py-2.5 border-t border-gray-800 text-[11px] text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Hiển thị <strong>{filteredTemplates.length}</strong> / <strong>{templates.length}</strong> kịch bản
          </span>
          <div className="flex items-center gap-3 text-gray-400">
            <span>🟢 Bật: <strong className="text-emerald-400">{stats.active}</strong></span>
            <span>🔴 Tắt: <strong className="text-rose-400">{stats.inactive}</strong></span>
            <span>🖼️ Ảnh: <strong className="text-blue-400">{stats.withImage}</strong></span>
            <span>✨ Spintax: <strong className="text-purple-400">{stats.withSpintax}</strong></span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(showModal || editTemplate) && (
        <TemplateModal
          template={editTemplate}
          users={users}
          currentUser={currentUser}
          defaultUserId={selectedUserFilter !== 'all' ? selectedUserFilter : (currentUser?.id || 1)}
          onClose={() => { setShowModal(false); setEditTemplate(null) }}
          onSuccess={fetchTemplates}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {showImportModal && (
        <ImportTemplatesModal
          onClose={() => setShowImportModal(false)}
          onSuccess={fetchTemplates}
        />
      )}

      {zoomImage && (
        <ImageZoomModal
          imageSrc={zoomImage.url}
          title={zoomImage.title}
          onClose={() => setZoomImage(null)}
        />
      )}

      {activeSpintaxContent && (
        <SpintaxPreviewModal
          content={activeSpintaxContent}
          onClose={() => setActiveSpintaxContent(null)}
        />
      )}
    </div>
  )
}
