# Basic Tools Toolset Installation

**Toolset ID:** `basic-tools`

## Overview
This document provides instructions for installing and setting up the Basic Tools toolset in a workspace. Basic Tools provides a set of basic tools for AI-assisted software development, including daily git operations such as generating git commit messages and performing git commits, as well as starting projects in development mode.

## AI Guided Installation
To install this toolset using AI Guided Installation, copy and paste the following prompt into your AI Coding tool's chat window:

```shell
Follow instructions in .asdm/toolsets/basic-tools/INSTALL.md
```

## Installation Steps

### 1. Detect the current `Agentic Engine` provider

Detect the current AI coding assistant provider (e.g., Claude Code, GitHub Copilot, Tencent CodeBuddy). Using the following guidelines to detect the provider:

- If `.claude` directory exists, use `Claude Code`
- If `.github` directory exists, use `GitHub Copilot`
- If `.codebuddy` directory exists, use `Tencent CodeBuddy`
- If no such folder is found in the current workspace, give user a prompt to select a provider manually

### 2. Create shortcuts commands for Basic Tools (toolset ID: `basic-tools`) in provider's entry point

Create shortcut commands in the appropriate location based on the detected provider. The installation process is consistent across all providers - we use `cat` to concatenate provider-specific frontmatter with the actual instruction content:

#### For Claude Code (`.claude/commands/`):
Claude Code uses Markdown files with Frontmatter metadata for slash commands. Create commands by concatenating Claude-specific frontmatter with instruction content:

```bash
mkdir -p .claude/commands/

# Start Project command
cat > .claude/commands/asdm-start-project.md << 'EOF'
---
description: "Detect workspace context and start the project in development mode"
argument-hint: "[optional: specific environment]"
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-start-project.md >> .claude/commands/asdm-start-project.md

# Generate Git Commit Message command
cat > .claude/commands/asdm-git-commit-message.md << 'EOF'
---
description: "Generate a standard git commit message based on current changes"
argument-hint: "[optional: custom scope or context]"
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md >> .claude/commands/asdm-git-commit-message.md

# Git Commit command
cat > .claude/commands/asdm-git-commit.md << 'EOF'
---
description: "Commit changes to the current branch with generated commit message"
argument-hint: "[optional: specific files to commit]"
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-git-commit.md >> .claude/commands/asdm-git-commit.md
```

#### For GitHub Copilot (`.github/prompts/`):
GitHub Copilot uses `.prompt.md` files with YAML frontmatter. Create prompt files by concatenating GitHub-specific frontmatter with instruction content:

```bash
mkdir -p .github/prompts/

# Start Project prompt
cat > .github/prompts/asdm-start-project.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Detect workspace context and start the project in development mode'
argument-hint: 'Enter optional environment or leave blank'
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-start-project.md >> .github/prompts/asdm-start-project.prompt.md

# Generate Git Commit Message prompt
cat > .github/prompts/asdm-git-commit-message.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Generate a standard git commit message based on current changes'
argument-hint: 'Enter optional scope or context'
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md >> .github/prompts/asdm-git-commit-message.prompt.md

# Git Commit prompt
cat > .github/prompts/asdm-git-commit.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Commit changes to the current branch with generated commit message'
argument-hint: 'Enter optional specific files to commit'
---

EOF
cat .asdm/toolsets/basic-tools/actions/asdm-git-commit.md >> .github/prompts/asdm-git-commit.prompt.md
```

#### For Tencent CodeBuddy (`.codebuddy/commands/`):
CodeBuddy doesn't support frontmatter, so simply copy the instruction files as-is:

```bash
mkdir -p .codebuddy/commands/

# Copy instruction files directly (no frontmatter needed)
cp .asdm/toolsets/basic-tools/actions/asdm-start-project.md .codebuddy/commands/
cp .asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md .codebuddy/commands/
cp .asdm/toolsets/basic-tools/actions/asdm-git-commit.md .codebuddy/commands/
```

### 3. Manual Usage for Other Providers

If your AI coding assistant provider is not detected by the automatic detection logic (Claude Code, GitHub Copilot, or Tencent CodeBuddy), you can still use the Basic Tools manually. Follow these steps:

#### Direct Instruction Usage
You can directly use the instruction files by copying their relative paths and pasting them into your AI coding assistant's chat window:

1. **Navigate to the instruction files**:
   ```bash
   cd .asdm/toolsets/basic-tools/actions/
   ```

2. **Right-click on the desired instruction file** and copy its relative path:
   - For starting projects: `asdm-start-project.md`
   - For generating commit messages: `asdm-git-commit-message.md`
   - For committing changes: `asdm-git-commit.md`

