# Instructions for asdm-prd-breakdown action

## Purpose
This instruction guides the AI model to break down tasks for a feature using Task Planner & Executor toolset. It first generates a comprehensive task list based on the feature PRD, then creates detailed task PRD documents for each task in the task list.

## Language Detection

Before generating any task PRD documents, you must detect and use the current environment's response language:

1. **Detect Response Language**: Analyze the environment settings to determine the primary language:
   - Check system/user language settings or environment configuration
   - Identify the primary language used in project documentation and comments
   - Determine the language preference based on workspace context

2. **Apply Language Consistency**: Ensure all generated task PRD documents use the detected language:
   - Use the same language for all markdown files, comments, and documentation
   - Maintain language consistency across all generated files
   - Follow the detected language's writing conventions and formatting

3. **Supported Languages**:
   - English (en)
   - Chinese (zh)
   - Other languages as needed based on environment detection

**IMPORTANT**: The language detection is the FIRST step before any task breakdown document generation. All output must consistently use the detected language throughout the entire process.

## Context Loading

Before breaking down tasks, the AI model must load the feature context from the feature directory. This ensures that task breakdown aligns with the feature requirements and specifications.

### Context Files to Read

The AI model should read the following context files:

1. **Feature PRD** (Required - MUST be read first)
   - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`
   - Purpose: Provides detailed feature requirements, scope, and acceptance criteria
   - Contains: Feature description, user stories, technical requirements, and success criteria

2. **Task List** (Optional - Generated if not exists)
   - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
   - Purpose: Provides the list of tasks to be broken down
   - Contains: Task IDs, task names, task descriptions, and current status
   - If not exists, will be generated in step 3

3. **Additional Context** (Optional - On-Demand)
   - Only after reviewing the feature PRD and task list, if additional context is needed
   - The AI model can request additional context files from `.asdm/contexts/` based on specific task requirements
   - Examples of additional context files:
     - `.asdm/contexts/standard-project-structure.md`
     - `.asdm/contexts/standard-coding-style.md`
     - `.asdm/contexts/data-models.md`
     - `.asdm/contexts/api.md`
     - `.asdm/contexts/architecture.md`

### Progressive Context Loading Strategy

To avoid overwhelming the AI model with excessive context, follow this progressive loading approach:

1. **Initial Phase** (Before task breakdown starts):
   - Read feature PRD to understand feature requirements
   - Read task list if it exists, otherwise prepare to generate it
   - Identify which additional context files might be needed

2. **Breakdown Phase** (During task breakdown):
   - Load additional context files only when specifically needed for a task
   - Example: If a task involves database changes, read `.asdm/contexts/data-models.md`
   - Example: If a task involves API changes, read `.asdm/contexts/api.md`

3. **Integration with Language Detection**:
   - Context loading should occur **after** language detection but **before** starting the breakdown steps
   - This ensures the AI model uses the correct language for understanding and generating content

**IMPORTANT**: Always read the feature PRD and task list before starting the task breakdown steps. These documents are the foundation for generating accurate and detailed task PRDs.

## Steps to Break Down Tasks for a Feature

### 1. Identify Feature and Validate Existence
Identify the feature to break down tasks for:
- Accept a feature ID or feature name from the user
- Validate the feature directory exists: `.asdm/workspace/features/<feature-id>-<feature-name>/`
- If the feature doesn't exist, inform the user and suggest using `/asdm-prd-planning` first

### 2. Load Feature Context
Load the necessary context files:
- Read feature PRD: `.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`
- Check if task list exists: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- If task list doesn't exist, proceed to step 3 to generate it
- Load additional context files as needed based on task requirements

### 3. Generate Task List (if not exists)
If task list doesn't exist, generate a comprehensive task list for the feature:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- Use the template from `.asdm/toolsets/task-planner-executor/spec/task-list.md`
- Use the detected language throughout the document
- Follow the template structure and fill out all relevant sections
- Ensure task list only contains basic task information without detailed descriptions
- Ensure task count validation (see step 3.1)

If task list already exists, skip to step 4.

### 3.1 Validate Task Count
After generating the task list, validate the task count:
- Count the total number of tasks in the task list
- If task count is **10 or fewer**: Proceed to step 4
- If task count is **more than 10**:
  - **Stop** the breakdown process
  - Explain to the user that the feature is too large and needs to be decomposed
  - Provide a summary of the preliminary task breakdown to help the user understand the scope
  - Ask the user to break down the feature into smaller sub-features
  - Request the user to specify which sub-feature to break down first
  - Once a smaller sub-feature is provided, restart the breakdown process from step 2 with the new feature

**Note**: Refer to `.asdm/toolsets/task-planner-executor/spec/task-list.md` for detailed guidelines on task count limitation, task granularity, status management, and dependency management. The task list should only contain basic task information without detailed descriptions or implementation details.

### 4. Select Tasks for Breakdown
Determine which tasks to break down:
- If user specifies task IDs, break down only those tasks
- If user doesn't specify task IDs, break down all tasks with status `TODO` or `IN PROGRESS`
- Confirm with the user which tasks will be broken down before proceeding

### 5. Generate Task PRDs
For each selected task, generate a detailed task PRD document:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`
- Use the template from `.asdm/toolsets/task-planner-executor/spec/task-prd-spec.md`
- Use the detected language throughout the document
- Follow the spec template structure and fill out all relevant sections

