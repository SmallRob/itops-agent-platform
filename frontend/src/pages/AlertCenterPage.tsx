import { lazy } from 'react';
import { Bell, Shield, Layers, Search, Zap, Activity } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const Alerts = lazy(() => import('./Alerts'));
const AlertNoiseManagement = lazy(() => import('./AlertNoiseManagement'));
const AlertCorrelationGroups = lazy(() => import('./AlertCorrelationGroups'));
const RootCauseAnalysis = lazy(() => import('./RootCauseAnalysis'));
const AlertAutoAnalysis = lazy(() => import('./AlertAutoAnalysis'));
const InspectionCenter = lazy(() => import('./InspectionCenter'));

const tabs: TabConfig[] = [
  { key: 'realtime', label: '实时告警', icon: Bell, component: Alerts },
  { key: 'noise', label: '告警降噪', icon: Shield, component: AlertNoiseManagement },
  { key: 'correlation', label: '告警关联', icon: Layers, component: AlertCorrelationGroups },
  { key: 'rca', label: '根因分析', icon: Search, component: RootCauseAnalysis },
  { key: 'auto-analysis', label: 'AI 自动分析', icon: Zap, component: AlertAutoAnalysis },
  { key: 'inspection', label: '巡检中心', icon: Activity, component: InspectionCenter },
];

export default function AlertCenterPage() {
  return <TabLayout tabs={tabs} defaultTab="realtime" />;
}
