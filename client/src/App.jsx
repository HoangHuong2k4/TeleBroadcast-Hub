import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard, Users, UsersRound, FileText,
  Clock, ClipboardList, Menu, X, Radio, UserCog,
  LogOut, ChevronDown, Shield, User as UserIcon,
  Store, Layers
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Groups from './pages/Groups'
import Clusters from './pages/Clusters'
import Templates from './pages/Templates'
import Scheduler from './pages/Scheduler'
import Logs from './pages/Logs'
import Login from './pages/Login'
import UsersPage from './pages/Users'
import { getCurrentUser, logout } from './utils/api'
import Logo from './components/Logo'

function RequireAuth({ children }) {
  const token = localStorage.getItem('auth_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const user = getCurrentUser()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-600/20 text-blue-400'
        }`}>
          {(user.display_name || user.username)?.charAt(0)?.toUpperCase()}
        </div>
        <span className="text-xs text-gray-300 max-w-[100px] truncate">{user.display_name || user.username}</span>
        {user.role === 'admin' && <Shield size={12} className="text-amber-400" />}
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-white truncate">{user.display_name || user.username}</p>
            <p className="text-xs text-gray-500 mt-0.5">@{user.username}</p>
            <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${
              user.role === 'admin' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-600/15 text-blue-400'
            }`}>
              {user.role === 'admin' ? <Shield size={10} /> : <UserIcon size={10} />}
              {user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
            </span>
          </div>
          <button
            onClick={() => { logout(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar({ open, setOpen }) {
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/accounts', icon: Radio, label: 'Tài khoản Telegram' },
    { to: '/groups', icon: Store, label: 'Quản lý Chợ' },
    { to: '/clusters', icon: Layers, label: 'Quản lý Cụm Chợ' },
    { to: '/templates', icon: FileText, label: 'Kịch bản' },
    { to: '/scheduler', icon: Clock, label: 'Lịch gửi tin' },
    { to: '/logs', icon: ClipboardList, label: 'Nhật ký' },
  ]

  const adminItems = [
    { to: '/users', icon: UserCog, label: 'Người dùng' },
  ]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-950 border-r border-gray-800/80 z-30 transition-transform duration-300 flex flex-col
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
          <Logo size={36} />
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}

          {isAdmin && adminItems.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Quản trị hệ thống</p>
              </div>
              {adminItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                    }`
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-gray-800/80">
          <UserMenu />
        </div>
      </aside>
    </>
  )
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 bg-gray-950 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
            >
              <Menu size={22} />
            </button>
            <Logo size={28} showText={true} />
          </div>
          <UserMenu />
        </header>

        <main className="flex-1 overflow-auto bg-gray-950 p-5 lg:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/logs" element={<Logs />} />
            {isAdmin && <Route path="/users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#f3f4f6',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#111827' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#111827' } },
        }}
      />
    </BrowserRouter>
  )
}
