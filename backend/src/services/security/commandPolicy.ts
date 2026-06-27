/**
 * 增强版命令安全策略服务
 *
 * 参考 Ongrid 的 cmdpolicy 设计理念，实现 5 级命令分类、读写分离、路径沙箱等安全机制。
 *
 * 核心能力:
 *   - 5 级命令分类: READ_FS / READ_SYSTEM / MIXED / NETWORK / DENIED
 *   - 读写分离检测: 同一命令根据子命令/参数区分读写行为
 *   - 管道分割检测: 拆分管道后逐段分析，防止通过管道绕过策略
 *   - 路径白名单沙箱: 限制文件操作只能在允许的目录内
 *   - 网络主机白名单: 限制网络命令只能访问指定主机
 *   - YAML 可扩展策略: 支持从外部 YAML 文件加载自定义策略规则
 */

// ============================================================
// 类型定义
// ============================================================

/** 命令安全分类 */
export enum CommandClass {
  /** 只读文件系统操作（cat / ls / find ...） */
  READ_FS = 'READ_FS',
  /** 只读系统信息查询（ps / top / free ...） */
  READ_SYSTEM = 'READ_SYSTEM',
  /** 混合读写命令，需根据子命令进一步判断（systemctl / iptables ...） */
  MIXED = 'MIXED',
  /** 网络访问命令（ping / curl / wget ...） */
  NETWORK = 'NETWORK',
  /** 完全禁止的危险命令（rm / shutdown / reboot ...） */
  DENIED = 'DENIED',
  /** 未匹配任何已知分类 */
  UNKNOWN = 'UNKNOWN',
}

/** 命令决策结果 */
export interface CommandDecision {
  /** 是否允许执行 */
  allowed: boolean;
  /** 命令所属安全分类 */
  class: CommandClass;
  /** 决策原因 */
  reason: string;
  /** 命中规则名称（可选） */
  matchedRule?: string;
}

/** 命令分类规则条目 */
export interface CommandRule {
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 命令名（不带参数） */
  command: string;
  /** 所属安全分类 */
  classification: CommandClass;
  /** 对于 MIXED 命令，定义哪些子命令/参数属于读操作 */
  readSubcommands?: string[];
  /** 对于 MIXED 命令，定义哪些子命令/参数属于写操作 */
  writeSubcommands?: string[];
  /** 危险参数模式列表（正则），匹配时视为写操作 */
  dangerousArgs?: RegExp[];
}

/** YAML 策略文件中加载的自定义规则条目 */
export interface YamlPolicyRule {
  name: string;
  description: string;
  command: string;
  classification: string;
  readSubcommands?: string[];
  writeSubcommands?: string[];
}

/** YAML 策略配置结构 */
export interface YamlPolicyConfig {
  /** 路径白名单 */
  allowedPaths?: string[];
  /** 网络主机白名单 */
  allowedHosts?: string[];
  /** 自定义命令规则 */
  rules?: YamlPolicyRule[];
}

/** 策略配置选项 */
export interface CommandPolicyOptions {
  /** 路径白名单（目录前缀） */
  allowedPaths?: string[];
  /** 网络主机白名单 */
  allowedHosts?: string[];
  /** 额外的自定义规则 */
  extraRules?: CommandRule[];
}

// ============================================================
// 预定义命令分类表（约 70+ 条）
// ============================================================

