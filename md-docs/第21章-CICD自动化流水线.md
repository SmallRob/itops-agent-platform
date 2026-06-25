# 第二十一章 CI/CD自动化流水线

## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="../../frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策

## 本章导读

CI/CD（持续集成/持续交付）是现代软件工程的基石。ITOps Agent Platform 使用 GitHub Actions 构建了完整的自动化流水线，涵盖代码质量检查、测试验证、Docker 镜像构建、镜像仓库推送和发布说明生成。本章将深入分析项目的三个 GitHub Actions 工作流文件，帮助你理解从零到发布的完整 CI/CD 链路。

## 学习目标

- 掌握 GitHub Actions 的基本概念和工作流结构
- 理解项目的 CI 流水线：代码检查、类型检查、测试验证
- 掌握 Release 流水线：质量门禁、镜像构建、镜像推送、版本发布
- 学会配置 GitHub Secrets 和环境变量
- 理解代码镜像同步机制
- 能够自行扩展和优化 CI/CD 流水线

## 核心内容

### 21.1 GitHub Actions 概览

项目包含三个工作流文件，各自承担不同的 CI/CD 职责：

| 工作流文件 | 触发条件 | 主要职责 |
|-----------|----------|----------|
| `ci.yml` | push/PR 到 main | 代码质量验证（lint + test + build） |
| `release.yml` | 打 tag 或手动触发 | 构建 Docker 镜像并推送到阿里云镜像仓库 |
| `mirror.yml` | push 到 main/master | 代码同步到 Gitee 和 GitCode |

**工作流文件位置：**

```
.github/
└── workflows/
    ├── ci.yml          # 持续集成
    ├── release.yml     # 发布流水线
    └── mirror.yml      # 代码镜像同步
```

### 21.2 CI 流水线：ci.yml

CI 流水线是代码合并前的质量闸门，确保每次提交都通过基础检查。

```yaml
name: CI (Build + Lint + Test)

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:  # 支持手动触发

jobs:
  backend-lint:
    name: Backend Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - working-directory: ./backend
        run: npm ci
      - working-directory: ./backend
        run: npx tsc --noEmit           # TypeScript 类型检查
      - working-directory: ./backend
        run: npm run lint --if-present
        continue-on-error: true          # Lint 不阻塞流水线

  frontend-lint:
    name: Frontend Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - working-directory: ./frontend
        run: npm ci
      - working-directory: ./frontend
        run: npx tsc --noEmit
      - working-directory: ./frontend
        run: npm run lint --if-present
        continue-on-error: true

  backend-test:
    name: Backend Test
    runs-on: ubuntu-latest
    needs: [backend-lint]               # 依赖 lint 通过
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - working-directory: ./backend
        run: npm ci
      - working-directory: ./backend
        run: npm test --if-present
        env:
          JWT_SECRET: test-secret-for-ci
          DOUBAO_API_KEY: test-api-key

  frontend-build:
    name: Frontend Build
    runs-on: ubuntu-latest
    needs: [frontend-lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - working-directory: ./frontend
        run: npm ci
      - working-directory: ./frontend
        run: npm run build

  docker-build:
    name: Docker Build (Verify)
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-build]
    if: github.event_name == 'pull_request'  # 仅 PR 时验证
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.backend
          push: false                        # 不推送
          load: true                         # 加载到本地
          tags: itops-backend:ci-test
          cache-from: type=gha               # 使用 GitHub Actions 缓存
          cache-to: type=gha,mode=max
```

**CI 流水线执行图：**

```
push / PR
  │
  ├─▶ backend-lint ─────────┐
  │                          ▼
  │                    backend-test ──┐
  │                                   ▼
  ├─▶ frontend-lint ──────────┐  docker-build (仅 PR)
  │                           ▼
  │                    frontend-build ──┘
  │
  └─▶ 全部通过 → 代码可合并
```

**关键设计决策：**

| 决策 | 说明 |
|------|------|
| `cache: 'npm'` | 缓存 node_modules，加速依赖安装 |
| `continue-on-error: true` | Lint 不阻塞流水线，作为参考 |
| `needs` 依赖 | 确保 lint 先于 test 执行，尽早发现低级错误 |
| PR 时验证 Docker 构建 | 确保 Dockerfile 变更不会导致构建失败 |
| `cache-from: type=gha` | 利用 GitHub Actions 缓存加速 Docker 层构建 |

