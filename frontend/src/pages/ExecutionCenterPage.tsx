import { lazy } from 'react';
import { Play, Clock, ShieldCheck } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Tasks = lazy(() => import('./Tasks'));
const ScheduledTasks = lazy(() => import('./ScheduledTasks'));
const Approvals = lazy(() => import('./Approvals'));

const tabs: TabConfig[] = [
  { key: 'tasks', label: '任务执行', icon: Play, component: Tasks },
  { key: 'scheduled', label: '定时任务', icon: Clock, component: ScheduledTasks },
  { key: 'approvals', label: '审批中心', icon: ShieldCheck, component: Approvals },
];

export default function ExecutionCenterPage() {
  return <TabLayout tabs={tabs} defaultTab="tasks" />;
}
