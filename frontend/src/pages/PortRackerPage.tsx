import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Network, Server as ServerIcon, Activity, Radio, Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

function getPortRackerDirectUrl(configData?: { directUrl?: string }): string {
  return configData?.directUrl || '';
}

interface PortInfo {
  port: number;
  protocol: string;
  service?: string;
  state?: string;
  process?: string;
  container?: string;
  composeProject?: string;
  health?: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  status: string;
  ports: PortInfo[];
}

export default function PortRackerPage() {
  const { theme } = useTheme();
  const [view, setView] = useState<'ports' | 'services'>('ports');

  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['portracker-health'],
    queryFn: async () => {
      const res = await api.get('/api/port-racker/health');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: portsData, isLoading: portsLoading, error: portsError, refetch: refetchPorts } = useQuery({
    queryKey: ['portracker-ports'],
    queryFn: async () => {
      const res = await api.get('/api/port-racker/ports');
      return res.data.data;
    },
    refetchInterval: 15000,
    retry: 1,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['portracker-services'],
    queryFn: async () => {
      const res = await api.get('/api/port-racker/services');
      return res.data.data;
    },
    refetchInterval: 15000,
    retry: 1,
    enabled: view === 'services',
  });

  const { data: configData } = useQuery({
    queryKey: ['portracker-config'],
    queryFn: async () => {
      const res = await api.get('/api/port-racker/config');
      return res.data.data;
    },
  });

  const directUrl = getPortRackerDirectUrl(configData);

  const isReachable = healthData?.reachable === true;
  const isLoading = portsLoading || servicesLoading;
  const hasError = !!portsError || !isReachable;

  const handleRefresh = useCallback(() => {
    refetchHealth();
    refetchPorts();
  }, [refetchHealth, refetchPorts]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy': case 'up': case 'running': case 'open': return 'text-green-400';
      case 'degraded': case 'warning': return 'text-yellow-400';
      case 'down': case 'unhealthy': case 'closed': case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy': case 'up': case 'running': case 'open':
        return theme === 'dark' ? 'bg-green-500/10' : 'bg-green-50';
      case 'degraded': case 'warning':
        return theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50';
      case 'down': case 'unhealthy': case 'closed': case 'error':
        return theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50';
      default:
        return theme === 'dark' ? 'bg-slate-500/10' : 'bg-gray-50';
    }
  };

  const ports: PortInfo[] = Array.isArray(portsData) ? portsData : portsData?.ports || [];
  const services: ServiceInfo[] = Array.isArray(servicesData) ? servicesData : servicesData?.services || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={clsx(
        'sticky top-0 z-20 border-b backdrop-blur-xl px-6 py-4',
        theme === 'dark' ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={clsx('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                端口监控 (PortRacker)
              </h1>
              <p className={clsx('text-xs', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                实时端口发现、服务识别与健康探测
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status */}
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
              isReachable
                ? theme === 'dark' ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
                : theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
            )}>
              {isReachable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {isReachable ? '已连接' : '未连接'}
            </div>

            {/* View toggle */}
            <div className={clsx(
              'flex items-center rounded-lg p-0.5',
              theme === 'dark' ? 'bg-slate-800/60' : 'bg-gray-100'
            )}>
              <button
                onClick={() => setView('ports')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'ports'
                    ? 'bg-blue-600 text-white shadow'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                <Network className="w-3.5 h-3.5" /> 端口
              </button>
              <button
                onClick={() => setView('services')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'services'
                    ? 'bg-blue-600 text-white shadow'
                    : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                )}
              >
                <ServerIcon className="w-3.5 h-3.5" /> 服务
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title="刷新"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>

            {/* Open in PortRacker - always visible as fallback */}
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25'
              )}
            >
              <ExternalLink className="w-4 h-4" />
              PortRacker
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {hasError && !ports.length ? (
          /* Error / Offline fallback */
          <div className="flex items-center justify-center h-full">
            <div className={clsx(
              'max-w-md w-full rounded-2xl p-8 text-center border',
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-gray-200 shadow-xl'
            )}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className={clsx('text-xl font-bold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                无法连接 PortRacker
              </h2>
              <p className={clsx('text-sm mb-6', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                请检查 PortRacker 服务是否正常运行，或在设置中配置正确的 API 地址。
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  直接访问 PortRacker
                </a>
                <div className={clsx('p-3 rounded-lg text-xs text-left', theme === 'dark' ? 'bg-slate-900/50 text-slate-400' : 'bg-gray-50 text-gray-500')}>
                  <p className="font-medium mb-1">服务地址:</p>
                  <p className="font-mono">{directUrl}</p>
                  {configData && <p className="mt-1">API: {configData.apiUrl}</p>}
                </div>
              </div>
            </div>
          </div>
        ) : view === 'ports' ? (
          /* Ports table view */
          <div className={clsx(
            'rounded-xl border overflow-hidden',
            theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-gray-200'
          )}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={clsx(
                    'border-b',
                    theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-gray-50 border-gray-200'
                  )}>
                    <th className="px-4 py-3 text-left font-medium">端口</th>
                    <th className="px-4 py-3 text-left font-medium">协议</th>
                    <th className="px-4 py-3 text-left font-medium">服务</th>
                    <th className="px-4 py-3 text-left font-medium">状态</th>
                    <th className="px-4 py-3 text-left font-medium">进程</th>
                    <th className="px-4 py-3 text-left font-medium">容器</th>
                    <th className="px-4 py-3 text-left font-medium">Compose 项目</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          {isLoading ? (
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                          ) : (
                            <Activity className="w-5 h-5 text-slate-400" />
                          )}
                          <p className={clsx('text-sm', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                            {isLoading ? '加载中...' : '暂无端口数据'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ports.map((p, i) => (
                      <tr key={`${p.port}-${p.protocol}-${i}`} className={clsx(
                        'border-b transition-colors',
                        theme === 'dark'
                          ? 'border-slate-700/30 hover:bg-slate-700/20'
                          : 'border-gray-100 hover:bg-gray-50'
                      )}>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'font-mono font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{p.port}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                          )}>{p.protocol || 'tcp'}</span>
                        </td>
                        <td className={clsx('px-4 py-2.5', theme === 'dark' ? 'text-slate-300' : 'text-gray-700')}>
                          {p.service || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            getStatusColor(p.state || p.health || ''),
                            getStatusBg(p.state || p.health || '')
                          )}>
                            {p.state || p.health || 'unknown'}
                          </span>
                        </td>
                        <td className={clsx('px-4 py-2.5 font-mono text-xs', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                          {p.process || '-'}
                        </td>
                        <td className={clsx('px-4 py-2.5 text-xs', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                          {p.container || '-'}
                        </td>
                        <td className={clsx('px-4 py-2.5 text-xs', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                          {p.composeProject || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {ports.length > 0 && (
              <div className={clsx(
                'px-4 py-2 border-t text-xs',
                theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500'
              )}>
                共 {ports.length} 个端口
              </div>
            )}
          </div>
        ) : (
          /* Services grouped view */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <p className={clsx('text-sm', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                  {isLoading ? '加载中...' : '暂无服务数据'}
                </p>
              </div>
            ) : (
              services.map((svc) => (
                <div key={svc.id} className={clsx(
                  'rounded-xl border p-4 transition-colors',
                  theme === 'dark'
                    ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                    : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={clsx('font-semibold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {svc.name}
                    </h3>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      getStatusColor(svc.status),
                      getStatusBg(svc.status)
                    )}>
                      {svc.status}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(svc.ports || []).map((p, i) => (
                      <div key={i} className={clsx(
                        'flex items-center justify-between text-xs py-1 px-2 rounded',
                        theme === 'dark' ? 'bg-slate-900/30' : 'bg-gray-50'
                      )}>
                        <span className="font-mono font-bold">{p.port}/{p.protocol || 'tcp'}</span>
                        <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>
                          {p.service || p.process || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
