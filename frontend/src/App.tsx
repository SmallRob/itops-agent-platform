import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';

// ==================== 代码分割（按需加载）====================
// ==================== 认证页面 ====================
const Login = lazy(() => import('./pages/Login'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const NotFound = lazy(() => import('./pages/NotFound'));

// ==================== 复合页面（新菜单结构）====================
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const AlertCenterPage = lazy(() => import('./pages/AlertCenterPage'));
const AIAgentPage = lazy(() => import('./pages/AIAgentPage'));
const ExecutionCenterPage = lazy(() => import('./pages/ExecutionCenterPage'));
const AutoRemediationPage = lazy(() => import('./pages/AutoRemediationPage'));
const ServerPage = lazy(() => import('./pages/ServerPage'));
const NetworkDevicePage = lazy(() => import('./pages/NetworkDevicePage'));
const ReportCenterPage = lazy(() => import('./pages/ReportCenterPage'));
const SystemManagementPage = lazy(() => import('./pages/SystemManagementPage'));
const PortainerPage = lazy(() => import('./pages/PortainerPage'));
const PortRackerPage = lazy(() => import('./pages/PortRackerPage'));

// ==================== 独立页面 ====================
const Knowledge = lazy(() => import('./pages/Knowledge'));

// ==================== 子路由/编辑器页面 ====================
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const RemediationPolicyEditor = lazy(() => import('./pages/RemediationPolicyEditor'));
const RCADetail = lazy(() => import('./pages/RCADetail'));
const RemoteDesktop = lazy(() => import('./pages/RemoteDesktop'));

// ==================== 旧路由兼容（重定向到新复合页面）====================
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BigScreenDashboard = lazy(() => import('./pages/BigScreenDashboard'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AlertMappings = lazy(() => import('./pages/AlertMappings'));
const Agents = lazy(() => import('./pages/Agents'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Servers = lazy(() => import('./pages/Servers'));
const NetworkDevices = lazy(() => import('./pages/NetworkDevices'));
const SSHKeys = lazy(() => import('./pages/SSHKeys'));
const DbConnections = lazy(() => import('./pages/DbConnections'));
const Scripts = lazy(() => import('./pages/Scripts'));
const ScheduledTasks = lazy(() => import('./pages/ScheduledTasks'));
const Approvals = lazy(() => import('./pages/Approvals'));
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const AlertNoiseManagement = lazy(() => import('./pages/AlertNoiseManagement'));
const AlertAutoAnalysis = lazy(() => import('./pages/AlertAutoAnalysis'));
const InspectionCenter = lazy(() => import('./pages/InspectionCenter'));
const RootCauseAnalysis = lazy(() => import('./pages/RootCauseAnalysis'));
const RemediationPolicies = lazy(() => import('./pages/RemediationPolicies'));
const RemediationExecutions = lazy(() => import('./pages/RemediationExecutions'));
const RemediationDashboard = lazy(() => import('./pages/RemediationDashboard'));
const RemediationWorkbench = lazy(() => import('./pages/RemediationWorkbench'));
const AiRemediations = lazy(() => import('./pages/AiRemediations'));
const Topology = lazy(() => import('./pages/Topology'));
const AIRootCause = lazy(() => import('./pages/AIRootCause'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const FrontendTests = lazy(() => import('./pages/FrontendTests'));
const SNMPPage = lazy(() => import('./pages/SNMP'));
const NetworkDiscoveryPage = lazy(() => import('./pages/NetworkDiscovery'));
const AlertCorrelationGroupsPage = lazy(() => import('./pages/AlertCorrelationGroups'));
const AIModels = lazy(() => import('./pages/AIModels'));

// ==================== 加载占位 ====================
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">加载中...</p>
      </div>
    </div>
  );
}

function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<SuspenseRoute><Login /></SuspenseRoute>} />
                  <Route path="/force-password-change" element={<SuspenseRoute><ProtectedRoute><ForcePasswordChange /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/workspace" replace />} />

                    {/* 新菜单结构 - 复合页面路由 */}
                    <Route path="workspace" element={<SuspenseRoute><ProtectedRoute><WorkspacePage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-center" element={<SuspenseRoute><ProtectedRoute><AlertCenterPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-agent" element={<SuspenseRoute><ProtectedRoute><AIAgentPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="execution" element={<SuspenseRoute><ProtectedRoute><ExecutionCenterPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="auto-remediation" element={<SuspenseRoute><ProtectedRoute><AutoRemediationPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="server-mgmt" element={<SuspenseRoute><ProtectedRoute><ServerPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="network-mgmt" element={<SuspenseRoute><ProtectedRoute><NetworkDevicePage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="portainer" element={<SuspenseRoute><ProtectedRoute><PortainerPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="port-racker" element={<SuspenseRoute><ProtectedRoute><PortRackerPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="report-center" element={<SuspenseRoute><ProtectedRoute><ReportCenterPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="system-mgmt" element={<SuspenseRoute><ProtectedRoute><SystemManagementPage /></ProtectedRoute></SuspenseRoute>} />

                    {/* 独立页面路由 */}
                    <Route path="knowledge" element={<SuspenseRoute><ProtectedRoute><Knowledge /></ProtectedRoute></SuspenseRoute>} />

                    {/* 子路由/编辑器页面（无侧边栏菜单入口） */}
                    <Route path="workflows/:id" element={<SuspenseRoute><ProtectedRoute><WorkflowEditor /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-policies/:id" element={<SuspenseRoute><ProtectedRoute><RemediationPolicyEditor /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-root-cause/:id" element={<SuspenseRoute><ProtectedRoute><RCADetail /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remote-desktop/:serverId" element={<SuspenseRoute><ProtectedRoute><RemoteDesktop /></ProtectedRoute></SuspenseRoute>} />

                    {/* 旧路由兼容（保留以支持书签/直接访问） */}
                    <Route path="dashboard" element={<SuspenseRoute><ProtectedRoute><Navigate to="/workspace" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="big-screen" element={<SuspenseRoute><ProtectedRoute><Navigate to="/workspace#bigscreen" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alerts" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-mappings" element={<SuspenseRoute><ProtectedRoute><AlertMappings /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-noise" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#noise" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-correlation-groups" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#correlation" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="root-cause-analysis" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#rca" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-root-cause" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#rca" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-auto-analysis" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#auto-analysis" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="inspection-center" element={<SuspenseRoute><ProtectedRoute><Navigate to="/alert-center#inspection" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="topology" element={<SuspenseRoute><ProtectedRoute><Navigate to="/network-mgmt#topology" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-insights" element={<SuspenseRoute><ProtectedRoute><Navigate to="/report-center#ai-insights" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="agents" element={<SuspenseRoute><ProtectedRoute><Navigate to="/ai-agent" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows" element={<SuspenseRoute><ProtectedRoute><Navigate to="/ai-agent#workflows" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="tasks" element={<SuspenseRoute><ProtectedRoute><Navigate to="/execution" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="scheduled-tasks" element={<SuspenseRoute><ProtectedRoute><Navigate to="/execution#scheduled" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="approvals" element={<SuspenseRoute><ProtectedRoute><Navigate to="/execution#approvals" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="scripts" element={<SuspenseRoute><ProtectedRoute><Navigate to="/ai-agent#scripts" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="servers" element={<SuspenseRoute><ProtectedRoute><Navigate to="/server-mgmt" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="terminal" element={<SuspenseRoute><ProtectedRoute><Navigate to="/server-mgmt#terminal" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remote-desktop" element={<SuspenseRoute><ProtectedRoute><Navigate to="/server-mgmt#remote" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="db-connections" element={<SuspenseRoute><ProtectedRoute><Navigate to="/server-mgmt#database" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ssh-keys" element={<SuspenseRoute><ProtectedRoute><Navigate to="/server-mgmt#credentials" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="network-devices" element={<SuspenseRoute><ProtectedRoute><Navigate to="/network-mgmt" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="snmp" element={<SuspenseRoute><ProtectedRoute><Navigate to="/network-mgmt#snmp" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="network-discovery" element={<SuspenseRoute><ProtectedRoute><Navigate to="/network-mgmt#discovery" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-policies" element={<SuspenseRoute><ProtectedRoute><Navigate to="/auto-remediation" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-workbench" element={<SuspenseRoute><ProtectedRoute><Navigate to="/auto-remediation#workbench" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-executions" element={<SuspenseRoute><ProtectedRoute><Navigate to="/auto-remediation#executions" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-dashboard" element={<SuspenseRoute><ProtectedRoute><Navigate to="/auto-remediation#dashboard" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-remediations" element={<SuspenseRoute><ProtectedRoute><Navigate to="/auto-remediation#ai" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="audit" element={<SuspenseRoute><ProtectedRoute><Navigate to="/report-center#audit" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="notifications" element={<SuspenseRoute><ProtectedRoute><Navigate to="/report-center#notifications" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="reports" element={<SuspenseRoute><ProtectedRoute><Navigate to="/report-center" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="users" element={<SuspenseRoute><ProtectedRoute><Navigate to="/system-mgmt" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="settings" element={<SuspenseRoute><ProtectedRoute><Navigate to="/system-mgmt#settings" replace /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="frontend-tests" element={<SuspenseRoute><ProtectedRoute><Navigate to="/system-mgmt#tests" replace /></ProtectedRoute></SuspenseRoute>} />
                  </Route>
                  <Route path="*" element={<SuspenseRoute><NotFound /></SuspenseRoute>} />
                </Routes>
              </BrowserRouter>
            </QueryClientProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
