# Standard Project Structure

## Overview
This document defines the standard project structure for this workspace. It provides guidelines for organizing files and directories to maintain consistency and facilitate collaboration.

## Project Structure Template

### General Structure
```
project-root/
├── .asdm/                          # ASDM configuration and toolsets
│   ├── contexts/                   # Context files for AI models
│   └── toolsets/                   # Installed ASDM toolsets
├── src/                            # Source code
│   ├── main/                       # Main application code
│   │   ├── [language]/             # Language-specific source (e.g., java, python, typescript)
│   │   │   ├── application/        # Application layer (use cases, services)
│   │   │   ├── domain/             # Domain layer (entities, value objects, repositories)
│   │   │   ├── infrastructure/     # Infrastructure layer (persistence, external services)
│   │   │   └── presentation/       # Presentation layer (controllers, views, APIs)
│   │   └── resources/              # Configuration resources
│   │       ├── application.yml     # Application configuration
│   │       ├── static/             # Static resources (CSS, JS, images)
│   │       └── templates/          # Template files
│   └── test/                       # Test code
│       ├── unit/                   # Unit tests
│       ├── integration/            # Integration tests
│       └── e2e/                    # End-to-end tests
├── config/                         # Configuration files
│   ├── development/                # Development environment configs
│   ├── staging/                    # Staging environment configs
│   └── production/                 # Production environment configs
├── docs/                           # Documentation
│   ├── api/                        # API documentation
│   ├── architecture/               # Architecture documentation
│   ├── deployment/                 # Deployment guides
│   └── user/                       # User documentation
├── scripts/                        # Build and utility scripts
│   ├── build.sh                    # Build script
│   ├── deploy.sh                   # Deployment script
│   └── test.sh                     # Test execution script
├── docker/                         # Docker configuration
│   ├── Dockerfile                  # Main Dockerfile
│   ├── docker-compose.yml          # Docker Compose configuration
│   └── .dockerignore               # Docker ignore file
├── .github/                        # GitHub configuration
│   ├── workflows/                  # GitHub Actions workflows
│   └── PULL_REQUEST_TEMPLATE.md    # PR template
├── .vscode/                        # VS Code configuration
│   ├── settings.json               # Editor settings
│   └── extensions.json             # Recommended extensions
├── package.json                    # Node.js dependencies (if applicable)
├── pom.xml                         # Maven configuration (if applicable)
├── build.gradle                    # Gradle configuration (if applicable)
├── requirements.txt                # Python dependencies (if applicable)
├── go.mod                          # Go modules (if applicable)
├── README.md                       # Project README
├── LICENSE                         # Project license
└── .gitignore                      # Git ignore rules
```

## Language-Specific Variations

### TypeScript/Node.js Project
```
src/
├── main/
│   ├── typescript/
│   │   ├── controllers/           # API controllers
│   │   ├── services/             # Business logic
│   │   ├── models/               # Data models
│   │   ├── repositories/         # Data access layer
│   │   ├── middleware/           # Express middleware
│   │   ├── routes/               # Route definitions
│   │   └── utils/                # Utility functions
│   └── resources/
│       └── ...
└── test/
    └── ...
```

### Java/Spring Boot Project
```
src/
├── main/
│   ├── java/
│   │   ├── com/example/app/
│   │   │   ├── controller/       # REST controllers
│   │   │   ├── service/          # Service layer
│   │   │   ├── repository/       # Data repositories
│   │   │   ├── model/            # Entity models
│   │   │   ├── dto/              # Data transfer objects
│   │   │   └── config/           # Configuration classes
│   └── resources/
│       └── ...
└── test/
    └── ...
```

### Python Project
```
src/
├── main/
│   ├── python/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py          # Application entry point
│   │   │   ├── api/             # API endpoints
│   │   │   ├── core/            # Core functionality
│   │   │   ├── models/          # Data models
│   │   │   ├── services/        # Business logic
│   │   │   └── utils/           # Utility functions
│   └── resources/
│       └── ...
└── test/
    └── ...
```

## Directory Purposes and Conventions

### Source Code Directories
- **`src/main/`**: Contains all production source code
- **`src/test/`**: Contains all test code (mirrors main structure)
- **Package by feature**: Organize code by business capability rather than technical layer
- **Clear separation**: Keep domain logic separate from infrastructure concerns

### Configuration Directories
- **Environment-specific**: Separate configs for dev, staging, prod
- **Externalized configuration**: Keep configs outside source code
- **Secret management**: Never commit secrets to version control

### Documentation
- **Living documentation**: Keep docs updated with code changes
- **API-first**: Document APIs before implementation
- **Architecture decisions**: Record important design decisions

### Build and Deployment
- **Reproducible builds**: Scripts should produce consistent results
- **Containerization**: Use Docker for consistent environments
- **CI/CD integration**: Configure automated pipelines

## Naming Conventions

### Files and Directories
- Use **kebab-case** for directory names: `user-management`, `api-gateway`
- Use **camelCase** for Java files: `UserController.java`
- Use **snake_case** for Python files: `user_service.py`
- Use **PascalCase** for TypeScript classes: `UserService.ts`

### Test Files
- Suffix test files with `.spec.ts` (TypeScript) or `Test.java` (Java)
- Place tests in parallel directory structure to source
- Use descriptive test names: `UserService.createUser.spec.ts`

## Best Practices

### 1. Modularity
- Keep modules focused and cohesive
- Minimize dependencies between modules
- Use clear interfaces between layers

### 2. Scalability
- Structure should support growth
- Avoid deep nesting (max 3-4 levels)
- Use feature folders for large projects

### 3. Maintainability
- Consistent structure across similar projects
- Clear separation of concerns
- Easy to navigate for new developers

### 4. Tool Integration
- Structure should work with IDEs and build tools
- Follow framework conventions
- Support automated testing and deployment

## Customization Guidelines

While this template provides a standard structure, projects may need customization:

1. **Framework requirements**: Follow framework-specific conventions
2. **Team preferences**: Adapt to team's established patterns
3. **Project size**: Simplify structure for small projects
4. **Domain complexity**: Adjust based on business domain needs

Always document any deviations from the standard structure in the project README.

---

*This template should be customized based on the specific technology stack and project requirements of the workspace.*