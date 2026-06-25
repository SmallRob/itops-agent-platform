# 服务器域 - 服务接口

> **层级**：L3 详细内容

## SSHService

**文件**：`backend/src/services/sshService.ts`

```typescript
// 执行命令
export async function executeCommand(
  serverId: string,
  command: string,
  options?: CommandOptions
): Promise<CommandResult>

// 测试连接
export async function testConnection(
  serverId: string
): Promise<{ success: boolean; message: string }>

// 合规检查
export async function runComplianceCheck(
  serverId: string
): Promise<Record<string, CommandResult>>
```

## TerminalService

**文件**：`backend/src/services/terminalService.ts`

```typescript
// 创建终端会话
export function createTerminalSession(
  serverId: string,
  cols: number,
  rows: number
): Promise<{ sessionId: string; shell?: ClientChannel; error?: string }>

// 关闭会话
export function closeTerminalSession(sessionId: string): boolean

// 发送数据
export function sendData(
  sessionId: string,
  data: string,
  userRole?: string
): { success: boolean; reason?: string }
```

## CredentialService

**文件**：`backend/src/services/credentialService.ts`

```typescript
// 存储凭据
export function setCredential(provider: string, value: string): void

// 获取凭据
export function getCredential(provider: string): string | undefined

// 删除凭据
export function deleteCredential(provider: string): void
```

---

*生成时间：2026-06-21*