import { lazy } from 'react';
import { Server, MonitorPlay, Terminal, Database, Key } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Servers = lazy(() => import('./Servers'));
const RemoteDesktop = lazy(() => import('./RemoteDesktop'));
const TerminalPage = lazy(() => import('./TerminalPage'));
const DbConnections = lazy(() => import('./DbConnections'));
const SSHKeys = lazy(() => import('./SSHKeys'));

const tabs: TabConfig[] = [
  { key: 'list', label: '服务器列表', icon: Server, component: Servers },
  { key: 'remote', label: '远程桌面', icon: MonitorPlay, component: RemoteDesktop },
  { key: 'terminal', label: 'Web 终端', icon: Terminal, component: TerminalPage },
  { key: 'database', label: '数据库管理', icon: Database, component: DbConnections },
  { key: 'credentials', label: '凭证管理', icon: Key, component: SSHKeys },
];

export default function ServerPage() {
  return <TabLayout tabs={tabs} defaultTab="list" />;
}
