import axios, { type InternalAxiosRequestConfig } from 'axios';

interface TokenRefreshResult {
  token: string;
  refreshToken: string;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: TokenRefreshResult | PromiseLike<TokenRefreshResult>) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, result: TokenRefreshResult | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (result) {
      prom.resolve(result);
    }
  });
  failedQueue = [];
};

const api = axios.create({
  baseURL: '',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshApi = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// CSRF token 管理（后端 SEC-043：state-changing 请求需携带 X-Session-Id / X-Csrf-Token）
// ============================================================
const CSRF_SESSION_KEY = 'itops-csrf-session-id';
let cachedCsrfToken: string | null = null;

function getCsrfSessionId(): string {
  let sid = localStorage.getItem(CSRF_SESSION_KEY);
  if (!sid) {
    sid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(CSRF_SESSION_KEY, sid);
  }
  return sid;
}

async function fetchCsrfToken(): Promise<string> {
  const sessionId = getCsrfSessionId();
  const res = await axios.get('/api/csrf-token', {
    headers: { 'X-Session-Id': sessionId },
  });
  const sid = res.data?.sessionId;
  if (sid) {
    localStorage.setItem(CSRF_SESSION_KEY, sid);
  }
  cachedCsrfToken = res.data?.csrfToken ?? null;
  if (!cachedCsrfToken) {
    throw new Error('Failed to fetch CSRF token');
  }
  return cachedCsrfToken;
}

async function getCsrfToken(): Promise<string> {
  return cachedCsrfToken ?? fetchCsrfToken();
}

/**
 * FormData（文件上传）请求配置
 *
 * 本实例默认头是 Content-Type: application/json，对 FormData 会有两种坏结果：
 *  - 沿用默认头：axios 把 FormData 序列化成 JSON，文件丢失；
 *  - 手动设 multipart/form-data：浏览器不会自动补 boundary（已实测后端报
 *    "Multipart: Boundary not found"）。
 * 因此这里清掉 Content-Type，交给浏览器生成带 boundary 的正确头部。
 *
 * 用法：api.post(url, formData, { ...formDataRequestConfig, params: {...} })
 */
export const formDataRequestConfig = {
  transformRequest: [
    (data: unknown, headers?: { delete?: (key: string) => void }) => {
      headers?.delete?.('Content-Type');
      return data;
    },
  ],
};

/** 需要 CSRF 头的写方法（后端全局中间件对 POST/PUT/DELETE/PATCH 校验） */
const CSRF_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * 统一附加认证与 CSRF 头
 *
 * 两个实例（api / refreshApi）必须共用同一套逻辑：refreshApi 曾漏加 CSRF 头，
 * 导致 POST /api/auth/refresh 被全局 CSRF 中间件拦截返回 403，
 * 而响应拦截器把「刷新失败」一律当作会话失效处理 → 任意 401 都会强退到登录页。
 */
async function attachAuthAndCsrf(config: InternalAxiosRequestConfig) {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || 'get').toUpperCase();
  if (CSRF_METHODS.includes(method)) {
    config.headers['X-Session-Id'] = getCsrfSessionId();
    config.headers['X-Csrf-Token'] = await getCsrfToken();
  }
  return config;
}

api.interceptors.request.use(attachAuthAndCsrf, (error) => Promise.reject(error));
refreshApi.interceptors.request.use(attachAuthAndCsrf, (error) => Promise.reject(error));

/** CSRF token 失效（后端重启/过期）时重新获取并重试一次 */
async function postRefresh(refreshToken: string) {
  try {
    return await refreshApi.post('/api/auth/refresh', { refreshToken });
  } catch (error) {
    const err = error as { response?: { status?: number; data?: { error?: string } } };
    if (err.response?.status === 403 && err.response?.data?.error === 'Invalid or missing CSRF token') {
      cachedCsrfToken = null;
      await fetchCsrfToken();
      return await refreshApi.post('/api/auth/refresh', { refreshToken });
    }
    throw error;
  }
}

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // CSRF token 失效（后端重启/过期）时，刷新 token 并重试一次
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'Invalid or missing CSRF token' &&
      !originalRequest._csrfRetry
    ) {
      originalRequest._csrfRetry = true;
      cachedCsrfToken = null;
      try {
        const csrfToken = await fetchCsrfToken();
        originalRequest.headers['X-Session-Id'] = getCsrfSessionId();
        originalRequest.headers['X-Csrf-Token'] = csrfToken;
        return api(originalRequest);
      } catch (csrfError) {
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 排队等待同一个刷新结果；注意也要打上 _retry，否则重试再遇 401 会重新进入刷新流程，
        // 与 React Query 自动重试叠加后会形成「刷新风暴」（每次都轮换并拉黑上一次的 refreshToken）
        originalRequest._retry = true;
        return new Promise<TokenRefreshResult>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((result) => {
            originalRequest.headers.Authorization = `Bearer ${result.token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await postRefresh(refreshToken);

        if (data.success) {
          const { token: newToken, refreshToken: newRefreshToken } = data.data;
          localStorage.setItem('token', newToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          processQueue(null, { token: newToken, refreshToken: newRefreshToken });
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // 只有「刷新令牌确实被拒绝」（400 无令牌 / 401 过期或无效）才判定会话结束并登出。
        // 但若本地 refreshToken 在本次刷新期间已被并发刷新轮换（刷新令牌单次有效），
        // 本次的 401 只是「用了旧令牌」，属于竞态而非会话失效 —— 此时必须保留会话，
        // 后续请求会用轮换后的新令牌，否则会出现"访问某页面被异常踢回登录页"。
        const status = (refreshError as { response?: { status?: number } })?.response?.status;
        const rotatedByConcurrentRefresh =
          localStorage.getItem('refreshToken') !== null &&
          localStorage.getItem('refreshToken') !== refreshToken;

        if ((status === 400 || status === 401) && !rotatedByConcurrentRefresh) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        } else {
          console.warn(
            `[api] Token 刷新失败（保留本地会话）：status=${status || 'N/A'}${
              rotatedByConcurrentRefresh ? '，本令牌已被并发刷新轮换' : ''
            }`
          );
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
