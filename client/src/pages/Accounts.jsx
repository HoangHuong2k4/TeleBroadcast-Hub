import { useEffect, useState } from 'react'
import {
  Plus, Trash2, LogOut, Wifi, WifiOff, Clock,
  AlertCircle, Send, ShieldCheck, Radio, RefreshCw,
  X, Eye, EyeOff, LogIn
} from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

function StatusBadge({ account }) {
  if (account.status === 'connected' || account.is_online) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900/30 text-emerald-400 text-xs rounded-full border border-emerald-800/40 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Đang kết nối
      </span>
    )
  }
  if (account.status === 'flood_wait') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/30 text-amber-400 text-xs rounded-full border border-amber-800/40 font-medium">
        <Clock size={11} />
        FloodWait {account.flood_wait_remaining}s
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-900/30 text-rose-400 text-xs rounded-full border border-rose-800/40 font-medium">
      <WifiOff size={11} />
      Mất kết nối
    </span>
  )
}

function AddAccountModal({ onClose, onSuccess, initialAccount = null }) {
  const [step, setStep] = useState('form') // form | otp | password
  const [form, setForm] = useState({
    phone: initialAccount?.phone || '',
    api_id: initialAccount?.api_id || '',
    api_hash: ''
  })
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!form.phone) {
      return toast.error('Vui lòng nhập số điện thoại')
    }
    if (!initialAccount && (!form.api_id || !form.api_hash)) {
      return toast.error('Vui lòng điền đầy đủ API ID và API Hash')
    }
    try {
      setLoading(true)
      await api.post('/accounts/send-otp', {
        phone: form.phone,
        api_id: form.api_id || undefined,
        api_hash: form.api_hash || undefined,
      })
      toast.success('Đã gửi OTP về Telegram của bạn')
      setStep('otp')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await api.post('/accounts/verify-otp', {
        phone: form.phone,
        code: otp,
        password: step === 'password' ? password : undefined,
      })
      toast.success('Đăng nhập tài khoản Telegram thành công!')
      onSuccess()
      onClose()
    } catch (err) {
      if (err.message === 'NEED_2FA_PASSWORD') {
        toast('Tài khoản có bật 2FA, nhập mật khẩu 2FA', { icon: '🔐' })
        setStep('password')
      } else {
        toast.error(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = {
    form: { title: 'Thêm tài khoản Telegram', subtitle: 'Bước 1: Thông tin API', icon: Radio },
    otp: { title: 'Nhập mã xác thực', subtitle: 'Bước 2: OTP từ Telegram', icon: ShieldCheck },
    password: { title: 'Xác thực 2 yếu tố', subtitle: 'Bước 3: Mật khẩu 2FA', icon: ShieldCheck },
  }

  const current = stepLabels[step]
  const StepIcon = current.icon

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-5">
          {['form', 'otp', 'password'].map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${
              i === 0 && (step === 'form' || step === 'otp' || step === 'password') ? 'bg-blue-500' :
              i === 1 && (step === 'otp' || step === 'password') ? 'bg-blue-500' :
              i === 2 && step === 'password' ? 'bg-blue-500' : 'bg-gray-700'
            }`} />
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="bg-blue-600/15 border border-blue-500/20 rounded-xl p-2.5">
            <StepIcon size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">{current.title}</h2>
            <p className="text-xs text-gray-400">{current.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Số điện thoại <span className="text-gray-500">(+84...)</span>
              </label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+84901234567"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">API ID</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345678"
                value={form.api_id}
                onChange={e => setForm(f => ({ ...f, api_id: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Lấy tại{' '}
                <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  my.telegram.org
                </a>
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">API Hash</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="abc123def456..."
                value={form.api_hash}
                onChange={e => setForm(f => ({ ...f, api_hash: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">
                Hủy
              </button>
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
                <Send size={16} />
                {loading ? 'Đang gửi...' : 'Gửi OTP'}
              </button>
            </div>
          </form>
        )}

        {(step === 'otp' || step === 'password') && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 text-sm text-blue-300">
              📱 Kiểm tra ứng dụng Telegram trên điện thoại hoặc máy tính để lấy mã OTP
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mã OTP (5-6 chữ số)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-3 text-white text-center text-2xl tracking-widest font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="• • • • • •"
                maxLength={7}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>

            {step === 'password' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Mật khẩu 2FA</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mật khẩu xác minh 2 bước"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep('form')} className="flex-1 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">
                ← Quay lại
              </button>
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
                <ShieldCheck size={16} />
                {loading ? 'Đang xác thực...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [reconnectAccount, setReconnectAccount] = useState(null)

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounts')
      setAccounts(res.data || [])
    } catch (err) {
      toast.error('Lỗi tải tài khoản: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa tài khoản này? Tất cả phiên đăng nhập sẽ bị hủy.')) return
    try {
      await api.delete(`/accounts/${id}`)
      toast.success('Đã xóa tài khoản')
      fetchAccounts()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDisconnect = async (id) => {
    try {
      await api.post(`/accounts/${id}/disconnect`)
      toast.success('Đã ngắt kết nối')
      fetchAccounts()
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    fetchAccounts()
    const interval = setInterval(fetchAccounts, 10000)
    return () => clearInterval(interval)
  }, [])

  const connectedCount = accounts.filter(a => a.status === 'connected' || a.is_online).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20">
              <Radio size={22} />
            </div>
            <h1 className="text-xl font-bold text-white">Tài khoản Telegram</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Quản lý tài khoản Userbot — mỗi tài khoản chỉ thuộc về bạn
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus size={18} />
          Thêm tài khoản
        </button>
      </div>

      {/* Stats Bar */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tổng tài khoản', value: accounts.length, color: 'text-white' },
            { label: 'Đang online', value: connectedCount, color: 'text-emerald-400' },
            { label: 'Offline / Lỗi', value: accounts.length - connectedCount, color: 'text-rose-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Account List */}
      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center text-gray-500">
          <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-blue-500" />
          Đang tải tài khoản...
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl py-16 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Radio size={32} className="text-gray-600" />
          </div>
          <p className="text-gray-300 font-medium">Chưa có tài khoản Telegram</p>
          <p className="text-gray-500 text-sm mt-1">Thêm tài khoản để bắt đầu gửi tin nhắn</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Thêm tài khoản đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 flex items-center gap-4 transition-colors">
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-lg ${
                acc.status === 'connected' || acc.is_online
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-500'
              }`}>
                {(acc.first_name || acc.phone)?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{acc.first_name || 'Tài khoản'}</span>
                  {acc.username && (
                    <span className="text-gray-400 text-sm">@{acc.username}</span>
                  )}
                  <StatusBadge account={acc} />
                </div>
                <p className="text-sm text-gray-400 mt-0.5 font-mono">{acc.phone}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  API ID: <span className="font-mono">{acc.api_id}</span>
                  {' '} • Thêm lúc: {new Date(acc.created_at).toLocaleDateString('vi-VN')}
                </p>
                {acc.time_slots && (() => {
                  try {
                    const slots = JSON.parse(acc.time_slots)
                    if (Array.isArray(slots) && slots.length > 0) {
                      return (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                            <Clock size={12} className="text-blue-400" />
                            Khung giờ chạy:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {slots.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/40 text-blue-300 font-mono text-[11px] font-semibold"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    }
                  } catch (_) {}
                  return null
                })()}

                {(!acc.is_online && acc.status !== 'connected') && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle size={15} className="text-rose-400 flex-shrink-0" />
                    <span>Phiên Telegram đã bị hủy hoặc hết hạn (AUTH_KEY_DUPLICATED). Hãy bấm <strong>Kết nối lại OTP</strong> bên phải để đăng nhập lại.</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {(!acc.is_online && acc.status !== 'connected') && (
                  <button
                    onClick={() => { setReconnectAccount(acc); setShowModal(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
                    title="Đăng nhập lại OTP Telegram"
                  >
                    <LogIn size={14} />
                    Kết nối lại OTP
                  </button>
                )}
                <button
                  onClick={() => fetchAccounts()}
                  className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-xl transition-colors"
                  title="Làm mới"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-xs transition-colors"
                  title="Ngắt kết nối"
                >
                  <LogOut size={14} />
                  Ngắt
                </button>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 rounded-xl text-xs transition-colors"
                  title="Xóa tài khoản"
                >
                  <Trash2 size={14} />
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddAccountModal
          initialAccount={reconnectAccount}
          onClose={() => { setShowModal(false); setReconnectAccount(null); }}
          onSuccess={fetchAccounts}
        />
      )}
    </div>
  )
}
