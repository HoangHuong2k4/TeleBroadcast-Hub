import { useState, useEffect } from 'react'
import { 
  Users, UserPlus, Shield, User, Lock, Edit2, Trash2, 
  CheckCircle2, XCircle, Search, RefreshCw, KeyRound, Radio
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { getCurrentUser } from '../utils/api'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentUser, setCurrentUser] = useState(getCurrentUser())

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'user'
  })

  const [editFormData, setEditFormData] = useState({
    display_name: '',
    role: 'user',
    is_active: 1,
    new_password: ''
  })

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/users')
      if (res.success) {
        setUsers(res.data)
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!formData.username.trim() || !formData.password) {
      return toast.error('Vui lòng điền đủ tên đăng nhập và mật khẩu')
    }

    try {
      const res = await api.post('/users', formData)
      if (res.success) {
        toast.success(res.message || 'Tạo người dùng thành công!')
        setShowCreateModal(false)
        setFormData({ username: '', password: '', display_name: '', role: 'user' })
        fetchUsers()
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo người dùng')
    }
  }

  const handleOpenEdit = (user) => {
    setSelectedUser(user)
    setEditFormData({
      display_name: user.display_name || '',
      role: user.role || 'user',
      is_active: user.is_active,
      new_password: ''
    })
    setShowEditModal(true)
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const payload = {
        display_name: editFormData.display_name,
        role: editFormData.role,
        is_active: editFormData.is_active,
      }
      if (editFormData.new_password.trim()) {
        payload.password = editFormData.new_password.trim()
      }

      const res = await api.put(`/users/${selectedUser.id}`, payload)
      if (res.success) {
        toast.success(res.message || 'Cập nhật thành công')
        setShowEditModal(false)
        fetchUsers()
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật người dùng')
    }
  }

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      return toast.error('Bạn không thể xóa tài khoản của chính mình')
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${user.username}"?`)) return

    try {
      const res = await api.delete(`/users/${user.id}`)
      if (res.success) {
        toast.success(res.message || 'Đã xóa người dùng')
        fetchUsers()
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa người dùng')
    }
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.display_name && u.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Users size={22} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Quản lý Tài khoản Người dùng</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Tạo và phân quyền tài khoản cho các nhân sự / thành viên liên kết Telegram riêng
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all self-start sm:self-auto"
        >
          <UserPlus size={18} />
          <span>Tạo tài khoản mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-gray-900 border border-gray-800 p-3.5 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Tìm theo username hoặc tên..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Tải lại"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/60 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="py-3.5 px-4 font-semibold">Tài khoản & Tên</th>
                <th className="py-3.5 px-4 font-semibold">Vai trò</th>
                <th className="py-3.5 px-4 font-semibold text-center">Acc Telegram</th>
                <th className="py-3.5 px-4 font-semibold text-center">Nhóm sở hữu</th>
                <th className="py-3.5 px-4 font-semibold">Trạng thái</th>
                <th className="py-3.5 px-4 font-semibold">Ngày tạo</th>
                <th className="py-3.5 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-blue-500" />
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    Không tìm thấy người dùng nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isCurrent = user.id === currentUser?.id
                  return (
                    <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            user.role === 'admin' 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {user.display_name || user.username}
                              {isCurrent && (
                                <span className="text-[10px] bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded font-normal">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Shield size={12} />
                            Quản trị viên
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <User size={12} />
                            Thành viên
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300">
                          <Radio size={13} className="text-cyan-400" />
                          {user.accounts_count || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-gray-300 font-medium">
                          {user.groups_count || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 size={14} />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                            <XCircle size={14} />
                            Tạm khóa
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Sửa / Đổi mật khẩu"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Xóa tài khoản"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo Người Dùng */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-blue-500" />
              Tạo tài khoản người dùng mới
            </h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Tên đăng nhập *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: nhanvien1"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A (Sales HN)"
                  value={formData.display_name}
                  onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Phân quyền</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">Thành viên (Chỉ quản lý acc Telegram của họ)</option>
                  <option value="admin">Quản trị viên (Toàn quyền hệ thống)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/30"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Người Dùng */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Edit2 size={20} className="text-blue-500" />
              Chỉnh sửa: @{selectedUser.username}
            </h2>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  value={editFormData.display_name}
                  onChange={e => setEditFormData({ ...editFormData, display_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Phân quyền</label>
                <select
                  value={editFormData.role}
                  disabled={selectedUser.id === currentUser?.id}
                  onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="user">Thành viên (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Trạng thái hoạt động</label>
                <select
                  value={editFormData.is_active}
                  disabled={selectedUser.id === currentUser?.id}
                  onChange={e => setEditFormData({ ...editFormData, is_active: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value={1}>Đang hoạt động</option>
                  <option value={0}>Tạm khóa tài khoản</option>
                </select>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <label className="block text-xs font-medium text-amber-400 mb-1 flex items-center gap-1.5">
                  <KeyRound size={14} />
                  Đặt lại mật khẩu mới (để trống nếu không đổi)
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  value={editFormData.new_password}
                  onChange={e => setEditFormData({ ...editFormData, new_password: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/30"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
