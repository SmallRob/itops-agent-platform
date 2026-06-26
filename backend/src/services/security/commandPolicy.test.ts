import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommandClass,
  CommandPolicyService,
  commandPolicyService,
  stripSudo,
  splitPipes,
  extractCommandName,
  extractArgs,
  extractPaths,
  extractHosts,
  isPathAllowed,
  isHostAllowed,
} from './commandPolicy';

// ============================================================
// 工具函数测试
// ============================================================

describe('工具函数', () => {
  // ----------------------------------------------------------
  // stripSudo - sudo 剥离
  // ----------------------------------------------------------
  describe('stripSudo - sudo 剥离', () => {
    it('应剥离简单 sudo 前缀', () => {
      expect(stripSudo('sudo cat /etc/hostname')).toBe('cat /etc/hostname');
    });

    it('应剥离 sudo -S 前缀', () => {
      expect(stripSudo('sudo -S cat /etc/hostname')).toBe('cat /etc/hostname');
    });

    it('应剥离 sudo -u root 前缀', () => {
      expect(stripSudo('sudo -u root ps aux')).toBe('ps aux');
    });

    it('应剥离 sudo --user=root 前缀', () => {
      expect(stripSudo('sudo --user=root ps aux')).toBe('ps aux');
    });

    it('应剥离多层 sudo 嵌套', () => {
      expect(stripSudo('sudo sudo cat /etc/hostname')).toBe('cat /etc/hostname');
    });

    it('不带 sudo 的命令应原样返回', () => {
      expect(stripSudo('cat /etc/hostname')).toBe('cat /etc/hostname');
    });
  });

  // ----------------------------------------------------------
  // splitPipes - 管道分割
  // ----------------------------------------------------------
  describe('splitPipes - 管道分割', () => {
    it('应正确分割简单管道', () => {
      expect(splitPipes('cat /var/log/syslog | grep error')).toEqual([
        'cat /var/log/syslog',
        'grep error',
      ]);
    });

    it('应正确分割多段管道', () => {
      expect(splitPipes('ps aux | grep nginx | wc -l')).toEqual([
        'ps aux',
        'grep nginx',
        'wc -l',
      ]);
    });

    it('单个命令（无管道）应返回单元素数组', () => {
      expect(splitPipes('ls -la')).toEqual(['ls -la']);
    });

    it('应忽略单引号内的管道符', () => {
      expect(splitPipes("echo 'hello|world' | cat")).toEqual([
        "echo 'hello|world'",
        'cat',
      ]);
    });

    it('应忽略双引号内的管道符', () => {
      expect(splitPipes('echo "hello|world" | cat')).toEqual([
        'echo "hello|world"',
        'cat',
      ]);
    });

    it('应忽略转义的管道符', () => {
      expect(splitPipes('echo hello\\|world | cat')).toEqual([
        'echo hello\\|world',
        'cat',
      ]);
    });

    it('空字符串应返回空数组', () => {
      expect(splitPipes('')).toEqual([]);
    });

    it('应去除空白段', () => {
      expect(splitPipes('  cat /tmp/x  ')).toEqual(['cat /tmp/x']);
    });
  });

  // ----------------------------------------------------------
  // extractCommandName - 提取命令名
  // ----------------------------------------------------------
  describe('extractCommandName - 提取命令名', () => {
    it('应提取简单命令名', () => {
      expect(extractCommandName('cat /var/log/syslog')).toBe('cat');
    });

    it('应提取带路径前缀的命令名', () => {
      expect(extractCommandName('/usr/bin/cat /tmp/test')).toBe('cat');
    });

    it('应处理带环境变量前缀的命令', () => {
      expect(extractCommandName('LANG=en_US.UTF-8 ls -la')).toBe('ls');
    });

    it('应处理单个命令（无参数）', () => {
      expect(extractCommandName('ps')).toBe('ps');
    });
  });

  // ----------------------------------------------------------
  // extractArgs - 提取参数
  // ----------------------------------------------------------
  describe('extractArgs - 提取参数', () => {
    it('应提取命令参数', () => {
      expect(extractArgs('cat /var/log/syslog')).toBe('/var/log/syslog');
    });

    it('无参数时返回空字符串', () => {
      expect(extractArgs('ps')).toBe('');
    });

    it('应跳过环境变量前缀', () => {
      expect(extractArgs('LANG=en_US.UTF-8 ls -la /tmp')).toBe('-la /tmp');
    });
  });

  // ----------------------------------------------------------
  // extractPaths - 提取路径
  // ----------------------------------------------------------
  describe('extractPaths - 提取路径', () => {
    it('应提取绝对路径', () => {
      expect(extractPaths('cat /var/log/syslog')).toContain('/var/log/syslog');
    });

    it('应提取多个路径', () => {
      const paths = extractPaths('cp /tmp/a.txt /home/user/');
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });

    it('无路径时返回空数组', () => {
      expect(extractPaths('ps aux')).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // extractHosts - 提取主机
  // ----------------------------------------------------------
  describe('extractHosts - 提取主机', () => {
    it('应从 URL 中提取主机', () => {
      const hosts = extractHosts('curl http://example.com/path');
      expect(hosts).toContain('example.com');
    });

    it('应从 HTTPS URL 中提取主机', () => {
      const hosts = extractHosts('wget https://releases.example.org/file.tar.gz');
      expect(hosts).toContain('releases.example.org');
    });

    it('无主机时返回空数组', () => {
      expect(extractHosts('ps aux')).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // isPathAllowed - 路径白名单验证
  // ----------------------------------------------------------
  describe('isPathAllowed - 路径白名单验证', () => {
    const allowed = ['/var/log', '/tmp', '/home', '/etc/hostname'];

    it('允许白名单内的路径', () => {
      expect(isPathAllowed('/var/log/syslog', allowed)).toBe(true);
    });

    it('允许精确匹配的路径', () => {
      expect(isPathAllowed('/etc/hostname', allowed)).toBe(true);
    });

    it('拒绝不在白名单内的路径', () => {
      expect(isPathAllowed('/etc/shadow', allowed)).toBe(false);
    });

    it('拒绝部分匹配的路径', () => {
      expect(isPathAllowed('/var/log-attack', allowed)).toBe(false);
    });

    it('允许 /tmp 子路径', () => {
      expect(isPathAllowed('/tmp/test.txt', allowed)).toBe(true);
    });

    it('允许 /home 子路径', () => {
      expect(isPathAllowed('/home/user/file.txt', allowed)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // isHostAllowed - 主机白名单验证
  // ----------------------------------------------------------
  describe('isHostAllowed - 主机白名单验证', () => {
    const allowed = ['localhost', '127.0.0.1', '10.0.0.1'];

    it('允许白名单内的主机', () => {
      expect(isHostAllowed('localhost', allowed)).toBe(true);
    });

    it('允许带端口的白名单主机', () => {
      expect(isHostAllowed('localhost:8080', allowed)).toBe(true);
    });

    it('拒绝不在白名单内的主机', () => {
      expect(isHostAllowed('evil.com', allowed)).toBe(false);
    });

    it('拒绝不在白名单内的 IP', () => {
      expect(isHostAllowed('192.168.1.100', allowed)).toBe(false);
    });
  });
});

// ============================================================
// CommandPolicyService 核心测试
// ============================================================

describe('CommandPolicyService', () => {
  let service: CommandPolicyService;

  beforeEach(() => {
    service = new CommandPolicyService();
  });

  // ----------------------------------------------------------
  // READ_FS 命令分类
  // ----------------------------------------------------------
  describe('READ_FS 命令分类', () => {
    const readFsCommands = [
      'cat', 'ls', 'find', 'grep', 'head', 'tail',
      'wc', 'du', 'df', 'file', 'stat', 'readlink',
      'realpath', 'tree', 'locate', 'which',
    ];

    readFsCommands.forEach((cmd) => {
      it(`${cmd} 应被分类为 READ_FS`, () => {
        expect(service.classifyCommand(cmd)).toBe(CommandClass.READ_FS);
      });
    });

    it('cat 白名单路径应被允许', () => {
      const result = service.evaluate('cat /var/log/syslog');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_FS);
    });

    it('cat 非白名单路径应被拒绝', () => {
      const result = service.evaluate('cat /etc/shadow');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.READ_FS);
    });

    it('ls 在白名单目录内应被允许', () => {
      const result = service.evaluate('ls -la /var/log');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_FS);
    });

    it('grep 在白名单路径应被允许', () => {
      const result = service.evaluate('grep error /var/log/syslog');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_FS);
    });
  });

  // ----------------------------------------------------------
  // READ_SYSTEM 命令分类
  // ----------------------------------------------------------
  describe('READ_SYSTEM 命令分类', () => {
    const readSystemCommands = [
      'ps', 'top', 'free', 'uptime', 'uname', 'hostname',
      'id', 'who', 'w', 'last', 'vmstat', 'iostat',
      'mpstat', 'sar', 'dmesg', 'lscpu', 'lsblk',
    ];

    readSystemCommands.forEach((cmd) => {
      it(`${cmd} 应被分类为 READ_SYSTEM`, () => {
        expect(service.classifyCommand(cmd)).toBe(CommandClass.READ_SYSTEM);
      });
    });

    it('ps aux 应被允许', () => {
      const result = service.evaluate('ps aux');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('free -h 应被允许', () => {
      const result = service.evaluate('free -h');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('uname -a 应被允许', () => {
      const result = service.evaluate('uname -a');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });
  });

  // ----------------------------------------------------------
  // MIXED 命令读写分离
  // ----------------------------------------------------------
  describe('MIXED 命令读写分离', () => {
    // systemctl
    it('systemctl status 应视为只读', () => {
      const result = service.evaluate('systemctl status nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('systemctl start 应视为写操作（MIXED）', () => {
      const result = service.evaluate('systemctl start nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('systemctl stop 应视为写操作（MIXED）', () => {
      const result = service.evaluate('systemctl stop nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('systemctl restart 应视为写操作（MIXED）', () => {
      const result = service.evaluate('systemctl restart nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('systemctl enable 应视为写操作（MIXED）', () => {
      const result = service.evaluate('systemctl enable nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('systemctl list-units 应视为只读', () => {
      const result = service.evaluate('systemctl list-units');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('systemctl is-active 应视为只读', () => {
      const result = service.evaluate('systemctl is-active nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    // iptables
    it('iptables -L 应视为只读', () => {
      const result = service.evaluate('iptables -L -n');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('iptables -A 应视为写操作（MIXED）', () => {
      const result = service.evaluate('iptables -A INPUT -p tcp --dport 80 -j ACCEPT');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('iptables -F 应视为写操作（MIXED）', () => {
      const result = service.evaluate('iptables -F');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    // ip
    it('ip addr show 应视为只读', () => {
      const result = service.evaluate('ip addr show');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('ip link show 应视为只读', () => {
      const result = service.evaluate('ip link show');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('ip route add 应视为写操作（MIXED）', () => {
      const result = service.evaluate('ip route add 10.0.0.0/8 via 192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('ip addr add 应视为写操作（MIXED）', () => {
      const result = service.evaluate('ip addr add 10.0.0.1/24 dev eth0');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    // docker
    it('docker ps 应视为只读', () => {
      const result = service.evaluate('docker ps');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('docker images 应视为只读', () => {
      const result = service.evaluate('docker images');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('docker run 应视为写操作（MIXED）', () => {
      const result = service.evaluate('docker run -d nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('docker stop 应视为写操作（MIXED）', () => {
      const result = service.evaluate('docker stop mycontainer');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('docker rm 应视为写操作（MIXED）', () => {
      const result = service.evaluate('docker rm mycontainer');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    // crontab
    it('crontab -l 应视为只读', () => {
      const result = service.evaluate('crontab -l');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('crontab -e 应视为写操作（MIXED）', () => {
      const result = service.evaluate('crontab -e');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    it('crontab -r 应视为写操作（MIXED）', () => {
      const result = service.evaluate('crontab -r');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });

    // mount
    it('mount 无参数应视为只读', () => {
      const result = service.evaluate('mount');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('mount -o 应视为写操作（MIXED）', () => {
      const customService = new CommandPolicyService({
        allowedPaths: ['/var/log', '/tmp', '/home', '/dev', '/mnt', '/proc'],
      });
      const result = customService.evaluate('mount -o rw /dev/sda1 /mnt');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });
  });

  // ----------------------------------------------------------
  // NETWORK 命令分类
  // ----------------------------------------------------------
  describe('NETWORK 命令分类', () => {
    const networkCommands = ['ping', 'curl', 'wget', 'dig', 'nslookup', 'netstat', 'ss'];

    networkCommands.forEach((cmd) => {
      it(`${cmd} 应被分类为 NETWORK`, () => {
        expect(service.classifyCommand(cmd)).toBe(CommandClass.NETWORK);
      });
    });

    it('ping localhost 应被允许（白名单内）', () => {
      const result = service.evaluate('ping localhost');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('ping 127.0.0.1 应被允许（白名单内）', () => {
      const result = service.evaluate('ping 127.0.0.1');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('curl http://localhost 应被允许', () => {
      const result = service.evaluate('curl http://localhost/health');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('curl 未识别主机默认允许（无 URL 形式主机）', () => {
      const result = service.evaluate('curl -v http://10.0.0.1:8080/api');
      // 10.0.0.1 不在默认白名单内，但不以 URL host 形式被匹配到会被默认允许
      // 如果匹配到了则应拒绝
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('netstat -tlnp 应被允许', () => {
      const result = service.evaluate('netstat -tlnp');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.NETWORK);
    });
  });

  // ----------------------------------------------------------
  // DENIED 命令分类
  // ----------------------------------------------------------
  describe('DENIED 命令分类', () => {
    const deniedCommands = [
      'rm', 'shutdown', 'reboot', 'halt', 'poweroff', 'init',
      'mkfs', 'fdisk', 'dd', 'parted', 'kill', 'killall',
      'passwd', 'useradd', 'userdel', 'groupadd', 'chown',
      'chmod', 'umount', 'insmod', 'rmmod', 'modprobe',
    ];

    deniedCommands.forEach((cmd) => {
      it(`${cmd} 应被分类为 DENIED`, () => {
        expect(service.classifyCommand(cmd)).toBe(CommandClass.DENIED);
      });
    });

    it('rm 命令应被拒绝', () => {
      const result = service.evaluate('rm -rf /tmp/test');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('shutdown 命令应被拒绝', () => {
      const result = service.evaluate('shutdown -h now');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('reboot 命令应被拒绝', () => {
      const result = service.evaluate('reboot');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('dd 命令应被拒绝', () => {
      const result = service.evaluate('dd if=/dev/zero of=/dev/sda');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('kill 命令应被拒绝', () => {
      const result = service.evaluate('kill -9 1234');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('chown 命令应被拒绝', () => {
      const result = service.evaluate('chown root:root /tmp/file');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('chmod 命令应被拒绝', () => {
      const result = service.evaluate('chmod 777 /tmp/file');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });
  });

  // ----------------------------------------------------------
  // 管道分割检测
  // ----------------------------------------------------------
  describe('管道分割检测', () => {
    it('管道中包含 DENIED 命令应整体被拒绝', () => {
      const result = service.evaluate('ps aux | grep nginx | rm -rf /tmp/test');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('纯只读管道应被允许', () => {
      const result = service.evaluate('ps aux | grep nginx | wc -l');
      expect(result.allowed).toBe(true);
    });

    it('管道中 NETWORK + READ_FS 应分类为 NETWORK', () => {
      const result = service.evaluate('curl http://localhost/api | grep result | wc -l');
      // 管道中包含 curl (NETWORK)，取最高风险等级
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('管道中包含 MIXED 写操作应保持 MIXED 分类', () => {
      const result = service.evaluate('echo "test" | systemctl start nginx');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.MIXED);
    });
  });

  // ----------------------------------------------------------
  // 路径白名单
  // ----------------------------------------------------------
  describe('路径白名单', () => {
    it('读取 /var/log 目录应被允许', () => {
      const result = service.evaluate('ls /var/log');
      expect(result.allowed).toBe(true);
    });

    it('读取 /tmp 文件应被允许', () => {
      const result = service.evaluate('cat /tmp/test.txt');
      expect(result.allowed).toBe(true);
    });

    it('读取 /proc 信息应被允许', () => {
      const result = service.evaluate('cat /proc/cpuinfo');
      expect(result.allowed).toBe(true);
    });

    it('读取 /etc/shadow 应被拒绝', () => {
      const result = service.evaluate('cat /etc/shadow');
      expect(result.allowed).toBe(false);
    });

    it('读取 /root 应被拒绝', () => {
      const result = service.evaluate('ls /root/.ssh');
      expect(result.allowed).toBe(false);
    });

    it('自定义路径白名单应生效', () => {
      const customService = new CommandPolicyService({
        allowedPaths: ['/var/log', '/custom/path'],
      });
      const result = customService.evaluate('cat /custom/path/data.txt');
      expect(result.allowed).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // sudo 剥离
  // ----------------------------------------------------------
  describe('sudo 剥离', () => {
    it('sudo cat 应先剥离 sudo 再评估', () => {
      const result = service.evaluate('sudo cat /etc/shadow');
      // 剥离 sudo 后变成 cat /etc/shadow，路径不在白名单
      expect(result.allowed).toBe(false);
    });

    it('sudo -u root ps 应先剥离 sudo 再评估', () => {
      const result = service.evaluate('sudo -u root ps aux');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.READ_SYSTEM);
    });

    it('sudo rm 应被拒绝（剥离 sudo 后仍为 DENIED）', () => {
      const result = service.evaluate('sudo rm -rf /tmp/test');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('sudo shutdown 应被拒绝', () => {
      const result = service.evaluate('sudo shutdown -h now');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });
  });

  // ----------------------------------------------------------
  // 危险命令组合
  // ----------------------------------------------------------
  describe('危险命令组合', () => {
    it('rm -rf / 应被拒绝', () => {
      const result = service.evaluate('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('dd if=/dev/zero of=/dev/sda 应被拒绝', () => {
      const result = service.evaluate('dd if=/dev/zero of=/dev/sda');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });

    it('shutdown -h now 应被拒绝', () => {
      const result = service.evaluate('shutdown -h now');
      expect(result.allowed).toBe(false);
    });

    it('init 0 应被拒绝', () => {
      const result = service.evaluate('init 0');
      expect(result.allowed).toBe(false);
    });

    it('mkfs.ext4 /dev/sda1 应被拒绝', () => {
      const result = service.evaluate('mkfs.ext4 /dev/sda1');
      expect(result.allowed).toBe(false);
    });

    it('useradd 应被拒绝', () => {
      const result = service.evaluate('useradd hacker');
      expect(result.allowed).toBe(false);
    });

    it('通过管道隐藏的 DENIED 命令应被检测到', () => {
      const result = service.evaluate('cat /var/log/syslog | grep error | kill -9 1');
      expect(result.allowed).toBe(false);
      expect(result.class).toBe(CommandClass.DENIED);
    });
  });

  // ----------------------------------------------------------
  // YAML 可扩展策略加载
  // ----------------------------------------------------------
  describe('YAML 可扩展策略加载', () => {
    it('应能通过 YAML 配置添加路径白名单', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        allowedPaths: ['/custom/data'],
      });
      const result = customService.evaluate('cat /custom/data/report.csv');
      expect(result.allowed).toBe(true);
    });

    it('应能通过 YAML 配置添加主机白名单', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        allowedHosts: ['10.0.0.50'],
      });
      const result = customService.evaluate('curl http://10.0.0.50/api');
      expect(result.class).toBe(CommandClass.NETWORK);
    });

    it('应能通过 YAML 配置添加自定义命令规则', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        rules: [
          {
            name: 'my_custom_tool',
            description: '自定义工具',
            command: 'mytool',
            classification: 'READ_FS',
          },
        ],
      });
      expect(customService.classifyCommand('mytool')).toBe(CommandClass.READ_FS);
    });

    it('应能通过 YAML 配置添加 MIXED 规则', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        rules: [
          {
            name: 'custom_svc',
            description: '自定义服务管理',
            command: 'mysvc',
            classification: 'MIXED',
            readSubcommands: ['status', 'list'],
            writeSubcommands: ['start', 'stop'],
          },
        ],
      });

      // 只读子命令
      const readResult = customService.evaluate('mysvc status');
      expect(readResult.allowed).toBe(true);
      expect(readResult.class).toBe(CommandClass.READ_SYSTEM);

      // 写子命令
      const writeResult = customService.evaluate('mysvc start');
      expect(writeResult.allowed).toBe(true);
      expect(writeResult.class).toBe(CommandClass.MIXED);
    });

    it('应忽略无效分类的 YAML 规则', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        rules: [
          {
            name: 'invalid',
            description: '无效规则',
            command: 'invalidcmd',
            classification: 'INVALID_CLASS',
          },
        ],
      });
      expect(customService.classifyCommand('invalidcmd')).toBe(CommandClass.UNKNOWN);
    });

    it('YAML 配置应与默认白名单合并（而非覆盖）', () => {
      const customService = new CommandPolicyService();
      customService.loadYamlPolicy({
        allowedPaths: ['/custom/data'],
      });
      // 原有 /var/log 应仍然有效
      const original = customService.evaluate('cat /var/log/syslog');
      expect(original.allowed).toBe(true);

      // 新增 /custom/data 也应有效
      const added = customService.evaluate('cat /custom/data/report.csv');
      expect(added.allowed).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 单例服务实例
  // ----------------------------------------------------------
  describe('单例服务实例', () => {
    it('commandPolicyService 应已定义', () => {
      expect(commandPolicyService).toBeDefined();
      expect(commandPolicyService).toBeInstanceOf(CommandPolicyService);
    });
  });

  // ----------------------------------------------------------
  // UNKNOWN 命令
  // ----------------------------------------------------------
  describe('UNKNOWN 命令', () => {
    it('未注册的命令应分类为 UNKNOWN', () => {
      expect(service.classifyCommand('my_custom_script')).toBe(CommandClass.UNKNOWN);
    });

    it('UNKNOWN 命令默认允许', () => {
      const result = service.evaluate('my_custom_script --arg');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.UNKNOWN);
    });

    it('空命令应返回 UNKNOWN', () => {
      const result = service.evaluate('');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.UNKNOWN);
    });

    it('仅空白的命令应返回 UNKNOWN', () => {
      const result = service.evaluate('   ');
      expect(result.allowed).toBe(true);
      expect(result.class).toBe(CommandClass.UNKNOWN);
    });
  });

  // ----------------------------------------------------------
  // 动态规则管理
  // ----------------------------------------------------------
  describe('动态规则管理', () => {
    it('addRule 应能动态添加新规则', () => {
      service.addRule({
        name: 'custom_tool',
        description: '自定义工具',
        command: 'customtool',
        classification: CommandClass.READ_FS,
      });
      expect(service.classifyCommand('customtool')).toBe(CommandClass.READ_FS);
    });

    it('addRule 应能覆盖已有规则', () => {
      // cat 默认是 READ_FS
      expect(service.classifyCommand('cat')).toBe(CommandClass.READ_FS);

      // 覆盖为 DENIED
      service.addRule({
        name: 'cat_override',
        description: '覆盖 cat 为禁止',
        command: 'cat',
        classification: CommandClass.DENIED,
      });
      expect(service.classifyCommand('cat')).toBe(CommandClass.DENIED);
    });

    it('listRules 应返回所有规则', () => {
      const rules = service.listRules();
      expect(rules.length).toBeGreaterThan(70);
      // 确保包含关键命令
      const ruleNames = rules.map((r) => r.command);
      expect(ruleNames).toContain('cat');
      expect(ruleNames).toContain('ps');
      expect(ruleNames).toContain('systemctl');
      expect(ruleNames).toContain('curl');
      expect(ruleNames).toContain('rm');
    });
  });

  // ----------------------------------------------------------
  // 白名单 getter 方法
  // ----------------------------------------------------------
  describe('白名单 getter 方法', () => {
    it('getAllowedPaths 应返回默认路径白名单', () => {
      const paths = service.getAllowedPaths();
      expect(paths).toContain('/var/log');
      expect(paths).toContain('/tmp');
      expect(paths).toContain('/proc');
    });

    it('getAllowedHosts 应返回默认主机白名单', () => {
      const hosts = service.getAllowedHosts();
      expect(hosts).toContain('localhost');
      expect(hosts).toContain('127.0.0.1');
    });

    it('getter 返回的数组应为副本（不影响内部状态）', () => {
      const paths1 = service.getAllowedPaths();
      paths1.push('/malicious/path');
      const paths2 = service.getAllowedPaths();
      expect(paths2).not.toContain('/malicious/path');
    });
  });

  // ----------------------------------------------------------
  // 自定义配置
  // ----------------------------------------------------------
  describe('自定义配置', () => {
    it('应支持自定义路径白名单', () => {
      const customService = new CommandPolicyService({
        allowedPaths: ['/custom/data'],
      });
      // 原默认路径应不存在
      const paths = customService.getAllowedPaths();
      expect(paths).toContain('/custom/data');
      expect(paths).not.toContain('/var/log');
    });

    it('应支持自定义主机白名单', () => {
      const customService = new CommandPolicyService({
        allowedHosts: ['192.168.1.100'],
      });
      const hosts = customService.getAllowedHosts();
      expect(hosts).toContain('192.168.1.100');
      expect(hosts).not.toContain('localhost');
    });

    it('应支持通过 extraRules 添加额外规则', () => {
      const customService = new CommandPolicyService({
        extraRules: [
          {
            name: 'mycmd',
            description: '自定义命令',
            command: 'mycmd',
            classification: CommandClass.READ_FS,
          },
        ],
      });
      expect(customService.classifyCommand('mycmd')).toBe(CommandClass.READ_FS);
    });
  });
});