3. **Enter a prompt** in your AI coding assistant:
   ```
   Follow the instructions in {relative path to instruction file}
   ```

## Initializing Basic Tools

### Starting a Project
After installation, you can start your project in development mode:

```shell
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-start-project.md
```

This will:
1. Detect the current workspace context
2. Analyze the workspace structure and project configuration
3. Identify the project type (Node.js, Java, Python, etc.)
4. Install dependencies if needed
5. Start the development server or application
6. Provide feedback on the startup status

### Generating a Git Commit Message
When you need to commit changes, generate a standardized commit message:

```shell
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md
```

This will:
1. Analyze staged and unstaged changes
2. Categorize changes (feature, bugfix, refactor, docs, etc.)
3. Extract relevant context from code changes
4. Generate a commit message following the standard spec
5. Present the generated message for review and approval

### Committing Changes
After generating a commit message, commit your changes:

```shell
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-git-commit.md
```

This will:
1. Retrieve the generated commit message from the current session
2. Stage all changed files (or specific files based on user selection)
3. Create a git commit with the generated message
4. Provide confirmation of the commit

### Available Commands
Once installed, you can use the following commands:

1. **`/asdm-start-project`** - Start the project in development mode
2. **`/asdm-git-commit-message`** - Generate a standard git commit message
3. **`/asdm-git-commit`** - Commit changes with the generated commit message

## Verification

After installation, verify that:

1. Shortcut commands for Basic Tools (toolset ID: `basic-tools`) are created in the appropriate provider directory (if using Claude Code, GitHub Copilot, or Tencent CodeBuddy)
2. The Basic Tools toolset files are located in `.asdm/toolsets/basic-tools` (toolset ID: `basic-tools`)

**For other providers**: Verify that you can access the instruction files at:
- `.asdm/toolsets/basic-tools/actions/asdm-start-project.md`
- `.asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md`
- `.asdm/toolsets/basic-tools/actions/asdm-git-commit.md`

## Usage Examples

### Starting a Project
```shell
# First, install the toolset using AI Guided Installation
Follow instructions in .asdm/toolsets/basic-tools/INSTALL.md

# Then start the project in development mode
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-start-project.md

# Example prompt when using slash command:
/asdm-start-project
```

### Generating and Committing Changes
```shell
# Generate a commit message for your changes
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-git-commit-message.md

# Example prompt when using slash command:
/asdm-git-commit-message

# Then commit the changes
Follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-git-commit.md

# Example prompt when using slash command:
/asdm-git-commit
```

## Usage

### For Supported Providers (Claude Code, GitHub Copilot, Tencent CodeBuddy)
Once installed, you can use the following commands:

- `/asdm-start-project`: Start the project in development mode
- `/asdm-git-commit-message`: Generate a standard git commit message
- `/asdm-git-commit`: Commit changes with the generated commit message

### For Other Providers (Manual Usage)
If your provider is not automatically detected, you can manually use the instructions by following the steps in the "Manual Usage for Other Providers" section above.

## Notes

- This installation process assumes you have the necessary permissions to create directories and files
- The actual implementation of the commands will be handled by the AI model using the templates and instructions provided in Basic Tools (toolset ID: `basic-tools`)
- Make sure to customize the provider-specific setup based on your actual AI coding assistant
- The toolset ID `basic-tools` should be used consistently when referring to Basic Tools in commands and documentation
- **For providers not in the detection logic**: Users can manually use the instruction files by copying their relative paths and entering prompts like "follow the instructions in .asdm/toolsets/basic-tools/actions/asdm-start-project.md"
- Commit message format follows the standard conventions defined in the git-commit-message-spec

## Spec Documents
The toolset uses the following spec documents as templates:

1. **`git-commit-message-spec.md`** - Template for generating standard git commit messages
2. **`git-commit-spec.md`** - Template for committing changes with generated messages

## Integration with Other Toolsets
Basic Tools can be used independently or integrated with other toolsets like Task Planner & Executor to support the complete development workflow. Basic Tools provides foundational git operations that are commonly needed throughout any development process.

### Getting Help
For issues with Basic Tools toolset, refer to:
- [ASDM Documentation](https://asdm.ai/docs)
- Toolset README: `.asdm/toolsets/basic-tools/README.md`
- Spec documents in `.asdm/toolsets/basic-tools/spec/`

## License
Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE. See [LICENSE](LICENSE) in the project root for license information.

---

*This installation document is part of the Basic Tools toolset. Use the actions to perform basic development tasks such as starting projects and managing git commits.*
