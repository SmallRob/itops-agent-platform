# Backend Services Domain Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor backend services into domain-based directory structure to reduce coupling and improve maintainability

**Architecture:** Organize services into 6 domain layers: Agent, Integration, Monitoring, Reporting, Foundation, and Knowledge Operations. Each domain gets its own directory with clear boundaries.

**Tech Stack:** TypeScript, Express.js, Node.js

---

## Domain Structure

```
backend/src/services/
├── agent/                    # Agent domain
│   ├── agentExecutor.ts
│   ├── multiAgentCollaboration.ts
│   ├── copilotService.ts
│   └── index.ts
├── alert/                    # Alert domain
│   ├── alertService.ts
│   ├── alertAutoAnalyzer.ts
│   ├── alertCorrelationService.ts
│   ├── alertDeviceResolver.ts
│   ├── alertNoiseReductionService.ts
│   ├── alertNotificationService.ts
│   ├── alertSourceAdapters.ts
│   └── index.ts
├── ai/                       # AI/LLM domain
│   ├── aiModelService.ts
│   ├── aiRemediationService.ts
│   ├── llmService.ts
│   ├── llmServiceEnhanced.ts
│   ├── enhancedRAGService.ts
│   ├── rootCauseAnalysisService.ts
│   └── index.ts
├── network/                  # Network domain
│   ├── networkDeviceService.ts
│   ├── networkDiscoveryService.ts
│   ├── networkInspectionService.ts
│   ├── networkCommandGenerator.ts
│   ├── networkResultParser.ts
│   ├── lldpDiscoveryService.ts
│   ├── snmpService.ts
│   ├── snmpPollingService.ts
│   ├── snmpTrapService.ts
│   ├── snmpOidRegistry.ts
│   ├── topologyService.ts
│   └── index.ts
├── server/                   # Server domain
│   ├── serverImportService.ts
│   ├── serverInfoCollector.ts
│   ├── sshService.ts
│   ├── terminalService.ts
│   ├── vncProxyService.ts
│   └── index.ts
├── database/                 # Database domain
│   ├── dbskiterService.ts
│   └── index.ts
├── workflow/                 # Workflow domain
│   ├── workflowExecutor.ts
│   ├── schedulerService.ts
│   ├── queueService.ts
│   ├── queueBullAdapter.ts
│   └── index.ts
├── report/                   # Report domain
│   ├── reportService.ts
│   └── index.ts
├── knowledge/                # Knowledge domain
│   ├── qanythingService.ts
│   ├── localRuleEngine.ts
│   └── index.ts
├── notification/             # Notification domain
│   ├── notificationService.ts
│   ├── notificationChannels.ts
│   └── index.ts
├── security/                 # Security domain
│   ├── encryptionService.ts
│   ├── credentialService.ts
│   ├── tokenBlacklist.ts
│   ├── loginThrottler.ts
│   └── index.ts
├── audit/                    # Audit domain
│   ├── auditService.ts
│   ├── changeService.ts
│   └── index.ts
├── backup/                   # Backup domain
│   ├── backupService.ts
│   ├── configBackupService.ts
│   ├── importExportService.ts
│   └── index.ts
├── monitor/                  # Monitor domain
│   ├── healthService.ts
│   ├── selfMonitorService.ts
│   └── index.ts
├── foundation/               # Foundation services
│   ├── commandDispatcher.ts
│   ├── portainerService.ts
│   ├── portRackerService.ts
│   ├── restartService.ts
│   ├── vendorAdapter.ts
│   └── index.ts
└── index.ts                  # Main export file
```

---

## Task 1: Create Domain Directory Structure

**Covers:** Domain organization

**Files:**
- Create: `backend/src/services/agent/`
- Create: `backend/src/services/alert/`
- Create: `backend/src/services/ai/`
- Create: `backend/src/services/network/`
- Create: `backend/src/services/server/`
- Create: `backend/src/services/database/`
- Create: `backend/src/services/workflow/`
- Create: `backend/src/services/report/`
- Create: `backend/src/services/knowledge/`
- Create: `backend/src/services/notification/`
- Create: `backend/src/services/security/`
- Create: `backend/src/services/audit/`
- Create: `backend/src/services/backup/`
- Create: `backend/src/services/monitor/`
- Create: `backend/src/services/foundation/`

- [ ] **Step 1: Create all domain directories**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mkdir -p agent alert ai network server database workflow report knowledge notification security audit backup monitor foundation
```

- [ ] **Step 2: Verify directories created**

```bash
ls -la
```

Expected: 15 new directories created

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: create domain directory structure for services"
```

---

## Task 2: Move Agent Domain Services

**Covers:** Agent domain

