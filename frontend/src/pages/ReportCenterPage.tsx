import { lazy } from 'react';
import { FileText, Shield, MessageSquare, Lightbulb } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Reports = lazy(() => import('./Reports'));
const AuditLogs = lazy(() => import('./AuditLogs'));
const Notifications = lazy(() => import('./Notifications'));
const AIInsights = lazy(() => import('./AIInsights'));

const tabs: TabConfig[] = [
  { key: 'reports', label: '报告系统', icon: FileText, component: Reports },
  { key: 'audit', label: '审计日志', icon: Shield, component: AuditLogs },
  { key: 'notifications', label: '通知系统', icon: MessageSquare, component: Notifications },
  { key: 'ai-insights', label: 'AI 洞察', icon: Lightbulb, component: AIInsights },
];

export default function ReportCenterPage() {
  return <TabLayout tabs={tabs} defaultTab="reports" />;
}
