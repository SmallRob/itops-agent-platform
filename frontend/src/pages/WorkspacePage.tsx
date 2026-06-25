import { lazy } from 'react';
import { LayoutDashboard, Monitor } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Dashboard = lazy(() => import('./Dashboard'));
const BigScreenDashboard = lazy(() => import('./BigScreenDashboard'));

const tabs: TabConfig[] = [
  { key: 'overview', label: '运行总览', icon: LayoutDashboard, component: Dashboard },
  { key: 'bigscreen', label: '监控大屏', icon: Monitor, component: BigScreenDashboard },
];

export default function WorkspacePage() {
  return <TabLayout tabs={tabs} defaultTab="overview" />;
}
