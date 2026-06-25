# Security Policy

## Supported Versions

The following versions of ITOps Agent Platform are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take the security of ITOps Agent Platform seriously. If you discover a security vulnerability, please follow these steps:

### 1. **DO NOT** create a public GitHub issue

Public disclosure of security vulnerabilities could put users at risk before a fix is available.

### 2. Send a detailed report

Email us at <huawei_network@foxmail.com> with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if you have them)

### 3. What to expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its impact
- **Fix Timeline**: We aim to release a fix within 30 days for critical vulnerabilities
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Production Deployment

When deploying ITOps Agent Platform in production, please ensure:

1. **JWT Secret**: Set a strong, random `JWT_SECRET` in your `.env` file
2. **Webhook Security**: Enable `WEBHOOK_VERIFY_ENABLED` and configure `WEBHOOK_SECRET`
3. **IP Whitelisting**: Configure `WEBHOOK_IP_WHITELIST` to restrict webhook sources
4. **Password Policy**: Change the default admin password immediately after first login
5. **HTTPS**: Use HTTPS in production with proper TLS certificates
6. **Network Isolation**: Run the application in a private network when possible
7. **Regular Updates**: Keep the application updated to the latest version

### Known Security Features

The platform includes the following security measures:

- **AES-256-GCM Encryption**: Server passwords and SSH keys are encrypted at rest
- **JWT Authentication**: Dual token mechanism with automatic refresh and blacklist
- **Login Throttling**: Account lockout after 5 failed login attempts
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **Audit Logging**: All operations are logged for traceability
- **Input Validation**: Request validation using Zod schemas
- **XSS Protection**: Frontend sanitizes user input and HTML output
- **CORS Control**: Configurable allowed origins
- **Non-root Container**: Docker containers run as non-root user

## Security Advisories

Security advisories will be published on the [GitHub Security Advisories](https://github.com/qinshihu/itops-agent-platform/security/advisories) page.

---

Thank you for helping keep ITOps Agent Platform and its users safe!
