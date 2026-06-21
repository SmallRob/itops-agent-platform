import { lazy } from 'react';
import { Bot, GitBranch, FileCode } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Agents = lazy(() => import('./Agents'));
const Workflows = lazy(() => import('./Workflows'));
const Scripts = lazy(() => import('./Scripts'));

const tabs: TabConfig[] = [
  { key: 'agents', label: 'Agent 管理', icon: Bot, component: Agents },
  { key: 'workflows', label: '工作流编排', icon: GitBranch, component: Workflows },
  { key: 'scripts', label: '脚本中心', icon: FileCode, component: Scripts },
];

export default function AIAgentPage() {
  return <TabLayout tabs={tabs} defaultTab="agents" />;
}