### 6. Update Task List Status
Update the task list to reflect task breakdown status:
- For tasks with generated PRDs, update the status if needed
- Maintain the status according to the task's actual state
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`

### 7. Review and Validate
Review all generated documents (task list if newly created, and task PRD documents) for:
- Completeness and accuracy
- Language consistency
- Proper structure and formatting
- Clear and actionable requirements
- Alignment with feature PRD
- Feasibility and implementability
- Clear acceptance criteria

**Note**: Refer to `.asdm/toolsets/task-planner-executor/spec/task-prd-spec.md` for detailed guidelines on task PRD content, best practices, and handling different task types.

## Usage

To use this instruction, the AI model should:

1. **Receive Feature Selection**: Get the feature ID or name from the user
2. **Detect Language**: Detect and set the response language
3. **Validate Feature**: Check if the feature directory and necessary files exist
4. **Load Context**: Read feature PRD, check for task list, and load any additional context files
5. **Generate Task List**: If task list doesn't exist, create it based on feature PRD and validate task count
6. **Select Tasks**: Determine which tasks to break down based on user input or task status
7. **Confirm Tasks**: Present the list of tasks to be broken down and get user confirmation
8. **Generate Task PRDs**: Create detailed task PRD documents for each selected task
9. **Update Task List**: Update task statuses if needed
10. **Review and Present**: Present all generated documents for user review
11. **Wait for Approval**: Wait for user approval or feedback before proceeding to execution

### User Interaction Guidelines

#### Before Starting Breakdown
- Ask the user to specify which feature to break down tasks for
- If multiple features exist, present a list of features from `features-list.md`
- If the user doesn't specify tasks, explain that all `TODO` and `IN PROGRESS` tasks will be broken down

#### During Task Selection
- Present the list of tasks that will be broken down
- Show task ID, task name, current status, and brief description
- Ask user to confirm or modify the selection

#### During Generation
- Provide progress updates as task PRDs are generated
- Notify user if any issues or warnings arise
- Ask for clarification if task descriptions are ambiguous

#### After Completion
- Present a summary of all generated task PRDs
- Show the file paths for each generated document
- Ask if the user wants to review any specific task PRD
- Prompt for next steps (e.g., proceed to execution)

## Output Summary

After completing the task breakdown phase, the following artifacts will be generated:

### Generated Documents
- **Task List** (if not already exists): Comprehensive list of tasks for the feature
  - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
  - Contains: Task IDs, task names, descriptions, status, dependencies, and estimated effort

- **Task PRD Documents**: One detailed PRD document for each selected task
  - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`
  - Each includes: task description, requirements, implementation approach, acceptance criteria, dependencies, and estimated effort

### Updated Documents
- **Task List**: Updated to reflect current task status
  - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`

### Task Breakdown Summary
The breakdown process should generate a summary that includes:
- Task list generation status (newly created or already existed)
- Total number of tasks in the task list
- Number of tasks broken down
- List of task PRD documents generated
- Any warnings or issues encountered
- Recommendations for next steps

These documents serve as the foundation for the execution phase (asdm-task-execution action). Each task PRD provides detailed guidance for implementing the task, ensuring alignment with feature requirements and project standards.

## Error Handling

### Common Scenarios and Solutions

#### Feature Not Found
- **Error**: Feature directory or feature PRD doesn't exist
- **Solution**: Inform the user and suggest using `/asdm-prd-planning` to create the feature first

#### Task List Not Found
- **Behavior**: Task list doesn't exist in the feature directory
- **Solution**: Automatically generate the task list based on the feature PRD (step 3)

#### Task Already Has PRD
- **Error**: Task PRD document already exists for a task
- **Solution**: Ask the user if they want to overwrite the existing PRD or skip this task

#### Insufficient Context
- **Error**: Cannot break down task due to missing or unclear requirements
- **Solution**: Ask the user for clarification or additional requirements for the task

#### Feature PRD Incomplete
- **Error**: Feature PRD doesn't provide enough information to break down tasks
- **Solution**: Ask the user to provide more details in the feature PRD or provide additional context directly
