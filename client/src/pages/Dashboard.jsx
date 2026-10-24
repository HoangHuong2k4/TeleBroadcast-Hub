import { useEffect, useState } from 'react'
import {
  UsersRound, Send, CheckCircle, TrendingUp, Clock,
  AlertCircle, RefreshCw, Radio, Zap, BarChart2,
  ChevronRight, Activity, Users, FileText
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'
import GroupAvatar from '../components/GroupAvatar'

function StatCard({ icon: Icon, label, value, color, sub, trend }) {
  const colorMap = {
    blue: { bg: 'bg-blue-600/10 border-blue-500/20', icon: 'text-blue-400', border: 'border-blue-500/30' },
    emerald: { bg: 'bg-emerald-600/10 border-emerald-500/20', icon: 'text-emerald-400', border: 'border-emerald-500/30' },
    rose: { bg: 'bg-rose-600/10 border-rose-500/20', icon: 'text-rose-400', border: 'border-rose-500/30' },
    amber: { bg: 'bg-amber-600/10 border-amber-500/20', icon: 'text-amber-400', border: 'border-amber-500/30' },
    purple: { bg: 'bg-purple-600/10 border-purple-500/20', icon: 'text-purple-400', border: 'border-purple-500/30' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={`bg-gray-900 border ${c.border} rounded-2xl p-5 flex items-start gap-4 hover:border-opacity-60 transition-all`}>
      <div className={`p-3 rounded-xl border ${c.bg}`}>
        <Icon size={20} className={c.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => (d.success || 0) + (d.failed || 0)), 1)
  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((day, i) => {
        const total = (day.success || 0) + (day.failed || 0)
        const totalPct = (total / maxVal) * 100
        const successPct = total > 0 ? ((day.success || 0) / total) * 100 : 0
        const isToday = i === data.length - 1
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
            <div className="w-full relative" style={{ height: '80px' }}>
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all ${
                  isToday ? 'bg-blue-600/40' : 'bg-gray-800'
                }`}
                style={{ height: `${Math.max(totalPct, 4)}%` }}
              />
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-t-md ${
                  isToday ? 'bg-blue-500' : 'bg-blue-600/60'
                }`}
                style={{ height: `${Math.max((totalPct * successPct) / 100, 4)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-600 font-mono group-hover:text-gray-400 transition-colors">
              {day.date?.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function LogStatusBadge({ status }) {
  const map = {
    success: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
    failed: 'bg-rose-900/30 text-rose-400 border-rose-800/40',
    skipped: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
  }
  const label = { success: 'Thành công', failed: 'Thất bại', skipped: 'Bỏ qua' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {label[status] || status}
    </span>
  )
}

function formatVNTime(timestamp) {
  if (!timestamp) return '—'
  const iso = timestamp.includes('T')
    ? (timestamp.endsWith('Z') ? timestamp : timestamp + 'Z')
    : timestamp.replace(' ', 'T') + 'Z'
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'short'
    })
  } catch (_) {
    return timestamp
  }
}

function getVNTimeString() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [liveVNTime, setLiveVNTime] = useState(getVNTimeString())
  const user = getCurrentUser()

  const fetchStats = async (silent = false, uid = selectedUserId) => {
    try {
      if (!silent) setLoading(true)
      const url = uid ? `/stats?user_id=${uid}` : '/stats'
      const res = await api.get(url)
      setStats(res.data)
    } catch (err) {
      toast.error('Lỗi tải thống kê: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = (uid) => {
    setSelectedUserId(uid)
    fetchStats(false, uid)
  }

  const runNow = async () => {
    try {
      setDispatching(true)
      await api.post('/scheduler/run-now')
      toast.success('🚀 Bắt đầu gửi tin! Theo dõi trong tab Nhật ký.')
      setTimeout(() => fetchStats(true), 3000)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDispatching(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const pollInterval = setInterval(() => fetchStats(true), 30000)
    const timeInterval = setInterval(() => {
      setLiveVNTime(getVNTimeString())
    }, 10000)
    return () => {
      clearInterval(pollInterval)
      clearInterval(timeInterval)
    }
  }, [selectedUserId])

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw size={28} className="animate-spin text-blue-500" />
        <p className="text-gray-500 text-sm">Đang tải dữ liệu...</p>
      </div>
    )
  }

  const successRate = stats?.successRate ?? 0
  const nowVN = stats?.currentTimeVN || liveVNTime
  const activeSlots = stats?.activeSlots || []
  const nextSlotIndex = activeSlots.findIndex(s => s >= nowVN)

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/15 rounded-xl border border-blue-500/20">
              <BarChart2 size={22} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard</h1>
              <p className="text-xs text-gray-500">
                Xin chào, <span className="text-blue-400 font-medium">{user?.display_name || user?.username}</span> 👋
                <span className="ml-2 font-mono text-[11px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-700/50">
                  VN: {nowVN}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchStats()}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={runNow}
            disabled={dispatching}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60"
          >
            {dispatching ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {dispatching ? 'Đang gửi...' : 'Gửi ngay'}
          </button>
        </div>
      </div>

      {/* Admin User Filter Tabs */}
      {user?.role === 'admin' && stats?.users?.length > 1 && (
        <div className="bg-gray-950/60 border border-gray-800/80 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users size={14} className="text-sky-400" />
            <span>Xem thống kê theo tài khoản:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => handleSelectUser(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                selectedUserId === null
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800'
              }`}
            >
              🌐 Toàn hệ thống
            </button>
            {stats.users.map(u => {
              const isCur = selectedUserId === u.id
              const isHiep = u.username === 'hiep'
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    isCur
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800'
                  }`}
                >
                  <span>👤 {u.display_name || u.username}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isCur ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {isHiep ? 'Hiệp' : 'Hương'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={UsersRound}
          label="Nhóm đang hoạt động"
          value={stats?.activeGroups ?? 0}
          color="blue"
          sub={`/ ${stats?.totalGroups ?? 0} nhóm`}
        />
        <StatCard
          icon={Send}
          label="Tin gửi hôm nay"
          value={stats?.todaySent ?? 0}
          color="emerald"
          sub={`${stats?.todayFail ?? stats?.todayFailed ?? 0} thất bại`}
        />
        <StatCard
          icon={CheckCircle}
          label="Tổng tin thành công"
          value={stats?.totalSuccess ?? 0}
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Tỷ lệ thành công"
          value={`${successRate}%`}
          color={successRate >= 80 ? 'emerald' : successRate >= 50 ? 'amber' : 'rose'}
          sub={`${stats?.totalFail ?? stats?.totalFailed ?? 0} lỗi tổng cộng`}
        />
      </div>

      {/* Chart + Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-day bar chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity size={17} className="text-blue-400" />
              Tin gửi 7 ngày qua
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Thành công
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-700 inline-block" /> Tổng
              </span>
            </div>
          </div>
          {stats?.last7Days?.length > 0 ? (
            <>
              <MiniBarChart data={stats.last7Days} />
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>
                  Tổng tuần: <strong className="text-white">{stats.last7Days.reduce((s, d) => s + (d.success || 0), 0)}</strong> tin
                </span>
              </div>
            </>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-600 text-sm">
              Chưa có dữ liệu gửi tin
            </div>
          )}
        </div>

        {/* Schedule slots */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Clock size={17} className="text-blue-400" />
              Lịch gửi hôm nay
            </h2>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-300">
              Giờ VN: {nowVN}
            </span>
          </div>
          {activeSlots.length > 0 ? (
            <div className="space-y-2">
              {activeSlots.slice(0, 8).map((slot, i) => {
                const isPast = slot < nowVN
                const isNext = i === nextSlotIndex
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      isNext ? 'bg-blue-600/15 border border-blue-500/30 ring-1 ring-blue-500/20' :
                      isPast ? 'opacity-40 bg-gray-900/60' : 'bg-gray-800/40'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isNext ? 'bg-blue-400 animate-pulse' :
                      isPast ? 'bg-gray-600' : 'bg-blue-500'
                    }`} />
                    <span className="font-mono font-bold text-white text-sm">{slot}</span>
                    <span className={`text-xs ml-auto font-medium ${
                      isNext ? 'text-blue-400 font-semibold' : isPast ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {isNext ? '🎯 Tiếp theo' : isPast ? 'Đã qua' : 'Chờ'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <Clock size={28} className="mx-auto text-gray-700 mb-2" />
              <p className="text-gray-500 text-sm">Chưa có lịch gửi</p>
              <Link to="/scheduler" className="text-blue-400 text-xs hover:underline mt-1 inline-block">
                Cài đặt ngay →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/accounts', icon: Radio, label: 'Tài khoản', sub: `${stats?.totalAccounts ?? 0} tài khoản`, color: 'blue' },
          { to: '/groups', icon: UsersRound, label: 'Nhóm', sub: `${stats?.totalGroups ?? 0} nhóm`, color: 'purple' },
          { to: '/templates', icon: FileText, label: 'Kịch bản', sub: `${stats?.totalTemplates ?? 0} kịch bản`, color: 'emerald' },
          { to: '/logs', icon: BarChart2, label: 'Nhật ký', sub: 'Xem chi tiết', color: 'amber' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 flex items-center gap-3 transition-all group"
          >
            <div className={`p-2 rounded-xl ${
              item.color === 'blue' ? 'bg-blue-600/10 text-blue-400' :
              item.color === 'purple' ? 'bg-purple-600/10 text-purple-400' :
              item.color === 'emerald' ? 'bg-emerald-600/10 text-emerald-400' :
              'bg-amber-600/10 text-amber-400'
            }`}>
              <item.icon size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{item.label}</p>
              <p className="text-xs text-gray-500">{item.sub}</p>
            </div>
            <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Activity size={17} className="text-blue-400" />
            Nhật ký gần nhất
          </h2>
          <Link to="/logs" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            Xem tất cả <ChevronRight size={14} />
          </Link>
        </div>
        {stats?.recentLogs?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-800/40 border-b border-gray-800">
                  <th className="text-left py-2.5 px-5">Thời gian</th>
                  <th className="text-left py-2.5 px-4">Nhóm</th>
                  <th className="text-left py-2.5 px-4">Kịch bản</th>
                  <th className="text-left py-2.5 px-4">Trạng thái</th>
                  <th className="text-left py-2.5 px-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {stats.recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-5 text-xs text-gray-400 whitespace-nowrap font-mono">
                      {formatVNTime(log.sent_at)}
                    </td>
                    <td className="py-2.5 px-4 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <GroupAvatar
                          avatarUrl={log.avatar_url}
                          title={log.group_title}
                          identifier={log.group_identifier}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-white truncate" title={log.group_title || log.group_identifier}>
                            {log.group_title && log.group_title !== log.group_identifier ? log.group_title : log.group_identifier}
                          </p>
                          <p className="font-mono text-[10px] text-gray-500 truncate">
                            {log.group_identifier}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-400 max-w-[120px] truncate">
                      {log.template_name || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <LogStatusBadge status={log.status} />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-rose-400 max-w-xs truncate">
                      {log.error_message || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Activity size={32} className="mx-auto text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">Chưa có nhật ký nào</p>
          </div>
        )}
      </div>
    </div>
  )
}