**Files:**
- Move: `agentExecutor.ts` → `agent/agentExecutor.ts`
- Move: `multiAgentCollaboration.ts` → `agent/multiAgentCollaboration.ts`
- Move: `copilotService.ts` → `agent/copilotService.ts`
- Move: `agentExecutor.test.ts` → `agent/agentExecutor.test.ts`
- Move: `multiAgentCollaboration.test.ts` → `agent/multiAgentCollaboration.test.ts`
- Create: `agent/index.ts`

- [ ] **Step 1: Move agent service files**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv agentExecutor.ts agent/
mv multiAgentCollaboration.ts agent/
mv copilotService.ts agent/
mv agentExecutor.test.ts agent/ 2>/dev/null || true
mv multiAgentCollaboration.test.ts agent/ 2>/dev/null || true
```

- [ ] **Step 2: Create agent/index.ts**

```typescript
export { executeAgent, type AgentExecutionOptions, type AgentExecutionResult } from './agentExecutor';
export { MultiAgentCollaboration } from './multiAgentCollaboration';
export { CopilotService } from './copilotService';
```

- [ ] **Step 3: Update imports in routes and other services**

Search and update all imports that reference the moved files:
- `import { executeAgent } from '../services/agentExecutor'` → `import { executeAgent } from '../services/agent'`
- `import { MultiAgentCollaboration } from '../services/multiAgentCollaboration'` → `import { MultiAgentCollaboration } from '../services/agent'`

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /home/hexiuqi/itops-agent-platform/backend
npm run build
```

Expected: Successful compilation

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move agent services to agent domain directory"
```

---

## Task 3: Move Alert Domain Services

**Covers:** Alert domain

**Files:**
- Move: `alertService.ts` → `alert/alertService.ts`
- Move: `alertAutoAnalyzer.ts` → `alert/alertAutoAnalyzer.ts`
- Move: `alertCorrelationService.ts` → `alert/alertCorrelationService.ts`
- Move: `alertDeviceResolver.ts` → `alert/alertDeviceResolver.ts`
- Move: `alertNoiseReductionService.ts` → `alert/alertNoiseReductionService.ts`
- Move: `alertNotificationService.ts` → `alert/alertNotificationService.ts`
- Move: `alertSourceAdapters.ts` → `alert/alertSourceAdapters.ts`
- Move: `alertService.test.ts` → `alert/alertService.test.ts`
- Move: `alertNotificationService.test.ts` → `alert/alertNotificationService.test.ts`
- Create: `alert/index.ts`

- [ ] **Step 1: Move alert service files**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv alertService.ts alert/
mv alertAutoAnalyzer.ts alert/
mv alertCorrelationService.ts alert/
mv alertDeviceResolver.ts alert/
mv alertNoiseReductionService.ts alert/
mv alertNotificationService.ts alert/
mv alertSourceAdapters.ts alert/
mv alertService.test.ts alert/ 2>/dev/null || true
mv alertNotificationService.test.ts alert/ 2>/dev/null || true
```

- [ ] **Step 2: Create alert/index.ts**

```typescript
export { AlertService } from './alertService';
export { AlertAutoAnalyzer } from './alertAutoAnalyzer';
export { AlertCorrelationService } from './alertCorrelationService';
export { AlertDeviceResolver } from './alertDeviceResolver';
export { AlertNoiseReductionService } from './alertNoiseReductionService';
export { AlertNotificationService } from './alertNotificationService';
export { AlertSourceAdapters } from './alertSourceAdapters';
```

- [ ] **Step 3: Update imports**

Update all imports referencing alert services.

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move alert services to alert domain directory"
```

---

## Task 4: Move AI/LLM Domain Services

**Covers:** AI domain

**Files:**
- Move: `aiModelService.ts` → `ai/aiModelService.ts`
- Move: `aiRemediationService.ts` → `ai/aiRemediationService.ts`
- Move: `llmService.ts` → `ai/llmService.ts`
- Move: `llmServiceEnhanced.ts` → `ai/llmServiceEnhanced.ts`
- Move: `enhancedRAGService.ts` → `ai/enhancedRAGService.ts`
- Move: `rootCauseAnalysisService.ts` → `ai/rootCauseAnalysisService.ts`
- Move: `aiModelService.test.ts` → `ai/aiModelService.test.ts`
- Move: `llmService.test.ts` → `ai/llmService.test.ts`
- Move: `rootCauseAnalysisService.test.ts` → `ai/rootCauseAnalysisService.test.ts`
- Create: `ai/index.ts`

- [ ] **Step 1: Move AI service files**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv aiModelService.ts ai/
mv aiRemediationService.ts ai/
mv llmService.ts ai/
mv llmServiceEnhanced.ts ai/
mv enhancedRAGService.ts ai/
mv rootCauseAnalysisService.ts ai/
mv aiModelService.test.ts ai/ 2>/dev/null || true
mv llmService.test.ts ai/ 2>/dev/null || true
mv rootCauseAnalysisService.test.ts ai/ 2>/dev/null || true
```

