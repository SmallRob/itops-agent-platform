import { lazy } from 'react';
import { Puzzle, Network, Webhook } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const SkillsManagement = lazy(() => import('./platform/SkillsManagement'));
const AgentProviders = lazy(() => import('./platform/AgentProviders'));
const HooksIntegration = lazy(() => import('./platform/HooksIntegration'));

const tabs: TabConfig[] = [
  { key: 'skills', label: '技能插件', icon: Puzzle, component: SkillsManagement },
  { key: 'providers', label: 'Agent Provider', icon: Network, component: AgentProviders },
  { key: 'hooks', label: 'Hooks 接入', icon: Webhook, component: HooksIntegration },
];

/**
 * 能力中心：平台可扩展内核的可视化入口
 * - 技能插件：目录即插件（启停 / 重载 / zip 安装 / 卸载 / 意图匹配测试）
 * - Agent Provider：降级链与健康熔断治理
 * - Hooks 接入：事件入站端点与来源映射
 */
export default function PlatformPage() {
  return <TabLayout tabs={tabs} defaultTab="skills" />;
}