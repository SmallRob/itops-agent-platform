# 告别半夜救火！用 AI 实现 Zabbix 告警自动诊断 + 自动修复，运维效率提升 10 倍

> 本文手把手教你搭建一套完整的 AI 智能运维系统：Zabbix 告警触发 → AI 自动诊断 → 生成修复方案 → 人工审批 → 自动执行修复 → 验证结果 → 失败自动回滚。全程开源，Docker 一键部署。

***

## 一、为什么要做这件事？

作为一个运维工程师，你一定经历过这些场景：

- 凌晨 3 点被电话叫醒：服务器 CPU 100% 了
- 同一台机器反复告警，每次都要手动登录排查
- 告警来了知道问题，但修复步骤记不住，还得翻文档
- 半夜处理完，第二天还要写故障报告

**传统运维的痛点**：

```
告警来了 → 手动登录服务器 → 查看日志/指标 → 分析问题
→ 翻文档找修复方案 → 手动执行命令 → 验证是否恢复 → 写报告
```

每一步都是人工操作，耗时、易出错、不可追溯。

**如果换成这样呢？**

```
告警来了 → AI 自动登录诊断 → 生成修复方案 → 推送到手机
→ 你点一下"通过" → 系统自动修复 → 自动验证 → 搞定
```

从 30 分钟缩短到 2 分钟，你只需要在手机上点一下。

***

## 二、项目介绍

**ITOps Agent Platform** 是一个开源的企业级 AI 运维自动化平台，核心能力：

| 能力         | 说明                                      |
| ---------- | --------------------------------------- |
| 多 Agent 协作 | 9 个预设运维 AI Agent，覆盖告警、诊断、巡检、变更等场景       |
| 可视化工作流     | 拖拽式编排，支持串行/并行/条件分支                      |
| 人工审批       | 关键操作需人工确认，支持超时自动拒绝                      |
| AI 自动修复    | 告警 → AI 分析 → 生成修复命令 → 审批 → 执行 → 验证 → 回滚 |
| 多模型支持      | 豆包/DeepSeek/通义千问/OpenAI/本地模型，数据可不出域     |
| 多渠道通知      | 飞书/企业微信/钉钉/Telegram/邮箱                  |

**GitHub 地址**：<https://github.com/qinshihu/itops-agent-platform>

**技术栈**：

| 层    | 技术                                   |
| ---- | ------------------------------------ |
| 前端   | React 18 + TypeScript + Tailwind CSS |
| 后端   | Node.js + Express + TypeScript       |
| 数据库  | SQLite（AES-256 加密）                   |
| 工作流  | @xyflow/react（拖拽编辑器）                 |
| 实时通信 | Socket.io                            |
| 部署   | Docker + Docker Compose              |

***

## 三、5 分钟部署

### 3.1 环境要求

- Docker 20.10+
- Docker Compose v2.0+
- 一台 2 核 4G 的服务器

### 3.2 一键部署

**Linux/macOS**：

```bash
curl -sL https://gitee.com/IT_Oline/itops-agent-platform/raw/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh
```

**Windows PowerShell**：

```powershell
Invoke-WebRequest -Uri "https://gitee.com/IT_Oline/itops-agent-platform/raw/main/deploy.ps1" -OutFile "deploy.ps1"
.\deploy.ps1
```

脚本会自动完成：环境检查 → 配置生成 → 镜像拉取 → 服务启动 → 健康验证。

### 3.3 手动部署（推荐学习）

```bash
# 1. 克隆项目
git clone https://github.com/qinshihu/itops-agent-platform.git
cd itops-agent-platform

# 2. 配置环境变量
cp .env.example .env
```

编辑 `.env` 文件，**必须修改**以下配置：

```bash
# 【必填】JWT 密钥，用强随机字符串
JWT_SECRET=$(openssl rand -hex 32)

# 【必填】至少配置一个 AI 模型
DOUBAO_API_KEY=你的豆包API密钥
# 或者
OPENAI_API_KEY=你的OpenAI密钥
```

```bash
# 3. 启动服务
docker-compose up -d

# 4. 验证
docker-compose ps
# 确认 backend 和 frontend 都是 Up 状态

curl http://localhost:3001/health
# 预期输出: {"status":"healthy"}
```

