import { useEffect, useState } from 'react'
import {
  Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Upload,
  Search, CheckSquare, Square, FileText, X, Check,
  Play, Hash, AlignLeft, AlignRight, Eye, EyeOff,
  RefreshCw, Settings2, Users, UsersRound, Radio, Clock,
  Sparkles, Layers, Sliders, Calendar, Send, Image, AlertCircle,
  HelpCircle, ChevronRight, ArrowRight, RotateCcw, Download, Store, Globe, ExternalLink
} from 'lucide-react'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'
import GroupAvatar from '../components/GroupAvatar'

// Helper tạo URL Telegram chuẩn mở trên Web/App
function getTelegramUrl(identifier) {
  if (!identifier) return null
  const trimmed = identifier.trim()
  if (trimmed.startsWith('https://t.me/') || trimmed.startsWith('http://t.me/')) {
    return trimmed
  }
  if (trimmed.startsWith('t.me/')) {
    return `https://${trimmed}`
  }
  if (trimmed.startsWith('@')) {
    return `https://t.me/${trimmed.slice(1)}`
  }
  if (!trimmed.startsWith('-') && !trimmed.startsWith('+')) {
    return `https://t.me/${trimmed}`
  }
  return null
}

// ─── Modal Cấu hình Nhóm Toàn Diện (Master & Custom Settings) ────────────────────────
function GroupConfigModal({ group, onClose, onSuccess, clusters = [] }) {
  const [activeTab, setActiveTab] = useState('template') // template | footer | schedule | account | preview
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [allMasterTemplates, setAllMasterTemplates] = useState([])
  const [assignedTemplates, setAssignedTemplates] = useState(new Set())

  // Form State
  const [title, setTitle] = useState(group.title || '')
  const [avatarUrl, setAvatarUrl] = useState(group.avatar_url || '')
  const [syncingMeta, setSyncingMeta] = useState(false)
  const [accountPhone, setAccountPhone] = useState(group.account_phone || '')
  const [clusterId, setClusterId] = useState(group.cluster_id || '')
  
  // 1. Template Settings
  const [templateMode, setTemplateMode] = useState(group.template_mode || 'global') // global | custom
  const [customContent, setCustomContent] = useState(group.custom_content || '')
  const [customImagePath, setCustomImagePath] = useState(group.custom_image_path || '')
  const [uploadingImage, setUploadingImage] = useState(false)

  // 2. Footer / Hashtag Settings
  const [rulePrefix, setRulePrefix] = useState(group.rule_prefix || '')
  const [ruleHashtags, setRuleHashtags] = useState(group.rule_hashtags || '')
  const [ruleSuffix, setRuleSuffix] = useState(group.rule_suffix || '')

  // 3. Schedule Settings
  const [scheduleMode, setScheduleMode] = useState(group.schedule_mode || 'global') // global | custom
  const [timeSlots, setTimeSlots] = useState(() => {
    try {
      const parsed = JSON.parse(group.custom_time_slots || '[]')
      return Array.isArray(parsed) ? parsed : ['09:00', '14:00', '20:00']
    } catch (_) {
      return ['09:00', '14:00', '20:00']
    }
  })
  const [newSlotInput, setNewSlotInput] = useState('')
  const [maxRepeats, setMaxRepeats] = useState(group.max_repeats_per_day || 0)
  const [sentToday, setSentToday] = useState(group.sent_today_count || 0)

  // Preview State
  const [previewText, setPreviewText] = useState('')
  const [previewTplName, setPreviewTplName] = useState('')
  const [previewImage, setPreviewImage] = useState('')
  const [previewTemplateId, setPreviewTemplateId] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const [globalScheduleSlots, setGlobalScheduleSlots] = useState([])

  useEffect(() => {
    const tplUrl = group.user_id ? `/templates?user_id=${group.user_id}` : '/templates'
    Promise.all([
      api.get('/accounts'),
      api.get(tplUrl),
      api.get(`/groups/${group.id}/templates`),
      api.get('/scheduler/config'),
    ]).then(([accRes, tplRes, assignRes, schedRes]) => {
      setAccounts(accRes.data || [])
      setAllMasterTemplates(tplRes.data || [])
      setAssignedTemplates(new Set((assignRes.data || []).map(t => t.id)))
      if (schedRes.data?.slots) {
        setGlobalScheduleSlots(schedRes.data.slots.filter(s => s.is_active).map(s => s.time_slot).sort())
      }
    }).catch(console.error)
  }, [group.id, group.user_id])

  // Load preview when opening preview tab
  useEffect(() => {
    if (activeTab === 'preview') {
      fetchPreview(previewTemplateId)
    }
  }, [activeTab, templateMode, customContent, customImagePath, rulePrefix, ruleHashtags, ruleSuffix])

  const fetchPreview = async (selectedTid = previewTemplateId) => {
    setPreviewLoading(true)
    try {
      const res = await api.post('/groups/preview-rule', {
        group_id: group.id,
        template_mode: templateMode,
        custom_content: customContent,
        custom_image_path: customImagePath,
        template_id: selectedTid ? parseInt(selectedTid) : undefined,
        template_ids: Array.from(assignedTemplates),
        rule_prefix: rulePrefix,
        rule_hashtags: ruleHashtags,
        rule_suffix: ruleSuffix,
        group_title: title || group.title,
        group_identifier: group.identifier,
      })
      setPreviewText(res.preview)
      setPreviewTplName(res.template_name || '')
      if (templateMode === 'custom') {
        setPreviewImage(customImagePath)
      } else {
        setPreviewImage(res.image_path || '')
      }
    } catch (err) {
      toast.error('Lỗi tạo xem trước: ' + err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      setUploadingImage(true)
      const res = await api.post(`/groups/${group.id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setCustomImagePath(res.custom_image_path)
      toast.success('Đã tải ảnh riêng cho nhóm!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!confirm('Xóa ảnh riêng của nhóm này?')) return
    try {
      await api.delete(`/groups/${group.id}/image`)
      setCustomImagePath('')
      toast.success('Đã xóa ảnh riêng')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleAssignedTemplate = (tid) => {
    setAssignedTemplates(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      return next
    })
  }

  const addTimeSlot = () => {
    if (!newSlotInput || !/^\d{2}:\d{2}$/.test(newSlotInput)) {
      return toast.error('Vui lòng chọn khung giờ hợp lệ (HH:MM)')
    }
    if (timeSlots.includes(newSlotInput)) {
      return toast.error('Khung giờ này đã có')
    }
    const updated = [...timeSlots, newSlotInput].sort()
    setTimeSlots(updated)
    setNewSlotInput('')
  }

  const addSpecificSlot = (slot) => {
    if (!slot || !/^\d{2}:\d{2}$/.test(slot)) return
    if (timeSlots.includes(slot)) {
      // Toggle off if already included
      setTimeSlots(prev => prev.filter(s => s !== slot))
      toast.info(`Đã bỏ ${slot}`)
      return
    }
    const updated = [...timeSlots, slot].sort()
    setTimeSlots(updated)
    toast.success(`Đã thêm ${slot}`)
  }

  const removeTimeSlot = (slot) => {
    setTimeSlots(prev => prev.filter(s => s !== slot))
  }

  const handleResetToday = () => {
    setSentToday(0)
    toast.success('Đã đặt lại số lần gửi hôm nay về 0 (sẽ lưu khi bấm Lưu)')
  }

  const handleSyncGroupMeta = async () => {
    try {
      setSyncingMeta(true)
      const res = await api.post(`/groups/${group.id}/sync-metadata`)
      if (res.data?.data) {
        if (res.data.data.title) setTitle(res.data.data.title)
        if (res.data.data.avatar_url) setAvatarUrl(res.data.data.avatar_url)
        toast.success(res.data.message || 'Đã đồng bộ thông tin từ Telegram!')
        onSuccess()
      }
    } catch (err) {
      toast.error(err.message || 'Không thể đồng bộ từ Telegram')
    } finally {
      setSyncingMeta(false)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      // 1. Tự động gộp giờ đang chọn trên ô input nếu người dùng chưa kịp bấm "+ Thêm giờ"
      let finalSlots = [...timeSlots]
      if (newSlotInput && /^\d{2}:\d{2}$/.test(newSlotInput)) {
        if (!finalSlots.includes(newSlotInput)) {
          finalSlots.push(newSlotInput)
          finalSlots.sort()
          setTimeSlots(finalSlots)
        }
      }

      if (scheduleMode === 'custom' && finalSlots.length === 0) {
        setLoading(false)
        return toast.error('Vui lòng thêm ít nhất 1 khung giờ phát tin riêng (bấm nút "+ Thêm giờ" hoặc chọn khung giờ nhanh)')
      }

      // 2. Cập nhật thông tin nhóm & quy tắc & lịch
      await api.put(`/groups/${group.id}`, {
        title: title.trim() || group.identifier,
        avatar_url: avatarUrl || null,
        account_phone: accountPhone || null,
        template_mode: templateMode,
        custom_content: templateMode === 'custom' ? customContent : null,
        custom_image_path: templateMode === 'custom' ? customImagePath : null,
        template_ids: templateMode === 'global' ? Array.from(assignedTemplates) : [],
        rule_prefix: rulePrefix.trim() || null,
        rule_hashtags: ruleHashtags.trim() || null,
        rule_suffix: ruleSuffix.trim() || null,
        schedule_mode: scheduleMode,
        custom_time_slots: JSON.stringify(finalSlots),
        max_repeats_per_day: parseInt(maxRepeats) || 0,
        sent_today_count: parseInt(sentToday) || 0,
        cluster_id: clusterId ? parseInt(clusterId) : null,
      })

      // 2. Cập nhật danh sách kịch bản chung được gán (nếu dùng chế độ global)
      if (templateMode === 'global') {
        await api.put(`/groups/${group.id}/templates`, {
          template_ids: Array.from(assignedTemplates)
        })
      }

      toast.success('Đã lưu toàn bộ cấu hình nhóm thành công!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestSend = async () => {
    if (!confirm(`Phát tin kiểm tra ngay bây giờ đến nhóm ${group.identifier}?`)) return
    try {
      const res = await api.post(`/groups/${group.id}/send-now`)
      toast.success(res.message)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30 flex-shrink-0 relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={title || group.identifier}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div className={avatarUrl ? 'hidden' : 'flex items-center justify-center w-full h-full'}>
                <Settings2 size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-base truncate max-w-[280px] sm:max-w-md">
                  {title && title !== group.identifier ? title : 'Cấu hình nhóm mục tiêu'}
                </h2>
                {getTelegramUrl(group.identifier) ? (
                  <a
                    href={getTelegramUrl(group.identifier)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs px-2 py-0.5 rounded-full bg-blue-900/30 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 inline-flex items-center gap-1 transition-colors group/tg"
                    title="Mở link chợ trên Telegram (Tab mới)"
                  >
                    <span>{group.identifier}</span>
                    <ExternalLink size={10} className="opacity-70 group-hover/tg:opacity-100" />
                  </a>
                ) : (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-800/40">
                    {group.identifier}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSyncGroupMeta}
                  disabled={syncingMeta}
                  className="p-1 text-gray-400 hover:text-sky-300 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Cập nhật lại Avatar và Tên nhóm từ Telegram"
                >
                  <RefreshCw size={13} className={syncingMeta ? 'animate-spin text-sky-400' : ''} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                {title || group.title || 'Chưa đặt tên gợi nhớ'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestSend}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-colors"
              title="Gửi 1 tin test ngay bây giờ"
            >
              <Send size={13} />
              Gửi thử ngay
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-gray-800 bg-gray-950/40 overflow-x-auto scrollbar-none">
          {[
            { id: 'template', label: 'Kịch bản phát', icon: FileText, badge: templateMode === 'custom' ? 'Riêng' : 'Chung' },
            { id: 'footer', label: 'Hashtag & Chân trang', icon: Hash, badge: ruleHashtags ? 'Đã cài' : null },
            { id: 'schedule', label: 'Lịch & Số lần lặp', icon: Clock, badge: scheduleMode === 'custom' ? `${timeSlots.length} giờ` : 'Lịch chung' },
            { id: 'account', label: 'Tài khoản & Nhóm', icon: Users, badge: null },
            { id: 'preview', label: 'Xem trước tin gửi', icon: Eye, badge: null },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-medium transition-all whitespace-nowrap border-b-2 ${
                  active
                    ? 'border-blue-500 text-blue-400 bg-gray-900/80'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab.badge === 'Riêng' || tab.badge.includes('giờ')
                      ? 'bg-amber-900/40 text-amber-300 border border-amber-800/40'
                      : 'bg-blue-900/40 text-blue-300 border border-blue-800/40'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Body Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-gray-900/50">

          {/* TAB 1: KỊCH BẢN (TEMPLATES: GLOBAL VS CUSTOM) */}
          {activeTab === 'template' && (
            <div className="space-y-5">
              {/* Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Lựa chọn cách thức phát kịch bản cho nhóm này:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setTemplateMode('global')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      templateMode === 'global'
                        ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                        : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`p-1.5 rounded-lg ${templateMode === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        <Layers size={16} />
                      </div>
                      <span className="font-semibold text-sm text-white">Dùng Kịch Bản Chung (Kho bài viết)</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Phát các bài viết từ Kho Kịch Bản chung. Có thể chọn tất cả (hệ thống tự chọn ngẫu nhiên mỗi lần) hoặc chỉ định các bài cụ thể.
                    </p>
                  </div>

                  <div
                    onClick={() => setTemplateMode('custom')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      templateMode === 'custom'
                        ? 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`p-1.5 rounded-lg ${templateMode === 'custom' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                        <Sparkles size={16} />
                      </div>
                      <span className="font-semibold text-sm text-white">Soạn Kịch Bản Riêng Biệt (Custom)</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Viết nội dung quảng cáo độc quyền riêng cho nhóm này (không dùng chung với nhóm khác). Có thể đính kèm ảnh riêng.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-view: Dùng Kịch bản Chung */}
              {templateMode === 'global' && (
                <div className="bg-gray-950/40 border border-gray-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <FileText size={14} className="text-blue-400" />
                        Danh sách kịch bản chung được phát vào nhóm:
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {assignedTemplates.size === 0
                          ? 'Đang chọn: Tất cả kịch bản chung (Hệ thống xoay ngẫu nhiên tránh trùng lặp)'
                          : `Đang chọn: ${assignedTemplates.size} kịch bản được tích chọn bên dưới`}
                      </p>
                    </div>

                    {assignedTemplates.size > 0 && (
                      <button
                        onClick={() => setAssignedTemplates(new Set())}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Đặt lại (Chọn tất cả)
                      </button>
                    )}
                  </div>

                  {allMasterTemplates.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      Kho chưa có kịch bản chung nào. Vui lòng vào trang Kịch Bản để thêm mới.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {allMasterTemplates.map(tpl => {
                        const isAssigned = assignedTemplates.has(tpl.id)
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => toggleAssignedTemplate(tpl.id)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                              isAssigned
                                ? 'border-blue-500/40 bg-blue-900/10 text-white'
                                : 'border-gray-800 bg-gray-900/40 text-gray-300 hover:border-gray-700'
                            }`}
                          >
                            <div className="mt-0.5">
                              {isAssigned ? (
                                <CheckSquare size={16} className="text-blue-400" />
                              ) : (
                                <Square size={16} className="text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold truncate">{tpl.name}</span>
                                {tpl.image_path && <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/30">Ảnh</span>}
                              </div>
                              <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                                {tpl.content}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view: Soạn Kịch bản Riêng */}
              {templateMode === 'custom' && (
                <div className="bg-gray-950/40 border border-amber-900/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Nội dung kịch bản riêng của nhóm này:
                    </label>
                    <span className="text-[11px] text-gray-500 font-mono">
                      Hỗ trợ Spintax {'{A|B|C}'} & thẻ &lt;b&gt;, &lt;i&gt;
                    </span>
                  </div>

                  <textarea
                    rows={5}
                    value={customContent}
                    onChange={e => setCustomContent(e.target.value)}
                    placeholder="Nhập nội dung quảng cáo riêng biệt cho nhóm này...\nVí dụ: Chào anh chị em nhóm {group_name}! Hôm nay shop ưu đãi đặc biệt..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans resize-y"
                  />

                  {/* Upload ảnh riêng cho nhóm */}
                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium cursor-pointer border border-gray-700 transition-colors">
                        <Image size={14} className="text-cyan-400" />
                        {uploadingImage ? 'Đang tải ảnh...' : customImagePath ? 'Đổi ảnh đính kèm' : 'Đính kèm ảnh riêng'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>

                      {customImagePath && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-400 font-mono truncate max-w-[150px]">
                            {customImagePath}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Xem trước kết quả <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HASHTAG & CHÂN TRANG */}
          {activeTab === 'footer' && (
            <div className="space-y-4">
              <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-3.5 text-xs text-blue-300 leading-relaxed flex items-start gap-2.5">
                <HelpCircle size={16} className="mt-0.5 flex-shrink-0 text-blue-400" />
                <div>
                  <strong>Cơ chế tự động ghép tin:</strong> Hệ thống sẽ tự động ghép các phần theo thứ tự:
                  <div className="font-mono mt-1 text-gray-300 text-[11px] bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                    [Lời chào / Tiền tố] ➜ [Nội dung kịch bản] ➜ [Hashtag chân trang] ➜ [Chữ ký / Hậu tố]
                  </div>
                </div>
              </div>

              {/* Prefix */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-1.5">
                  <AlignLeft size={14} className="text-cyan-400" />
                  Lời chào / Tiền tố đầu tin (Prefix)
                </label>
                <textarea
                  rows={2}
                  value={rulePrefix}
                  onChange={e => setRulePrefix(e.target.value)}
                  placeholder="Ví dụ: 🏙️ CHỢ CÔNG NGHỆ HN — GÓC MUA BÁN UY TÍN"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Hashtag chân trang */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                    <Hash size={14} className="text-emerald-400" />
                    Hashtag chân trang của nhóm (Footer Tags)
                  </label>
                  <span className="text-[11px] text-gray-500">Tự động gắn vào cuối mỗi bài đăng</span>
                </div>
                <textarea
                  rows={2}
                  value={ruleHashtags}
                  onChange={e => setRuleHashtags(e.target.value)}
                  placeholder="Ví dụ: #muaban #hanoi #congnghe #telebroadcast"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono resize-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Có thể dùng biến <code className="text-blue-300 bg-gray-800 px-1 py-0.5 rounded">{'{'+'group_hashtags'+'}'}</code> nếu muốn đặt hashtag ở giữa nội dung thay vì cuối tin.
                </p>
              </div>

              {/* Suffix / Chữ ký */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-1.5">
                  <AlignRight size={14} className="text-amber-400" />
                  Chữ ký / Hậu tố cuối tin (Suffix)
                </label>
                <textarea
                  rows={2}
                  value={ruleSuffix}
                  onChange={e => setRuleSuffix(e.target.value)}
                  placeholder="Ví dụ: ☎️ Admin hỗ trợ: @admin_support | 🛡️ Cam kết uy tín 100%"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: LỊCH CHẠY & SỐ LẦN LẶP (SCHEDULE & FREQUENCY) */}
          {activeTab === 'schedule' && (
            <div className="space-y-5">
              {/* Schedule Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Chế độ hẹn giờ phát tin cho nhóm này:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setScheduleMode('global')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      scheduleMode === 'global'
                        ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50'
                        : 'border-gray-800 bg-gray-800/30 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={16} className={scheduleMode === 'global' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className="font-semibold text-sm text-white">Chạy theo Lịch Chung Hệ Thống</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Tự động phát tin theo các khung giờ cài đặt chung trong trang <strong>Lịch gửi tin</strong>:
                    </p>
                    {globalScheduleSlots.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {globalScheduleSlots.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-lg bg-blue-900/40 text-blue-300 font-mono text-[11px] font-semibold border border-blue-700/40">
                            {s}
                          </span>
                        ))}
                        <span className="text-[11px] text-gray-400 font-mono">({globalScheduleSlots.length} khung giờ)</span>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-300 font-mono mt-1">Đang lấy khung giờ hệ thống...</p>
                    )}
                  </div>

                  <div
                    onClick={() => setScheduleMode('custom')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      scheduleMode === 'custom'
                        ? 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/50'
                        : 'border-gray-800 bg-gray-800/30 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={16} className={scheduleMode === 'custom' ? 'text-amber-400' : 'text-gray-400'} />
                      <span className="font-semibold text-sm text-white">Cài Khung Giờ Riêng Cho Nhóm</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Chỉ định chính xác nhóm này được phát vào những giờ nào trong ngày (không phụ thuộc giờ chung của hệ thống).
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-view: Khung giờ riêng */}
              {scheduleMode === 'custom' && (
                <div className="bg-gray-950/40 border border-gray-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-400" />
                      Các khung giờ phát tin riêng của nhóm (Giờ VN - HH:MM):
                    </label>
                    <div className="flex items-center gap-2">
                      {globalScheduleSlots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTimeSlots([...globalScheduleSlots])
                            toast.success(`Đã sao chép ${globalScheduleSlots.length} khung giờ từ Lịch chung!`)
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium transition-colors"
                          title="Sao chép toàn bộ khung giờ đang cài trong trang Lịch gửi tin"
                        >
                          📋 Lấy theo Lịch chung ({globalScheduleSlots.length} giờ)
                        </button>
                      )}
                      <span className="text-xs text-amber-300 font-mono">
                        {timeSlots.length} khung giờ
                      </span>
                    </div>
                  </div>

                  {/* Badges of current slots */}
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.map(slot => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 text-white font-mono text-xs border border-gray-700"
                      >
                        <Clock size={12} className="text-amber-400" />
                        {slot}
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(slot)}
                          className="hover:text-rose-400 ml-1 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {timeSlots.length === 0 && (
                      <span className="text-xs text-rose-400">Chưa có khung giờ nào! Nhóm sẽ không tự chạy.</span>
                    )}
                  </div>

                  {/* Add Slot Input & Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <input
                      type="time"
                      value={newSlotInput}
                      onChange={e => setNewSlotInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTimeSlot()
                        }
                      }}
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={addTimeSlot}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        newSlotInput
                          ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-900/40 animate-pulse'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                      }`}
                    >
                      <Plus size={13} />
                      {newSlotInput ? `+ Thêm ${newSlotInput}` : '+ Thêm giờ'}
                    </button>
                    {timeSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTimeSlots([])}
                        className="text-[11px] text-gray-400 hover:text-rose-400 ml-auto transition-colors"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {/* Gợi ý khung giờ nhanh */}
                  <div className="pt-2 border-t border-gray-800/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-400 mr-1">Giờ gợi ý:</span>
                    {['06:50', '09:00', '10:00', '10:05', '11:30', '14:00', '15:00', '20:00', '21:00'].map(preset => {
                      const isSelected = timeSlots.includes(preset)
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => addSpecificSlot(preset)}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold shadow-sm shadow-amber-500/10'
                              : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700/80'
                          }`}
                        >
                          {preset} {isSelected ? '✓' : '+'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Repeat Frequency Settings */}
              <div className="bg-gray-950/40 border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sliders size={14} className="text-blue-400" />
                      Giới hạn số lần lặp lại trong ngày (Frequency Cap):
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Tránh bị Telegram cấm hoặc admin nhóm kick vì gửi quá nhiều lần trong 1 ngày.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Hôm nay đã gửi:</span>
                    <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-800/30">
                      {sentToday} {maxRepeats > 0 ? `/ ${maxRepeats}` : 'lần'}
                    </span>
                    {sentToday > 0 && (
                      <button
                        type="button"
                        onClick={handleResetToday}
                        title="Đặt lại về 0"
                        className="p-1 hover:text-white text-gray-500 rounded"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Số lần lặp tối đa mỗi ngày:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={maxRepeats}
                        onChange={e => setMaxRepeats(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400">
                        {parseInt(maxRepeats) === 0 ? '(0 = Không giới hạn số lần)' : 'lần / ngày'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TÀI KHOẢN & THÔNG TIN */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Tên gợi nhớ của nhóm (Title / Note)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Nhóm Mua Bán Đồ Cũ VIP"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Tài khoản Telegram phụ trách gửi tin vào nhóm này:
                </label>
                <select
                  value={accountPhone}
                  onChange={e => setAccountPhone(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Tự động (Ưu tiên tài khoản của bạn đang online) --</option>
                  {accounts.map(acc => (
                    <option key={acc.phone} value={acc.phone}>
                      {acc.phone} — {acc.first_name || acc.username || 'Telegram Account'} ({acc.status === 'connected' ? '🟢 Online' : '🔴 Offline'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Nếu tài khoản chỉ định bị FloodWait hoặc ngắt kết nối, hệ thống sẽ tự động dùng tài khoản phụ khác để không làm gián đoạn bài đăng.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
                  <Layers size={13} className="text-sky-400" />
                  Gán vào Cụm Chợ:
                </label>
                <select
                  value={clusterId}
                  onChange={e => setClusterId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chưa phân cụm (Chợ lẻ) --</option>
                  {clusters.map(c => (
                    <option key={c.id} value={c.id}>
                      🏷️ {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Gom các chợ cùng tính chất (VD: Chợ VN có Rule, Chợ không bot) để lọc và phát tin đồng loạt.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-800">
                <span className="text-xs text-gray-500">
                  ID định danh Telegram: <strong className="text-gray-300 font-mono">{group.identifier}</strong>
                </span>
              </div>
            </div>
          )}

          {/* TAB 5: XEM TRƯỚC TIN NHẮN (LIVE PREVIEW) */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Eye size={14} className="text-cyan-400" />
                    Mô phỏng tin nhắn hiển thị thực tế trên Telegram:
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Bao gồm kịch bản đã quay Spintax, hashtag và chữ ký chân trang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchPreview(previewTemplateId)}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-xl transition-colors border border-gray-700"
                >
                  <RefreshCw size={12} className={previewLoading ? 'animate-spin' : ''} />
                  Xoay Spintax / Đổi bài
                </button>
              </div>

              {/* Template Picker if global mode */}
              {templateMode === 'global' && (
                <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" />
                    <span className="text-gray-300 font-medium">Kịch bản xem trước:</span>
                    <select
                      value={previewTemplateId}
                      onChange={e => {
                        setPreviewTemplateId(e.target.value)
                        fetchPreview(e.target.value)
                      }}
                      className="bg-gray-900 border border-gray-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
                    >
                      <option value="">🎲 Ngẫu nhiên theo kịch bản đã chọn</option>
                      {allMasterTemplates
                        .filter(t => assignedTemplates.size === 0 || assignedTemplates.has(t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                      }
                    </select>
                  </div>
                  {previewTplName && (
                    <span className="text-[11px] text-blue-300 font-medium px-2 py-0.5 rounded-md bg-blue-950/40 border border-blue-800/30">
                      Bài: {previewTplName}
                    </span>
                  )}
                </div>
              )}

              {/* Telegram Phone Bubble Mockup */}
              <div className="bg-[#182533] border border-[#243447] rounded-2xl p-4 shadow-xl max-w-lg mx-auto">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2b3e55]">
                  <GroupAvatar
                    avatarUrl={avatarUrl}
                    title={title}
                    identifier={group.identifier}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate max-w-[280px]">
                      {title || group.identifier}
                    </div>
                    <div className="text-[10px] text-blue-300">
                      {templateMode === 'custom' ? '✨ Kịch bản riêng của nhóm' : `📄 Bài: ${previewTplName || 'Kịch bản chung'}`}
                    </div>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="bg-[#2b5278] rounded-2xl p-3.5 text-white shadow-md space-y-2">
                  {(previewImage || (templateMode === 'custom' && customImagePath)) && (
                    <div className="rounded-xl overflow-hidden bg-black/40 border border-white/10 mb-2">
                      <img
                        src={`/uploads/${templateMode === 'custom' ? customImagePath : previewImage}`}
                        alt="Preview image"
                        className="w-full max-h-56 object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {previewLoading ? (
                    <div className="py-6 text-center text-xs text-blue-200">
                      <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-300" />
                      Đang biên soạn bản xem trước...
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans break-words">
                      {previewText || 'Chưa có nội dung xem trước'}
                    </div>
                  )}

                  <div className="text-[10px] text-blue-200 text-right pt-1 font-mono">
                    12:00 ✓✓
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/90">
          <div className="text-xs text-gray-500">
            Chế độ: <strong className="text-gray-300">{templateMode === 'custom' ? 'Kịch bản riêng' : 'Kịch bản chung'}</strong> • <strong className="text-gray-300">{scheduleMode === 'custom' ? 'Lịch riêng' : 'Lịch hệ thống'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
            >
              <Check size={14} />
              {loading ? 'Đang lưu cấu hình...' : 'Lưu toàn bộ cấu hình'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Modal Xem Nhanh Tin Nhắn (Quick Preview Modal) ──────────────────────────
function QuickPreviewModal({ group, onClose }) {
  const [text, setText] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [imagePath, setImagePath] = useState(group.custom_image_path || '')
  const [loading, setLoading] = useState(true)

  const loadPreview = () => {
    setLoading(true)
    api.post('/groups/preview-rule', {
      group_id: group.id,
      template_mode: group.template_mode,
      custom_content: group.custom_content,
      rule_prefix: group.rule_prefix,
      rule_hashtags: group.rule_hashtags,
      rule_suffix: group.rule_suffix,
      group_title: group.title,
      group_identifier: group.identifier,
    }).then(res => {
      setText(res.preview)
      setTemplateName(res.template_name || '')
      if (group.template_mode !== 'custom' && res.image_path) {
        setImagePath(res.image_path)
      } else if (group.template_mode === 'custom') {
        setImagePath(group.custom_image_path || '')
      }
    }).catch(err => {
      setText('Lỗi khi xem trước: ' + err.message)
    }).finally(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    loadPreview()
  }, [group])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Eye size={15} className="text-blue-400" />
              Xem trước bài đăng
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <GroupAvatar
                avatarUrl={group.avatar_url}
                title={group.title}
                identifier={group.identifier}
                size="xs"
              />
              <span className="font-semibold text-xs text-white truncate max-w-[200px]">{group.title || group.identifier}</span>
              {templateName && (
                <span className="text-[10px] text-amber-300 px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-800/30 truncate max-w-[140px]">
                  {templateName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={loadPreview}
              disabled={loading}
              title="Xoay bài khác"
              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400"><X size={16} /></button>
          </div>
        </div>

        <div className="bg-[#182533] border border-[#243447] rounded-xl p-3.5 max-h-96 overflow-y-auto">
          {imagePath && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/40 border border-white/10">
              <img src={`/uploads/${imagePath}`} alt="Attachment" className="w-full max-h-48 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}
          {loading ? (
            <p className="text-center text-xs text-gray-400 py-6">Đang tải bản xem trước...</p>
          ) : (
            <div className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">
              {text}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{group.template_mode === 'custom' ? 'Kịch bản riêng' : 'Kịch bản chung'}</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs rounded-xl transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Nhập Nhóm Hàng Loạt (Text List + JSON Config Import) ──────────────
function BulkImportModal({ onClose, onSuccess }) {
  const [importMode, setImportMode] = useState('text') // text | json
  const [text, setText] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [parsedGroups, setParsedGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [jsonError, setJsonError] = useState('')

  const handleJsonFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        const items = Array.isArray(parsed) ? parsed : (parsed.groups || [])
        setParsedGroups(items)
        setJsonError('')
      } catch (err) {
        setJsonError('File JSON không hợp lệ: ' + err.message)
        setParsedGroups([])
      }
    }
    reader.readAsText(f)
  }

  const handleJsonText = (val) => {
    setJsonText(val)
    if (!val.trim()) {
      setParsedGroups([])
      setJsonError('')
      return
    }
    try {
      const parsed = JSON.parse(val)
      const items = Array.isArray(parsed) ? parsed : (parsed.groups || [])
      setParsedGroups(items)
      setJsonError('')
    } catch (err) {
      setJsonError('Chuỗi JSON chưa đúng: ' + err.message)
      setParsedGroups([])
    }
  }

  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return toast.error('Danh sách nhóm trống')
    try {
      setLoading(true)
      const res = await api.post('/groups', { bulk: text })
      toast.success(res.message || `Đã thêm/cập nhật ${res.added} nhóm mới`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJsonSubmit = async () => {
    if (parsedGroups.length === 0) return toast.error('Không có nhóm hợp lệ trong JSON để nhập')
    try {
      setLoading(true)
      const res = await api.post('/groups/import-json', { groups: parsedGroups })
      toast.success(res.message || `Đã nhập và đồng bộ ${res.imported} nhóm`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <Upload size={18} className="text-blue-400" />
              Nhập danh sách Nhóm mục tiêu
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Nhập từ danh sách link nhanh hoặc file JSON cấu hình đầy đủ</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"><X size={18} /></button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-2 bg-gray-950/60 p-1 rounded-2xl border border-gray-800">
          <button
            type="button"
            onClick={() => setImportMode('text')}
            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
              importMode === 'text'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 Danh sách link / username
          </button>
          <button
            type="button"
            onClick={() => setImportMode('json')}
            className={`py-2 rounded-xl text-xs font-semibold transition-all ${
              importMode === 'json'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📦 File JSON đầy đủ cấu hình
          </button>
        </div>

        {/* Mode 1: Text list */}
        {importMode === 'text' && (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <p className="text-xs text-gray-400">
              Mỗi dòng 1 nhóm: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-300">@ten_nhom</code> hoặc <code className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-300">t.me/ten_nhom</code>
            </p>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-3.5 py-3 text-white text-xs font-mono h-48 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={"@nhom_muaban1\n@nhom_muaban2\nt.me/nhomvip\nhttps://t.me/nhom4"}
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium">Hủy</button>
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md">
                <Upload size={14} />
                {loading ? 'Đang nhập...' : 'Nhập danh sách'}
              </button>
            </div>
          </form>
        )}

        {/* Mode 2: JSON import */}
        {importMode === 'json' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Cách 1: Chọn file .json nhóm từ máy tính</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleJsonFile}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Cách 2: Hoặc dán chuỗi JSON cấu hình</label>
              <textarea
                rows={3}
                value={jsonText}
                onChange={e => handleJsonText(e.target.value)}
                placeholder='[{"identifier": "@nhom1", "title": "Nhóm 1", "rule_hashtags": "#muaban", ...}]'
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {jsonError && (
              <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-400">
                {jsonError}
              </div>
            )}

            {parsedGroups.length > 0 && (
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
                <div className="text-xs font-bold text-emerald-400">
                  ✅ Tìm thấy {parsedGroups.length} nhóm kèm cấu hình:
                </div>
                <div className="space-y-1">
                  {parsedGroups.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/80 px-2 py-1 rounded">
                      <span className="font-mono text-blue-300 truncate max-w-[170px]">{g.identifier}</span>
                      <span className="text-gray-400 truncate max-w-[180px]">{g.title || 'Chưa đặt tên'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1 border-t border-gray-800">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium">Hủy</button>
              <button
                type="button"
                onClick={handleJsonSubmit}
                disabled={loading || parsedGroups.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Upload size={14} />
                {loading ? 'Đang đồng bộ...' : `Nhập ${parsedGroups.length} nhóm`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Modal Cài Đặt Hàng Loạt (Bulk Config Modal) ──────────────────────────────
function BulkConfigModal({ selectedIds, groups = [], clusters = [], onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('template') // template | schedule | footer
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)

  // Data lists
  const [allTemplates, setAllTemplates] = useState([])
  const [allAccounts, setAllAccounts] = useState([])

  // 1. Template Settings
  // 'keep' = Không đổi | 'specific' = Gán 1 hoặc nhiều kịch bản cụ thể | 'all' = Xoay ngẫu nhiên tất cả kịch bản chung
  const [templateAssignMode, setTemplateAssignMode] = useState('keep')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(new Set())
  const [tplSearch, setTplSearch] = useState('')

  // 2. Account & Schedule Settings
  const [accountPhone, setAccountPhone] = useState('')
  const [scheduleMode, setScheduleMode] = useState('') // '' = keep, 'global', 'custom'
  const [customSlots, setCustomSlots] = useState([])
  const [newSlotInput, setNewSlotInput] = useState('')

  // 3. Hashtags & Rules
  const [ruleHashtags, setRuleHashtags] = useState('')
  const [rulePrefix, setRulePrefix] = useState('')
  const [ruleSuffix, setRuleSuffix] = useState('')
  const [maxRepeats, setMaxRepeats] = useState('')
  const [clusterId, setClusterId] = useState('')

  // Load templates and accounts
  useEffect(() => {
    Promise.all([
      api.get('/templates'),
      api.get('/accounts')
    ]).then(([tplRes, accRes]) => {
      setAllTemplates(tplRes.data || [])
      setAllAccounts(accRes.data || [])
    }).catch(err => {
      toast.error('Lỗi tải dữ liệu: ' + err.message)
    }).finally(() => {
      setFetchingData(false)
    })
  }, [])

  const defaultSuggestedSlots = ['06:50', '09:00', '10:00', '14:00', '15:00', '20:00', '21:00']

  const toggleSlot = (slot) => {
    setCustomSlots(prev => {
      if (prev.includes(slot)) return prev.filter(s => s !== slot)
      return [...prev, slot].sort()
    })
  }

  const addCustomSlot = () => {
    if (!newSlotInput.trim()) return
    const s = newSlotInput.trim()
    if (!/^\d{1,2}:\d{2}$/.test(s)) {
      return toast.error('Định dạng giờ phải là HH:mm (ví dụ 09:30)')
    }
    const [h, m] = s.split(':').map(n => n.padStart(2, '0'))
    const formatted = `${h}:${m}`
    if (!customSlots.includes(formatted)) {
      setCustomSlots(prev => [...prev, formatted].sort())
    }
    setNewSlotInput('')
  }

  const toggleTemplateSelection = (id) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectSingleTemplate = (id) => {
    setSelectedTemplateIds(new Set([id]))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (selectedIds.size === 0) return toast.error('Vui lòng chọn ít nhất 1 nhóm')

    try {
      setLoading(true)
      const payload = {
        ids: Array.from(selectedIds),
      }

      // Xử lý kịch bản
      if (templateAssignMode === 'specific') {
        if (selectedTemplateIds.size === 0) {
          setLoading(false)
          return toast.error('Vui lòng chọn ít nhất 1 kịch bản muốn gán cho các nhóm')
        }
        payload.template_mode = 'global'
        payload.template_ids = Array.from(selectedTemplateIds)
      } else if (templateAssignMode === 'all') {
        payload.template_mode = 'global'
        payload.assign_all_templates = true
      }

      // Xử lý tài khoản
      if (accountPhone) {
        payload.account_phone = accountPhone
      }

      // Xử lý lịch gửi
      if (scheduleMode) {
        payload.schedule_mode = scheduleMode
        if (scheduleMode === 'custom') {
          payload.custom_time_slots = JSON.stringify(customSlots)
        }
      }

      // Xử lý cụm nhóm
      if (clusterId) {
        payload.cluster_id = clusterId
      }

      // Xử lý quy tắc & hashtag
      if (ruleHashtags.trim()) payload.rule_hashtags = ruleHashtags.trim()
      if (rulePrefix.trim()) payload.rule_prefix = rulePrefix.trim()
      if (ruleSuffix.trim()) payload.rule_suffix = ruleSuffix.trim()
      if (maxRepeats !== '') payload.max_repeats_per_day = parseInt(maxRepeats) || 0

      const res = await api.put('/groups/bulk-config', payload)
      toast.success(res.message || `Đã cập nhật cấu hình cho ${selectedIds.size} nhóm!`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error('Lỗi cài đặt hàng loạt: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter templates by search
  const filteredTemplates = allTemplates.filter(t => {
    if (!tplSearch.trim()) return true
    const q = tplSearch.toLowerCase().trim()
    return (t.name || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Cài Đặt Cấu Hình Hàng Loạt
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50">
                  {selectedIds.size} nhóm đã chọn
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Gán 1 kịch bản, chỉnh tài khoản, khung giờ và hashtag cùng lúc cho tất cả nhóm
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-gray-800 bg-gray-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'template'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            <FileText size={15} />
            1. Kịch Bản Phát Sóng
            {templateAssignMode === 'specific' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            <Clock size={15} />
            2. Tài Khoản & Lịch Giờ
            {(accountPhone || scheduleMode) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('footer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'footer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            <Hash size={15} />
            3. Hashtag & Cụm Chợ
            {(ruleHashtags || clusterId || maxRepeats) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {fetchingData ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-400" />
                Đang tải danh sách kịch bản và tài khoản...
              </div>
            ) : (
              <>
                {/* ─── TAB 1: KỊCH BẢN PHÁT SÓNG ─── */}
                {activeTab === 'template' && (
                  <div className="space-y-4">
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-3">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider">
                        Chọn cách thức gán kịch bản cho {selectedIds.size} nhóm:
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <label
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            templateAssignMode === 'keep'
                              ? 'border-blue-500 bg-blue-950/30 text-white'
                              : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_tpl_mode"
                            value="keep"
                            checked={templateAssignMode === 'keep'}
                            onChange={() => setTemplateAssignMode('keep')}
                            className="mt-0.5 text-blue-600"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">Giữ nguyên</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Không thay đổi kịch bản của từng nhóm</div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            templateAssignMode === 'specific'
                              ? 'border-emerald-500 bg-emerald-950/30 text-white'
                              : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_tpl_mode"
                            value="specific"
                            checked={templateAssignMode === 'specific'}
                            onChange={() => setTemplateAssignMode('specific')}
                            className="mt-0.5 text-emerald-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-emerald-300">🎯 Gán 1 kịch bản cụ thể</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Tất cả nhóm sẽ chỉ phát bài viết bạn chọn</div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            templateAssignMode === 'all'
                              ? 'border-purple-500 bg-purple-950/30 text-white'
                              : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_tpl_mode"
                            value="all"
                            checked={templateAssignMode === 'all'}
                            onChange={() => setTemplateAssignMode('all')}
                            className="mt-0.5 text-purple-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-purple-300">🔄 Xoay vòng toàn bộ</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Tự động chọn ngẫu nhiên mọi bài viết</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Danh sách chọn kịch bản khi chọn 'specific' */}
                    {templateAssignMode === 'specific' && (
                      <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CheckSquare size={15} className="text-emerald-400" />
                            Chọn kịch bản muốn gán vào {selectedIds.size} nhóm:
                          </h4>
                          <span className="text-[11px] text-gray-400">
                            Đã chọn: <strong className="text-emerald-400">{selectedTemplateIds.size}</strong> kịch bản
                          </span>
                        </div>

                        {/* Search input */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="text"
                            placeholder="Tìm kiếm kịch bản theo tên..."
                            value={tplSearch}
                            onChange={e => setTplSearch(e.target.value)}
                            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* List */}
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {filteredTemplates.length === 0 ? (
                            <div className="py-6 text-center text-xs text-gray-500">
                              Không tìm thấy kịch bản nào phù hợp
                            </div>
                          ) : (
                            filteredTemplates.map(tpl => {
                              const isChecked = selectedTemplateIds.has(tpl.id)
                              const hasSpintax = /\{[^{}]*\|[^{}]*\}/.test(tpl.content || '')
                              const isOnlyOne = selectedTemplateIds.size === 1 && isChecked

                              return (
                                <div
                                  key={tpl.id}
                                  onClick={() => handleSelectSingleTemplate(tpl.id)}
                                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    isChecked
                                      ? 'border-emerald-500/60 bg-emerald-950/20 text-white shadow-sm'
                                      : 'border-gray-800 bg-gray-900/50 text-gray-300 hover:border-gray-700'
                                  }`}
                                >
                                  <div className="mt-0.5">
                                    <input
                                      type="radio"
                                      checked={isChecked}
                                      onChange={() => handleSelectSingleTemplate(tpl.id)}
                                      className="text-emerald-500 focus:ring-0 cursor-pointer"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-xs text-white truncate max-w-[240px]">
                                        {tpl.name}
                                      </span>
                                      {hasSpintax && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-950 border border-purple-800/60 text-purple-300">
                                          Spintax
                                        </span>
                                      )}
                                      {tpl.image_path && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-950 border border-blue-800/60 text-blue-300">
                                          Có ảnh
                                        </span>
                                      )}
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-400">
                                        {tpl.user_id === 1 ? '👑 Hương' : '👤 Hiệp'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate mt-1">
                                      {tpl.content.replace(/<[^>]+>/g, '').slice(0, 70)}...
                                    </p>
                                  </div>

                                  {isChecked && (
                                    <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full self-center">
                                      Đã chọn gán
                                    </span>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 2: TÀI KHOẢN & LỊCH GỬI ─── */}
                {activeTab === 'schedule' && (
                  <div className="space-y-4">
                    {/* Tài khoản Telegram */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-2">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} className="text-blue-400" />
                        Tài khoản Telegram phụ trách gửi tin:
                      </label>
                      <select
                        value={accountPhone}
                        onChange={e => setAccountPhone(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Giữ nguyên tài khoản hiện tại của từng nhóm --</option>
                        {allAccounts.map(acc => (
                          <option key={acc.phone} value={acc.phone}>
                            {acc.first_name || 'Telegram'} ({acc.phone}) - {acc.user_id === 1 ? 'Hương' : 'Hiệp'}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500">
                        Chọn tài khoản nếu bạn muốn chuyển toàn bộ nhóm đã chọn sang số này phát sóng
                      </p>
                    </div>

                    {/* Chế độ lịch gửi */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-3">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider flex items-center gap-2">
                        <Clock size={14} className="text-yellow-400" />
                        Chế độ lịch phát sóng:
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            scheduleMode === 'global'
                              ? 'border-blue-500 bg-blue-950/30 text-white'
                              : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_sched_mode"
                            value="global"
                            checked={scheduleMode === 'global'}
                            onChange={() => setScheduleMode('global')}
                            className="mt-0.5 text-blue-600"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">🌐 Lịch chung hệ thống</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Chạy theo khung giờ cài đặt chung của User</div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            scheduleMode === 'custom'
                              ? 'border-yellow-500 bg-yellow-950/30 text-white'
                              : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_sched_mode"
                            value="custom"
                            checked={scheduleMode === 'custom'}
                            onChange={() => setScheduleMode('custom')}
                            className="mt-0.5 text-yellow-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-yellow-300">⏰ Lịch riêng tùy chỉnh</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Đặt khung giờ phát tin riêng cho nhóm</div>
                          </div>
                        </label>
                      </div>

                      {/* Chọn giờ nhanh khi chọn 'custom' */}
                      {scheduleMode === 'custom' && (
                        <div className="pt-2 border-t border-gray-800 space-y-2.5 animate-in fade-in duration-200">
                          <label className="text-[11px] font-semibold text-gray-300 block">
                            Bấm chọn các khung giờ phát tin (Giờ Việt Nam):
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {defaultSuggestedSlots.map(s => {
                              const active = customSlots.includes(s)
                              return (
                                <button
                                  type="button"
                                  key={s}
                                  onClick={() => toggleSlot(s)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                                    active
                                      ? 'bg-yellow-500 text-gray-950 shadow-md font-bold'
                                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                  }`}
                                >
                                  {s} {active ? '✓' : ''}
                                </button>
                              )
                            })}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Thêm giờ khác (ví dụ 11:30)..."
                              value={newSlotInput}
                              onChange={e => setNewSlotInput(e.target.value)}
                              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none w-48"
                            />
                            <button
                              type="button"
                              onClick={addCustomSlot}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold rounded-xl"
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── TAB 3: HASHTAG & CỤM CHỢ ─── */}
                {activeTab === 'footer' && (
                  <div className="space-y-4">
                    {/* Cụm nhóm */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-2">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14} className="text-purple-400" />
                        Gán vào Cụm Nhóm Chợ (Cluster):
                      </label>
                      <select
                        value={clusterId}
                        onChange={e => setClusterId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Giữ nguyên cụm nhóm hiện tại --</option>
                        <option value="none">❌ Không gán cụm nào (Gỡ khỏi cụm)</option>
                        {clusters.map(c => (
                          <option key={c.id} value={c.id}>
                            📁 {c.name} ({c.color})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Hashtag chân trang */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-2">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider flex items-center gap-2">
                        <Hash size={14} className="text-emerald-400" />
                        Hashtag chân trang hàng loạt:
                      </label>
                      <input
                        type="text"
                        placeholder="#muaban #mmo #dichvu (Để trống nếu không đổi)"
                        value={ruleHashtags}
                        onChange={e => setRuleHashtags(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[11px] text-gray-500">
                        Hashtag sẽ tự động chèn vào cuối bài viết khi phát vào các nhóm này
                      </p>
                    </div>

                    {/* Số lần lặp */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-2xl p-4 space-y-2">
                      <label className="text-xs font-bold text-gray-200 block uppercase tracking-wider">
                        Số lần gửi tối đa trong ngày:
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Để trống nếu không đổi (0 = Không giới hạn)"
                        value={maxRepeats}
                        onChange={e => setMaxRepeats(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-950/90">
            <div className="text-xs text-gray-400">
              Đang chọn: <strong className="text-white">{selectedIds.size}</strong> nhóm
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? 'Đang lưu cấu hình...' : `Áp Dụng Cho ${selectedIds.size} Nhóm`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Groups Page ────────────────────────────────────────────────────────
export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [configModalGroup, setConfigModalGroup] = useState(null)
  const [quickPreviewGroup, setQuickPreviewGroup] = useState(null)
  const [showBulk, setShowBulk] = useState(false)
  const [showBulkConfig, setShowBulkConfig] = useState(false)
  const [newIdent, setNewIdent] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [filterActive, setFilterActive] = useState('all') // all | active | inactive
  const [filterTemplateMode, setFilterTemplateMode] = useState('all') // all | global | custom
  const [filterScheduleMode, setFilterScheduleMode] = useState('all') // all | global | custom
  const [clusters, setClusters] = useState([])
  const [filterCluster, setFilterCluster] = useState('all') // all | unassigned | clusterId
  const [filterUser, setFilterUser] = useState('all') // all | user_id
  const [users, setUsers] = useState([])

  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

  const fetchGroups = async () => {
    try {
      const promises = [
        api.get('/groups'),
        api.get('/clusters')
      ]
      if (isAdmin) {
        promises.push(api.get('/users').catch(() => ({ data: [] })))
      }
      const [groupsRes, clustersRes, usersRes] = await Promise.all(promises)
      setGroups(groupsRes.data || [])
      setClusters(clustersRes.data || [])
      if (usersRes?.data && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newIdent.trim()) return
    try {
      await api.post('/groups', {
        identifier: newIdent.trim(),
        ...(isAdmin && filterUser !== 'all' ? { user_id: Number(filterUser) } : {})
      })
      toast.success('Đã thêm nhóm mới thành công')
      setNewIdent('')
      fetchGroups()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggle = async (group) => {
    try {
      await api.patch(`/groups/${group.id}/toggle`)
      fetchGroups()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const [togglingBulk, setTogglingBulk] = useState(false)

  const handleBulkToggle = async (targetActive) => {
    if (selected.size === 0) return
    const actionText = targetActive === 1 ? 'BẬT' : 'TẮT'
    try {
      setTogglingBulk(true)
      const res = await api.patch('/groups/bulk-toggle', {
        ids: Array.from(selected),
        is_active: targetActive
      })
      toast.success(res.message || `Đã ${actionText} ${selected.size} nhóm thành công!`)
      fetchGroups()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setTogglingBulk(false)
    }
  }

  const handleToggleAllFiltered = async (targetActive) => {
    if (filtered.length === 0) return
    const actionText = targetActive === 1 ? 'BẬT' : 'TẮT'
    if (!confirm(`Bạn có chắc muốn ${actionText} hoạt động cho tất cả ${filtered.length} nhóm đang hiển thị?`)) return
    try {
      setTogglingBulk(true)
      const ids = filtered.map(g => g.id)
      const res = await api.patch('/groups/bulk-toggle', {
        ids,
        is_active: targetActive
      })
      toast.success(res.message || `Đã ${actionText} tất cả ${filtered.length} nhóm thành công!`)
      fetchGroups()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setTogglingBulk(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhóm này khỏi hệ thống?')) return
    try {
      await api.delete(`/groups/${id}`)
      toast.success('Đã xóa nhóm')
      fetchGroups()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Xóa ${selected.size} nhóm đã chọn?`)) return
    try {
      await api.delete('/groups', { data: { ids: Array.from(selected) } })
      toast.success(`Đã xóa ${selected.size} nhóm`)
      setSelected(new Set())
      fetchGroups()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(g => g.id)))
    }
  }

  const handleSendNow = async (group) => {
    if (!confirm(`Phát tin ngay đến nhóm ${group.identifier}?`)) return
    try {
      const res = await api.post(`/groups/${group.id}/send-now`)
      toast.success(res.message)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get('/groups/export')
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `nhom_muc_tieu_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success(`Đã xuất ${res.total || res.groups?.length || 0} nhóm thành công!`)
    } catch (err) {
      toast.error('Lỗi xuất nhóm: ' + err.message)
    }
  }

  const [syncingMeta, setSyncingMeta] = useState(false)

  const handleSyncAllTelegramMeta = async () => {
    try {
      setSyncingMeta(true)
      const res = await api.post('/groups/sync-metadata', { force_all: true })
      toast.success(res.message || 'Đã đồng bộ thông tin và Avatar từ Telegram!')
      fetchGroups()
    } catch (err) {
      toast.error(err.message || 'Không thể đồng bộ từ Telegram')
    } finally {
      setSyncingMeta(false)
    }
  }

  const handleSyncSelectedTelegramMeta = async () => {
    if (selected.size === 0) return
    try {
      setSyncingMeta(true)
      const res = await api.post('/groups/sync-metadata', { group_ids: Array.from(selected) })
      toast.success(res.message || `Đã cập nhật Avatar cho ${selected.size} nhóm đã chọn!`)
      fetchGroups()
    } catch (err) {
      toast.error(err.message || 'Không thể đồng bộ từ Telegram')
    } finally {
      setSyncingMeta(false)
    }
  }

  const filtered = groups.filter(g => {
    const matchUser = !isAdmin || filterUser === 'all' || (Number(g.user_id) === Number(filterUser))

    const matchSearch = g.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (g.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.rule_hashtags || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.owner_name || g.owner_username || '').toLowerCase().includes(search.toLowerCase())

    const matchActive = filterActive === 'all' || 
      (filterActive === 'active' && g.is_active) ||
      (filterActive === 'inactive' && !g.is_active)

    const matchTemplate = filterTemplateMode === 'all' ||
      (filterTemplateMode === 'custom' && g.template_mode === 'custom') ||
      (filterTemplateMode === 'global' && g.template_mode !== 'custom')

    const matchSchedule = filterScheduleMode === 'all' ||
      (filterScheduleMode === 'custom' && g.schedule_mode === 'custom') ||
      (filterScheduleMode === 'global' && g.schedule_mode !== 'custom')

    const matchCluster = filterCluster === 'all' ||
      (filterCluster === 'unassigned' && !g.cluster_id) ||
      (String(g.cluster_id) === String(filterCluster))

    return matchUser && matchSearch && matchActive && matchTemplate && matchSchedule && matchCluster
  })

  // Thống kê nhanh theo user đang lọc (nếu admin lọc)
  const displayGroups = (isAdmin && filterUser !== 'all')
    ? groups.filter(g => Number(g.user_id) === Number(filterUser))
    : groups
  const activeCount = displayGroups.filter(g => g.is_active).length
  const customTplCount = displayGroups.filter(g => g.template_mode === 'custom').length
  const customScheduleCount = displayGroups.filter(g => g.schedule_mode === 'custom').length
  const hashtagCount = displayGroups.filter(g => g.rule_hashtags && g.rule_hashtags.trim()).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-2xl border border-blue-500/20 shadow-md">
              <Store size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Quản lý Chợ</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Thiết lập kịch bản riêng/chung, hashtag chân trang, và khung giờ lặp lại độc lập cho từng nhóm chợ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Xuất toàn bộ danh sách & cấu hình nhóm ra file JSON"
          >
            <Download size={14} className="text-blue-400" />
            Export JSON
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Nhập danh sách link hoặc file JSON cấu hình nhóm"
          >
            <Upload size={14} className="text-emerald-400" />
            Import Nhóm
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <Users size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Tổng nhóm</div>
            <div className="text-xl font-bold text-white mt-0.5">{groups.length} <span className="text-xs font-normal text-emerald-400">({activeCount} bật)</span></div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Kịch bản riêng</div>
            <div className="text-xl font-bold text-white mt-0.5">{customTplCount} <span className="text-xs font-normal text-gray-500">/{groups.length}</span></div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Lịch riêng từng nhóm</div>
            <div className="text-xl font-bold text-white mt-0.5">{customScheduleCount} <span className="text-xs font-normal text-gray-500">nhóm</span></div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Hash size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Có hashtag chân trang</div>
            <div className="text-xl font-bold text-white mt-0.5">{hashtagCount} <span className="text-xs font-normal text-gray-500">nhóm</span></div>
          </div>
        </div>
      </div>

      {/* Add Single Group Bar */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono">@</span>
          <input
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-8 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            placeholder="Nhập username nhóm hoặc link t.me (ví dụ: @muaban_hanoi hoặc t.me/nhomvip)..."
            value={newIdent}
            onChange={e => setNewIdent(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={16} />
          Thêm nhóm
        </button>
      </form>

      {/* Filters and Search */}
      <div className="space-y-3">
        {/* User Filter Tabs (Admin Only) */}
        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto shadow-sm">
            <span className="text-gray-400 text-xs font-semibold flex items-center gap-1.5 px-1 flex-shrink-0">
              <Users size={14} className="text-purple-400" />
              Lọc theo User:
            </span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              <button
                type="button"
                onClick={() => setFilterUser('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  filterUser === 'all'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                    : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                <span>Tất cả</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filterUser === 'all' ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {groups.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterUser(1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  Number(filterUser) === 1
                    ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                    : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-purple-300 border border-gray-800'
                }`}
              >
                <span>👑 Hương (admin)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${Number(filterUser) === 1 ? 'bg-purple-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {groups.filter(g => Number(g.user_id) === 1).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterUser(2)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  Number(filterUser) === 2
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                    : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-emerald-300 border border-gray-800'
                }`}
              >
                <span>👤 Hiệp (hiep)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${Number(filterUser) === 2 ? 'bg-emerald-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {groups.filter(g => Number(g.user_id) === 2).length}
                </span>
              </button>

              {users.filter(u => u.id !== 1 && u.id !== 2).map(u => {
                const uCount = groups.filter(g => Number(g.user_id) === Number(u.id)).length
                const active = Number(filterUser) === Number(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setFilterUser(u.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                      active
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                        : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    <span>👤 {u.display_name || u.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {uCount}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-0.5">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'active', label: '🟢 Bật' },
                { id: 'inactive', label: '🔴 Tắt' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterActive(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterActive === f.id
                      ? 'bg-blue-600/20 text-blue-400 font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Template Mode Filter */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-0.5">
              {[
                { id: 'all', label: 'Mọi kịch bản' },
                { id: 'global', label: '🌐 Kịch bản chung' },
                { id: 'custom', label: '🎯 Kịch bản riêng' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterTemplateMode(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterTemplateMode === f.id
                      ? 'bg-amber-600/20 text-amber-300 font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Schedule Mode Filter */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-0.5">
              {[
                { id: 'all', label: 'Mọi lịch' },
                { id: 'global', label: '🌐 Giờ hệ thống' },
                { id: 'custom', label: '⏰ Giờ riêng' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterScheduleMode(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterScheduleMode === f.id
                      ? 'bg-purple-600/20 text-purple-300 font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 shadow-sm"
                placeholder="Tìm nhóm, hashtag, tên..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={fetchGroups}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors border border-gray-800"
              title="Tải lại danh sách"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleSyncAllTelegramMeta}
              disabled={syncingMeta}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-800/50 rounded-xl text-xs font-medium transition-all shadow-sm"
              title="Tự động nạp Avatar và Tên nhóm thực tế từ Telegram"
            >
              <Globe size={14} className={syncingMeta ? 'animate-spin text-sky-400' : 'text-sky-400'} />
              <span>{syncingMeta ? 'Đang nạp...' : 'Đồng bộ Avatar'}</span>
            </button>
          </div>
        </div>

        {/* Cluster Filter Tabs */}
        {clusters.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-gray-500 font-medium flex items-center gap-1 mr-1 flex-shrink-0">
              <Layers size={13} className="text-sky-400" />
              Cụm Chợ:
            </span>
            <button
              onClick={() => setFilterCluster('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex-shrink-0 ${
                filterCluster === 'all'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              Tất cả ({groups.length})
            </button>
            {clusters.map(c => {
              const count = groups.filter(g => g.cluster_id === c.id).length
              const active = String(filterCluster) === String(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => setFilterCluster(c.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                    active
                      ? 'bg-sky-600 text-white font-semibold shadow-sm'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  <span>🏷️ {c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-sky-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
            <button
              onClick={() => setFilterCluster('unassigned')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex-shrink-0 ${
                filterCluster === 'unassigned'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              Chợ chưa phân cụm ({groups.filter(g => !g.cluster_id).length})
            </button>
          </div>
        )}

        {/* Selected Batch Actions */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between bg-blue-950/30 border border-blue-800/40 rounded-2xl px-4 py-2.5 shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-300">
                ✅ Đã chọn {selected.size} nhóm
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:text-white ml-2 underline"
              >
                Bỏ chọn
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bật hàng loạt */}
              <button
                onClick={() => handleBulkToggle(1)}
                disabled={togglingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                title="Bật hoạt động cho tất cả nhóm đã chọn"
              >
                <ToggleRight size={15} />
                Bật ({selected.size})
              </button>

              {/* Tắt hàng loạt */}
              <button
                onClick={() => handleBulkToggle(0)}
                disabled={togglingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-gray-300 border border-gray-700 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                title="Tắt hoạt động cho tất cả nhóm đã chọn"
              >
                <ToggleLeft size={15} />
                Tắt ({selected.size})
              </button>

              <button
                onClick={handleSyncSelectedTelegramMeta}
                disabled={syncingMeta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-800/50 rounded-xl text-xs font-medium transition-colors"
                title="Tải lại Avatar & Tên Telegram cho các nhóm đã chọn"
              >
                <RefreshCw size={13} className={syncingMeta ? 'animate-spin' : ''} />
                Lấy Avatar & Tên ({selected.size})
              </button>
              <button
                onClick={() => setShowBulkConfig(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Sliders size={13} />
                Cài đặt hàng loạt
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-medium transition-colors"
              >
                <Trash2 size={13} />
                Xóa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Groups Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                <th className="py-3.5 px-4 w-10">
                  <button onClick={toggleSelectAll} className="hover:text-white transition-colors">
                    {selected.size === filtered.length && filtered.length > 0 ? (
                      <CheckSquare size={16} className="text-blue-400" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Thông tin Nhóm</th>
                <th className="py-3.5 px-4">Kịch bản phát</th>
                <th className="py-3.5 px-4">Hashtag chân trang</th>
                <th className="py-3.5 px-4">Lịch chạy & Tần suất</th>
                <th className="py-3.5 px-4">Tài khoản gửi</th>
                <th className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Trạng thái</span>
                    <div className="inline-flex items-center rounded-lg bg-gray-950/80 border border-gray-700/80 p-0.5 ml-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleToggleAllFiltered(1)}
                        title={`Bật tất cả ${filtered.length} nhóm đang hiển thị`}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/80 transition-colors uppercase tracking-wider"
                      >
                        Bật hết
                      </button>
                      <span className="text-gray-600 text-[9px]">|</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllFiltered(0)}
                        title={`Tắt tất cả ${filtered.length} nhóm đang hiển thị`}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors uppercase tracking-wider"
                      >
                        Tắt hết
                      </button>
                    </div>
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-gray-500">
                    <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-blue-500" />
                    Đang đồng bộ danh sách nhóm...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-gray-500">
                    <UsersRound size={36} className="mx-auto mb-2 opacity-30" />
                    Không tìm thấy nhóm mục tiêu nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map(group => {
                  const isCustomTpl = group.template_mode === 'custom'
                  const isCustomSched = group.schedule_mode === 'custom'
                  const hasHashtag = Boolean(group.rule_hashtags && group.rule_hashtags.trim())
                  
                  let customSlots = []
                  if (isCustomSched) {
                    try {
                      customSlots = JSON.parse(group.custom_time_slots || '[]')
                    } catch (_) {}
                  }

                  return (
                    <tr
                      key={group.id}
                      className={`hover:bg-gray-800/30 transition-colors ${
                        selected.has(group.id) ? 'bg-blue-950/15' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <button onClick={() => toggleSelect(group.id)}>
                          {selected.has(group.id) ? (
                            <CheckSquare size={16} className="text-blue-400" />
                          ) : (
                            <Square size={16} className="text-gray-600" />
                          )}
                        </button>
                      </td>

                      {/* Thông tin nhóm */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          <GroupAvatar
                            avatarUrl={group.avatar_url}
                            title={group.title}
                            identifier={group.identifier}
                            size="md"
                          />
                          <div className="min-w-0">
                            {getTelegramUrl(group.identifier) ? (
                              <a
                                href={getTelegramUrl(group.identifier)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Mở nhóm trên Telegram (Tab mới)"
                                className="font-semibold text-xs text-white truncate hover:text-blue-300 transition-colors inline-flex items-center gap-1 group/title"
                              >
                                <span className="truncate max-w-[170px]">{group.title && group.title !== group.identifier ? group.title : group.identifier}</span>
                                <ExternalLink size={11} className="opacity-0 group-hover/title:opacity-100 text-blue-400 flex-shrink-0 transition-opacity" />
                              </a>
                            ) : (
                              <div className="font-semibold text-xs text-white truncate hover:text-blue-300 transition-colors">
                                {group.title && group.title !== group.identifier ? group.title : group.identifier}
                              </div>
                            )}
                            <div className="font-mono text-[11px] text-blue-400/80 truncate mt-0.5 flex items-center gap-1.5">
                              {getTelegramUrl(group.identifier) ? (
                                <a
                                  href={getTelegramUrl(group.identifier)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Mở link chợ trong tab mới"
                                  className="inline-flex items-center gap-1 hover:text-blue-300 hover:underline truncate max-w-[160px]"
                                >
                                  <span className="truncate">{group.identifier}</span>
                                  <ExternalLink size={10} className="flex-shrink-0 opacity-70" />
                                </a>
                              ) : (
                                <span>{group.identifier}</span>
                              )}
                              {group.member_count > 0 && (
                                <span className="text-[10px] text-gray-400 font-sans flex-shrink-0">
                                  • {group.member_count.toLocaleString('vi-VN')} mem
                                </span>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  Number(group.user_id) === 1
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                                }`}>
                                  {Number(group.user_id) === 1 ? '👑 Hương' : `👤 ${group.owner_name || group.owner_username || 'Hiệp'}`}
                                </span>
                                {group.cluster_name && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/70 border border-sky-800/40 text-sky-300 text-[10px] font-semibold">
                                    🏷️ {group.cluster_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {!isAdmin && group.cluster_name && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/70 border border-sky-800/40 text-sky-300 text-[10px] font-semibold">
                                  🏷️ {group.cluster_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kịch bản phát */}
                      <td className="py-3.5 px-4">
                        {isCustomTpl ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-800/40 font-semibold text-[11px]">
                              <Sparkles size={12} />
                              Kịch bản riêng
                            </span>
                            {group.custom_image_path && (
                              <span className="text-[10px] text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/20 ml-1.5">
                                + Ảnh
                              </span>
                            )}
                            <p className="text-[10px] text-gray-500 font-mono truncate max-w-[170px]">
                              {group.custom_content || 'Chưa nhập nội dung'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-300 border border-blue-800/40 font-semibold text-[11px]">
                              <Layers size={12} />
                              Kịch bản chung
                            </span>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {group.assigned_templates_count > 0 ? (
                                <span
                                  className="text-emerald-400 font-medium block truncate max-w-[180px]"
                                  title={group.assigned_templates_names || `${group.assigned_templates_count} bài chỉ định`}
                                >
                                  🎯 {group.assigned_templates_names || `${group.assigned_templates_count} bài chỉ định`}
                                </span>
                              ) : (
                                <span className="text-gray-500">Tất cả kho bài (Xoay vòng)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Hashtag chân trang */}
                      <td className="py-3.5 px-4 max-w-[190px]">
                        {hasHashtag ? (
                          <div className="flex flex-wrap gap-1">
                            {group.rule_hashtags.split(/\s+/).slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/30 font-mono text-[10px] truncate max-w-[100px]"
                              >
                                {tag}
                              </span>
                            ))}
                            {group.rule_hashtags.split(/\s+/).length > 3 && (
                              <span className="text-[10px] text-gray-500 self-center">
                                +{group.rule_hashtags.split(/\s+/).length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-[11px] italic">Không dùng hashtag</span>
                        )}
                        {(group.rule_prefix || group.rule_suffix) && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {group.rule_prefix ? 'Có lời chào' : ''} {group.rule_suffix ? '• Có chữ ký' : ''}
                          </div>
                        )}
                      </td>

                      {/* Lịch chạy & Tần suất */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        {isCustomSched ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 font-semibold text-[11px]">
                              <Clock size={11} />
                              {customSlots.length > 0 ? customSlots.join(', ') : 'Chưa cài giờ'}
                            </span>
                            <div className="text-[10px] text-gray-400">
                              Lặp tối đa: <strong className="text-gray-200">{group.max_repeats_per_day > 0 ? `${group.max_repeats_per_day} lần/ngày` : 'Vô hạn'}</strong>
                              {' '}(Hôm nay: <span className="text-emerald-400">{group.sent_today_count || 0}</span>)
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded text-[11px]">
                              <Clock size={11} className="text-gray-500" />
                              Giờ hệ thống
                            </span>
                            <div className="text-[10px] text-gray-500">
                              Tối đa: {group.max_repeats_per_day > 0 ? `${group.max_repeats_per_day} lần` : 'Vô hạn'} (Hôm nay: {group.sent_today_count || 0})
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Tài khoản phụ trách */}
                      <td className="py-3.5 px-4">
                        {group.account_phone ? (
                          <span className="bg-gray-800 text-blue-300 px-2.5 py-1 rounded-lg font-mono text-[11px] border border-gray-700">
                            {group.account_phone}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Tự động (Acc chính)</span>
                        )}
                      </td>

                      {/* Trạng thái Bật/Tắt */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggle(group)}
                          title={group.is_active ? 'Click để tạm dừng' : 'Click để kích hoạt'}
                          className="transition-transform active:scale-95"
                        >
                          {group.is_active ? (
                            <ToggleRight size={26} className="text-emerald-400" />
                          ) : (
                            <ToggleLeft size={26} className="text-gray-600" />
                          )}
                        </button>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {getTelegramUrl(group.identifier) && (
                            <a
                              href={getTelegramUrl(group.identifier)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-sky-400 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Mở nhóm trên Telegram (Tab mới)"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}

                          <button
                            onClick={() => setQuickPreviewGroup(group)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Xem trước tin nhắn sẽ gửi"
                          >
                            <Eye size={15} />
                          </button>
                          
                          <button
                            onClick={() => handleSendNow(group)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Gửi ngay 1 tin đến nhóm này"
                          >
                            <Play size={15} />
                          </button>

                          <button
                            onClick={() => setConfigModalGroup(group)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors border border-transparent hover:border-blue-800/40"
                            title="Cấu hình chi tiết nhóm này"
                          >
                            <Settings2 size={15} />
                          </button>

                          <button
                            onClick={() => handleDelete(group.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Xóa nhóm"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3.5 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between bg-gray-950/20">
            <span>Hiển thị <strong>{filtered.length}</strong> / <strong>{groups.length}</strong> nhóm mục tiêu</span>
            {selected.size > 0 && (
              <span className="text-blue-400 font-semibold">{selected.size} nhóm đang được chọn</span>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {configModalGroup && (
        <GroupConfigModal
          group={configModalGroup}
          clusters={clusters}
          onClose={() => setConfigModalGroup(null)}
          onSuccess={fetchGroups}
        />
      )}

      {quickPreviewGroup && (
        <QuickPreviewModal
          group={quickPreviewGroup}
          onClose={() => setQuickPreviewGroup(null)}
        />
      )}

      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onSuccess={fetchGroups}
        />
      )}

      {showBulkConfig && (
        <BulkConfigModal
          selectedIds={selected}
          groups={groups}
          clusters={clusters}
          onClose={() => setShowBulkConfig(false)}
          onSuccess={() => {
            setSelected(new Set())
            fetchGroups()
          }}
        />
      )}

    </div>
  )
}
