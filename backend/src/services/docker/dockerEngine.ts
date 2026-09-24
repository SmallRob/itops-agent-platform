/**
 * Docker Engine API 客户端
 * 通过 Unix socket（默认 /var/run/docker.sock）直连本机 Docker Engine，
 * 使用 Node 原生 http 模块，无需额外依赖。
 *
 * 只读查询 + 受控写操作（拉取/删除镜像、容器启停），写操作由 dockerRoutes 做角色与审计管控。
 */
import http from 'http';

const DEFAULT_SOCKET_PATH = '/var/run/docker.sock';
const DEFAULT_TIMEOUT_MS = 15000;

export class DockerEngineError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'DockerEngineError';
    this.statusCode = statusCode;
  }
}

/** Docker 功能开关（DOCKER_ENABLED=false 时整体关闭） */
export function isDockerEnabled(): boolean {
  return process.env.DOCKER_ENABLED !== 'false';
}

/** Docker socket 路径 */
export function getDockerSocketPath(): string {
  return process.env.DOCKER_SOCKET_PATH || DEFAULT_SOCKET_PATH;
}

interface RawResponse {
  statusCode: number;
  contentType: string;
  body: Buffer;
}

/**
 * 底层调用（返回原始 Buffer，便于处理 JSON / 文本 / 多路复用流）
 */
function dockerRaw(path: string, method = 'GET', timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RawResponse> {
  if (!isDockerEnabled()) {
    return Promise.reject(new DockerEngineError('Docker 功能未启用（DOCKER_ENABLED=false）', 503));
  }

  const socketPath = getDockerSocketPath();

  return new Promise<RawResponse>((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: `/${path.replace(/^\/+/, '')}`,
        method,
        headers: { Host: 'localhost', Accept: 'application/json' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            contentType: String(res.headers['content-type'] || ''),
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new DockerEngineError('Docker Engine 请求超时', 504));
    });

    req.on('error', (error: NodeJS.ErrnoException) => {
      if (error instanceof DockerEngineError) {
        reject(error);
      } else if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'ECONNREFUSED') {
        reject(new DockerEngineError(`无法访问 Docker socket（${socketPath}）：${error.code}`, 503));
      } else {
        reject(new DockerEngineError(`Docker Engine 请求失败：${error.message}`, 502));
      }
    });

    req.end();
  });
}

function toEngineError(response: RawResponse, fallback: string): DockerEngineError {
  let message = fallback;
  try {
    const parsed = JSON.parse(response.body.toString('utf8')) as { message?: string };
    if (parsed.message) message = parsed.message;
  } catch {
    /* 保持默认错误信息 */
  }
  return new DockerEngineError(message, response.statusCode === 404 ? 404 : 502);
}

/**
 * 调用 Docker Engine API（JSON 响应）
 * @param path 形如 /images/json?all=1
 */
export async function dockerRequest<T>(path: string, method = 'GET', timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await dockerRaw(path, method, timeoutMs);
  const text = response.body.toString('utf8');

  if (response.statusCode >= 400) {
    throw toEngineError(response, `Docker Engine 返回 ${response.statusCode}`);
  }
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new DockerEngineError('Docker Engine 响应解析失败', 502);
  }
}

/**
 * 调用 Docker Engine API（文本响应，如容器日志）
 * Docker 非 TTY 容器的日志为 8 字节帧头多路复用流，此处做解复用
 */
export async function dockerRequestText(path: string, method = 'GET', timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const response = await dockerRaw(path, method, timeoutMs);

  if (response.statusCode >= 400) {
    throw toEngineError(response, `Docker Engine 返回 ${response.statusCode}`);
  }

  const body = response.body;
  // 多路复用流：帧头 [streamType(1B) 0 0 0 size(4B BE)]，解出 payload
  if (body.length >= 8 && (body[0] === 0 || body[0] === 1 || body[0] === 2) && body[1] === 0 && body[2] === 0 && body[3] === 0) {
    const parts: Buffer[] = [];
    let offset = 0;
    while (offset + 8 <= body.length) {
      const size = body.readUInt32BE(offset + 4);
      if (size === 0 || offset + 8 + size > body.length) break;
      parts.push(body.subarray(offset + 8, offset + 8 + size));
      offset += 8 + size;
    }
    if (parts.length > 0) {
      return Buffer.concat(parts).toString('utf8');
    }
  }

  return body.toString('utf8');
}

/**
 * Docker 的分块 JSON 流（如 /images/create 拉取镜像）：
 * 收集全部 NDJSON 分片，检查是否存在 error 字段
 */
export async function dockerRequestJsonStream(
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ error?: string; chunks: Array<Record<string, unknown>> }> {
  const response = await dockerRaw(path, 'POST', timeoutMs);

  if (response.statusCode >= 400) {
    throw toEngineError(response, `Docker Engine 返回 ${response.statusCode}`);
  }

  const chunks: Array<Record<string, unknown>> = [];
  let error: string | undefined;

  for (const line of response.body.toString('utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      chunks.push(parsed);
      const errorDetail = parsed.errorDetail as { message?: string } | undefined;
      if (parsed.error) {
        error = errorDetail?.message || String(parsed.error);
      }
    } catch {
      /* 忽略无法解析的分片 */
    }
  }

  return { error, chunks };
}

/** 探测 Docker Engine 是否可用，并返回版本信息 */
export async function pingDockerEngine(): Promise<{ available: boolean; version?: string; apiVersion?: string; message?: string }> {
  try {
    const version = await dockerRequest<{ Version?: string; ApiVersion?: string }>('/version', 'GET', 5000);
    return { available: true, version: version.Version, apiVersion: version.ApiVersion };
  } catch (error) {
    return { available: false, message: error instanceof Error ? error.message : '未知错误' };
  }
}

/** 校验容器/镜像 ID 或容器名，防止路径注入 */
export function assertSafeDockerId(ref: string, label = '资源'): string {
  const value = (ref || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value)) {
    throw new DockerEngineError(`${label}标识非法`, 400);
  }
  return value;
}

/** 校验镜像引用（允许 registry:port/name:tag 形式），防止路径注入 */
export function assertSafeImageRef(ref: string, label = '镜像'): string {
  const value = (ref || '').trim();
  const valid = /^[a-zA-Z0-9][a-zA-Z0-9_.:\-/]{0,255}$/.test(value);
  if (!valid || value.includes('..')) {
    throw new DockerEngineError(`${label}引用非法`, 400);
  }
  return value;
}