### 3.4 访问系统

- **前端**：<http://你的服务器IP:8080>
- **默认账号**：admin / admin
- 首次登录会强制修改密码

***

## 四、配置 Zabbix 告警自动修复（核心教程）

这是本文的重点。配置完成后，Zabbix 告警会自动触发 AI 诊断和修复。

### 4.1 整体架构

```
Zabbix 告警
    │
    ▼ Webhook POST
ITOps 平台接收告警
    │
    ▼ 自动
根据告警 IP 匹配设备 → SSH 登录诊断 → AI 分析根因
    │
    ▼ 自动
生成修复方案 → 创建审批请求 → 推送通知到企微/钉钉
    │
    ▼ 等待人工
运维人员在手机上点击"通过"
    │
    ▼ 自动
执行修复命令 → 验证修复结果
    │
    ├── 成功 → 通知 + 审计日志
    └── 失败 → 自动回滚 → 通知 + 审计日志
```

### 4.2 第一步：配置 Zabbix Webhook

登录 Zabbix 管理界面：

**1. 创建报警媒介类型**

路径：**管理 → 报警媒介类型 → 创建**

| 配置项  | 值                                              |
| ---- | ---------------------------------------------- |
| 名称   | `ITOps Webhook`                                |
| 类型   | `Webhook`                                      |
| URL  | `http://<ITOps服务器IP>:3001/api/webhooks/zabbix` |
| 请求方法 | `POST`                                         |

**参数**（点击"添加"逐条填写）：

| 名称          | 值                           |
| ----------- | --------------------------- |
| alertid     | `{ALERT.ID}`                |
| host        | `{HOST.NAME}`               |
| ip          | `{HOST.IP}`                 |
| trigger     | `{TRIGGER.NAME}`            |
| severity    | `{TRIGGER.SEVERITY}`        |
| value       | `{TRIGGER.VALUE}`           |
| event\_id   | `{EVENT.ID}`                |
| time        | `{EVENT.DATE} {EVENT.TIME}` |
| description | `{TRIGGER.DESCRIPTION}`     |

**2. 创建告警动作**

路径：**配置 → 动作 → 创建动作**

- **条件**：
  - 触发器严重程度 >= "平均"（过滤掉信息级别告警）
  - 触发器值 = "问题"（只处理 PROBLEM，不处理 RECOVERY）
- **操作**：
  - 发送到用户组：选择运维组
  - 仅送到：选择 `ITOps Webhook` 媒介类型

### 4.3 第二步：配置 ITOps 平台

编辑 `.env` 文件，添加以下配置：

```bash
# ============================
# Webhook 安全配置
# ============================
# Zabbix 服务器 IP（多个用逗号分隔，支持 CIDR）
WEBHOOK_IP_WHITELIST=192.168.1.100,10.0.0.0/8

# Webhook 签名密钥（与 Zabbix 端保持一致）
WEBHOOK_SECRET=my-secret-key-123

# ============================
# AI 模型配置（至少配一个）
# ============================
DOUBAO_API_KEY=你的豆包API密钥
DOUBAO_MODEL_ID=ep-xxxx

# ============================
# 通知渠道配置（至少配一个）
# ============================
# 企业微信
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key

# 钉钉
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=你的token

# 邮箱
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=alert@example.com
SMTP_PASSWORD=你的密码
NOTIFICATION_EMAIL=admin@example.com
```

修改后重启服务：

```bash
docker-compose restart
```

### 4.4 第三步：添加目标设备

这一步非常关键。AI 分析时需要根据告警 IP 找到对应设备，用 SSH 登录执行诊断命令。

**添加服务器**：

1. 登录 ITOps 前端 → 进入 **服务器管理** 页面
2. 点击 **添加服务器**
3. 填写：

| 字段     | 说明                                      |
| ------ | --------------------------------------- |
| 名称     | 如 `Web服务器01`                            |
| IP 地址  | 如 `192.168.1.50`（必须与 Zabbix 告警中的 IP 一致） |
| SSH 端口 | 默认 22                                   |
| 用户名    | 如 `root`                                |
| 认证方式   | 密码 或 SSH 密钥                             |
| 密码/密钥  | 填写 SSH 登录凭证                             |

