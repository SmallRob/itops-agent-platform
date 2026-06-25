# PRD Builder Toolset Installation

**Toolset ID:** `prd-builder`

## Overview
This document provides instructions for installing and setting up the PRD Builder toolset in a workspace. PRD Builder helps plan and execute tasks for features in a workspace, generating feature PRDs and task lists, and managing task execution status.

## AI Guided Installation
To install this toolset using AI Guided Installation, copy and paste the following prompt into your AI Coding tool's chat window:

```shell
Follow instructions in .asdm/toolsets/prd-builder/INSTALL.md
```

## Installation Steps

### 1. Create `.asdm/workspace/features` directory for PRD Builder's workspace

Create the directory structure for storing feature and task files:

```bash
mkdir -p .asdm/workspace/features
```

### 2. Detect the current `Agentic Engine` provider

Detect the current AI coding assistant provider (e.g., Claude Code, GitHub Copilot, Tencent CodeBuddy). Using the following guidelines to detect the provider:

- If `.claude` directory exists, use `Claude Code`
- If `.github` directory exists, use `GitHub Copilot`
- If `.codebuddy` directory exists, use `Tencent CodeBuddy`
- If no such folder is found in the current workspace, give user a prompt to select a provider manually

### 3. Create shortcuts commands for PRD Builder (toolset ID: `prd-builder`) in provider's entry point

Create shortcut commands in the appropriate location based on the detected provider. The installation process is consistent across all providers - we use `cat` to concatenate provider-specific frontmatter with the actual instruction content:

#### For Claude Code (`.claude/commands/`):
Claude Code uses Markdown files with Frontmatter metadata for slash commands. Create commands by concatenating Claude-specific frontmatter with instruction content:

```bash
mkdir -p .claude/commands/

# Task Planning command
cat > .claude/commands/asdm-prd-planning.md << 'EOF'
---
description: "Plan tasks for a workspace feature"
argument-hint: "[feature description]"
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md >> .claude/commands/asdm-prd-planning.md

# Task Breakdown command
cat > .claude/commands/asdm-prd-breakdown.md << 'EOF'
---
description: "Break down tasks for a workspace feature"
argument-hint: "[feature ID or name]"
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md >> .claude/commands/asdm-prd-breakdown.md

# Task Execution command
cat > .claude/commands/asdm-prd-execution.md << 'EOF'
---
description: "Execute tasks for a workspace feature"
argument-hint: "[task ID]"
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-execution.md >> .claude/commands/asdm-prd-execution.md
```

#### For GitHub Copilot (`.github/prompts/`):
GitHub Copilot uses `.prompt.md` files with YAML frontmatter. Create prompt files by concatenating GitHub-specific frontmatter with instruction content:

```bash
mkdir -p .github/prompts/

# Task Planning prompt
cat > .github/prompts/asdm-prd-planning.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Plan tasks for a workspace feature'
argument-hint: 'Enter feature description'
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md >> .github/prompts/asdm-prd-planning.prompt.md

# Task Breakdown prompt
cat > .github/prompts/asdm-prd-breakdown.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Break down tasks for a workspace feature'
argument-hint: 'Enter feature ID or name'
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md >> .github/prompts/asdm-prd-breakdown.prompt.md

# Task Execution prompt
cat > .github/prompts/asdm-prd-execution.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Execute tasks for a workspace feature'
argument-hint: 'Enter task ID'
---

EOF
cat .asdm/toolsets/prd-builder/actions/asdm-prd-execution.md >> .github/prompts/asdm-prd-execution.prompt.md
```

#### For Tencent CodeBuddy (`.codebuddy/commands/`):
CodeBuddy doesn't support frontmatter, so simply copy the instruction files as-is:

```bash
mkdir -p .codebuddy/commands/

# Copy instruction files directly (no frontmatter needed)
cp .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md .codebuddy/commands/
cp .asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md .codebuddy/commands/
cp .asdm/toolsets/prd-builder/actions/asdm-prd-execution.md .codebuddy/commands/
```

### 4. Manual Usage for Other Providers

If your AI coding assistant provider is not detected by the automatic detection logic (Claude Code, GitHub Copilot, or Tencent CodeBuddy), you can still use the PRD Builder manually. Follow these steps:

#### Direct Instruction Usage
You can directly use the instruction files by copying their relative paths and pasting them into your AI coding assistant's chat window:

1. **Navigate to the instruction files**:
   ```bash
   cd .asdm/toolsets/prd-builder/actions/
   ```

2. **Right-click on the desired instruction file** and copy its relative path:
   - For task planning: `asdm-prd-planning.md`
   - For task breakdown: `asdm-prd-breakdown.md`
   - For task execution: `asdm-prd-execution.md`

3. **Enter a prompt** in your AI coding assistant:
   ```
   Follow the instructions in {relative path to instruction file}
   ```

## Initializing PRD Builder

### Planning a New Feature
After installation, you can start planning tasks for a new feature:

```shell
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md
```

