import { lazy } from 'react';
import { Users, Settings, FlaskConical } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const UsersPage = lazy(() => import('./Users'));
const SettingsPage = lazy(() => import('./Settings'));
const FrontendTests = lazy(() => import('./FrontendTests'));

const tabs: TabConfig[] = [
  { key: 'users', label: '用户管理', icon: Users, component: UsersPage },
  { key: 'settings', label: '系统设置', icon: Settings, component: SettingsPage },
  { key: 'tests', label: '前端测试', icon: FlaskConical, component: FrontendTests },
];

export default function SystemManagementPage() {
  return <TabLayout tabs={tabs} defaultTab="users" />;
}
