import { useState } from 'react'
import { Radio, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { setCurrentUser } from '../utils/api'
import Logo from '../components/Logo'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return toast.error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu')
    
    try {
      setLoading(true)
      const res = await axios.post('/api/auth/login', { 
        username: username.trim(), 
        password 
      })
      if (res.data.success && res.data.token) {
        setCurrentUser(res.data.user, res.data.token)
        toast.success(`Xin chào, ${res.data.user?.display_name || res.data.user?.username}!`)
        setTimeout(() => {
          window.location.href = '/'
        }, 300)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sai tên đăng nhập hoặc mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <Logo size={56} showText={false} />
          </div>
          <h1 className="text-2xl font-extrabold text-white text-center tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
            TeleBroadcast Hub
          </h1>
          <p className="text-gray-400 text-xs mt-1.5 text-center">Hệ thống quản trị & tự động phát tin Telegram đa tài khoản</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Tên đăng nhập</label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all" 
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="password" 
                required
                className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang xác thực...' : (
              <>
                Đăng nhập hệ thống <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        
        <div className="mt-8 pt-4 border-t border-gray-800/80 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Hệ thống bảo vệ đa tài khoản & phân quyền</span>
        </div>
      </div>
    </div>
  )
}