- [ ] **Step 2: Create ai/index.ts**

```typescript
export { AiModelService } from './aiModelService';
export { AiRemediationService } from './aiRemediationService';
export { LLMService } from './llmService';
export { LLMServiceEnhanced } from './llmServiceEnhanced';
export { EnhancedRAGService } from './enhancedRAGService';
export { RootCauseAnalysisService } from './rootCauseAnalysisService';
```

- [ ] **Step 3: Update imports**

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move AI/LLM services to ai domain directory"
```

---

## Task 5: Move Network Domain Services

**Covers:** Network domain

**Files:**
- Move all network-related services to `network/`
- Create: `network/index.ts`

- [ ] **Step 1: Move network service files**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv networkDeviceService.ts network/
mv networkDiscoveryService.ts network/
mv networkInspectionService.ts network/
mv networkCommandGenerator.ts network/
mv networkResultParser.ts network/
mv lldpDiscoveryService.ts network/
mv snmpService.ts network/
mv snmpPollingService.ts network/
mv snmpTrapService.ts network/
mv snmpOidRegistry.ts network/
mv topologyService.ts network/
mv networkResultParser.test.ts network/ 2>/dev/null || true
```

- [ ] **Step 2: Create network/index.ts**

```typescript
export { NetworkDeviceService } from './networkDeviceService';
export { NetworkDiscoveryService } from './networkDiscoveryService';
export { NetworkInspectionService } from './networkInspectionService';
export { NetworkCommandGenerator } from './networkCommandGenerator';
export { NetworkResultParser } from './networkResultParser';
export { LLDPDiscoveryService } from './lldpDiscoveryService';
export { SNMPService } from './snmpService';
export { SNMPPollingService } from './snmpPollingService';
export { SNMPTrapService } from './snmpTrapService';
export { SNMPOidRegistry } from './snmpOidRegistry';
export { TopologyService } from './topologyService';
```

- [ ] **Step 3: Update imports**

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move network services to network domain directory"
```

---

## Task 6: Move Server Domain Services

**Covers:** Server domain

**Files:**
- Move all server-related services to `server/`
- Create: `server/index.ts`

- [ ] **Step 1: Move server service files**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv serverImportService.ts server/
mv serverInfoCollector.ts server/
mv sshService.ts server/
mv terminalService.ts server/
mv vncProxyService.ts server/
mv serverImportService.test.ts server/ 2>/dev/null || true
mv serverInfoCollector.test.ts server/ 2>/dev/null || true
mv sshService.test.ts server/ 2>/dev/null || true
```

- [ ] **Step 2: Create server/index.ts**

```typescript
export { ServerImportService } from './serverImportService';
export { ServerInfoCollector } from './serverInfoCollector';
export { SSHService } from './sshService';
export { TerminalService } from './terminalService';
export { VNCProxyService } from './vncProxyService';
```

- [ ] **Step 3: Update imports**

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move server services to server domain directory"
```

---

## Task 7: Move Remaining Domain Services

**Covers:** Database, Workflow, Report, Knowledge, Notification, Security, Audit, Backup, Monitor, Foundation domains

**Files:**
- Move remaining services to their respective domains
- Create index.ts for each domain

- [ ] **Step 1: Move database services**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src/services
mv dbskiterService.ts database/
```

- [ ] **Step 2: Move workflow services**

```bash
mv workflowExecutor.ts workflow/
mv schedulerService.ts workflow/
mv queueService.ts workflow/
mv queueBullAdapter.ts workflow/
mv workflowExecutor.test.ts workflow/ 2>/dev/null || true
mv schedulerService.test.ts workflow/ 2>/dev/null || true
mv queueService.test.ts workflow/ 2>/dev/null || true
```

- [ ] **Step 3: Move report services**

```bash
mv reportService.ts report/
```

- [ ] **Step 4: Move knowledge services**

```bash
mv qanythingService.ts knowledge/
mv localRuleEngine.ts knowledge/
mv localRuleEngine.test.ts knowledge/ 2>/dev/null || true
```

- [ ] **Step 5: Move notification services**

```bash
mv notificationService.ts notification/
mv notificationChannels.ts notification/
mv notificationChannels.test.ts notification/ 2>/dev/null || true
```

- [ ] **Step 6: Move security services**