This will:
1. Generate a unique feature ID and create a feature directory
2. Generate a detailed feature PRD document using the feature-prd-spec template
3. Add the feature to the features tracking list
4. Generate a task plan with task IDs and statuses
5. Generate task PRD documents using the task-prd-spec template

### Breaking Down Tasks
After planning a feature, you can break down tasks into detailed PRD documents:

```shell
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md
```

This will:
1. Prompt you to select a feature (if no feature ID is specified)
2. Load feature context (feature PRD, task list, and additional context files)
3. Select tasks to break down based on user input or task status
4. Generate detailed task PRD documents for each selected task
5. Update the task list status if needed

### Executing Tasks
Once tasks are planned and broken down, you can execute them:

```shell
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-execution.md
```

This will:
1. Prompt you to select a task (if no task ID is specified)
2. Execute the selected task based on the task PRD
3. Update the task status in the task list

### Available Commands
Once installed, you can use the following commands:

1. **`/asdm-task-planning`** - Plan tasks for a new feature
2. **`/asdm-task-breakdown`** - Break down tasks into detailed PRD documents
3. **`/asdm-task-execution`** - Execute tasks for a feature

## Workspace Structure
The toolset will create the following structure in `.asdm/workspace/features/`:

```
.asdm/workspace/features/
├── <feature-id>-<feature-name>/        ## Workspace for a feature
│   ├── feature-prd.md                  ## Feature PRD document
│   ├── task-list.md                    ## Task list document with task IDs and statuses
│   └── <task-id>-<task-name>-prd.md    ## Task PRD document for each task
└── features-list.md                    ## Feature tracking document
```

## Spec Documents
The toolset uses the following spec documents as templates:

1. **`feature-prd-spec.md`** - Template for generating feature PRD documents
2. **`task-prd-spec.md`** - Template for generating task PRD documents
3. **`feature-list.md`** - Template for the feature tracking list
4. **`task-list.md`** - Template for the task list with statuses (TODO, IN PROGRESS, DONE)

## Verification

After installation, verify that:

1. The `.asdm/workspace/features` directory exists for PRD Builder
2. Shortcut commands for PRD Builder (toolset ID: `prd-builder`) are created in the appropriate provider directory (if using Claude Code, GitHub Copilot, or Tencent CodeBuddy)
3. The PRD Builder toolset files are located in `.asdm/toolsets/prd-builder` (toolset ID: `prd-builder`)

**For other providers**: Verify that you can access the instruction files at:
- `.asdm/toolsets/prd-builder/actions/asdm-prd-planning.md`
- `.asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md`
- `.asdm/toolsets/prd-builder/actions/asdm-prd-execution.md`

## Usage Examples

### Planning a New Feature
```shell
# First, install the toolset using AI Guided Installation
Follow instructions in .asdm/toolsets/prd-builder/INSTALL.md

# Then plan tasks for a new feature
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md

# Example prompt when using slash command:
/asdm-prd-planning Add user authentication with OAuth support
```

### Breaking Down Tasks
```shell
# Break down tasks for a feature
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-breakdown.md

# Example prompt when using slash command:
/asdm-prd-breakdown FEA-001-User-Auth
```

### Executing a Task
```shell
# Execute a specific task
Follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-execution.md

# Example prompt when using slash command:
/asdm-prd-execution TASK-001
```

## Usage

### For Supported Providers (Claude Code, GitHub Copilot, Tencent CodeBuddy)
Once installed, you can use the following commands:

- `/asdm-prd-planning {feature description}`: Plan tasks for a new feature
- `/asdm-prd-breakdown {feature ID or name}`: Break down tasks into detailed PRD documents
- `/asdm-prd-execution {task ID}`: Execute a specific task

### For Other Providers (Manual Usage)
If your provider is not automatically detected, you can manually use the instructions by following the steps in the "Manual Usage for Other Providers" section above.

## Notes

- This installation process assumes you have the necessary permissions to create directories and files
- The actual implementation of the commands will be handled by the AI model using the templates and instructions provided in PRD Builder (toolset ID: `prd-builder`)
- Make sure to customize the provider-specific setup based on your actual AI coding assistant
- The toolset ID `prd-builder` should be used consistently when referring to PRD Builder in commands and documentation
- **For providers not in the detection logic**: Users can manually use the instruction files by copying their relative paths and entering prompts like "follow the instructions in .asdm/toolsets/prd-builder/actions/asdm-prd-planning.md"
- Task statuses: TODO, IN PROGRESS, DONE
- The toolset automatically updates the features tracking list when new features are generated

## Integration with Other Toolsets
PRD Builder can integrate with Context Builder to understand the workspace better during task planning and execution. Context files from Context Builder can be referenced to ground the generated tasks and PRDs to the actual codebase.

### Getting Help
For issues with PRD Builder toolset, refer to:
- [ASDM Documentation](https://asdm.ai/docs)
- Toolset README: `.asdm/toolsets/prd-builder/README.md`
- Spec documents in `.asdm/toolsets/prd-builder/spec/`

## License
Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE. See [LICENSE](LICENSE) in the project root for license information.

---

*This installation document is part of the PRD Builder toolset. Use the task planning instruction to create feature and task plans for your workspace.*