### 21.3 Release 流水线：release.yml

Release 流水线是项目的发布引擎，包含四个阶段：质量门禁、后端构建、前端构建、发布说明。

```yaml
name: Release (Build & Push Docker Images)

on:
  push:
    tags:
      - 'v*'                    # 打 v3.0.5 这样的 tag 时触发
  workflow_dispatch:
    inputs:
      push_to_registry:
        description: 'Push to Aliyun registry'
        type: boolean
        default: true
      backend_tag:
        description: 'Backend image tag'
        type: string
        default: 'latest'
      frontend_tag:
        description: 'Frontend image tag'
        type: string
        default: 'latest'

env:
  ALIYUN_REGISTRY: registry.cn-hangzhou.aliyuncs.com
  ALIYUN_NAMESPACE: huluwa666
  ALIYUN_REPO: tsq-images-hub
  IMAGE_PREFIX: IT_Onlin-ITOps
```

**Phase 1: 质量门禁**

```yaml
  quality-gates:
    name: Quality Gates
    runs-on: ubuntu-latest
    continue-on-error: true
    outputs:
      backend_ok: ${{ steps.backend-check.outputs.ok }}
      frontend_ok: ${{ steps.frontend-check.outputs.ok }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json
      - working-directory: ./backend
        run: npm ci
      - working-directory: ./frontend
        run: npm ci
      - working-directory: ./backend
        run: npx tsc --noEmit
      - working-directory: ./frontend
        run: npx tsc --noEmit
      - working-directory: ./frontend
        run: npm run build
      - working-directory: ./backend
        run: npm test --if-present
        continue-on-error: true
        env:
          JWT_SECRET: test-secret-for-ci
          DOUBAO_API_KEY: test-api-key
```

**Phase 2 & 3: 构建并推送 Docker 镜像**

```yaml
  build-backend:
    name: Build & Push Backend
    needs: [quality-gates]
    runs-on: ubuntu-latest
    if: always() && (github.event_name == 'workflow_dispatch' && inputs.push_to_registry || startsWith(github.ref, 'refs/tags/'))
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3         # 多平台支持
      - uses: docker/setup-buildx-action@v3        # Buildx 构建引擎
      - uses: docker/login-action@v3               # 登录阿里云镜像仓库
        with:
          registry: ${{ env.ALIYUN_REGISTRY }}
          username: ${{ secrets.ALIYUN_REGISTRY_USERNAME }}
          password: ${{ secrets.ALIYUN_REGISTRY_PASSWORD }}

      - id: version
        run: |
          if [[ "${{ github.ref_type }}" == "tag" ]]; then
            echo "version=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
          else
            echo "version=${{ inputs.backend_tag }}" >> $GITHUB_OUTPUT
          fi

      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.backend
          push: true
          platforms: linux/amd64
          tags: |
            registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-${{ steps.version.outputs.version }}
            registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
            registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Phase 4: 自动生成发布说明**

```yaml
  release-notes:
    name: Create Release Notes
    needs: [build-backend, build-frontend]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0                      # 获取完整 git 历史

      - id: notes
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          echo "## Release $VERSION" > release_notes.md
          echo "### Docker Images" >> release_notes.md
          echo "| Component | Image |" >> release_notes.md
          echo "|-----------|-------|" >> release_notes.md
          echo "| Backend | \`${{ env.IMAGE_PREFIX }}-backend-${VERSION}\` |" >> release_notes.md
          echo "| Frontend | \`${{ env.IMAGE_PREFIX }}-frontend-${VERSION}\` |" >> release_notes.md

          # 获取自上一个 tag 以来的变更
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$PREV_TAG" ]; then
            git log ${PREV_TAG}..HEAD --pretty=format:"* %s (%h)" >> release_notes.md
          else
            git log -20 --pretty=format:"* %s (%h)" >> release_notes.md
          fi

      - uses: softprops/action-gh-release@v1
        with:
          body_path: release_notes.md
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Release 流水线执行图：**

```
tag push (v3.0.5) 或 workflow_dispatch
        │
        ▼
  ┌──────────────┐
  │ Phase 1      │  质量门禁：tsc + build + test
  │ Quality Gates│
  └──────┬───────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────┐
│ Phase 2 │ │ Phase 3  │  并行构建
│ Backend │ │ Frontend │
│ Build   │ │ Build    │
│ + Push  │ │ + Push   │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ▼
  ┌──────────────┐
  │ Phase 4      │  生成 Release Notes
  │ Release Notes│  创建 GitHub Release
  └──────────────┘
```

