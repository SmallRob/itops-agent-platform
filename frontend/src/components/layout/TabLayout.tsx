import { useState, useEffect, Suspense, lazy, ComponentType } from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';

export interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

interface TabLayoutProps {
  tabs: TabConfig[];
  defaultTab?: string;
  hashPrefix?: string;
}

/**
 * 通用 Tab 布局组件
 * 将多个独立页面组合为一个带 Tab 切换的复合页面
 * 支持 URL hash 定位到具体 Tab（如 /alerts#noise-reduction）
 */
export default function TabLayout({ tabs, defaultTab, hashPrefix = '' }: TabLayoutProps) {
  const { theme } = useTheme();

  // 从 URL hash 或默认值确定初始 Tab
  const getInitialTab = () => {
    const hash = window.location.hash.slice(1);
    if (hash && tabs.some(t => t.key === hash)) {
      return hash;
    }
    return defaultTab || tabs[0].key;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && tabs.some(t => t.key === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [tabs]);

  // 切换 Tab 时更新 hash
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  const activeTabConfig = tabs.find(t => t.key === activeTab) || tabs[0];

  return (
    <div className="h-full flex flex-col">
      {/* Tab 栏 */}
      <div className={clsx(
        'sticky top-0 z-20 border-b backdrop-blur-xl',
        theme === 'dark'
          ? 'bg-slate-900/80 border-slate-700/50'
          : 'bg-white/80 border-gray-200'
      )}>
        <div className="px-6 pt-4 pb-0">
          <div className={clsx(
            'inline-flex items-center rounded-xl p-1 gap-0.5',
            theme === 'dark'
              ? 'bg-slate-800/60 border border-slate-700/40'
              : 'bg-gray-100 border border-gray-200'
          )}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? theme === 'dark'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : theme === 'dark'
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                  )}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab 内容区 */}
      <div className="flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className={clsx('text-sm', theme === 'dark' ? 'text-slate-400' : 'text-gray-500')}>
                  加载中...
                </p>
              </div>
            </div>
          }
        >
          <activeTabConfig.component />
        </Suspense>
      </div>
    </div>
  );
}
