import { lazy } from 'react';
import { Wrench, Workflow, ListChecks, BarChart3, Lightbulb } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const RemediationPolicies = lazy(() => import('./RemediationPolicies'));
const RemediationWorkbench = lazy(() => import('./RemediationWorkbench'));
const RemediationExecutions = lazy(() => import('./RemediationExecutions'));
const RemediationDashboard = lazy(() => import('./RemediationDashboard'));
const AiRemediations = lazy(() => import('./AiRemediations'));

const tabs: TabConfig[] = [
  { key: 'policies', label: '修复策略', icon: Wrench, component: RemediationPolicies },
  { key: 'workbench', label: '自愈工作台', icon: Workflow, component: RemediationWorkbench },
  { key: 'executions', label: '执行记录', icon: ListChecks, component: RemediationExecutions },
  { key: 'dashboard', label: '修复仪表盘', icon: BarChart3, component: RemediationDashboard },
  { key: 'ai', label: 'AI 修复记录', icon: Lightbulb, component: AiRemediations },
];

export default function AutoRemediationPage() {
  return <TabLayout tabs={tabs} defaultTab="policies" />;
}
