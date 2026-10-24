import { useEffect, useState, useRef, useMemo } from 'react'
import {
  CheckCircle, XCircle, SkipForward, RefreshCw, Trash2, Filter,
  Search, ChevronLeft, ChevronRight, Users, User
} from 'lucide-react'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'
import GroupAvatar from '../components/GroupAvatar'

function formatLogTime(timestamp) {
  if (!timestamp) return '—'
  const iso = timestamp.includes('T')
    ? (timestamp.endsWith('Z') ? timestamp : timestamp + 'Z')
    : timestamp.replace(' ', 'T') + 'Z'
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch (_) {
    return timestamp
  }
}

const STATUS_LABELS = {
  success: { label: 'Thành công', icon: CheckCircle, cls: 'badge-success' },
  failed: { label: 'Thất bại', icon: XCircle, cls: 'badge-danger' },
  skipped: { label: 'Bỏ qua', icon: SkipForward, cls: 'badge-warning' },
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [userStats, setUserStats] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filters, setFilters] = useState({ status: '', group: '', date: '' })
  const [selectedUserFilter, setSelectedUserFilter] = useState('all') // 'all' | 1 | 2
  const [page, setPage] = useState(1)
  const intervalRef = useRef(null)

  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'

  const fetchLogs = async (p = page) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: p,
        limit: 50,
        ...(isAdmin && selectedUserFilter !== 'all' && { user_id: selectedUserFilter }),
        ...(filters.status && { status: filters.status }),
        ...(filters.group && { group: filters.group }),
        ...(filters.date && { date: filters.date }),
      })
      const res = await api.get(`/logs?${params}`)
      setLogs(res.data || [])
      setPagination(res.pagination || { total: 0, page: 1, limit: 50, pages: 1 })
      if (res.user_stats) {
        setUserStats(res.user_stats)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearLogs = async () => {
    if ((pagination?.total || 0) === 0 && logs.length === 0) {
      toast('Hiện chưa có nhật ký nào để xóa', { icon: 'ℹ️' })
      return
    }

    const scopeText = !isAdmin || selectedUserFilter === 'all'
      ? 'toàn bộ nhật ký hệ thống'
      : Number(selectedUserFilter) === 1
      ? 'toàn bộ nhật ký của 👑 Hương'
      : 'toàn bộ nhật ký của 👤 Hiệp'

    if (!confirm(`Xác nhận xóa ${scopeText}? Hành động này không thể hoàn tác.`)) return

    try {
      const url = isAdmin && selectedUserFilter !== 'all' ? `/logs?user_id=${selectedUserFilter}` : '/logs'
      await api.delete(url)
      toast.success(`Đã xóa ${scopeText}`)
      fetchLogs(1)
      setPage(1)
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa nhật ký')
    }
  }

  useEffect(() => {
    fetchLogs(page)
  }, [page, filters, selectedUserFilter])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchLogs(page), 8000)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, page, filters, selectedUserFilter])

  const applyFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  // Đếm số lượng log theo user
  const huongLogCount = useMemo(() => {
    const found = userStats.find(s => Number(s.user_id) === 1)
    return found ? found.count : 0
  }, [userStats])

  const hiepLogCount = useMemo(() => {
    const found = userStats.find(s => Number(s.user_id) === 2)
    return found ? found.count : 0
  }, [userStats])

  const totalLogsCount = useMemo(() => {
    return userStats.reduce((sum, s) => sum + s.count, 0) || pagination.total
  }, [userStats, pagination.total])

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20">
              <Filter size={20} />
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Nhật ký hoạt động
              {isAdmin && selectedUserFilter !== 'all' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-normal">
                  {Number(selectedUserFilter) === 1 ? '👑 Hương' : '👤 Hiệp'}
                </span>
              )}
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            <span className="text-white font-semibold">{pagination.total.toLocaleString()}</span> bản ghi — tự động làm mới mỗi 8 giây
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-900/20 border-emerald-700/50 text-emerald-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Live: ON' : 'Live: OFF'}
          </button>
          <button
            onClick={() => fetchLogs(page)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Tải lại
          </button>
          <button
            onClick={handleClearLogs}
            disabled={pagination.total === 0 || loading}
            title={pagination.total === 0 ? 'Chưa có nhật ký để xóa' : 'Xóa nhật ký'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-800/40 text-rose-400 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {isAdmin && selectedUserFilter !== 'all' ? `Xóa log ${selectedUserFilter === 1 ? 'Hương' : 'Hiệp'}` : 'Xóa hết'}
          </button>
        </div>
      </div>

      {/* User Filter Tabs for Admin */}
      {isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto shadow-sm">
          <span className="text-gray-400 text-xs font-semibold flex items-center gap-1.5 px-1 flex-shrink-0">
            <Users size={14} className="text-purple-400" />
            Lọc theo User:
          </span>
          <div className="flex items-center gap-1.5 flex-nowrap">
            <button
              type="button"
              onClick={() => { setSelectedUserFilter('all'); setPage(1) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                selectedUserFilter === 'all'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <span>Tất cả</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedUserFilter === 'all' ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {totalLogsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedUserFilter(1); setPage(1) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                Number(selectedUserFilter) === 1
                  ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                  : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-purple-300 border border-gray-800'
              }`}
            >
              <span>👑 Hương (admin)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${Number(selectedUserFilter) === 1 ? 'bg-purple-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {huongLogCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedUserFilter(2); setPage(1) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                Number(selectedUserFilter) === 2
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-emerald-300 border border-gray-800'
              }`}
            >
              <span>👤 Hiệp (hiep)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${Number(selectedUserFilter) === 2 ? 'bg-emerald-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {hiepLogCount}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lọc chi tiết</span>
        </div>
        <select
          className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status}
          onChange={e => applyFilter('status', e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="success">✅ Thành công</option>
          <option value="failed">❌ Thất bại</option>
          <option value="skipped">⏭ Bỏ qua</option>
        </select>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3">
          <Search size={14} className="text-gray-500" />
          <input
            className="bg-transparent text-xs text-gray-200 py-2 outline-none w-40 placeholder-gray-500"
            placeholder="Tìm nhóm, ID..."
            value={filters.group}
            onChange={e => applyFilter('group', e.target.value)}
          />
        </div>
        <input
          type="date"
          className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.date}
          onChange={e => applyFilter('date', e.target.value)}
        />
        {(filters.status || filters.group || filters.date) && (
          <button
            onClick={() => { setFilters({ status: '', group: '', date: '' }); setPage(1) }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-400 transition-colors"
          >
            <XCircle size={14} />
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800 bg-gray-800/50">
                <th className="text-left py-3 px-4 font-medium">Thời gian</th>
                {isAdmin && <th className="text-left py-3 px-4 font-medium">Người gửi</th>}
                <th className="text-left py-3 px-4 font-medium">Nhóm</th>
                <th className="text-left py-3 px-4 font-medium">Kịch bản</th>
                <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                <th className="text-left py-3 px-4 font-medium">Chi tiết lỗi</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-400" />
                    Đang tải nhật ký...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center mb-3 text-gray-400 shadow-inner">
                        <Filter size={22} className="text-blue-400" />
                      </div>
                      <p className="text-base font-semibold text-gray-300">Chưa có bản ghi nhật ký nào</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">
                        Khi các kịch bản bắt đầu gửi tin nhắn đến các nhóm theo lịch trình, toàn bộ lịch sử trạng thái sẽ xuất hiện chi tiết tại đây.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const statusInfo = STATUS_LABELS[log.status] || { label: log.status, cls: 'badge-info' }
                  const Icon = statusInfo.icon
                  return (
                    <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatLogTime(log.sent_at)}
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            Number(log.user_id) === 1
                              ? 'bg-purple-950/70 text-purple-300 border-purple-800/40'
                              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40'
                          }`}>
                            {Number(log.user_id) === 1 ? '👑 Hương' : `👤 ${log.owner_name || log.owner_username || 'Hiệp'}`}
                          </span>
                        </td>
                      )}

                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          <GroupAvatar
                            avatarUrl={log.avatar_url}
                            title={log.group_title}
                            identifier={log.group_identifier}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-white block truncate hover:text-blue-300 transition-colors" title={log.group_title || log.group_identifier}>
                              {log.group_title && log.group_title !== log.group_identifier ? log.group_title : log.group_identifier}
                            </span>
                            <span className="font-mono text-blue-400/80 text-[11px] block truncate">
                              {log.group_identifier}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-400 max-w-[150px] truncate">
                        {log.template_name || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span className={statusInfo.cls}>
                          {Icon && <Icon size={11} />}
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-red-400 max-w-xs">
                        {log.error_message ? (
                          <span title={log.error_message} className="cursor-help line-clamp-2">
                            {log.error_message}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              Trang <strong className="text-white">{pagination.page}</strong>/{pagination.pages} — {pagination.total.toLocaleString()} bản ghi
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const p = Math.max(1, Math.min(pagination.pages - 4, page - 2)) + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === page ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