**镜像标签策略：**

| 标签 | 示例 | 用途 |
|------|------|------|
| 版本 tag | `IT_Onlin-ITOps-backend-v3.0.5` | 固定版本，不可变 |
| latest | `IT_Onlin-ITOps-backend-latest` | 最新版本，每次覆盖 |
| commit SHA | `IT_Onlin-ITOps-backend-abc1234` | 精确对应代码提交 |

### 21.4 代码镜像同步：mirror.yml

```yaml
name: Mirror to Gitee & Gitcode

on:
  push:
    branches: [main, master]
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  mirror:
    name: Mirror Code
    runs-on: ubuntu-latest
    if: github.repository == 'qinshihu/itops-agent-platform'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Git
        run: |
          git config --global user.name "qinshihu"
          git config --global user.email "huawei_network@foxmail.com"

      - name: Push to Gitee
        env:
          GITEE_TOKEN: ${{ secrets.GITEE_TOKEN }}
        run: |
          git remote add gitee https://oauth2:${GITEE_TOKEN}@gitee.com/IT_Oline/itops-agent-platform.git
          git push gitee main --force
          git push gitee --tags --force

      - name: Push to Gitcode
        env:
          GITCODE_TOKEN: ${{ secrets.GITCODE_TOKEN }}
        run: |
          git remote add gitcode https://oauth2:${GITCODE_TOKEN}@gitcode.com/gcw_IM7aAihp/itops-agent-platform.git
          git push gitcode main --force
          git push gitcode --tags --force
```

**代码同步架构：**

```
      ┌───────────────────┐
      │    GitHub (主)     │
      │  qinshihu/itops-  │
      │  agent-platform   │
      └─────────┬─────────┘
                │ push to main/tag
                ▼
      ┌───────────────────┐
      │  mirror.yml       │
      │  (GitHub Actions) │
      └────┬──────────┬───┘
           │          │
           ▼          ▼
  ┌─────────────┐ ┌─────────────┐
  │   Gitee     │ │   GitCode   │
  │  (国内镜像)  │ │  (国内镜像)  │
  └─────────────┘ └─────────────┘
```

### 21.5 Secrets 与环境变量配置

**必需的 GitHub Secrets：**

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `ALIYUN_REGISTRY_USERNAME` | 阿里云镜像仓库用户名 | 阿里云容器镜像服务控制台 |
| `ALIYUN_REGISTRY_PASSWORD` | 阿里云镜像仓库密码 | 创建个人实例访问凭证 |
| `GITHUB_TOKEN` | GitHub 自动提供 | 无需手动设置 |
| `GITEE_TOKEN` | Gitee 个人令牌 | Gitee 设置 → 私人令牌 |
| `GITCODE_TOKEN` | GitCode 个人令牌 | GitCode 设置 → 访问令牌 |

**配置步骤：**

```
1. 进入 GitHub 仓库页面
2. Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 填写 Secret 名称和值
5. 保存

或者使用 GitHub CLI:

  gh secret set ALIYUN_REGISTRY_USERNAME --body "your-username"
  gh secret set ALIYUN_REGISTRY_PASSWORD --body "your-password"
  gh secret set GITEE_TOKEN --body "your-gitee-token"
  gh secret set GITCODE_TOKEN --body "your-gitcode-token"
```

### 21.6 完整发布流程

**从开发到发布的完整操作：**

```bash
# 1. 在本地开发分支完成功能开发
git checkout -b feature/new-agent
# ... coding ...
git add .
git commit -m "feat(backend): add new monitoring agent"
git push origin feature/new-agent

# 2. 创建 Pull Request，CI 流水线自动运行
# → 等待 CI 全部通过 (lint + test + build + docker verify)
# → Code Review
# → 合并到 main

# 3. 打版本号 tag
git checkout main
git pull origin main
git tag v3.0.5
git push origin v3.0.5

# 4. Release 流水线自动触发
# → Phase 1: 质量门禁通过
# → Phase 2: 构建并推送后端镜像
# → Phase 3: 构建并推送前端镜像
# → Phase 4: 创建 GitHub Release

# 5. 验证发布结果
# → 检查 GitHub Releases 页面
# → 验证阿里云镜像仓库中的新镜像
# → 使用新镜像部署测试环境
```

