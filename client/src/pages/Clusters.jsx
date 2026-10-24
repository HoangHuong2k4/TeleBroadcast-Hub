import { useEffect, useState, useMemo } from 'react'
import {
  Layers, Plus, Search, Edit3, Trash2, Send, CheckCircle2,
  AlertCircle, ChevronRight, X, ExternalLink, Shield, Sparkles,
  UsersRound, Store, Hash, MessageSquare, Play, HelpCircle, Lock, Users
} from 'lucide-react'
import api, { getCurrentUser } from '../utils/api'
import toast from 'react-hot-toast'
import GroupAvatar from '../components/GroupAvatar'

// Bảng màu hỗ trợ
const COLOR_OPTIONS = [
  { id: 'blue', label: 'Xanh Dương', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', ring: 'ring-blue-500' },
  { id: 'emerald', label: 'Xanh Ngọc', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', ring: 'ring-emerald-500' },
  { id: 'purple', label: 'Tím Huyền Bí', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', ring: 'ring-purple-500' },
  { id: 'amber', label: 'Cam Hổ Phách', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', ring: 'ring-amber-500' },
  { id: 'rose', label: 'Đỏ Hồng', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', ring: 'ring-rose-500' },
  { id: 'cyan', label: 'Xanh Cyan', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', ring: 'ring-cyan-500' },
]

export default function Clusters() {
  const [clusters, setClusters] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCluster, setEditingCluster] = useState(null)
  const [runningClusterId, setRunningClusterId] = useState(null)

  // User and Admin state
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  const [filterUser, setFilterUser] = useState('all') // 'all' | 1 | 2
  const [users, setUsers] = useState([])

  // Form state for Modal
  const [formUserId, setFormUserId] = useState(1)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formColor, setFormColor] = useState('blue')
  const [formHashtags, setFormHashtags] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formSuffix, setFormSuffix] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [groupSearch, setGroupSearch] = useState('')
  const [modalGroupFilter, setModalGroupFilter] = useState('available') // available | unassigned | in_cluster | other_cluster | all
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const promises = [
        api.get('/clusters'),
        api.get('/groups')
      ]
      if (isAdmin) {
        promises.push(api.get('/users').catch(() => ({ data: [] })))
      }
      const [clustersRes, groupsRes, usersRes] = await Promise.all(promises)
      setClusters(clustersRes.data || [])
      setGroups(groupsRes.data || [])
      if (usersRes?.data && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data)
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi tải dữ liệu cụm chợ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Mở modal tạo mới
  const handleOpenCreate = () => {
    setEditingCluster(null)
    const defaultUid = filterUser !== 'all' ? Number(filterUser) : (currentUser?.id || 1)
    setFormUserId(defaultUid)
    setFormName('')
    setFormDesc('')
    setFormColor('blue')
    setFormHashtags('')
    setFormPrefix('')
    setFormSuffix('')
    setSelectedGroupIds(new Set())
    setGroupSearch('')
    setModalGroupFilter('available')
    setShowModal(true)
  }

  // Mở modal chỉnh sửa
  const handleOpenEdit = (cluster) => {
    setEditingCluster(cluster)
    setFormUserId(cluster.user_id || currentUser?.id || 1)
    setFormName(cluster.name || '')
    setFormDesc(cluster.description || '')
    setFormColor(cluster.color || 'blue')
    setFormHashtags(cluster.rule_hashtags || '')
    setFormPrefix(cluster.rule_prefix || '')
    setFormSuffix(cluster.rule_suffix || '')

    // Lấy các group đang thuộc cluster này
    const memberIds = (cluster.member_groups || []).map(g => g.id)
    setSelectedGroupIds(new Set(memberIds))
    setGroupSearch('')
    setModalGroupFilter('available')
    setShowModal(true)
  }

  // Toggle chọn chợ trong modal - KHÔNG CHO PHÉP CHỌN CHỢ ĐÃ THUỘC CỤM KHÁC
  const toggleGroupSelection = (group) => {
    const isAssignedToOther = group.cluster_id && group.cluster_id !== editingCluster?.id
    if (isAssignedToOther) {
      toast.error(`Chợ "${group.title || group.identifier}" đã thuộc cụm "${group.cluster_name}". Không thể chọn vào cụm khác!`, {
        icon: '🔒'
      })
      return
    }

    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(group.id)) next.delete(group.id)
      else next.add(group.id)
      return next
    })
  }

  // Lưu Cụm Chợ
  const handleSave = async (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      return toast.error('Vui lòng nhập tên Cụm Chợ')
    }

    try {
      setSaving(true)
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        color: formColor,
        rule_hashtags: formHashtags.trim(),
        rule_prefix: formPrefix.trim(),
        rule_suffix: formSuffix.trim(),
        group_ids: Array.from(selectedGroupIds),
        ...(isAdmin ? { user_id: formUserId } : {})
      }

      if (editingCluster) {
        await api.put(`/clusters/${editingCluster.id}`, payload)
        toast.success(`Đã cập nhật cụm "${formName}"`)
      } else {
        await api.post('/clusters', payload)
        toast.success(`Đã tạo Cụm Chợ "${formName}"`)
      }

      setShowModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  // Xóa Cụm
  const handleDelete = async (cluster) => {
    if (!confirm(`Bạn có chắc muốn xóa Cụm Chợ "${cluster.name}"?\n(Các chợ thành viên sẽ không bị xóa mà chỉ được chuyển về dạng chưa phân cụm)`)) {
      return
    }

    try {
      await api.delete(`/clusters/${cluster.id}`)
      toast.success(`Đã xóa cụm "${cluster.name}"`)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    }
  }

  // Phát tin toàn bộ cụm ngay
  const handleRunClusterNow = async (cluster) => {
    const activeCount = (cluster.member_groups || []).filter(g => g.is_active).length
    if (activeCount === 0) {
      return toast.error('Cụm này chưa có chợ nào đang kích hoạt (active)')
    }

    if (!confirm(`🚀 Bắt đầu phát tin ngay cho ${activeCount} chợ trong cụm "${cluster.name}"?`)) {
      return
    }

    try {
      setRunningClusterId(cluster.id)
      const res = await api.post(`/clusters/${cluster.id}/run-now`)
      toast.success(res.message || 'Đã kích hoạt gửi tin cho cụm!')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setRunningClusterId(null)
    }
  }

  // Filter clusters on main view
  const filteredClusters = useMemo(() => {
    return clusters.filter(c => {
      if (isAdmin && filterUser !== 'all' && Number(c.user_id) !== Number(filterUser)) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        (c.member_groups || []).some(g => (g.title || g.identifier)?.toLowerCase().includes(q))
      )
    })
  }, [clusters, search, isAdmin, filterUser])

  // Lọc nhóm theo chủ sở hữu cụm (formUserId) nếu là admin
  const userScopedGroups = useMemo(() => {
    if (!isAdmin) return groups
    return groups.filter(g => Number(g.user_id) === Number(formUserId))
  }, [groups, formUserId, isAdmin])

  // Thống kê số lượng chợ theo trạng thái khả dụng trong modal
  const modalCounts = useMemo(() => {
    const total = userScopedGroups.length
    const other = userScopedGroups.filter(g => g.cluster_id && g.cluster_id !== editingCluster?.id).length
    const current = editingCluster ? userScopedGroups.filter(g => g.cluster_id === editingCluster.id).length : 0
    const unassigned = userScopedGroups.filter(g => !g.cluster_id).length
    const available = unassigned + current
    return { total, other, current, unassigned, available }
  }, [userScopedGroups, editingCluster])

  // Filter groups in modal theo tab & search
  const filteredGroupsForModal = useMemo(() => {
    return userScopedGroups.filter(g => {
      const isAssignedToOther = g.cluster_id && g.cluster_id !== editingCluster?.id
      const isInThisCluster = editingCluster && g.cluster_id === editingCluster.id
      const isUnassigned = !g.cluster_id

      if (modalGroupFilter === 'available' && isAssignedToOther) return false
      if (modalGroupFilter === 'unassigned' && !isUnassigned) return false
      if (modalGroupFilter === 'in_cluster' && !isInThisCluster) return false
      if (modalGroupFilter === 'other_cluster' && !isAssignedToOther) return false

      if (groupSearch.trim()) {
        const q = groupSearch.toLowerCase().trim()
        const matchTitle = (g.title || '').toLowerCase().includes(q)
        const matchIdent = (g.identifier || '').toLowerCase().includes(q)
        const matchCluster = (g.cluster_name || '').toLowerCase().includes(q)
        if (!matchTitle && !matchIdent && !matchCluster) return false
      }

      return true
    })
  }, [userScopedGroups, modalGroupFilter, groupSearch, editingCluster])

  // Chọn tất cả CHỢ KHẢ DỤNG (Chỉ chọn chợ chưa phân cụm hoặc chợ đã thuộc cụm này)
  const handleSelectAllAvailable = () => {
    const available = filteredGroupsForModal.filter(g => !g.cluster_id || g.cluster_id === editingCluster?.id)
    if (available.length === 0) {
      return toast('Không có chợ khả dụng nào trong danh sách đang lọc', { icon: 'ℹ️' })
    }
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      available.forEach(g => next.add(g.id))
      return next
    })
    toast.success(`Đã chọn ${available.length} chợ khả dụng`)
  }

  const handleDeselectAll = () => {
    setSelectedGroupIds(new Set())
  }

  const totalGroupsInClusters = useMemo(() => {
    return groups.filter(g => g.cluster_id).length
  }, [groups])

  const getColorConfig = (colorId) => {
    return COLOR_OPTIONS.find(c => c.id === colorId) || COLOR_OPTIONS[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/20 text-sky-400 border border-sky-500/30">
                <Layers size={22} />
              </span>
              Quản lý Cụm Chợ
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 border border-blue-700/50 text-blue-300">
              {clusters.length} Cụm
            </span>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Gom các nhóm chợ thành từng cụm mục tiêu (Chợ VN có rule, Chợ không bot, Chợ MMO...) để phát tin có tổ chức và kiểm soát an toàn.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-all self-start sm:self-auto"
        >
          <Plus size={16} />
          Tạo Cụm Chợ Mới
        </button>
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
              onClick={() => setFilterUser('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                filterUser === 'all'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'bg-gray-950/80 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <span>Tất cả</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filterUser === 'all' ? 'bg-blue-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {clusters.length}
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
                {clusters.filter(c => Number(c.user_id) === 1).length}
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
                {clusters.filter(c => Number(c.user_id) === 2).length}
              </span>
            </button>

            {users.filter(u => u.id !== 1 && u.id !== 2).map(u => {
              const uCount = clusters.filter(c => Number(c.user_id) === Number(u.id)).length
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

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800/40 text-blue-400">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Tổng số Cụm Chợ</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{clusters.length}</p>
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Chợ đã gom vào Cụm</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {totalGroupsInClusters} <span className="text-xs font-normal text-gray-500">/ {groups.length} chợ</span>
            </p>
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <Store size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Chợ chưa phân cụm (Chợ lẻ)</p>
            <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">
              {groups.length - totalGroupsInClusters}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tên cụm chợ, mô tả, link chợ..."
            className="w-full bg-gray-950/60 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Cluster Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : filteredClusters.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/40 border border-gray-800/60 rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-800/60 border border-gray-700/40 text-gray-400 flex items-center justify-center mx-auto mb-3">
            <Layers size={26} />
          </div>
          <h3 className="text-base font-semibold text-white">Chưa có Cụm Chợ nào</h3>
          <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
            Hãy bấm nút <strong>"Tạo Cụm Chợ Mới"</strong> bên trên để gom các nhóm Telegram cùng tính chất vào một cụm.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus size={14} />
            Tạo Cụm đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClusters.map((cluster) => {
            const colorCfg = getColorConfig(cluster.color)
            const members = cluster.member_groups || []
            const activeMembers = members.filter(m => m.is_active)

            return (
              <div
                key={cluster.id}
                className="bg-gray-900/90 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all group relative overflow-hidden"
              >
                {/* Top color ribbon */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${colorCfg.bg.replace('/15', '')}`} />

                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-semibold text-[11px] border ${colorCfg.bg} ${colorCfg.text} ${colorCfg.border}`}>
                        <Store size={12} />
                        {cluster.name}
                      </span>
                      {isAdmin && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          Number(cluster.user_id) === 1
                            ? 'bg-purple-950/70 text-purple-300 border-purple-800/40'
                            : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40'
                        }`}>
                          {Number(cluster.user_id) === 1 ? '👑 Hương' : `👤 ${cluster.owner_name || cluster.owner_username || 'Hiệp'}`}
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(cluster)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                        title="Chỉnh sửa Cụm"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(cluster)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-gray-800 transition-colors"
                        title="Xóa Cụm"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-400 line-clamp-2 min-h-[32px]">
                    {cluster.description || 'Chưa có mô tả cho cụm chợ này.'}
                  </p>

                  {/* Hashtags chân trang chung nếu có */}
                  {cluster.rule_hashtags && (
                    <div className="mt-2.5 p-2 rounded-xl bg-gray-950/60 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mb-1">
                        <Hash size={11} className="text-emerald-400" />
                        Hashtag chân trang chung:
                      </span>
                      <p className="text-[11px] font-mono text-emerald-300 truncate">
                        {cluster.rule_hashtags}
                      </p>
                    </div>
                  )}

                  {/* Member Groups Preview */}
                  <div className="mt-3.5 pt-3.5 border-t border-gray-800/80">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-400 font-medium flex items-center gap-1.5">
                        <UsersRound size={13} className="text-sky-400" />
                        Chợ thành viên:
                      </span>
                      <span className="font-mono text-white font-semibold">
                        {activeMembers.length} active / {members.length} chợ
                      </span>
                    </div>

                    {members.length === 0 ? (
                      <div className="p-2.5 rounded-xl bg-gray-950/40 border border-dashed border-gray-800 text-center">
                        <p className="text-[11px] text-gray-500">Chưa gán chợ nào vào cụm này</p>
                        <button
                          onClick={() => handleOpenEdit(cluster)}
                          className="text-[11px] text-blue-400 hover:underline font-medium mt-0.5"
                        >
                          + Gán chợ ngay
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {members.map(grp => (
                          <div
                            key={grp.id}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-gray-950/60 border border-gray-800/60 text-[11px] hover:border-gray-700/80 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GroupAvatar
                                avatarUrl={grp.avatar_url}
                                title={grp.title}
                                identifier={grp.identifier}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <p className="text-gray-200 truncate font-semibold max-w-[170px]" title={grp.title || grp.identifier}>
                                  {grp.title && grp.title !== grp.identifier ? grp.title : grp.identifier}
                                </p>
                                <p className="text-[10px] text-gray-500 font-mono truncate">
                                  {grp.identifier}
                                </p>
                              </div>
                            </div>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${grp.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} title={grp.is_active ? 'Đang bật' : 'Đang tắt'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action: Run Cluster */}
                <div className="mt-4 pt-3 border-t border-gray-800/80">
                  <button
                    onClick={() => handleRunClusterNow(cluster)}
                    disabled={runningClusterId === cluster.id || activeMembers.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 transition-all disabled:opacity-50"
                  >
                    {runningClusterId === cluster.id ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        Đang phát tin...
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        Phát tin Cụm ({activeMembers.length} chợ)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL TẠO / SỬA CỤM CHỢ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-900/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingCluster ? `Chỉnh sửa Cụm: ${editingCluster.name}` : 'Tạo Cụm Chợ Mới'}
                  </h3>
                  <p className="text-xs text-gray-400">Gom nhóm các chợ có cùng tính chất hoặc rule phát tin</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Chủ sở hữu cụm (Admin only) */}
              {isAdmin && (
                <div className="space-y-1 bg-purple-950/20 border border-purple-800/30 rounded-xl p-3">
                  <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Users size={13} />
                    Chủ sở hữu Cụm Chợ (Chỉ hiển thị các chợ của User này)
                  </label>
                  <select
                    value={formUserId}
                    disabled={Boolean(editingCluster)}
                    onChange={(e) => {
                      setFormUserId(Number(e.target.value))
                      setSelectedGroupIds(new Set())
                    }}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-60"
                  >
                    <option value={1}>👑 Hương (admin)</option>
                    <option value={2}>👤 Hiệp (hiep)</option>
                    {users.filter(u => u.id !== 1 && u.id !== 2).map(u => (
                      <option key={u.id} value={u.id}>👤 {u.display_name || u.username}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tên cụm & Màu sắc */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-300">
                    Tên Cụm Chợ <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Chợ VN có Rule, Chợ Không Bot, Chợ MMO..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300">Màu sắc nhận diện</label>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mô tả */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Mô tả / Ghi chú</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Ghi chú đặc điểm của cụm này, đối tượng khách hàng..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Hashtag chân trang chung */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Hash size={13} className="text-emerald-400" />
                  Hashtag chân trang chung của Cụm (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={formHashtags}
                  onChange={(e) => setFormHashtags(e.target.value)}
                  placeholder="#muaban #telegram #mmo #uytin"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-gray-500">Các chợ trong cụm sẽ kế thừa hashtag này nếu chợ đó chưa cấu hình hashtag riêng.</p>
              </div>

              {/* Chọn các chợ thành viên */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Store size={14} className="text-sky-400" />
                      Chọn Chợ vào Cụm
                    </label>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Đã chọn <span className="font-bold text-blue-400">{selectedGroupIds.size}</span> / {modalCounts.available} chợ khả dụng
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllAvailable}
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Chọn tất cả khả dụng
                    </button>
                    <span className="text-gray-600">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-[11px] text-gray-400 hover:text-white hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Filter status tabs in modal */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'available', label: `Khả dụng (${modalCounts.available})` },
                    { id: 'unassigned', label: `Chưa có cụm (${modalCounts.unassigned})` },
                    ...(editingCluster ? [{ id: 'in_cluster', label: `Trong cụm này (${modalCounts.current})` }] : []),
                    { id: 'other_cluster', label: `Đã thuộc cụm khác (${modalCounts.other})` },
                    { id: 'all', label: `Tất cả (${modalCounts.total})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModalGroupFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors flex-shrink-0 ${
                        modalGroupFilter === tab.id
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'bg-gray-950/80 text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter search in modal */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Tìm chợ theo tên hoặc link @username..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Groups checklist box */}
                <div className="max-h-56 overflow-y-auto space-y-1 p-2 rounded-xl bg-gray-950/70 border border-gray-800">
                  {filteredGroupsForModal.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      <Store size={24} className="mx-auto mb-1.5 opacity-30" />
                      Không tìm thấy chợ nào trong mục này
                    </div>
                  ) : (
                    filteredGroupsForModal.map(g => {
                      const isSelected = selectedGroupIds.has(g.id)
                      const isAssignedToOther = g.cluster_id && g.cluster_id !== editingCluster?.id

                      return (
                        <div
                          key={g.id}
                          onClick={() => toggleGroupSelection(g)}
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-all text-xs select-none ${
                            isAssignedToOther
                              ? 'opacity-40 bg-gray-950/40 border border-gray-800/40 cursor-not-allowed'
                              : isSelected
                              ? 'bg-blue-600/20 border border-blue-500/40 text-blue-200 cursor-pointer shadow-sm'
                              : 'bg-gray-900/60 hover:bg-gray-800 border border-gray-800/60 text-gray-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAssignedToOther}
                              onChange={() => {}} // handled by parent onClick
                              className={`rounded border-gray-700 text-blue-600 focus:ring-0 flex-shrink-0 ${
                                isAssignedToOther ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              }`}
                            />
                            <GroupAvatar
                              avatarUrl={g.avatar_url}
                              title={g.title}
                              identifier={g.identifier}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-sm text-white flex items-center gap-1.5">
                                <span>{g.title && g.title !== g.identifier ? g.title : g.identifier}</span>
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                                <span className="truncate">{g.identifier}</span>
                                {g.member_count > 0 && (
                                  <span className="text-gray-500 font-sans">• {g.member_count.toLocaleString('vi-VN')} mem</span>
                                )}
                                {g.cluster_name && (
                                  <span className={isAssignedToOther ? "text-amber-400 font-sans font-medium" : "text-sky-400 font-sans"}>
                                    • Cụm: {g.cluster_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {isAssignedToOther ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-800/40 flex items-center gap-1">
                                <Lock size={10} />
                                Thuộc {g.cluster_name}
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${g.is_active ? 'bg-emerald-950/60 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                                {g.is_active ? 'Bật' : 'Tắt'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                  {editingCluster ? 'Lưu Thay Đổi' : 'Tạo Cụm Chợ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