```bash
mv encryptionService.ts security/
mv credentialService.ts security/
mv tokenBlacklist.ts security/
mv loginThrottler.ts security/
mv encryptionService.test.ts security/ 2>/dev/null || true
mv credentialService.test.ts security/ 2>/dev/null || true
mv tokenBlacklist.test.ts security/ 2>/dev/null || true
mv loginThrottler.test.ts security/ 2>/dev/null || true
```

- [ ] **Step 7: Move audit services**

```bash
mv auditService.ts audit/
mv changeService.ts audit/
```

- [ ] **Step 8: Move backup services**

```bash
mv backupService.ts backup/
mv configBackupService.ts backup/
mv importExportService.ts backup/
mv backupService.test.ts backup/ 2>/dev/null || true
mv importExportService.test.ts backup/ 2>/dev/null || true
```

- [ ] **Step 9: Move monitor services**

```bash
mv healthService.ts monitor/
mv selfMonitorService.ts monitor/
mv healthService.test.ts monitor/ 2>/dev/null || true
```

- [ ] **Step 10: Move foundation services**

```bash
mv commandDispatcher.ts foundation/
mv portainerService.ts foundation/
mv portRackerService.ts foundation/
mv restartService.ts foundation/
mv vendorAdapter.ts foundation/
mv vendorAdapter.test.ts foundation/ 2>/dev/null || true
```

- [ ] **Step 11: Create all index.ts files**

Create index.ts for each domain with appropriate exports.

- [ ] **Step 12: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor: move remaining services to domain directories"
```

---

## Task 8: Create Main Services Index

**Covers:** Main export

**Files:**
- Create: `backend/src/services/index.ts`

- [ ] **Step 1: Create main services/index.ts**

```typescript
// Agent domain
export * from './agent';

// Alert domain
export * from './alert';

// AI domain
export * from './ai';

// Network domain
export * from './network';

// Server domain
export * from './server';

// Database domain
export * from './database';

// Workflow domain
export * from './workflow';

// Report domain
export * from './report';

// Knowledge domain
export * from './knowledge';

// Notification domain
export * from './notification';

// Security domain
export * from './security';

// Audit domain
export * from './audit';

// Backup domain
export * from './backup';

// Monitor domain
export * from './monitor';

// Foundation domain
export * from './foundation';
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: create main services index file"
```

---

## Task 9: Update All Imports

**Covers:** Import updates

**Files:**
- Modify: All route files and other services that import from services

- [ ] **Step 1: Find all imports from services**

```bash
cd /home/hexiuqi/itops-agent-platform/backend/src
grep -r "from '../services/" routes/ | grep -v "from '../services/" | head -50
```

- [ ] **Step 2: Update imports to use domain index**

Update imports like:
- `import { executeAgent } from '../services/agentExecutor'` → `import { executeAgent } from '../services/agent'`
- `import { AlertService } from '../services/alertService'` → `import { AlertService } from '../services/alert'`

Or use the main index:
- `import { executeAgent, AlertService } from '../services'`

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: update all service imports to use domain structure"
```

---

## Task 10: Build and Deploy

**Covers:** Deployment

**Files:**
- None (build and deploy only)

- [ ] **Step 1: Build backend Docker image**

```bash
cd /home/hexiuqi/itops-agent-platform
docker compose build backend
```

- [ ] **Step 2: Restart backend service**

```bash
docker compose up -d backend
```

- [ ] **Step 3: Verify service is running**

```bash
docker logs itops-backend --tail 20
```

Expected: Service starts without errors

- [ ] **Step 4: Test API endpoints**

```bash
curl -s http://localhost:19301/health | jq .
```

Expected: Health check returns 200

- [ ] **Step 5: Commit final changes**

```bash
git add -A
git commit -m "refactor: complete service domain refactoring"
```

---

## Summary

This plan refactors the backend services from a flat structure to a domain-based organization:

1. **Agent domain** - Agent execution, multi-agent collaboration, copilot
2. **Alert domain** - Alert processing, analysis, correlation, notification
3. **AI domain** - LLM services, AI remediation, root cause analysis
4. **Network domain** - Network devices, SNMP, topology
5. **Server domain** - Server management, SSH, terminal
6. **Database domain** - Database operations (dbskiter)
7. **Workflow domain** - Workflow execution, scheduling, queues
8. **Report domain** - Report generation
9. **Knowledge domain** - Knowledge base, rule engine
10. **Notification domain** - Notification channels
11. **Security domain** - Encryption, credentials, authentication
12. **Audit domain** - Audit logging, change tracking
13. **Backup domain** - Backup, import/export
14. **Monitor domain** - Health checks, self-monitoring
15. **Foundation domain** - Command dispatch, vendor adapters

Each domain has its own directory with an index.ts for clean exports. All imports are updated to use the new structure.