**手动触发 Release（不依赖 tag）：**

```
1. 进入 GitHub Actions → Release 工作流
2. 点击 "Run workflow"
3. 选择分支 (main)
4. 设置参数：
   - Push to Aliyun registry: ✅
   - Backend image tag: v3.0.5-rc1
   - Frontend image tag: v3.0.5-rc1
5. 点击 "Run workflow"
```

### 21.7 CI/CD 流水线扩展建议

**可考虑的扩展方向：**

| 扩展 | 说明 | 实现方式 |
|------|------|----------|
| 安全扫描 | Trivy 扫描 Docker 镜像漏洞 | `aquasecurity/trivy-action` |
| 代码覆盖率 | 生成覆盖率报告 | `codecov/codecov-action` |
| E2E 测试 | 自动化端到端测试 | Playwright + `playwright/action` |
| 自动部署 | 镜像构建后自动部署 | SSH deploy / kubectl |
| Slack/钉钉通知 | 构建结果推送 | `slackapi/slack-github-action` |
| 语义化版本 | 自动版本号管理 | `semantic-release` |
| 预览环境 | PR 自动部署临时环境 | Vercel/Railway preview |

**添加 Trivy 安全扫描示例：**

```yaml
  security-scan:
    name: Security Scan
    needs: [build-backend]
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
          format: 'table'
          exit-code: '1'
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'
```

## 本章小结

本章深入分析了 ITOps Agent Platform 的 CI/CD 自动化流水线。CI 流水线在每次代码变更时执行 lint、test、build 和 Docker 构建验证，确保代码质量。Release 流水线通过质量门禁、镜像构建推送和自动发布说明，实现了从代码到可部署镜像的自动化。镜像同步工作流则确保了代码在国内外多个平台的可用性。掌握这些 CI/CD 知识，你将能够为任何项目设计和实施自动化发布流程。

## 本章练习

### 基础练习

1. **本地模拟 CI 流程**：在本地环境中依次执行 CI 流水线中的所有步骤（`npm ci`、`tsc --noEmit`、`npm run lint`、`npm test`、`npm run build`），记录每个步骤的执行时间，并与 GitHub Actions 中的执行时间进行对比分析。

2. **手动触发 Release**：通过 GitHub 页面手动触发 Release 工作流，使用自定义 tag（如 `v0.0.1-test`），验证镜像是否成功推送到阿里云镜像仓库。

3. **添加缓存验证**：在 CI 流水线中，查看 GitHub Actions 的缓存命中情况。修改 `package-lock.json` 后再次运行，观察缓存是否失效。解释 `cache-dependency-path` 的作用。

### 进阶练习

4. **添加安全扫描**：在 Release 流水线中集成 Trivy 镜像安全扫描，当发现 CRITICAL 级别漏洞时阻止发布。编写完整的 YAML 配置。

5. **实现自动版本号**：使用 `conventional-changelog` 和 `standard-version`，实现基于 Conventional Commits 的自动版本号生成。编写对应的 GitHub Actions 步骤。

6. **实现预览环境**：为每个 Pull Request 自动创建临时预览环境（使用 docker-compose 或 Kubernetes namespace），PR 合并后自动销毁。设计完整的方案。

### 思考题

7. 当前 CI 流水线中 `continue-on-error: true` 用于 lint 步骤。这种设计的优缺点是什么？如果团队决定将 lint 作为硬性要求（lint 失败则阻塞合并），应该如何修改流水线？这对开发体验有什么影响？

8. 镜像标签策略中同时推送了版本 tag、latest 和 commit SHA 三个标签。在什么场景下需要每个标签？如果未来需要实现蓝绿部署或金丝雀发布，当前的标签策略是否足够？需要做哪些调整？

## 延伸阅读

- GitHub Actions 官方文档: [https://docs.github.com/en/actions](https://docs.github.com/en/actions)
- Docker Buildx 文档: [https://docs.docker.com/build/buildx/](https://docs.docker.com/build/buildx/)
- Conventional Commits 规范: [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/)
- GitHub Actions 缓存最佳实践: [https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- 书籍推荐：《Continuous Delivery》- Jez Humble & David Farley，CI/CD 经典著作
