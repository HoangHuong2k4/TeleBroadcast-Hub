import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const msg = err.response?.data?.error || err.message || 'Lỗi không xác định'
    return Promise.reject(new Error(msg))
  }
)

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

export function setCurrentUser(user, token) {
  if (token) localStorage.setItem('auth_token', token)
  if (user) localStorage.setItem('auth_user', JSON.stringify(user))
}

export function logout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  window.location.href = '/login'
}

export default api
