import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import {
  LayoutDashboard,
  Bot,
  Bell,
  BookOpen,
  Server,
  FileText,
  Network,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Home,
  Zap,
  AlertTriangle,
  BookMarked,
  Cog,
  LogOut,
  User as UserIcon,
  Container,
  Radio,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChatWidget from '../ChatWidget';

/**
 * 重构后的导航菜单结构
 * 从 42 个菜单项 / 7 组 精简为 13 个菜单项 / 5 组
 * 低频功能通过页面内 Tab 切换访问
 */
const navigationGroups = [
  {
    name: '工作台',
    icon: Home,
    color: 'emerald',
    items: [
      { name: '智能驾驶舱', href: '/workspace', icon: LayoutDashboard },
      { name: '告警中心', href: '/alert-center', icon: Bell },
    ]
  },
  {
    name: 'AI 运维',
    icon: Zap,
    color: 'violet',
    items: [
      { name: 'AI Agent', href: '/ai-agent', icon: Bot },
      { name: '执行中心', href: '/execution', icon: Zap },
      { name: '自动修复', href: '/auto-remediation', icon: Network },
    ]
  },
  {
    name: '基础设施',
    icon: Server,
    color: 'cyan',
    items: [
      { name: '服务器', href: '/server-mgmt', icon: Server },
      { name: '网络设备', href: '/network-mgmt', icon: Network },
      { name: '容器管理', href: '/portainer', icon: Container },
      { name: '端口监控', href: '/port-racker', icon: Radio },
    ]
  },
  {
    name: '知识与运营',
    icon: BookMarked,
    color: 'amber',
    items: [
      { name: '知识库', href: '/knowledge', icon: BookOpen },
      { name: '报告中心', href: '/report-center', icon: FileText },
    ]
  },
  {
    name: '系统管理',
    icon: Cog,
    color: 'rose',
    items: [
      { name: '系统管理', href: '/system-mgmt', icon: Cog },
    ]
  },
];

const groupColorMap: Record<string, {
  active: string;
  activeLight: string;
  hover: string;
  hoverLight: string;
}> = {
  emerald: {
    active: 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25',
    activeLight: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25',
    hover: 'hover:bg-emerald-800/20 hover:text-emerald-300',
    hoverLight: 'hover:bg-emerald-50 hover:text-emerald-700',
  },
  violet: {
    active: 'bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-500/25',
    activeLight: 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25',
    hover: 'hover:bg-violet-800/20 hover:text-violet-300',
    hoverLight: 'hover:bg-violet-50 hover:text-violet-700',
  },
  cyan: {
    active: 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-500/25',
    activeLight: 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25',
    hover: 'hover:bg-cyan-800/20 hover:text-cyan-300',
    hoverLight: 'hover:bg-cyan-50 hover:text-cyan-700',
  },
  amber: {
    active: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-500/25',
    activeLight: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25',
    hover: 'hover:bg-amber-800/20 hover:text-amber-300',
    hoverLight: 'hover:bg-amber-50 hover:text-amber-700',
  },
  rose: {
    active: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-500/25',
    activeLight: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25',
    hover: 'hover:bg-rose-800/20 hover:text-rose-300',
    hoverLight: 'hover:bg-rose-50 hover:text-rose-700',
  },
};

export default function Layout() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['工作台', 'AI 运维', '基础设施', '知识与运营', '系统管理'])
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // 使用 staleTime 优化查询，5分钟内使用缓存数据，避免频繁重新请求
  const { data: agentCount } = useQuery({
    queryKey: ['agents-count'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return (res.data.data as Array<{ enabled: number }>).filter((a) => a.enabled === 1).length;
    },
    refetchInterval: 60000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: workflowCount } = useQuery({
    queryKey: ['workflows-count'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return (res.data.data as Array<{ is_template: number }>).filter((w) => w.is_template === 1).length;
    },
    refetchInterval: 60000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: serverCount } = useQuery({
    queryKey: ['servers-count'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return (res.data.data as Array<unknown>).length;
    },
    refetchInterval: 60000,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'admin': '管理员',
      'operator': '运维员',
      'viewer': '只读用户'
    };
    return roleMap[role] || role;
  };

  return (
    <div className={clsx('flex h-screen', theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gray-50')}>
      <aside className={clsx('w-56 flex flex-col backdrop-blur-xl shadow-2xl border-r',
        theme === 'dark'
          ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-slate-700/50'
          : 'bg-white/95 border-gray-200'
      )}>
        <div className={clsx('p-4 border-b',
          theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M16 16C16 12.5 18.5 10 21.5 10C24.5 10 27 12.5 27 16C27 19.5 24.5 22 21.5 22C19.5 22 17.8 20.8 16.8 19L16 17.8L15.2 19C14.2 20.8 12.5 22 10.5 22C7.5 22 5 19.5 5 16C5 12.5 7.5 10 10.5 10C13.5 10 16 12.5 16 16Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className={clsx('text-base font-bold tracking-tight',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>ITOps Agent</h1>
              <p className={clsx('text-[11px]',
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              )}>多Agent自动化平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin">
          {navigationGroups.map((group) => (
            <div key={group.name} className="space-y-0.5">
              <button
                onClick={() => toggleGroup(group.name)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 group',
                  theme === 'dark'
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                )}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
                  'bg-emerald-500': group.color === 'emerald',
                  'bg-violet-500': group.color === 'violet',
                  'bg-cyan-500': group.color === 'cyan',
                  'bg-amber-500': group.color === 'amber',
                  'bg-rose-500': group.color === 'rose',
                })} />
                <group.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">{group.name}</span>
                {expandedGroups.has(group.name) ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
              </button>
              
              {expandedGroups.has(group.name) && (
                <div className="pl-2 space-y-0.5">
                  {group.items.map((item) => {
                    const colors = groupColorMap[group.color] || groupColorMap.emerald;
                    return (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                            isActive
                              ? (theme === 'dark' ? colors.active : colors.activeLight)
                              : theme === 'dark'
                                ? `text-slate-400 ${colors.hover} hover:bg-slate-800/80`
                                : `text-gray-600 ${colors.hoverLight}`
                          )
                        }
                      >
                        <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                        {item.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={clsx('border-t',
          theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
        )}>
          <div className="p-3 space-y-2">
            <div className={clsx('grid grid-cols-3 gap-1.5 rounded-lg p-2',
              theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50'
                : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="text-center">
                <p className={clsx('text-sm font-bold leading-tight',
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                )}>{agentCount ?? '...'}</p>
                <p className="text-[9px] text-slate-500 leading-tight">Agent</p>
              </div>
              <div className={clsx('text-center border-x',
                theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
              )}>
                <p className={clsx('text-sm font-bold leading-tight',
                  theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                )}>{workflowCount ?? '...'}</p>
                <p className="text-[9px] text-slate-500 leading-tight">工作流</p>
              </div>
              <div className="text-center">
                <p className={clsx('text-sm font-bold leading-tight',
                  theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                )}>{serverCount ?? '...'}</p>
                <p className="text-[9px] text-slate-500 leading-tight">服务器</p>
              </div>
            </div>

            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={clsx('w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-200',
                    theme === 'dark'
                      ? 'hover:bg-slate-800/60'
                      : 'hover:bg-gray-100'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30 flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={clsx('text-xs font-semibold truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{user.username}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {getRoleText(user.role)}
                    </p>
                  </div>
                  {userMenuOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {userMenuOpen && (
                  <div className={clsx(
                    'absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-xl border overflow-hidden animate-slide-up z-50',
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700/50'
                      : 'bg-white border-gray-200'
                  )}>
                    <button
                      onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-slate-300 hover:bg-slate-700/60'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {theme === 'dark' ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-purple-500" />
                      )}
                      <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
                    </button>
                    <button
                      onClick={() => { navigate('/system-mgmt#settings'); setUserMenuOpen(false); }}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-slate-300 hover:bg-slate-700/60'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>系统设置</span>
                    </button>
                    <div className={clsx('border-t mx-2',
                      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
                    )} />
                    <button
                      onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-red-600 hover:bg-red-50'
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={clsx('flex items-center justify-between rounded-lg px-3 py-2',
              theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50'
                : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse shadow shadow-green-500/30" />
                <span className={clsx('text-[11px] font-medium',
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-600'
                )}>系统正常</span>
              </div>
              <button
                onClick={toggleTheme}
                className={clsx('p-1.5 rounded-lg transition-all duration-200 flex-shrink-0',
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/60'
                    : 'text-gray-400 hover:text-purple-600 hover:bg-gray-200'
                )}
                title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
}
