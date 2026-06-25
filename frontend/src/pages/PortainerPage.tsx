import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Container, RefreshCw, AlertCircle, CheckCircle2, Monitor, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

export default function PortainerPage() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [iframeError, setIframeError] = useState(false);
  const [portainerUrl, setPortainerUrl] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/api/portainer/config');
      const url = res.data.data?.url || '';
      setPortainerUrl(url);
      setConfigLoaded(true);
      if (url) {
        checkPortainerStatus();
      }
    } catch {
      setConfigLoaded(true);
    }
  };

  useEffect(() => {
    if (!portainerUrl) return;
    const timer = setInterval(() => checkPortainerStatus(), 30000);
    return () => clearInterval(timer);
  }, [portainerUrl]);

  const checkPortainerStatus = async () => {
    setStatus('checking');
    try {
      const res = await api.get('/api/portainer/health');
      setStatus(res.data.data?.reachable ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  if (configLoaded && !portainerUrl) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className={clsx(
          'max-w-md w-full rounded-2xl p-8 text-center border',
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700/50'
            : 'bg-white border-gray-200 shadow-xl'
        )}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h2 className={clsx('text-xl font-bold mb-2',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            未配置 Portainer 地址
          </h2>
          <p className={clsx('text-sm mb-6',
            theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
          )}>
            请前往 设置 &gt; 服务集成 &gt; 容器管理 (Portainer) 配置访问地址
          </p>
          <a
            href="/settings?tab=integrations"
            className={clsx(
              'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
            )}
          >
            <Settings className="w-4 h-4" />
            前往配置
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={clsx(
        'sticky top-0 z-20 border-b backdrop-blur-xl px-6 py-4',
        theme === 'dark'
          ? 'bg-slate-900/80 border-slate-700/50'
          : 'bg-white/80 border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Container className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={clsx('text-lg font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                容器管理 (Portainer)
              </h1>
              <p className={clsx('text-xs',
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              )}>
                Docker 容器可视化管理平台 - 支持容器日志、镜像管理、网络/卷管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status */}
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
              status === 'online'
                ? theme === 'dark' ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
                : status === 'offline'
                  ? theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                  : theme === 'dark' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
            )}>
              {status === 'online' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
               status === 'offline' ? <AlertCircle className="w-3.5 h-3.5" /> :
               <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {status === 'online' ? '运行中' : status === 'offline' ? '离线' : '检测中...'}
            </div>

            {/* Refresh */}
            <button
              onClick={() => checkPortainerStatus()}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title="刷新状态"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Open in new tab - primary action */}
            <a
              href={portainerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
              )}
            >
              <ExternalLink className="w-4 h-4" />
              打开 Portainer
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {iframeError || status === 'offline' ? (
          /* Fallback: info card when iframe can't load */
          <div className="flex items-center justify-center h-full p-8">
            <div className={clsx(
              'max-w-md w-full rounded-2xl p-8 text-center border',
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700/50'
                : 'bg-white border-gray-200 shadow-xl'
            )}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                <Monitor className="w-8 h-8 text-white" />
              </div>
              <h2 className={clsx('text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {status === 'offline' ? 'Portainer 未运行' : '无法嵌入 Portainer'}
              </h2>
              <p className={clsx('text-sm mb-6',
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              )}>
                {status === 'offline'
                  ? 'Portainer 服务当前不可用，请检查容器是否正常运行。'
                  : '由于浏览器安全策略，Portainer 无法在 iframe 中加载。请点击下方按钮在新窗口中打开。'
                }
              </p>
              <a
                href={portainerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                )}
              >
                <ExternalLink className="w-4 h-4" />
                在新窗口打开 Portainer
              </a>
              {status === 'offline' && (
                <div className={clsx('mt-4 p-3 rounded-lg text-xs text-left',
                  theme === 'dark' ? 'bg-slate-900/50 text-slate-400' : 'bg-gray-50 text-gray-500'
                )}>
                  <p className="font-medium mb-1">访问地址:</p>
                  <p className="font-mono">{portainerUrl}</p>
                  <p className="mt-1">默认账号: admin / 密码: admin123456</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Iframe attempt */
          <iframe
            ref={iframeRef}
            src={portainerUrl}
            className="w-full h-full border-0"
            title="Portainer 容器管理"
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
}
