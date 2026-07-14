import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || '网络错误'
    return Promise.reject(new Error(message))
  }
)
