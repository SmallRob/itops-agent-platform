# ASDM Toolset - PRD Builder

toolset-id: prd-builder
toolset-name: PRD Builder
version: 0.0.2
updated-date: 2026-1-19
toolset-description: A toolset for planning and executing tasks for a workspace.

## Overview

PRD Builder (toolset-id: prd-builder) is a ASDM toolset for planning and executing tasks for a workspace. It takes a feature description as input and generates a task plan for the feature, then execute the tasks for the feature. During the execution phase, it will update the task plan with the current status of each task.

User can install this `toolset` into a workspace and run `INSTALL.md` document using `AI Guided Installation` to initialize the toolset for the workspace. Just simply copy and paste the following prompt into your `AI Coding` tool's chat window and hit enter:

```shell
Follow instructions in .asdm/toolsets/prd-builder/INSTALL.md
```
## Features

Main features of PRD Builder:

### Common features

- Provide user friendly shortcuts `actions` using provider's entry point to ease the process of planning tasks for a workspace
- Provide standard `spec` for planning tasks for a workspace, and allow user admin (Project Manager, Product Manager, Product Owner) to define their own process by customize the templates (spec documents)

### Planning Phase

- Generate a detailed feature PRD document with a unique ID (`.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`) using the template (spec document: feature-prd-spec.md).
- Add the current feature into feature tracking document in `.asdm/workspace/features/features-list.md` which keep tracking a list of all features in the workspace, the document should be updated automatically when a new feature is generated
- Generate task plan for a feature based on the feature description and save the plan as `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`, inside the file, there should be a list of tasks with a unique ID and their status (e.g. `TODO`, `IN PROGRESS`, `DONE`)

### Task breakdown Phase

- Generate the task description file (`.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`) using the template (spec document: task-prd-spec.md) and the feature PRD (`.asdm/workspace/features/<feature-id>-<feature-name>/<feature-name>-prd.md`)

### Execution Phase

- Execute tasks for a feature based on the task plan (`.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`)
- Update the task plan (`.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`) with the current status of each task
- If user is not specifying the task ID, the toolset should prompt the user to select a task from the task plan, when prompting the user, the toolset should show the task ID and task name and the current status of each task so user is clear about what task to execute

## Toolset Installation Process

`INSTALL.md` will setup the toolset with the following steps:

- Create `.asdm/workspace/features` directory for PRD Builder's workspace
- Detect the current `Agentic Engine` provider, e.g. Claude Code, GitHub Copilot, Tencent CodeBuddy etc. （Use hard-coded provider name for now, e.g. CodeBuddy ）
- Create shortcuts commands for `PRD Builder` in provider's entry point, e.g. `.claude/commands`, `.github/prompts`, `.codebuddy/commands` etc.

## Toolset Workflow

Once `PRD Builder` is installed, user can use the following commands to plan tasks for the current workspace:

- `/asdm-prd-planning`: plan tasks for the current workspace
- `/asdm-prd-breakdown`: breakdown tasks for the current workspace
- `/asdm-prd-execution`: execute tasks for the current workspace

## Toolset Structure

The PRD Builder toolset has the following structure:

```
.asdm/
└── toolsets/
    └── prd-builder/                        ## PRD Builder toolset
        ├── INSTALL.md                      ## Installation instructions for the toolset
        ├── README.md                       ## Current document
        └── actions/                        ## Instructions for PRD Builder
            ├── asdm-prd-planning           ## Instruction for planning tasks for a workspace
            ├── asdm-prd-breakdown          ## Instruction for breaking down tasks for a workspace
            └── asdm-prd-execution          ## Instruction for executing tasks for a workspace
        └── spec/                           ## Spec documents for PRD Builder
            ├── feature-prd-spec.md         ## Spec document for feature PRD
            ├── task-prd-spec.md            ## Spec document for task PRD
            ├── feature-list.md             ## Spec document for feature list
            └── task-list.md                ## Spec document for task list
```

## Toolset Workspace
The PRD Builder toolset has the following workspace structure:

```
.asdm/
└── workspace/                                  ## Workspace for ASDM
    └── features/                               ## Workspace for features
        ├── <feature-id>-<feature-name>/        ## Workspace for a feature
        │   ├── feature-prd.md                  ## Feature PRD document
        │   ├── task-list.md                    ## Task list document       
        │   └── <task-id>-<task-name>-prd.md    ## Task PRD document
        └── features-list.md                    ## Feature list document
```

## Copyright & License

Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE. See [LICENSE](LICENSE) in the project root for license information.
