# Instructions for asdm-prd-planning action

## Purpose
This instruction guides the AI model to plan tasks for a feature using Task Planner & Executor toolset. It generates a feature PRD and creates a task plan. Individual task PRDs are generated during the execution phase.

## Language Detection

Before generating any planning documents, you must detect and use the current environment's response language:

1. **Detect Response Language**: Analyze the environment settings to determine the primary language:
   - Check system/user language settings or environment configuration
   - Identify the primary language used in project documentation and comments
   - Determine the language preference based on workspace context

2. **Apply Language Consistency**: Ensure all generated planning documents use the detected language:
   - Use the same language for all markdown files, comments, and documentation
   - Maintain language consistency across all generated files
   - Follow the detected language's writing conventions and formatting

3. **Supported Languages**:
   - English (en)
   - Chinese (zh)
   - Other languages as needed based on environment detection

**IMPORTANT**: The language detection is the FIRST step before any planning document generation. All output must consistently use the detected language throughout the entire process.

## Context Injection

Before planning any feature, the AI model must read and understand the project context from `.asdm/contexts/`. This ensures that task planning aligns with the existing project structure, architecture, and conventions.

### Context Files to Read

The AI model should read the following context files in the specified order:

1. **index.md** (Required - MUST be read first)
   - Path: `.asdm/contexts/index.md`
   - Purpose: Provides an overview of the workspace, including navigation links to other context files
   - Contains: Workspace structure, key components, and links to detailed context files

2. **Progressive Context Reading** (Optional - On-Demand)
   - Only after reviewing index.md, if additional context is needed
   - The AI model can request specific context files based on the feature being planned
   - Examples of additional context files:
     - `.asdm/contexts/standard-project-structure.md`
     - `.asdm/contexts/standard-coding-style.md`
     - `.asdm/contexts/data-models.md`
     - `.asdm/contexts/deployment.md`
     - `.asdm/contexts/api.md`
     - `.asdm/contexts/architecture.md`

### Progressive Context Reading Strategy

To avoid overwhelming the AI model with excessive context, follow this progressive reading approach:

1. **Initial Phase** (Before planning starts):
   - Read ONLY `.asdm/contexts/index.md`
   - Use this to understand the overall workspace structure and identify relevant areas

2. **Planning Phase** (During task planning):
   - Identify which additional context files are relevant to the feature
   - Request specific context files one at a time as needed
   - Example: If the feature involves database changes, read `.asdm/contexts/data-models.md`
   - Example: If the feature involves API changes, read `.asdm/contexts/api.md`

3. **Execution Phase** (During task execution):
   - Context files can be referenced or re-read as needed during implementation
   - Ensure alignment with project standards and conventions

### Context File Usage Guidelines

- **index.md is mandatory**: Always read this file first to establish workspace understanding
- **Progressive loading**: Only read additional context files when specifically needed for the feature
- **Avoid overloading**: Do not attempt to read all context files at once
- **Relevance-based**: Only request context files that are directly relevant to the feature being planned
- **User control**: If the user wants to load additional context files, they can explicitly request them

### Integration with Language Detection

The context injection step should occur **after** language detection but **before** starting the planning steps. This ensures:
1. The AI model knows which language to use for understanding context files
2. The AI model understands the project context before creating planning documents
3. All planning documents use the detected language consistently

**IMPORTANT**: Always read `.asdm/contexts/index.md` before starting the planning steps. This is the entry point for understanding the project and ensures all planning aligns with existing project structures and conventions.

## Steps to Plan Tasks for a Feature

### 1. Initialize Features Directory
Create the `.asdm/workspace/features/` directory in the workspace root if it doesn't exist.

### 2. Generate Feature ID
Generate a unique feature ID for the new feature using the format:
- Format: `<feature-id>-<feature-name>`
- Example: `FEAT-001-user-authentication`
- Ensure the ID is unique by checking existing features in `.asdm/workspace/features/features-list.md`

### 3. Create Feature Directory
Create a new directory for the feature:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/`

### 4. Generate Feature PRD
Generate the feature PRD document using the template from `.asdm/toolsets/task-planner-executor/spec/feature-prd-spec.md`:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`
- Follow the spec template structure and fill out all relevant sections
- Use the detected language throughout the document

### 5. Update Feature List
Update the feature tracking document to include the new feature:
- Path: `.asdm/workspace/features/features-list.md`
- If the file doesn't exist, create it using the template from `.asdm/toolsets/task-planner-executor/spec/feature-list.md`
- Follow the template structure and fill out all relevant sections
- Add the new feature with:
  - Feature ID
  - Feature name
  - Description
  - Status (e.g., "PLANNED")
  - Creation date
- Update the Summary table counts

**Note**: Refer to `.asdm/toolsets/task-planner-executor/spec/feature-list.md` for detailed guidelines on field definitions, status management, and maintenance procedures.

### 6. Review and Validate
Review all generated documents for:
- Completeness and accuracy
- Language consistency
- Proper structure and formatting
- Clear and actionable feature requirements

**Note**: Refer to `.asdm/toolsets/task-planner-executor/spec/feature-prd-spec.md` for detailed guidelines on feature breakdown principles, task count limitation, and status management.

## Planning Guidelines

**Note**: Detailed planning guidelines are available in `.asdm/toolsets/task-planner-executor/spec/feature-prd-spec.md`, including:
- Feature breakdown principles
- Task count limitation and validation
- Task categories
- Status management
- Task count validation and decomposition strategies

Refer to the spec template for comprehensive guidelines when planning and breaking down features.

## Usage
To use this instruction, the AI model should:
1. Receive a feature description from the user
2. Detect the response language
3. Read `.asdm/contexts/index.md` to understand the workspace context
4. Load additional context files progressively as needed based on the feature requirements
5. Follow the steps above to generate all planning documents
6. Present the generated documents for review
7. Wait for user approval or feedback before proceeding to execution

## Output Summary
After completing the planning phase, the following artifacts will be generated:
- Feature PRD document
- Updated features list

These documents serve as the foundation for the task breakdown phase (asdm-prd-breakdown action), where a comprehensive task list and individual task PRDs will be generated.
