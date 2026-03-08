import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '';

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const res = await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = res.data;
        useAuthStore.getState().setAccessToken(accessToken);
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

// Projects endpoints
export const projectsApi = {
  list: () => api.get('/api/projects'),
  create: (name: string) => api.post('/api/projects', { name }),
  get: (id: string) => api.get(`/api/projects/${id}`),
  update: (id: string, name: string) => api.patch(`/api/projects/${id}`, { name }),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
  getMembers: (id: string) => api.get(`/api/projects/${id}/members`),
  inviteMember: (id: string, email: string, role: 'editor' | 'viewer') =>
    api.post(`/api/projects/${id}/members`, { email, role }),
  removeMember: (projectId: string, userId: string) =>
    api.delete(`/api/projects/${projectId}/members/${userId}`),
};

// Files endpoints
export const filesApi = {
  list: (projectId: string) => api.get(`/api/projects/${projectId}/files`),
  create: (projectId: string, name: string, content?: string) =>
    api.post(`/api/projects/${projectId}/files`, { name, content }),
  get: (projectId: string, fileId: string) =>
    api.get(`/api/projects/${projectId}/files/${fileId}`),
  update: (projectId: string, fileId: string, data: { name?: string; content?: string; position?: number }) =>
    api.patch(`/api/projects/${projectId}/files/${fileId}`, data),
  delete: (projectId: string, fileId: string) =>
    api.delete(`/api/projects/${projectId}/files/${fileId}`),
  reorder: (projectId: string, order: Array<{ id: string; position: number }>) =>
    api.patch(`/api/projects/${projectId}/files/bulk/reorder`, { order }),
};