> **重要**：IP 地址必须与 Zabbix 告警中的 `{HOST.IP}` 一致，否则系统无法匹配设备。

**添加网络设备**（可选）：

路径：**网络设备管理 → 添加设备**

支持华为、思科、H3C、锐捷、中兴等厂商，系统会自动适配各厂商的诊断命令。

### 4.5 第四步：测试验证

#### 4.5.1 模拟告警

在 Zabbix 中手动触发一个测试告警，或者用 curl 模拟：

```bash
curl -X POST http://localhost:3001/api/webhooks/zabbix \
  -H "Content-Type: application/json" \
  -d '{
    "alertid": "test-001",
    "host": "Web服务器01",
    "ip": "192.168.1.50",
    "trigger": "CPU使用率超过90%",
    "severity": "high",
    "value": "1",
    "event_id": "12345",
    "time": "2026-06-15 10:00:00",
    "description": "服务器CPU使用率持续超过90%，当前值95%"
  }'
```

#### 4.5.2 观察日志

```bash
# 查看后端实时日志
docker-compose logs -f backend
```

你应该看到类似输出：

```
[Webhook] Received Zabbix alert: CPU使用率超过90%
[AlertService] Alert created: id=xxx, severity=high
[AlertAutoAnalyzer] Starting auto analysis for alert xxx
[AlertAutoAnalyzer] Found device: Web服务器01 (192.168.1.50)
[SSHService] Connected to 192.168.1.50:22
[AlertAutoAnalyzer] Running diagnostic commands...
[LLMService] Analyzing with model: doubao-pro
[AI Remediation] Created record xxx for alert xxx
[AI Remediation] Workflow created: 审批 → 执行 → 验证
[Notification] Sent approval request to WeChat
```

#### 4.5.3 审批修复

1. 打开前端 → **审批中心** 页面
2. 看到待审批的修复请求
3. 查看 AI 分析结果和修复方案
4. 点击 **通过**

审批通过后，系统自动：

- SSH 登录目标服务器
- 执行修复命令
- 验证修复结果
- 发送通知 + 记录审计日志

***

## 五、实战案例

### 案例 1：CPU 使用率过高

**告警**：`CPU使用率超过90%，持续5分钟`

**AI 诊断过程**：

1. SSH 登录服务器
2. 执行 `top -bn1 | head -20` 查看进程
3. 执行 `uptime` 查看负载
4. 发现 Java 进程（PID: 12345）占用 95% CPU

**AI 分析结果**：

```
根因：Java 进程 PID 12345 CPU 占用异常，疑似死循环或 GC 频繁
影响：服务器整体响应变慢，可能影响业务
```

**AI 修复方案**：

```bash
# 1. 终止异常进程
kill -9 12345
# 2. 重启服务
systemctl restart myapp
# 3. 确认服务正常
systemctl status myapp
```

**验证命令**（自动生成）：

```bash
uptime
top -bn1 | head -5
systemctl status myapp
```

### 案例 2：磁盘空间不足

**告警**：`根分区磁盘使用率超过90%`

**AI 诊断过程**：

1. 执行 `df -h` 查看磁盘使用
2. 执行 `du -sh /var/log/* | sort -rh | head -10` 查找大文件
3. 发现 `/var/log/app.log` 占用 15GB

**AI 修复方案**：

```bash
# 1. 清理旧日志
find /var/log -name "*.log" -mtime +7 -delete
# 2. 截断当前日志
> /var/log/app.log
# 3. 检查磁盘空间
df -h
```

### 案例 3：Docker 容器异常

**告警**：`Docker容器 nginx 退出，状态 Exited(137)`

**AI 诊断过程**：

1. 执行 `docker ps -a --filter name=nginx` 查看容器状态
2. 执行 `docker logs nginx --tail 50` 查看日志
3. 发现 OOM Killed（内存不足被系统杀掉）

**AI 修复方案**：

```bash
# 1. 重启容器并限制内存
docker start nginx
# 2. 检查容器状态
docker ps --filter name=nginx
# 3. 检查系统内存
free -m
```

