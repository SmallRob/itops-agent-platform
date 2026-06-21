export interface CommandPolicy {
  name: string;
  description: string;
  patterns: RegExp[];
  action: 'block' | 'warn' | 'allow';
  blockedRoles: string[];
}

const DANGEROUS_COMMANDS: CommandPolicy[] = [
  {
    name: 'filesystem_destructive',
    description: '破坏性文件系统操作',
    patterns: [
      /^rm\s+-rf\s+\/{1,3}$/,
      /^rm\s+-rf\s+\*$/,
      /^>\s*\/dev\/sd/,
      /^dd\s+if=\/dev\/zero/,
      /^shred\s+-/,
    ],
    action: 'block',
    blockedRoles: ['viewer', 'operator'],
  },
  {
    name: 'system_critical',
    description: '系统关键操作',
    patterns: [
      /^mkfs\./,
      /^fdisk\s/,
      /^parted\s/,
      /^cryptsetup\s/,
      /^lvremove\s/,
      /^vgremove\s/,
    ],
    action: 'block',
    blockedRoles: ['viewer', 'operator', 'admin'],
  },
  {
    name: 'network_destructive',
    description: '网络破坏性操作',
    patterns: [
      /^iptables\s+-F\s*$/,
      /^iptables\s+--flush\s*$/,
      /^ip\s+link\s+delete/,
      /^tc\s+qdisc\s+del/,
    ],
    action: 'block',
    blockedRoles: ['viewer', 'operator'],
  },
  {
    name: 'process_kill',
    description: '批量终止进程',
    patterns: [
      /^kill\s+-9\s+0$/,
      /^killall\s+-9\s/,
      /^pkill\s+-9\s+-f\s*$/,
      /^:\(\)\{.*:\|:.*&.*\};:$ /,
    ],
    action: 'block',
    blockedRoles: ['viewer', 'operator'],
  },
  {
    name: 'credential_access',
    description: '凭据访问尝试',
    patterns: [
      /\/etc\/shadow/,
      /\/etc\/passwd\s*[|>]/,
      /cat\s+.*\.pem\s*$/,
      /cat\s+.*id_rsa/,
      /cat\s+.*\.key\s*$/,
      /export\s+.*PASSWORD/,
      /export\s+.*SECRET/,
    ],
    action: 'warn',
    blockedRoles: ['viewer'],
  },
  {
    name: 'privilege_escalation',
    description: '权限提升尝试',
    patterns: [
      /^su\s+$/,
      /^sudo\s+su\s*$/,
      /^sudo\s+-i\s*$/,
      /^sudo\s+passwd\s/,
    ],
    action: 'warn',
    blockedRoles: ['viewer'],
  },
  {
    name: 'hidden_backdoor',
    description: '隐藏后门/持久化',
    patterns: [
      /^nohup\s+.*&\s*$/,
      /crontab\s+-l/,
      /systemctl\s+enable\s+.*\.service$/,
      /^echo\s+.*>>\s*\/etc\/rc\.local/,
      /wget\s+.*\|\s*(ba)?sh/,
      /curl\s+.*\|\s*(ba)?sh/,
    ],
    action: 'warn',
    blockedRoles: ['viewer'],
  },
];

export function checkCommandSafety(
  command: string,
  userRole: string
): {
  allowed: boolean;
  severity: 'blocked' | 'warning' | 'safe';
  reason?: string;
  policy?: string;
} {
  // 去除前后空格并统一多余空白
  let trimmed = command.trim().replace(/\s+/g, ' ');

  // 剥离 sudo 前缀，防止绕过安全检查
  // 匹配 sudo、sudo -S、sudo -u xxx 等常见形式
  trimmed = trimmed.replace(/^(?:sudo(?:\s+-\w+(?:\s+\S+)?)?\s+)+/, '');

  for (const policy of DANGEROUS_COMMANDS) {
    for (const pattern of policy.patterns) {
      if (pattern.test(trimmed)) {
        if (policy.action === 'block' && policy.blockedRoles.includes(userRole)) {
          return {
            allowed: false,
            severity: 'blocked',
            reason: `禁止操作: ${policy.description}`,
            policy: policy.name,
          };
        }
        if (policy.action === 'warn' && policy.blockedRoles.includes(userRole)) {
          return {
            allowed: true,
            severity: 'warning',
            reason: `警告: ${policy.description}`,
            policy: policy.name,
          };
        }
        break;
      }
    }
  }

  return { allowed: true, severity: 'safe' };
}
