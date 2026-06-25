# GitHub Actions CI/CD 配置指南

## 📋 概述

本项目配置了三条 GitHub Actions 流水线，实现完整的 CI/CD 自动化：

| 流水线 | 文件 | 触发条件 | 功能 |
|--------|------|---------|------|
| **CI** | `ci.yml` | Push/PR 到 main | 代码质量检查（Lint + TypeScript + 测试） |
| **Release** | `release.yml` | 推送 tag (`v*`) 或手动触发 | 构建 Docker 镜像并推送至阿里云 |
| **Mirror** | `mirror.yml` | Push 到 main 或手动触发 | 自动同步代码到 Gitee/Gitcode |

---

## 🔐 配置 GitHub Secrets

进入仓库 **Settings → Secrets and variables → Actions**，添加以下 Secrets：

### 阿里云镜像仓库（必须）

| Secret 名称 | 值 | 说明 |
|-------------|-----|------|
| `ALIYUN_REGISTRY_USERNAME` | `huluwa666` | 阿里云容器镜像服务用户名 |
| `ALIYUN_REGISTRY_PASSWORD` | `你的密码` | 阿里云 Registry 登录密码（非阿里云账号密码） |

> 💡 获取路径：[容器镜像服务控制台](https://cr.console.aliyun.com/) → 左侧 "访问凭证" → 设置/查看密码

### Gitee 同步（可选）

| Secret 名称 | 值 | 说明 |
|-------------|-----|------|
| `GITEE_TOKEN` | 你的 Gitee Token | Gitee 个人访问令牌（PAT） |

> 💡 Gitee Token 获取：[Gitee 设置 → 私人令牌](https://gitee.com/profile/personal_access_tokens)
> 💡 Gitcode Token 获取：[Gitcode 设置 → 访问令牌](https://gitcode.com/-/user_settings/access_tokens)

---

## 🚀 使用方式

### 日常开发流程

```bash
# 1. 本地开发并提交
git add .
git commit -m "feat: your feature description"
git push origin main

# CI 自动触发：
# ✅ 代码 Lint 检查
# ✅ TypeScript 类型检查
# ✅ 单元测试运行
# ✅ Docker 镜像构建验证
# ✅ 代码自动同步到 Gitee/Gitcode
```

### 发布新版本

```bash
# 1. 更新版本号（CHANGELOG.md, README.md 等）
# 2. 打 tag 并推送
git tag -a v3.0.5 -m "Release v3.0.5: description"
git push origin v3.0.5

# Release 流水线自动触发：
# ✅ 质量门禁（Lint + 类型检查 + 测试 + 前端构建）
# ✅ 构建后端 Docker 镜像 → 推送阿里云（v3.0.5 + latest）
# ✅ 构建前端 Docker 镜像 → 推送阿里云（v3.0.5 + latest）
# ✅ 自动生成 GitHub Release 和 Release Notes
# ✅ 代码自动同步到 Gitee/Gitcode
```

### 手动触发 Release

进入 GitHub → Actions → Release (Build & Push Docker Images) → Run workflow

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `push_to_registry` | `true` | 是否推送镜像到阿里云 |
| `backend_tag` | `latest` | 后端镜像标签 |
| `frontend_tag` | `latest` | 前端镜像标签 |

---

## 📊 流水线架构图

```
git push origin main
         │
         ├──→ CI 流水线 ──→ Lint → TypeScript → Test → Docker Build (verify)
         │
         └──→ Mirror 流水线 ──→ Gitee 同步
                               └→ Gitcode 同步

git push origin v3.0.5
         │
         └──→ Release 流水线 ──→ 质量门禁 ──→ 构建后端镜像 ──→ 推送阿里云
                                   │
                                   └──→ 构建前端镜像 ──→ 推送阿里云
                                                           │
                                                           └──→ 创建 GitHub Release
```

---

## 📁 镜像标签策略

| 触发方式 | 后端标签 | 前端标签 |
|---------|---------|---------|
| `push main` | `latest` + commit sha | `latest` + commit sha |
| `push tag v3.0.5` | `v3.0.5` + `latest` + commit sha | `v3.0.5` + `latest` + commit sha |
| 手动触发 | 自定义标签 | 自定义标签 |

---

## ⚙️ 自定义配置

### 跳过 Mirror 同步

在 commit message 中包含 `[skip-mirror]` 即可跳过同步：

```bash
git commit -m "chore: update docs [skip-mirror]"
```

### 多架构构建

Release 流水线默认构建 `linux/amd64` 和 `linux/arm64` 两种架构。
如果只需要 amd64，可以在 `release.yml` 中修改 `platforms` 参数：

```yaml
platforms: linux/amd64
```

### 添加通知

在流水线末尾添加 Slack/Discord/企业微信通知：

```yaml
- name: Notify
  uses: slackapi/slack-github-action@v1
  with:
    channel-id: 'deployments'
    slack-message: "Release ${{ github.ref_name }} completed!"
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```
