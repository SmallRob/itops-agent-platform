# 自动修复域 - 服务接口

> **层级**：L3 详细内容

## RemediationService

**文件**：`backend/src/services/remediationService.ts`

```typescript
// 策略管理
export function createPolicy(policy: PolicyInput): RemediationPolicy
export function updatePolicy(id: string, updates: Partial<PolicyInput>): RemediationPolicy
export function matchAlertToPolicies(alert: Alert): RemediationPolicy[]

// 执行管理
export function triggerRemediation(policy: RemediationPolicy, alert: Alert): Promise<RemediationExecution>
export function approveExecution(id: string, action: 'approve'|'reject', userId: string): void
export function verifyResult(executionId: string): Promise<boolean>
export function rollbackExecution(executionId: string): Promise<void>
```

## AiRemediationService

**文件**：`backend/src/services/aiRemediationService.ts`

```typescript
// AI 修复
export async function createAndExecute(input: {
  alert_id: string;
  device_id: string;
  diagnosis: string;
  commands: string[];
  risk_level: 'low'|'medium'|'high';
}): Promise<AiRemediationRecord>
```

## RootCauseAnalysisService

**文件**：`backend/src/services/rootCauseAnalysisService.ts`

```typescript
// 根因分析
export async function analyze(rcaId: string): Promise<RootCauseAnalysis>
export async function autoAnalyze(alertId: string): Promise<RootCauseAnalysis>
```

---

*生成时间：2026-06-21*