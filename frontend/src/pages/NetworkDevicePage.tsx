import { lazy } from 'react';
import { Network, Radio, Globe, Search } from 'lucide-react';
import TabLayout, { TabConfig } from '../components/layout/TabLayout';

const NetworkDevices = lazy(() => import('./NetworkDevices'));
const SNMPPage = lazy(() => import('./SNMP'));
const Topology = lazy(() => import('./Topology'));
const NetworkDiscovery = lazy(() => import('./NetworkDiscovery'));

const tabs: TabConfig[] = [
  { key: 'devices', label: '设备列表', icon: Network, component: NetworkDevices },
  { key: 'snmp', label: 'SNMP 管理', icon: Radio, component: SNMPPage },
  { key: 'topology', label: '拓扑发现', icon: Globe, component: Topology },
  { key: 'discovery', label: '设备发现', icon: Search, component: NetworkDiscovery },
];

export default function NetworkDevicePage() {
  return <TabLayout tabs={tabs} defaultTab="devices" />;
}
