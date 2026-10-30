import { useState, useEffect } from 'react'
import {
  ArrowLeftRight, Check, AlertCircle, RefreshCw, X, Shield,
  User, Layers, FileText, Store, Clock, Lock, CheckCircle2, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

export default function SyncModal({
  isOpen,
  onClose,
  onSuccess,
  users = [],
  initialSourceId = null,
  initialTargetId = null
}) {
  const [sourceId, setSourceId] = useState(initialSourceId || '')
  const [targetId, setTargetId] = useState(initialTargetId || '')
  const [syncTemplates, setSyncTemplates] = useState(true)
  const [syncClusters, setSyncClusters] = useState(true)
  const [syncGroups, setSyncGroups] = useState(true)
  const [mode, setMode] = useState('merge') // 'merge' or 'overwrite'
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Tự động khởi tạo giá trị ban đầu nếu danh sách users có sẵn
  useEffect(() => {
    if (users && users.length > 0) {
      if (!sourceId) {
        setSourceId(initialSourceId || users[0]?.id || '')
      }
      if (!targetId) {
        const defaultTarget = users.find(u => u.id !== (initialSourceId || users[0]?.id))
        setTargetId(initialTargetId || defaultTarget?.id || '')
      }
    }
  }, [users, initialSourceId, initialTargetId])

  if (!isOpen) return null

  const sourceUser = users.find(u => Number(u.id) === Number(sourceId))
  const targetUser = users.find(u => Number(u.id) === Number(targetId))

  const handleSwap = () => {
    const temp = sourceId
    setSourceId(targetId)
    setTargetId(temp)
    setResult(null)
  }

  const handleSync = async () => {
    if (!sourceId || !targetId) {
      return toast.error('Vui lòng chọn cả tài khoản nguồn và đích')
    }
    if (Number(sourceId) === Number(targetId)) {
      return toast.error('Tài khoản nguồn và đích không được trùng nhau')
    }
    if (!syncTemplates && !syncClusters && !syncGroups) {
      return toast.error('Vui lòng chọn ít nhất 1 mục cần đồng bộ')
    }

    if (mode === 'overwrite') {
      const confirmed = window.confirm(
        `⚠️ CẢNH BÁO QUAN TRỌNG:\n\nChế độ [Xóa sạch & Đồng bộ mới] sẽ XÓA TOÀN BỘ dữ liệu nhóm/cụm/kịch bản hiện có của tài khoản [${targetUser?.display_name || targetUser?.username}] và thay thế hoàn toàn bằng dữ liệu của [${sourceUser?.display_name || sourceUser?.username}].\n\n(Khung giờ gửi tin riêng của tài khoản đích vẫn được giữ nguyên).\n\nBạn có chắc chắn muốn thực hiện?`
      )
      if (!confirmed) return
    }

    try {
      setLoading(true)
      setResult(null)
      const res = await api.post('/users/sync', {
        source_user_id: sourceId,
        target_user_id: targetId,
        sync_templates: syncTemplates,
        sync_clusters: syncClusters,
        sync_groups: syncGroups,
        mode
      })

      if (res.success) {
        toast.success(res.message || 'Đồng bộ dữ liệu thành công!')
        setResult(res.data)
        if (onSuccess) onSuccess(res.data)
      } else {
        toast.error(res.error || 'Đồng bộ thất bại')
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đồng bộ dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Đồng Bộ Dữ Liệu Tài Khoản
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                  Admin Tool
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Sao chép kịch bản, cụm chợ và nhóm chợ từ tài khoản này sang tài khoản khác
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Account Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            {/* Source Card */}
            <div className="md:col-span-5 bg-gray-950/70 border border-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Nguồn (Sao chép từ)
                </span>
                {sourceUser && (
                  <span className="text-[11px] text-gray-500">ID: {sourceUser.id}</span>
                )}
              </div>

              <select
                value={sourceId}
                onChange={e => { setSourceId(e.target.value); setResult(null); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {users.map(u => (
                  <option key={`src-${u.id}`} value={u.id}>
                    {u.role === 'admin' ? '👑 ' : '👤 '}
                    {u.display_name || u.username} (@{u.username})
                  </option>
                ))}
              </select>

              {sourceUser && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-400">
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <FileText size={12} className="text-indigo-400" />
                    {sourceUser.templates_count ?? 0} kịch bản
                  </span>
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <Layers size={12} className="text-cyan-400" />
                    {sourceUser.clusters_count ?? 0} cụm
                  </span>
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <Store size={12} className="text-emerald-400" />
                    {sourceUser.groups_count ?? 0} nhóm
                  </span>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="p-2.5 rounded-full bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white border border-gray-700 transition-all shadow-md group"
                title="Đảo ngược nguồn và đích"
              >
                <ArrowLeftRight size={16} className="group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </div>

            {/* Target Card */}
            <div className="md:col-span-5 bg-gray-950/70 border border-indigo-900/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Đích (Đồng bộ vào)
                </span>
                {targetUser && (
                  <span className="text-[11px] text-gray-500">ID: {targetUser.id}</span>
                )}
              </div>

              <select
                value={targetId}
                onChange={e => { setTargetId(e.target.value); setResult(null); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {users.map(u => (
                  <option key={`dst-${u.id}`} value={u.id}>
                    {u.role === 'admin' ? '👑 ' : '👤 '}
                    {u.display_name || u.username} (@{u.username})
                  </option>
                ))}
              </select>

              {targetUser && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-400">
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <FileText size={12} className="text-indigo-400" />
                    {targetUser.templates_count ?? 0} kịch bản
                  </span>
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <Layers size={12} className="text-cyan-400" />
                    {targetUser.clusters_count ?? 0} cụm
                  </span>
                  <span className="bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700/60 flex items-center gap-1">
                    <Store size={12} className="text-emerald-400" />
                    {targetUser.groups_count ?? 0} nhóm
                  </span>
                </div>
              )}
            </div>
          </div>

          {Number(sourceId) === Number(targetId) && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              <AlertCircle size={16} />
              <span>Tài khoản nguồn và tài khoản đích không được trùng nhau! Vui lòng chọn tài khoản khác.</span>
            </div>
          )}

          {/* Sync Items Checklist */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Các mục đồng bộ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Templates */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                syncTemplates
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={syncTemplates}
                  onChange={e => setSyncTemplates(e.target.checked)}
                  className="mt-0.5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <FileText size={14} className="text-indigo-400" />
                    Nội dung & Kịch bản (Templates)
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Toàn bộ mẫu bài đăng, nội dung, emoji & hình ảnh đính kèm
                  </p>
                </div>
              </label>

              {/* Clusters */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                syncClusters
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={syncClusters}
                  onChange={e => setSyncClusters(e.target.checked)}
                  className="mt-0.5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Layers size={14} className="text-cyan-400" />
                    Cụm Chợ (Clusters)
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Các cụm phân loại, màu sắc, tiền tố, hashtag & chữ ký chân trang
                  </p>
                </div>
              </label>

              {/* Groups */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                syncGroups
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={syncGroups}
                  onChange={e => setSyncGroups(e.target.checked)}
                  className="mt-0.5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Store size={14} className="text-emerald-400" />
                    Danh sách Nhóm chợ (Groups)
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Các nhóm Telegram, tự động gán cụm chợ & kịch bản tương ứng
                  </p>
                </div>
              </label>

              {/* Schedule Slots (LOCKED / PROTECTED) */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-gray-950/50 border-gray-800 text-gray-500 relative">
                <div className="mt-0.5 text-gray-500">
                  <Lock size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Clock size={14} className="text-amber-500/70" />
                    Khung giờ gửi tin (Được bảo vệ)
                  </div>
                  <p className="text-[11px] text-emerald-400/90 font-medium mt-0.5">
                    ✓ Giữ nguyên lịch gửi riêng biệt của tài khoản đích, không bao giờ ghi đè
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Mode Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Chế độ đồng bộ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setMode('merge')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  mode === 'merge'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                    : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Bổ sung & Cập nhật
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Giữ lại toàn bộ dữ liệu hiện có của tài khoản đích, chỉ thêm mới các mục chưa có và cập nhật nội dung mới nhất.
                </p>
              </div>

              <div
                onClick={() => setMode('overwrite')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  mode === 'overwrite'
                    ? 'bg-rose-600/15 border-rose-500 text-white shadow-md shadow-rose-600/10'
                    : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Xóa sạch & Đồng bộ mới
                  </span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-medium">
                    Clone 100%
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Xóa các nhóm, cụm, kịch bản cũ của tài khoản đích và thay bằng toàn bộ dữ liệu từ nguồn (khung giờ vẫn giữ riêng).
                </p>
              </div>
            </div>
          </div>

          {/* Sync Result Banner */}
          {result && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 size={16} />
                <span>Đồng bộ hoàn tất thành công!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-gray-900/60 p-2 rounded-xl">
                  <div className="text-[11px] text-gray-400">Kịch bản</div>
                  <div className="text-white font-bold mt-0.5">
                    +{result.templates?.added || 0} mới / {result.templates?.updated || 0} sửa
                  </div>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-xl">
                  <div className="text-[11px] text-gray-400">Cụm chợ</div>
                  <div className="text-white font-bold mt-0.5">
                    +{result.clusters?.added || 0} mới / {result.clusters?.updated || 0} sửa
                  </div>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-xl">
                  <div className="text-[11px] text-gray-400">Nhóm chợ</div>
                  <div className="text-white font-bold mt-0.5">
                    +{result.groups?.added || 0} mới / {result.groups?.updated || 0} sửa
                  </div>
                </div>
                <div className="bg-gray-900/60 p-2 rounded-xl">
                  <div className="text-[11px] text-gray-400">Gán kịch bản</div>
                  <div className="text-emerald-400 font-bold mt-0.5">
                    {result.group_templates_assigned || 0} liên kết
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={loading || Number(sourceId) === Number(targetId) || (!syncTemplates && !syncClusters && !syncGroups)}
            onClick={handleSync}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
              loading || Number(sourceId) === Number(targetId) || (!syncTemplates && !syncClusters && !syncGroups)
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang đồng bộ dữ liệu...</span>
              </>
            ) : (
              <>
                <ArrowLeftRight size={16} />
                <span>Bắt đầu Đồng bộ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
