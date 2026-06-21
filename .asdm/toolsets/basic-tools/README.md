# ASDM Toolset - Basic Tools

toolset-id: basic-tools
toolset-name: Basic Tools
version: 0.0.2
updated-date: 2026-1-21
toolset-description: A set of basic tools for AI-assisted software development.

## Overview

Basic Tools (toolset-id: basic-tools) is a ASDM toolset for basic tools for AI-assisted software development. It provides a set of basic tools for AI-assisted software development, including daily git operations, such as generate git commit message and git commit.

## Features

Main features of Basic Tools:

- Provide user friendly shortcuts `actions` using provider's entry point to ease the process of basic git operations
- Provide standard `spec` for basic git operations, and allow user admin (Project Manager, Product Manager, Product Owner) to define their own process by customize the templates (spec documents)

## Toolset Installation Process

`INSTALL.md` will setup the toolset with the following steps:

- Detect the current `Agentic Engine` provider, e.g. Claude Code, GitHub Copilot, Tencent CodeBuddy etc. （Use hard-coded provider name for now, e.g. CodeBuddy ）
- Create shortcuts commands for `Basic Tools` in provider's entry point, e.g. `.claude/commands`, `.github/prompts`, `.codebuddy/commands` etc.

## Toolset Structure

The structure of the toolset is as follows:

```
.asdm/toolsets/basic-tools/
├── actions/
│   ├── asdm-start-project.md       ## Command for detecting the current workspace context and start the project in development mode
│   ├── asdm-git-commit.md          ## Command for committing changes to the current branch with the commit message generated in the current session
│   └── asdm-git-commit-message.md  ## Command for generating a standard git commit message
├── spec/
│   ├── git-commit-message-spec.md  ## Spec document for generating a standard git commit message
│   └── git-commit-spec.md          ## Spec document for committing changes to the current branch with the commit message generated in the current session
└── INSTALL.md
```