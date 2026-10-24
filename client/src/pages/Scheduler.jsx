import { useEffect, useState } from 'react'
import {
  Clock, Plus, Trash2, Play, Square, ToggleLeft, ToggleRight,
  Settings, RefreshCw, Zap, Users, User, ShieldCheck, Sparkles, Check
} from 'lucide-react'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'

const QUICK_PRESETS = ['06:50', '09:00', '10:00', '11:30', '14:00', '15:00', '20:00', '21:00']

export default function Scheduler() {
  const currentUser = getCurrentUser()
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || 1)
  const [config, setConfig] = useState({ slots: [], users: [], settings: {} })
  const [status, setStatus] = useState({ isRunning: false, currentRun: null })
  const [loading, setLoading] = useState(true)
  const [newSlot, setNewSlot] = useState('')
  const [settings, setSettings] = useState({ delay_min: 35, delay_max: 65, shuffle_groups: true, proxy_api: '' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [running, setRunning] = useState(false)

  const fetchConfig = async (targetId = selectedUserId) => {
    try {
      const url = targetId && currentUser?.role === 'admin'
        ? `/scheduler/config?user_id=${targetId}`
        : '/scheduler/config'

      const [configRes, statusRes] = await Promise.all([
        api.get(url),
        api.get('/scheduler/status'),
      ])
      setConfig(configRes.data)
      setStatus(statusRes.data)
      if (configRes.data.target_user_id) {
        setSelectedUserId(configRes.data.target_user_id)
      }
      setSettings({
        delay_min: parseInt(configRes.data.settings?.delay_min) || 35,
        delay_max: parseInt(configRes.data.settings?.delay_max) || 65,
        shuffle_groups: configRes.data.settings?.shuffle_groups !== '0',
        proxy_api: configRes.data.settings?.proxy_api || '',
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = (uid) => {
    setSelectedUserId(uid)
    fetchConfig(uid)
  }

  const handleAddSlot = async (slotToAdd) => {
    const val = typeof slotToAdd === 'string' ? slotToAdd : newSlot
    if (!val || !/^\d{2}:\d{2}$/.test(val)) {
      return toast.error('Vui lòng chọn khung giờ hợp lệ (HH:MM)')
    }
    try {
      await api.post('/scheduler/config/slots', { time_slot: val, user_id: selectedUserId })
      toast.success(`Đã thêm khung giờ ${val}`)
      setNewSlot('')
      fetchConfig(selectedUserId)
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  const handleToggleSlot = async (id) => {
    try {
      await api.patch(`/scheduler/config/slots/${id}/toggle`)
      fetchConfig(selectedUserId)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeleteSlot = async (id) => {
    if (!confirm('Xóa khung giờ này khỏi lịch?')) return
    try {
      await api.delete(`/scheduler/config/slots/${id}`)
      toast.success('Đã xóa khung giờ')
      fetchConfig(selectedUserId)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleSaveSettings = async () => {
    if (settings.delay_min >= settings.delay_max) {
      return toast.error('Delay tối thiểu phải nhỏ hơn tối đa')
    }
    try {
      setSavingSettings(true)
      await api.put('/scheduler/config/settings', settings)
      toast.success('Đã lưu cài đặt')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRotateProxy = async () => {
    if (!settings.proxy_api) return toast.error('Vui lòng nhập Link API Proxy Xoay và lưu cài đặt trước')
    try {
      setRotating(true)
      const res = await api.post('/scheduler/rotate-proxy')
      toast.success(res.message || 'Xoay Proxy thành công!')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setRotating(false)
    }
  }

  const handleRunNow = async () => {
    try {
      setRunning(true)
      await api.post('/scheduler/run-now')
      toast.success('Bắt đầu gửi! Xem nhật ký để theo dõi.')
      setTimeout(() => fetchConfig(selectedUserId), 2000)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  const handleStop = async () => {
    try {
      await api.post('/scheduler/stop')
      toast.success('Đã gửi lệnh dừng')
      setTimeout(() => fetchConfig(selectedUserId), 1000)
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    fetchConfig(selectedUserId)
    const interval = setInterval(() => fetchConfig(selectedUserId), 5000)
    return () => clearInterval(interval)
  }, [selectedUserId])

  const selectedUserObj = config.users?.find(u => u.id === selectedUserId)
  const isHiệp = selectedUserObj?.username === 'hiep' || (!selectedUserObj && currentUser?.username === 'hiep')
  const isHương = selectedUserObj?.username === 'admin' || (!selectedUserObj && currentUser?.username === 'admin')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Clock className="text-blue-400" />
            Lịch gửi tin & Cài đặt phát tin
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Khung giờ chạy tự động riêng biệt theo từng tài khoản, không bị trùng lặp hay ảnh hưởng chéo.
          </p>
        </div>
        <button onClick={() => fetchConfig(selectedUserId)} className="btn-secondary text-sm">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Dispatcher status */}
      <div className={`card border ${status.isRunning ? 'border-green-600/40 bg-green-900/10' : 'border-gray-800'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <div>
              <h3 className="font-semibold text-white">
                {status.isRunning ? '🚀 Đang điều phối gửi tin...' : '⏹ Dispatcher đang chờ khung giờ'}
              </h3>
              {status.currentRun && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {status.currentRun.done}/{status.currentRun.total} nhóm •
                  ✅ {status.currentRun.success} •
                  ❌ {status.currentRun.fail}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {status.isRunning ? (
              <button onClick={handleStop} className="btn-danger text-sm">
                <Square size={15} />
                Dừng ngay
              </button>
            ) : (
              <button onClick={handleRunNow} disabled={running} className="btn-success text-sm">
                <Zap size={15} />
                {running ? 'Đang khởi động...' : 'Gửi thủ công ngay'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time slots Card */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Khung giờ gửi cố định
            </h2>
            <span className="text-xs text-blue-300 font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/40">
              {config.slots.filter(s => s.is_active).length} khung giờ hoạt động
            </span>
          </div>

          {/* User Switcher Tabs (For Admin or multi-user system) */}
          {currentUser?.role === 'admin' && config.users?.length > 1 && (
            <div className="bg-gray-950/60 border border-gray-800/80 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users size={13} className="text-sky-400" />
                  Đang xem & cài đặt lịch của:
                </span>
                <span className="text-[11px] text-gray-500">Bấm tab để đổi</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {config.users.map(u => {
                  const isCur = selectedUserId === u.id
                  const isHiepUser = u.username === 'hiep'
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 border ${
                        isCur
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                          : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800'
                      }`}
                    >
                      <span>👤 {u.display_name || u.username}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isCur ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {isHiepUser ? 'Hiệp' : 'Hương'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Current Owner Badge */}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-900/40 px-3 py-2 rounded-xl border border-gray-800/50">
            <span>
              Lịch riêng của:{' '}
              <strong className="text-white">
                {selectedUserObj ? (selectedUserObj.display_name || selectedUserObj.username) : currentUser?.username}
                {isHiệp ? ' (Hiệp Bùi)' : isHương ? ' (Hương)' : ''}
              </strong>
            </span>
            <span className="text-gray-500">Tự động đồng bộ tài khoản</span>
          </div>

          {/* Add slot form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddSlot(newSlot)
            }}
            className="flex gap-2"
          >
            <input
              type="time"
              className="input flex-1"
              value={newSlot}
              onChange={e => setNewSlot(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary px-4 flex items-center gap-1.5 font-semibold text-xs"
            >
              <Plus size={16} />
              Thêm giờ
            </button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="pt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400 mr-1">Giờ gợi ý:</span>
            {QUICK_PRESETS.map(preset => {
              const exists = config.slots.some(s => s.time_slot === preset)
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    if (exists) {
                      const found = config.slots.find(s => s.time_slot === preset)
                      if (found) handleToggleSlot(found.id)
                    } else {
                      handleAddSlot(preset)
                    }
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                    exists
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 font-semibold'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700/80'
                  }`}
                  title={exists ? 'Bấm để bật/tắt' : 'Bấm để thêm nhanh'}
                >
                  {preset} {exists ? '✓' : '+'}
                </button>
              )
            })}
          </div>

          {/* Slot list */}
          <div className="space-y-2 pt-2">
            {config.slots.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Chưa có khung giờ nào cho tài khoản này</p>
            ) : (
              config.slots.map(slot => {
                const now = new Date()
                const [h, m] = slot.time_slot.split(':').map(Number)
                const slotDate = new Date()
                slotDate.setHours(h, m, 0, 0)
                const isPast = now > slotDate
                return (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      !slot.is_active ? 'bg-gray-800/20 border-gray-800 opacity-60' :
                      isPast ? 'bg-gray-900/60 border-gray-800' :
                      'bg-blue-950/30 border-blue-800/40 shadow-sm'
                    }`}
                  >
                    <Clock size={16} className={slot.is_active && !isPast ? 'text-blue-400' : 'text-gray-500'} />
                    <span className="font-mono font-bold text-white flex-1 text-sm">{slot.time_slot}</span>
                    {slot.is_active && !isPast && (
                      <span className="text-[11px] font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded-lg">
                        Sắp tới
                      </span>
                    )}
                    {isPast && slot.is_active && (
                      <span className="text-[11px] text-gray-500 px-2 py-0.5">
                        Đã qua
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(slot.id)}
                      className="hover:scale-105 transition-transform"
                      title={slot.is_active ? 'Bấm để tắt' : 'Bấm để bật'}
                    >
                      {slot.is_active
                        ? <ToggleRight size={22} className="text-green-400" />
                        : <ToggleLeft size={22} className="text-gray-500" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      title="Xóa khung giờ"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl p-3 text-xs text-sky-300">
            💡 <strong>Phân tách độc lập:</strong> Toàn bộ các chợ thuộc tài khoản này khi chọn <em>"Chạy theo Lịch Chung Hệ Thống"</em> sẽ tự động chạy theo đúng các khung giờ liệt kê ở trên, hoàn toàn không chạm hay can thiệp vào giờ của người dùng khác.
          </div>
        </div>

        {/* Settings Card */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Settings size={18} className="text-blue-400" />
            Cài đặt hành vi gửi & Proxy
          </h2>

          <div>
            <label className="label">Độ trễ tối thiểu (giây)</label>
            <input
              type="number"
              min={10}
              max={300}
              className="input"
              value={settings.delay_min}
              onChange={e => setSettings(s => ({ ...s, delay_min: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-gray-500 mt-1">Khuyến nghị: 35+ giây để tránh bị ban</p>
          </div>

          <div>
            <label className="label">Độ trễ tối đa (giây)</label>
            <input
              type="number"
              min={10}
              max={600}
              className="input"
              value={settings.delay_max}
              onChange={e => setSettings(s => ({ ...s, delay_max: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Delay thực tế: ngẫu nhiên trong khoảng [{settings.delay_min}s, {settings.delay_max}s]
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
            <button onClick={() => setSettings(s => ({ ...s, shuffle_groups: !s.shuffle_groups }))}>
              {settings.shuffle_groups
                ? <ToggleRight size={22} className="text-green-400" />
                : <ToggleLeft size={22} className="text-gray-500" />
              }
            </button>
            <div>
              <p className="text-sm font-medium text-white">Đảo ngẫu nhiên thứ tự nhóm</p>
              <p className="text-xs text-gray-400">Shuffle danh sách nhóm trước mỗi đợt gửi để chống pattern</p>
            </div>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-300">
            ⚠️ <strong>Khuyến nghị:</strong> Giữ delay tối thiểu 35-65 giây để hạn chế nguy cơ bị FloodWait hoặc ban tài khoản Telegram.
          </div>

          <hr className="border-gray-800" />
          
          <h3 className="font-semibold text-white">Proxy Xoay</h3>
          <div>
            <label className="label">Link API Proxy Xoay (Proxyquick)</label>
            <input
              type="text"
              className="input w-full"
              placeholder="https://proxyquick.click/api/v3/users/rotatev2?token=..."
              value={settings.proxy_api}
              onChange={e => setSettings(s => ({ ...s, proxy_api: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Dùng để tự động cập nhật IP mới</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary flex-1">
              {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
            <button onClick={handleRotateProxy} disabled={rotating || !settings.proxy_api} className="btn-secondary">
              <RefreshCw size={18} className={rotating ? 'animate-spin' : ''} />
              {rotating ? 'Đang xoay...' : 'Xoay Proxy Ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