const DEFAULT_COMMAND_RULES: CommandRule[] = [
  // ----------------------------------------------------------
  // READ_FS — 只读文件系统操作（16 个）
  // ----------------------------------------------------------
  { name: 'cat', description: '查看文件内容', command: 'cat', classification: CommandClass.READ_FS },
  { name: 'ls', description: '列出目录内容', command: 'ls', classification: CommandClass.READ_FS },
  { name: 'find', description: '查找文件', command: 'find', classification: CommandClass.READ_FS },
  { name: 'grep', description: '搜索文本', command: 'grep', classification: CommandClass.READ_FS },
  { name: 'head', description: '查看文件头部', command: 'head', classification: CommandClass.READ_FS },
  { name: 'tail', description: '查看文件尾部', command: 'tail', classification: CommandClass.READ_FS },
  { name: 'wc', description: '统计行数/字数', command: 'wc', classification: CommandClass.READ_FS },
  { name: 'du', description: '查看磁盘占用', command: 'du', classification: CommandClass.READ_FS },
  { name: 'df', description: '查看磁盘空间', command: 'df', classification: CommandClass.READ_FS },
  { name: 'file', description: '识别文件类型', command: 'file', classification: CommandClass.READ_FS },
  { name: 'stat', description: '查看文件状态', command: 'stat', classification: CommandClass.READ_FS },
  { name: 'readlink', description: '查看符号链接目标', command: 'readlink', classification: CommandClass.READ_FS },
  { name: 'realpath', description: '解析绝对路径', command: 'realpath', classification: CommandClass.READ_FS },
  { name: 'tree', description: '树形列出目录', command: 'tree', classification: CommandClass.READ_FS },
  { name: 'locate', description: '定位文件', command: 'locate', classification: CommandClass.READ_FS },
  { name: 'which', description: '查找命令路径', command: 'which', classification: CommandClass.READ_FS },

  // ----------------------------------------------------------
  // READ_SYSTEM — 只读系统信息查询（17 个）
  // ----------------------------------------------------------
  { name: 'ps', description: '查看进程列表', command: 'ps', classification: CommandClass.READ_SYSTEM },
  { name: 'top', description: '查看系统负载', command: 'top', classification: CommandClass.READ_SYSTEM },
  { name: 'free', description: '查看内存使用', command: 'free', classification: CommandClass.READ_SYSTEM },
  { name: 'uptime', description: '查看运行时间', command: 'uptime', classification: CommandClass.READ_SYSTEM },
  { name: 'uname', description: '查看系统信息', command: 'uname', classification: CommandClass.READ_SYSTEM },
  { name: 'hostname', description: '查看主机名', command: 'hostname', classification: CommandClass.READ_SYSTEM },
  { name: 'id', description: '查看用户 ID', command: 'id', classification: CommandClass.READ_SYSTEM },
  { name: 'who', description: '查看登录用户', command: 'who', classification: CommandClass.READ_SYSTEM },
  { name: 'w', description: '查看登录用户详情', command: 'w', classification: CommandClass.READ_SYSTEM },
  { name: 'last', description: '查看登录历史', command: 'last', classification: CommandClass.READ_SYSTEM },
  { name: 'vmstat', description: '虚拟内存统计', command: 'vmstat', classification: CommandClass.READ_SYSTEM },
  { name: 'iostat', description: 'IO 统计', command: 'iostat', classification: CommandClass.READ_SYSTEM },
  { name: 'mpstat', description: '多处理器统计', command: 'mpstat', classification: CommandClass.READ_SYSTEM },
  { name: 'sar', description: '系统活动报告', command: 'sar', classification: CommandClass.READ_SYSTEM },
  { name: 'dmesg', description: '查看内核消息', command: 'dmesg', classification: CommandClass.READ_SYSTEM },
  { name: 'lscpu', description: '查看 CPU 信息', command: 'lscpu', classification: CommandClass.READ_SYSTEM },
  { name: 'lsblk', description: '查看块设备', command: 'lsblk', classification: CommandClass.READ_SYSTEM },

  // ----------------------------------------------------------
  // MIXED — 混合读写命令（7 个），需根据子命令判断
  // ----------------------------------------------------------
  {
    name: 'systemctl',
    description: '系统服务管理',
    command: 'systemctl',
    classification: CommandClass.MIXED,
    readSubcommands: ['status', 'show', 'list-units', 'list-unit-files', 'is-active', 'is-enabled', 'is-failed', 'cat', 'help', 'daemon-reload'],
    writeSubcommands: ['start', 'stop', 'restart', 'reload', 'enable', 'disable', 'mask', 'unmask', 'reset-failed', 'kill'],
  },
  {
    name: 'iptables',
    description: '防火墙规则管理',
    command: 'iptables',
    classification: CommandClass.MIXED,
    readSubcommands: ['-L', '--list', '-S', '--list-rules', '-Z', '--zero', '-L -n', '-L -v'],
    writeSubcommands: ['-A', '--append', '-D', '--delete', '-I', '--insert', '-R', '--replace', '-F', '--flush', '-P', '--policy', '-N', '--new-chain', '-X', '--delete-chain'],
  },
  {
    name: 'ip',
    description: '网络配置工具',
    command: 'ip',
    classification: CommandClass.MIXED,
    readSubcommands: ['addr show', 'addr list', 'link show', 'route show', 'route list', 'neigh show', 'rule show', 'route get', '-s link show'],
    writeSubcommands: ['addr add', 'addr del', 'addr flush', 'link set', 'link add', 'link delete', 'route add', 'route del', 'route flush', 'neigh add', 'neigh del', 'neigh flush'],
  },
  {
    name: 'docker',
    description: '容器管理',
    command: 'docker',
    classification: CommandClass.MIXED,
    readSubcommands: ['ps', 'images', 'inspect', 'logs', 'top', 'stats', 'port', 'diff', 'history', 'version', 'info'],
    writeSubcommands: ['run', 'start', 'stop', 'restart', 'rm', 'rmi', 'pull', 'push', 'exec', 'kill', 'pause', 'unpause', 'create', 'rename', 'update'],
  },
  {
    name: 'journalctl',
    description: '系统日志查询',
    command: 'journalctl',
    classification: CommandClass.MIXED,
    readSubcommands: ['--list-boots', '-b', '--disk-usage', '--verify', '--dump-catalog'],
    writeSubcommands: ['--vacuum-size', '--vacuum-time', '--vacuum-files', '--rotate', '--flush'],
  },
  {
    name: 'crontab',
    description: '定时任务管理',
    command: 'crontab',
    classification: CommandClass.MIXED,
    readSubcommands: ['-l', '--list'],
    writeSubcommands: ['-e', '--edit', '-r', '--remove'],
  },
  {
    name: 'mount',
    description: '挂载管理',
    command: 'mount',
    classification: CommandClass.MIXED,
    readSubcommands: [],   // 无参数 mount 即为只读查询
    writeSubcommands: ['-o', '-t'],
  },

  // SEC-040: Additional MIXED command patterns for security coverage
  {
    name: 'usermod',
    description: '修改用户属性',
    command: 'usermod',
    classification: CommandClass.MIXED,
    readSubcommands: ['--help'],
    writeSubcommands: ['-a', '-G', '-s', '-d', '-l', '-L', '-U', '-e', '-f'],
  },
  {
    name: 'groupdel',
    description: '删除用户组',
    command: 'groupdel',
    classification: CommandClass.MIXED,
    readSubcommands: ['--help'],
    writeSubcommands: [], // any usage is a write
  },
  {
    name: 'su',
    description: '切换用户',
    command: 'su',
    classification: CommandClass.MIXED,
    readSubcommands: ['--help', '--version'],
    writeSubcommands: ['-', '-l', '-c'], // switch or run as another user
  },
  {
    name: 'sysctl',
    description: '内核参数管理',
    command: 'sysctl',
    classification: CommandClass.MIXED,
    readSubcommands: ['-a', '--all', '-r'],
    writeSubcommands: ['-w', '--write', '-p'], // write or load config
  },
  {
    name: 'tc',
    description: '流量控制',
    command: 'tc',
    classification: CommandClass.MIXED,
    readSubcommands: ['qdisc show', 'class show', 'filter show', 'qdisc ls', 'class ls', 'filter ls'],
    writeSubcommands: ['qdisc add', 'qdisc del', 'qdisc replace', 'class add', 'class del', 'class change', 'filter add', 'filter del'],
  },
  {
    name: 'nsenter',
    description: '进入命名空间',
    command: 'nsenter',
    classification: CommandClass.MIXED,
    readSubcommands: ['--help', '--version'],
    writeSubcommands: ['-t', '-n', '-p', '-m', '-u', '-i', '-C'], // all usages are potentially dangerous
  },
  {
    name: 'nmap',
    description: '网络扫描工具',
    command: 'nmap',
    classification: CommandClass.MIXED,
    readSubcommands: ['-sn', '-sL', '--list-interfaces', '--iflist', '-h', '--help'],
    writeSubcommands: ['-sS', '-sT', '-sU', '-sV', '-O', '-A', '-p-', '--script', '-oN', '-oX'],
  },

  // ----------------------------------------------------------
  // NETWORK — 网络访问命令（7 个）
  // ----------------------------------------------------------
  { name: 'ping', description: '网络连通性测试', command: 'ping', classification: CommandClass.NETWORK },
  { name: 'curl', description: 'HTTP 请求', command: 'curl', classification: CommandClass.NETWORK },
  { name: 'wget', description: '下载文件', command: 'wget', classification: CommandClass.NETWORK },
  { name: 'dig', description: 'DNS 查询', command: 'dig', classification: CommandClass.NETWORK },
  { name: 'nslookup', description: 'DNS 查询', command: 'nslookup', classification: CommandClass.NETWORK },
  { name: 'netstat', description: '网络连接统计', command: 'netstat', classification: CommandClass.NETWORK },
  { name: 'ss', description: '套接字统计', command: 'ss', classification: CommandClass.NETWORK },

  // ----------------------------------------------------------
  // DENIED — 完全禁止的危险命令（25 个）
  // ----------------------------------------------------------
  { name: 'rm', description: '删除文件/目录', command: 'rm', classification: CommandClass.DENIED },
  { name: 'shutdown', description: '关机', command: 'shutdown', classification: CommandClass.DENIED },
  { name: 'reboot', description: '重启', command: 'reboot', classification: CommandClass.DENIED },
  { name: 'halt', description: '停机', command: 'halt', classification: CommandClass.DENIED },
  { name: 'poweroff', description: '断电关机', command: 'poweroff', classification: CommandClass.DENIED },
  { name: 'init', description: '切换运行级别', command: 'init', classification: CommandClass.DENIED },
  { name: 'mkfs', description: '创建文件系统', command: 'mkfs', classification: CommandClass.DENIED },
  { name: 'fdisk', description: '磁盘分区', command: 'fdisk', classification: CommandClass.DENIED },
  { name: 'dd', description: '低级磁盘复制', command: 'dd', classification: CommandClass.DENIED },
  { name: 'parted', description: '磁盘分区工具', command: 'parted', classification: CommandClass.DENIED },
  { name: 'kill', description: '终止进程', command: 'kill', classification: CommandClass.DENIED },
  { name: 'killall', description: '终止所有同名进程', command: 'killall', classification: CommandClass.DENIED },
  { name: 'passwd', description: '修改密码', command: 'passwd', classification: CommandClass.DENIED },
  { name: 'useradd', description: '添加用户', command: 'useradd', classification: CommandClass.DENIED },
  { name: 'userdel', description: '删除用户', command: 'userdel', classification: CommandClass.DENIED },
  { name: 'groupadd', description: '添加用户组', command: 'groupadd', classification: CommandClass.DENIED },
  { name: 'chown', description: '修改文件所有者', command: 'chown', classification: CommandClass.DENIED },
  { name: 'chmod', description: '修改文件权限', command: 'chmod', classification: CommandClass.DENIED },
  { name: 'umount', description: '卸载挂载点', command: 'umount', classification: CommandClass.DENIED },
  { name: 'insmod', description: '加载内核模块', command: 'insmod', classification: CommandClass.DENIED },
  { name: 'rmmod', description: '卸载内核模块', command: 'rmmod', classification: CommandClass.DENIED },
  { name: 'modprobe', description: '模块加载管理', command: 'modprobe', classification: CommandClass.DENIED },
  { name: 'pkill', description: '按名称终止进程', command: 'pkill', classification: CommandClass.DENIED },
  { name: 'pkill', description: '按名称终止进程', command: 'pkill', classification: CommandClass.DENIED },
  { name: 'mkswap', description: '创建交换分区', command: 'mkswap', classification: CommandClass.DENIED },
];