***

## 六、进阶配置

### 6.1 自定义修复策略

路径：**修复策略管理 → 新建策略**

可以针对特定告警模式配置固定的修复方案，跳过 AI 分析直接执行：

| 配置项  | 说明                        |
| ---- | ------------------------- |
| 策略名称 | 如 `Nginx 重启`              |
| 告警源  | zabbix                    |
| 告警级别 | high                      |
| 匹配模式 | `.*nginx.*down.*`（正则）     |
| 执行模式 | approval（审批后执行）           |
| 修复命令 | `systemctl restart nginx` |
| 验证命令 | `systemctl status nginx`  |
| 回滚命令 | `systemctl stop nginx`    |
| 冷却时间 | 300 秒（5 分钟内不重复触发）         |

### 6.2 配置审批超时

不同风险等级设置不同的审批超时时间：

| 风险等级 | 超时时间  | 超时行为 |
| ---- | ----- | ---- |
| 低风险  | 30 分钟 | 自动拒绝 |
| 中风险  | 1 小时  | 自动拒绝 |
| 高风险  | 2 小时  | 自动拒绝 |

### 6.3 本地部署 AI 模型（数据不出域）

如果对数据安全有要求，可以用本地模型：

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull qwen2.5:7b
```

在 `.env` 中配置：

```bash
LLM_API_BASE=http://host.docker.internal:11434/v1
LLM_MODEL=qwen2.5:7b
LLM_API_KEY=ollama
```

这样所有 AI 分析都在本地完成，数据不会发送到任何第三方。

***

## 七、常见问题

### Q1：告警收到了，但 AI 没有分析？

**排查步骤**：

1. 检查设备是否添加：告警 IP 必须在 `servers` 或 `network_devices` 表中
2. 检查 SSH 凭证：确保能正常连接
3. 检查 AI 模型配置：`LLM_API_KEY` 是否正确
4. 查看日志：`docker-compose logs -f backend | grep -i error`

### Q2：审批通知没收到？

1. 检查通知渠道配置：`.env` 中的 Webhook URL 是否正确
2. 测试通知：在系统 **设置 → 通知配置** 页面点击"测试发送"
3. 检查网络：服务器能否访问企微/钉钉的 API

### Q3：修复执行失败怎么办？

系统会自动回滚。回滚逻辑：

1. 验证节点检测到修复失败
2. 自动触发回滚节点
3. 执行回滚命令（如停止服务、恢复配置）
4. 发送回滚通知
5. 记录审计日志

### Q4：如何防止 AI 误操作？

系统有多层安全保护：

- **人工审批**：所有修复操作必须人工确认
- **命令白名单**：只允许安全的命令（systemctl/docker/sed 等）
- **危险命令拦截**：禁止 `rm -rf /`、管道注入等
- **自动回滚**：验证失败自动恢复
- **审计日志**：所有操作可追溯

### Q5：同一告警反复触发怎么办？

系统有冷却机制：

- 同一告警 5 分钟内不会重复分析
- 修复策略可配置冷却时间（默认 300 秒）
- 每小时最大执行次数限制（默认 5 次）

***

## 八、总结

通过本文的配置，你获得了一套完整的 AI 智能运维系统：

| 环节   | 之前              | 之后             |
| ---- | --------------- | -------------- |
| 告警响应 | 人工查看，分钟级        | 自动接收，秒级        |
| 问题诊断 | 手动登录排查，10-30 分钟 | AI 自动诊断，1-2 分钟 |
| 修复方案 | 翻文档/凭经验         | AI 自动生成        |
| 修复执行 | 手动操作            | 审批后自动执行        |
| 结果验证 | 手动检查            | 自动验证 + 回滚      |
| 审计追溯 | 靠记忆/手写          | 完整审计日志         |

**核心价值**：把运维工程师从"半夜救火"变成"手机点一下"。

***

**项目地址**：<https://github.com/qinshihu/itops-agent-platform>

**完整教程**：项目内置 28 章教学书籍，从入门到精通

**许可证**：MPL-2.0 开源

作者：谭策 2026-6-13
