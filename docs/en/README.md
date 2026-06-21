# Documentation Index

Collection of all technical documentation for ITOps Agent Platform.

---

## 📚 Documentation List

### 📖 User Documentation

- [Project Overview](../../README.md) — Project introduction, features, quick start
- [Deployment Guide](../DEPLOYMENT.md) — Complete deployment configuration, FAQs, troubleshooting
- [Quick Deployment](../QUICK_DEPLOY.md) — Simplified deployment steps for quick setup
- [Test Guide](../TEST_GUIDE.md) — Testing methods and procedures
- [Changelog](../CHANGELOG.md) — Version update history and changes

### ⚙️ Feature Documentation

- [Web SSH Terminal](../WEB_TERMINAL.md) — Interactive remote terminal features, implementation, usage
- [Host Management Enhancement](../SERVER_MANAGEMENT.md) — Server group management, bulk import, information collection
- [Network Device Inspection](../NETWORK_DEVICE_INSPECTION.md) — Network device inspection features
- [QAnything Integration](../QANYTHING_INTEGRATION.md) — QAnything knowledge base integration
- [Workflow Guide](../WORKFLOW_GUIDE.md) — Workflow orchestration usage guide
- [Auto Remediation](../AUTO_REMEDIATION_DESIGN.md) — Alert auto remediation feature design

### 👩‍💻 Development Documentation

- [Development Guide](../DEVELOPMENT.md) — Local development environment setup (including Docker hot reload), workflow, debugging
- [API Documentation](../API.md) — Complete backend API reference (with request/response examples)
- [Architecture Design](../ARCHITECTURE.md) — System architecture and technical design
- [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md) — System architecture diagrams, module relationships
- [Technical Implementation](../TECHNICAL_IMPLEMENTATION.md) — Core feature implementation details
- [Architecture Decision Records](../arch/) — Key technology selection decisions and rationale

### 🚀 Deployment & Operations

- [Production Best Practices](../PRODUCTION.md) — Production configuration, security hardening, performance optimization
- [CI/CD Configuration](../CICD_SETUP.md) — Continuous integration and deployment configuration
- [Docker Image Build](../../docker/README.md) — Docker image build and usage instructions

---

## 🎯 Recommended Reading Path

| Role | Recommended Reading Order |
|------|-------------|
| **New Users** | [Project Overview](../../README.md) → [Quick Deployment](../QUICK_DEPLOY.md) → [Test Guide](../TEST_GUIDE.md) |
| **Deployment/Operations** | [Deployment Guide](../DEPLOYMENT.md) → [Production Best Practices](../PRODUCTION.md) → [Docker Image Build](../../docker/README.md) |
| **Developers** | [Development Guide](../DEVELOPMENT.md) → [Architecture Design](../ARCHITECTURE.md) → [API Documentation](../API.md) |
| **Architects** | [Architecture Design](../ARCHITECTURE.md) → [Architecture Decision Records](../arch/) → [Technical Implementation](../TECHNICAL_IMPLEMENTATION.md) |

---

## 📁 Documentation Structure

```
ai/
├── README.md                    # Root documentation (entry point)
├── README.en.md                 # English version
├── CONTRIBUTING.md              # Contributing guide
├── CODE_OF_CONDUCT.md           # Code of conduct
├── SECURITY.md                  # Security policy
├── LICENSE                      # MPL-2.0 license
├── .github/
│   ├── ISSUE_TEMPLATE/          # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md # PR template
├── docs/                        # Technical documentation directory
│   ├── README.md                # This document (Chinese)
│   ├── en/                      # English documentation
│   │   └── README.md            # English documentation index
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── QUICK_DEPLOY.md          # Quick deployment guide
│   ├── DEVELOPMENT.md           # Development guide
│   ├── API.md                   # API documentation
│   ├── ARCHITECTURE.md          # Architecture design
│   ├── ARCHITECTURE_DIAGRAM.md  # Architecture diagram
│   ├── TECHNICAL_IMPLEMENTATION.md # Technical implementation
│   ├── PRODUCTION.md            # Production configuration
│   ├── CICD_SETUP.md            # CI/CD configuration
│   ├── SPEC.md                  # Technical specification
│   ├── TEST_GUIDE.md            # Test guide
│   ├── CHANGELOG.md             # Changelog
│   ├── WEB_TERMINAL.md          # Web terminal documentation
│   ├── SERVER_MANAGEMENT.md     # Host management documentation
│   ├── NETWORK_DEVICE_INSPECTION.md # Network device inspection
│   ├── QANYTHING_INTEGRATION.md # QAnything integration
│   ├── WORKFLOW_GUIDE.md        # Workflow guide
│   ├── AUTO_REMEDIATION_DESIGN.md # Auto remediation design
│   ├── AI_MODEL_POOL_DEVELOPMENT.md # AI model pool development
│   ├── add_command_agent.sql    # Agent database script
│   └── arch/                    # Architecture decision records
│       └── README.md
├── docs-assets/                 # Documentation image assets
├── docker/                      # Docker configuration
├── frontend/                    # Frontend source code
├── backend/                     # Backend source code
├── examples/                    # Examples and test scripts
└── .github/workflows/           # GitHub Actions CI/CD
```

---

## 💡 Contributing to Documentation

If you find documentation errors or want to contribute:

1. Find the relevant document and submit a Pull Request
2. Maintain consistent documentation style
3. Synchronize important configuration changes across related documents
4. Add documentation for new features and tests