// ============================================================
// 默认配置
// ============================================================

/** 默认路径白名单（仅允许访问以下目录前缀） */
const DEFAULT_ALLOWED_PATHS: string[] = [
  '/var/log',
  '/tmp',
  '/opt/app',
  '/home',
  '/etc/hostname',
  '/etc/os-release',
  '/proc',
  '/sys',
];

/** 默认网络主机白名单 */
const DEFAULT_ALLOWED_HOSTS: string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
];

// ============================================================
// 工具函数
// ============================================================

/**
 * 剥离命令开头的 sudo 前缀，防止通过 sudo 绕过安全检查
 * 支持: sudo, sudo -S, sudo -u xxx, sudo --user=xxx 等形式
 *
 * 采用分步剥离策略: 先匹配 sudo，再逐个剥离标志和参数，
 * 循环处理多层 sudo 嵌套。
 */
export function stripSudo(command: string): string {
  let result = command;
  // 循环剥离多层 sudo 前缀
  while (/^sudo\s/.test(result)) {
    result = result.replace(/^sudo\s+/, '');
    // 剥离带参数的标志: -u user, -g group, -C num, -D dir 等
    result = result.replace(/^-(?:u|g|C|D|R|T)\s+\S+\s*/, '');
    // 剥离无参数的短标志: -S, -i, -k, -K, -b, -n, -v, -l, -p, -s, -E, -P, -B, -H 等
    result = result.replace(/^-[A-Za-z]+\s*/, '');
    // 剥离长标志: --user=root, --flag 等
    result = result.replace(/^--[\w-]+(?:=\S+)?\s*/, '');
  }
  return result;
}

/**
 * 管道分割: 将命令按管道符 | 拆分为多个子命令片段
 * 注意: 忽略被引号包裹的管道符
 */
export function splitPipes(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (const ch of command) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }
    if (ch === '|' && !inSingleQuote && !inDoubleQuote) {
      segments.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    segments.push(current.trim());
  }
  return segments.filter(Boolean);
}

/**
 * 从命令字符串中提取命令名（第一个词）
 */
export function extractCommandName(segment: string): string {
  const trimmed = segment.trim();
  // 处理带环境变量前缀的情况: VAR=val command ...
  const withoutEnv = trimmed.replace(/^(\w+=\S+\s+)*/, '');
  const firstToken = withoutEnv.split(/\s+/)[0] || '';
  // 取 basename（忽略路径前缀）
  return firstToken.replace(/^.*\//, '');
}

/**
 * 从命令片段中提取所有参数部分（去掉命令名）
 */
export function extractArgs(segment: string): string {
  const trimmed = segment.trim();
  const withoutEnv = trimmed.replace(/^(\w+=\S+\s+)*/, '');
  const idx = withoutEnv.indexOf(' ');
  return idx === -1 ? '' : withoutEnv.slice(idx).trim();
}

/**
 * 提取命令中出现的所有路径（以 / 开头的 token）
 * 注意: 排除 CIDR 表示法（如 10.0.0.0/8 中的 /8）
 */
export function extractPaths(segment: string): string[] {
  const paths: string[] = [];
  // 匹配路径形式的 token: /开头，可能包含通配符
  // 使用负向回顾确保 / 前面不是数字或点号（排除 CIDR 表示法）
  const pathRegex = /(?<![.\d])(\/[a-zA-Z_*?[\]{}][\w./\-*?[\]{}]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(segment)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * 提取命令中出现的网络主机名/IP
 */
export function extractHosts(segment: string): string[] {
  const hosts: string[] = [];
  // 匹配 URL 中的主机: http(s)://host 或直接 @host / host:port
  const urlRegex = /https?:\/\/([^/:?\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(segment)) !== null) {
    hosts.push(match[1]);
  }
  // 匹配 -h host 或 --host=host 形式
  const flagRegex = /(?:-h|--host[=\s])\s*(\S+)/g;
  while ((match = flagRegex.exec(segment)) !== null) {
    hosts.push(match[1]);
  }
  return hosts;
}

/**
 * 检查路径是否在白名单内
 */
export function isPathAllowed(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((prefix) => {
    // 处理精确匹配（如 /etc/hostname）
    if (path === prefix) return true;
    // 处理目录前缀匹配（确保是目录级别的前缀）
    const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
    return path.startsWith(normalizedPrefix) || path === prefix;
  });
}

/**
 * 检查主机是否在白名单内
 */
export function isHostAllowed(host: string, allowedHosts: string[]): boolean {
  // 去除端口号
  const cleanHost = host.replace(/:\d+$/, '');
  return allowedHosts.some((allowed) => cleanHost === allowed);
}

// ============================================================
// 核心服务类
// ============================================================

export class CommandPolicyService {
  /** 合并后的命令规则映射表（命令名 -> 规则） */
  private ruleMap: Map<string, CommandRule> = new Map();
  /** 路径白名单 */
  private allowedPaths: string[];
  /** 网络主机白名单 */
  private allowedHosts: string[];

  constructor(options?: CommandPolicyOptions) {
    this.allowedPaths = options?.allowedPaths ?? [...DEFAULT_ALLOWED_PATHS];
    this.allowedHosts = options?.allowedHosts ?? [...DEFAULT_ALLOWED_HOSTS];

    // 加载默认规则
    for (const rule of DEFAULT_COMMAND_RULES) {
      this.ruleMap.set(rule.command, rule);
    }

    // 加载额外自定义规则
    if (options?.extraRules) {
      for (const rule of options.extraRules) {
        this.ruleMap.set(rule.command, rule);
      }
    }
  }

  // ----------------------------------------------------------
  // 公开方法
  // ----------------------------------------------------------

  /**
   * 对给定命令字符串进行安全策略评估
   *
   * @param rawCommand 原始命令字符串
   * @returns CommandDecision 决策结果
   */
  evaluate(rawCommand: string): CommandDecision {
    // 1. 预处理: 去除前后空格，统一空白
    const normalized = rawCommand.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return {
        allowed: true,
        class: CommandClass.UNKNOWN,
        reason: '空命令',
      };
    }

    // 2. 剥离 sudo 前缀
    const withoutSudo = stripSudo(normalized);

    // 3. 管道分割，逐段检查
    const segments = splitPipes(withoutSudo);
    const decisions: CommandDecision[] = [];

    for (const segment of segments) {
      const decision = this.evaluateSegment(segment);
      decisions.push(decision);
    }

    // 4. 汇总: 取最高风险等级
    return this.mergeDecisions(decisions);
  }

  /**
   * 查询指定命令名的分类信息（不做管道/路径检查）
   * 支持带变体后缀的命令名，如 mkfs.ext4 -> mkfs
   */
  classifyCommand(commandName: string): CommandClass {
    const rule = this.lookupRule(commandName);
    return rule?.classification ?? CommandClass.UNKNOWN;
  }

  /**
   * 获取所有已注册的规则列表（供前端展示或调试）
   */
  listRules(): CommandRule[] {
    return Array.from(this.ruleMap.values());
  }

  /**
   * 动态添加规则
   */
  addRule(rule: CommandRule): void {
    this.ruleMap.set(rule.command, rule);
  }

  /**
   * 从 YAML 配置对象加载扩展策略
   * 注意: YAML 解析由调用方负责，本方法接收已解析的配置对象
   */
  loadYamlPolicy(config: YamlPolicyConfig): void {
    // 加载路径白名单
    if (config.allowedPaths) {
      const existing = new Set(this.allowedPaths);
      for (const p of config.allowedPaths) {
        existing.add(p);
      }
      this.allowedPaths = Array.from(existing);
    }

    // 加载主机白名单
    if (config.allowedHosts) {
      const existing = new Set(this.allowedHosts);
      for (const h of config.allowedHosts) {
        existing.add(h);
      }
      this.allowedHosts = Array.from(existing);
    }

    // 加载自定义命令规则
    if (config.rules) {
      for (const r of config.rules) {
        const classification = r.classification as CommandClass;
        if (!Object.values(CommandClass).includes(classification)) {
          continue; // 跳过无效分类
        }
        this.ruleMap.set(r.command, {
          name: r.name,
          description: r.description,
          command: r.command,
          classification,
          readSubcommands: r.readSubcommands,
          writeSubcommands: r.writeSubcommands,
        });
      }
    }
  }

  /**
   * 获取当前路径白名单
   */
  getAllowedPaths(): string[] {
    return [...this.allowedPaths];
  }

  /**
   * 获取当前主机白名单
   */
  getAllowedHosts(): string[] {
    return [...this.allowedHosts];
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /**
   * 查找命令规则，支持变体后缀回退
   * 例如: mkfs.ext4 -> 查找 mkfs.ext4，未找到则回退到 mkfs
   */
  private lookupRule(cmdName: string): CommandRule | undefined {
    // 先尝试精确匹配
    const exact = this.ruleMap.get(cmdName);
    if (exact) return exact;

    // 回退: 取点号前的基名（如 mkfs.ext4 -> mkfs）
    const dotIndex = cmdName.indexOf('.');
    if (dotIndex > 0) {
      const baseName = cmdName.slice(0, dotIndex);
      return this.ruleMap.get(baseName);
    }

    return undefined;
  }

  /**
   * 对单个命令片段（非管道）进行策略评估
   */
  private evaluateSegment(segment: string): CommandDecision {
    const cmdName = extractCommandName(segment);
    const args = extractArgs(segment);
    const fullArgs = `${cmdName} ${args}`.trim();

    // 查找规则（支持变体后缀，如 mkfs.ext4 -> mkfs）
    const rule = this.lookupRule(cmdName);

    // 未匹配任何规则 => 默认允许（UNKNOWN 分类）
    if (!rule) {
      return {
        allowed: true,
        class: CommandClass.UNKNOWN,
        reason: `未知命令 "${cmdName}"，未匹配任何安全策略`,
      };
    }

    // ---- DENIED: 直接拒绝 ----
    if (rule.classification === CommandClass.DENIED) {
      return {
        allowed: false,
        class: CommandClass.DENIED,
        reason: `禁止执行: ${rule.description} (${rule.command})`,
        matchedRule: rule.name,
      };
    }

    // ---- MIXED: 根据子命令判断读写 ----
    if (rule.classification === CommandClass.MIXED) {
      const mixedDecision = this.evaluateMixedCommand(rule, args);
      // 路径白名单检查（混合命令也可能操作路径）
      if (mixedDecision.allowed && this.hasPathViolation(fullArgs)) {
        return {
          allowed: false,
          class: mixedDecision.class,
          reason: '路径不在白名单内，拒绝执行',
          matchedRule: rule.name,
        };
      }
      return { ...mixedDecision, matchedRule: rule.name };
    }

    // ---- NETWORK: 检查主机白名单 ----
    if (rule.classification === CommandClass.NETWORK) {
      const hostCheck = this.checkHostWhitelist(segment);
      if (!hostCheck.allowed) {
        return {
          allowed: false,
          class: CommandClass.NETWORK,
          reason: hostCheck.reason!,
          matchedRule: rule.name,
        };
      }
      return {
        allowed: true,
        class: CommandClass.NETWORK,
        reason: `允许网络操作: ${rule.description}`,
        matchedRule: rule.name,
      };
    }

    // ---- READ_FS: 检查路径白名单 ----
    if (rule.classification === CommandClass.READ_FS) {
      if (this.hasPathViolation(fullArgs)) {
        return {
          allowed: false,
          class: CommandClass.READ_FS,
          reason: '路径不在白名单内，拒绝执行',
          matchedRule: rule.name,
        };
      }
      return {
        allowed: true,
        class: CommandClass.READ_FS,
        reason: `允许只读文件操作: ${rule.description}`,
        matchedRule: rule.name,
      };
    }

    // ---- READ_SYSTEM: 直接允许 ----
    return {
      allowed: true,
      class: CommandClass.READ_SYSTEM,
      reason: `允许只读系统查询: ${rule.description}`,
      matchedRule: rule.name,
    };
  }

  /**
   * 对 MIXED 类型命令判断读写行为
   */
  private evaluateMixedCommand(rule: CommandRule, args: string): CommandDecision {
    const readSubs = rule.readSubcommands ?? [];
    const writeSubs = rule.writeSubcommands ?? [];
    const dangerousArgs = rule.dangerousArgs ?? [];

    // 检查是否匹配写操作子命令
    for (const writeSub of writeSubs) {
      if (args.includes(writeSub)) {
        return {
          allowed: true,
          class: CommandClass.MIXED,
          reason: `检测到写操作子命令 "${writeSub}"，归类为 MIXED 写操作`,
        };
      }
    }

    // 检查是否匹配危险参数
    for (const pattern of dangerousArgs) {
      if (pattern.test(args)) {
        return {
          allowed: true,
          class: CommandClass.MIXED,
          reason: `检测到危险参数模式，归类为 MIXED 写操作`,
        };
      }
    }

    // 检查是否匹配读操作子命令
    for (const readSub of readSubs) {
      if (args.includes(readSub)) {
        return {
          allowed: true,
          class: CommandClass.READ_SYSTEM,
          reason: `检测到只读子命令 "${readSub}"，归类为只读操作`,
        };
      }
    }

    // 无参数的 mount 等视为只读查询
    if (!args || args.trim() === '') {
      // 无子命令时：如果存在读子命令定义，视为只读查询
      if (readSubs.length >= 0) {
        return {
          allowed: true,
          class: CommandClass.READ_SYSTEM,
          reason: '无子命令参数，视为只读查询',
        };
      }
    }

    // 默认视为 MIXED
    return {
      allowed: true,
      class: CommandClass.MIXED,
      reason: '无法明确判断读写类型，归类为 MIXED',
    };
  }

  /**
   * 检查命令中的路径是否违反白名单
   */
  private hasPathViolation(commandArgs: string): boolean {
    const paths = extractPaths(commandArgs);
    if (paths.length === 0) return false;
    return paths.some((p) => !isPathAllowed(p, this.allowedPaths));
  }

  /**
   * 检查命令中的网络主机是否在白名单内
   */
  private checkHostWhitelist(segment: string): { allowed: boolean; reason?: string } {
    const hosts = extractHosts(segment);
    if (hosts.length === 0) {
      // 没有明确提取到主机（如直接 ping 10.0.0.1），允许通过
      return { allowed: true };
    }
    for (const host of hosts) {
      if (!isHostAllowed(host, this.allowedHosts)) {
        return {
          allowed: false,
          reason: `目标主机 "${host}" 不在白名单内`,
        };
      }
    }
    return { allowed: true };
  }

  /**
   * 合并多个管道段的决策结果，取最高风险等级
   *
   * 优先级: DENIED > MIXED(write) > NETWORK > READ_FS > READ_SYSTEM > UNKNOWN
   */
  private mergeDecisions(decisions: CommandDecision[]): CommandDecision {
    if (decisions.length === 0) {
      return { allowed: true, class: CommandClass.UNKNOWN, reason: '空命令' };
    }
    if (decisions.length === 1) {
      return decisions[0];
    }

    // 优先级映射
    const priority: Record<CommandClass, number> = {
      [CommandClass.DENIED]: 5,
      [CommandClass.MIXED]: 4,
      [CommandClass.NETWORK]: 3,
      [CommandClass.READ_FS]: 2,
      [CommandClass.READ_SYSTEM]: 1,
      [CommandClass.UNKNOWN]: 0,
    };

    let highest = decisions[0];
    for (let i = 1; i < decisions.length; i++) {
      const current = decisions[i];
      const currentPri = priority[current.class] ?? 0;
      const highestPri = priority[highest.class] ?? 0;

      // 如果有任何段被拒绝，整体拒绝
      if (!current.allowed) {
        return current;
      }

      if (currentPri > highestPri) {
        highest = current;
      }
    }

    return {
      allowed: highest.allowed,
      class: highest.class,
      reason: `管道命令包含多个段，综合分类: ${highest.class} — ${decisions.map((d) => d.reason).join(' | ')}`,
      matchedRule: highest.matchedRule,
    };
  }
}

// ============================================================
// 单例导出（方便全局使用）
// ============================================================

export const commandPolicyService = new CommandPolicyService();
