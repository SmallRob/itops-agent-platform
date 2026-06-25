# Instructions for asdm-task-execution action

## Purpose
This instruction guides the AI model to execute tasks for a feature using Task Planner & Executor toolset. It executes tasks based on the task plan and task PRDs, updating the task list with current status. Task PRDs can be generated on-demand during the execution phase.

## Language Detection

Before executing any tasks, you must detect and use the current environment's response language:

1. **Detect Response Language**: Analyze the environment settings to determine the primary language:
   - Check system/user language settings or environment configuration
   - Identify the primary language used in project documentation and comments
   - Determine the language preference based on workspace context

2. **Apply Language Consistency**: Ensure all interactions and status updates use the detected language:
   - Use the same language for all communications with the user
   - Maintain language consistency in status messages and updates
   - Follow the detected language's writing conventions and formatting

3. **Supported Languages**:
   - English (en)
   - Chinese (zh)
   - Other languages as needed based on environment detection

**IMPORTANT**: The language detection is the FIRST step before any task execution. All interactions must consistently use the detected language throughout the entire process.

## Context Loading

Before executing tasks, the AI model must load the feature context from the feature directory. This ensures that task execution aligns with the feature requirements and specifications.

### Context Files to Read

The AI model should read the following context files:

1. **Task List** (Required - MUST be read first)
   - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
   - Purpose: Provides the list of tasks and their current status
   - Contains: Task IDs, task names, task descriptions, and current status

2. **Feature PRD** (Required)
   - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`
   - Purpose: Provides detailed feature requirements and context
   - Contains: Feature description, user stories, technical requirements, and success criteria

3. **Task PRDs** (On-Demand)
   - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`
   - Purpose: Provides detailed requirements for specific tasks
   - Load only for tasks being executed
   - If a task PRD doesn't exist, inform the user and prompt them to use `/asdm-prd-breakdown` to generate it

4. **Additional Context** (Optional - On-Demand)
   - Only after reviewing the task list and feature PRD, if additional context is needed
   - The AI model can request additional context files from `.asdm/contexts/` based on specific task requirements
   - Examples of additional context files:
     - `.asdm/contexts/standard-project-structure.md`
     - `.asdm/contexts/standard-coding-style.md`
     - `.asdm/contexts/data-models.md`
     - `.asdm/contexts/api.md`
     - `.asdm/contexts/architecture.md`

### Progressive Context Loading Strategy

To avoid overwhelming the AI model with excessive context, follow this progressive loading approach:

1. **Initial Phase** (Before execution starts):
   - Read task list to understand available tasks and their status
   - Read feature PRD to understand feature requirements and context
   - Identify which additional context files might be needed

2. **Selection Phase** (During task selection):
   - Load task PRDs for selected tasks
   - If a task PRD doesn't exist, inform the user and prompt them to use `/asdm-prd-breakdown` to generate it first

3. **Execution Phase** (During task execution):
   - Load additional context files only when specifically needed for implementation
   - Reference project standards and conventions as needed
   - Ensure alignment with coding style and architecture guidelines

4. **Integration with Language Detection**:
   - Context loading should occur **after** language detection but **before** starting execution steps
   - This ensures the AI model uses the correct language for understanding and communication

**IMPORTANT**: Always read the task list and feature PRD before starting the task execution steps. These documents provide the foundation for selecting and executing tasks.

## Steps to Execute Tasks for a Feature

### 1. Identify Feature and Validate Existence
Identify the feature to execute tasks for:
- Accept a feature ID or feature name from the user
- Validate the feature directory exists: `.asdm/workspace/features/<feature-id>-<feature-name>/`
- Validate the task list exists: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- If the feature or task list doesn't exist, inform the user and suggest using `/asdm-prd-planning` first

### 2. Load Feature Context
Load the necessary context files:
- Read task list: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- Read feature PRD: `.asdm/workspace/features/<feature-id>-<feature-name>/feature-prd.md`
- Load additional context files as needed based on task requirements

### 3. Present Available Tasks
Present the available tasks to the user:
- Display task ID, task name, and current status for all tasks in the task list
- Order tasks logically (e.g., by dependencies, by status, by task ID)
- Highlight tasks that are ready for execution (e.g., `TODO` status, no blocking dependencies)
- If user hasn't specified a task ID, prompt the user to select a task

### 4. Select Task for Execution
Determine which task to execute:
- If user specifies a task ID, select that task
- If user doesn't specify a task ID, prompt the user to select from available tasks
- Validate the selected task exists and is ready for execution
- Check task dependencies and ensure prerequisite tasks are completed

### 5. Check Task PRD Existence
Check if a task PRD exists for the selected task:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`
- If the task PRD exists, load it
- If the task PRD doesn't exist:
  - Inform the user that the task PRD is missing
  - Explain that task PRD is required for proper task execution
  - Prompt the user to use `/asdm-prd-breakdown` to generate the task PRD first
  - Offer to generate all missing task PRDs or only the selected task's PRD
  - Wait for user confirmation before proceeding
  - Stop the execution process until task PRDs are generated

### 6. Confirm Task Execution
Present the task details to the user and get confirmation:
- Show task ID and task name
- Display task description
- Show acceptance criteria
- Highlight any dependencies or risks
- Ask the user to confirm before proceeding with execution

### 7. Update Task Status to IN PROGRESS
Update the task list to mark the task as in progress:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- Update task status from `TODO` to `IN PROGRESS`
- Save the updated task list

### 8. Execute the Task
Implement the task based on the task PRD:
- Follow the implementation approach specified in the task PRD
- Adhere to project coding standards and conventions
- Implement acceptance criteria
- Write necessary tests (if required by the task PRD)
- Use available tools to create, modify, or delete files as needed
- Ensure the implementation is complete and functional

**Progressive Validation During Implementation**:
- After making significant code changes, run quick validation checks:
  - For compilation errors: Run compiler (e.g., `mvn compile`, `npm run build`)
  - For syntax errors: Use language-specific validators
- This helps catch issues early before final validation
- Fix any issues immediately before proceeding

### 9. Validate Task Completion
**CRITICAL**: Validation must be performed by **executing** the validation commands, not just displaying them to the user.

#### 9.1 Extract Validation Steps from Task PRD
From the task PRD, identify and extract:
- Validation steps from Section 3.2 "Implementation Steps"
- Validation tools from Section 4.1 "Primary Criteria"
- Any test methods specified in the acceptance criteria

#### 9.2 Execute Validation Commands
**REQUIRED**: Execute each validation command using the terminal:
- **For compilation checks**: Run the compiler command (e.g., `mvn compile`, `npm run build`, `tsc`)
  - Use `run_in_terminal` to execute the command
  - Capture and analyze the output
  - Verify there are no compilation errors
- **For test execution**: Run the test command (e.g., `mvn test`, `npm test`, `pytest`)
  - Use `run_in_terminal` to execute the command
  - Verify all tests pass
  - Check test coverage if specified
- **For code quality**: Run linters and formatters (e.g., `eslint`, `checkstyle`, `pylint`)
  - Use `run_in_terminal` to execute the command
  - Verify no linting errors or warnings
  - Apply auto-fixes if applicable
- **For type checking**: Run type checkers if applicable (e.g., `tsc --noEmit`, `mypy`)
  - Use `run_in_terminal` to execute the command
  - Verify no type errors

#### 9.3 Verify Acceptance Criteria
After running validation commands:
- Review all acceptance criteria from the task PRD
- Confirm each criterion is met based on validation results
- Verify alignment with feature PRD requirements
- Check for any unintended side effects
- Ensure code quality and adherence to standards

#### 9.4 Handle Validation Failures
If any validation command fails:
- **DO NOT** mark the task as DONE
- Analyze the error output
- Fix the issues identified by the validation tools
- Re-run the validation commands
- Only proceed to Step 10 when all validations pass

**Important**: The task can only be marked as DONE if ALL validation commands execute successfully. This ensures quality and prevents shipping broken code.

### 10. Update Task Status to DONE or FAILED
Update the task list with the final status:
- Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`
- If successful: Update status to `DONE`
- If failed: Update status to `BLOCKED` or `TODO` (depending on the situation)
- Add comments or notes about the execution result
- Save the updated task list

**Check if All Tasks Are Completed**:
After updating a task to `DONE`, check if all tasks in the task list are now completed:
- If all tasks are marked as `DONE`:
  - Update the feature status in `.asdm/workspace/features/features-list.md` from `PLANNED` or `IN PROGRESS` to `COMPLETED`
  - Update the **最后更新** (Last Updated) timestamp to the current date
  - Update the **摘要** (Summary) table to reflect the new status counts
  - Update the feature's **状态** (Status) column to `COMPLETED`
  - Update the feature's **进度** (Progress) to `100%`
  - Update the feature's **更新日期** (Updated Date) to the current date
  - Save the updated features-list.md
- If some tasks remain incomplete: Skip this step and continue with next task execution

### 11. Present Execution Summary
Present a summary of the task execution:
- Show task ID, task name, and final status
- Describe what was accomplished
- List any files that were created or modified
- **Report validation results**:
  - List all validation commands that were executed
  - Show validation status (passed/failed) for each command
  - Include relevant output or error messages
  - Confirm all validations passed before marking as DONE
- Highlight any issues or warnings
- Suggest next steps (e.g., execute next task, review changes)

**Validation Results Format**:
```
Validation Results:
✓ Compilation: mvn compile - PASSED
✓ Unit Tests: mvn test - PASSED (15/15 tests)
✓ Code Style: mvn checkstyle:check - PASSED
✓ Integration Tests: mvn verify - PASSED
```

## Execution Guidelines

### Task Execution Best Practices

#### 1. Follow Task PRD
- Strictly follow the task PRD's requirements and acceptance criteria
- Implement all specified features and functionality
- Do not deviate from the implementation approach without user approval
- If the task PRD is unclear, ask for clarification before proceeding

#### 2. Code Quality
- Adhere to project coding standards and conventions
- Write clean, readable, and maintainable code
- Include appropriate comments and documentation
- Follow language-specific best practices
- **Execute validation tools** to verify code quality (not just plan to run them)
- Address all issues reported by linters, formatters, and type checkers

#### 3. Testing
- Write unit tests as specified in the task PRD
- **Execute test suites** using the terminal to verify all tests pass
- Test acceptance criteria thoroughly
- Ensure edge cases are handled
- Verify no regressions in existing functionality
- **Capture and review test results** before marking task as complete

#### 4. Status Updates
- Update task list immediately when status changes
- Keep the user informed of progress
- Report any blockers or issues promptly
- Maintain accurate tracking of task progress

#### 5. Validation Execution (MANDATORY)
**Critical Requirement**: Validation must be performed by **executing commands**, not by describing what should be run.

- **Extract validation commands** from the task PRD:
  - Section 3.2 "Implementation Steps" - look for validation steps
  - Section 4.1 "Acceptance Criteria" - identify validation tools
- **Execute each validation command** using `run_in_terminal`:
  - Run compilation/build commands to verify code compiles
  - Run test suites to verify functionality works correctly
  - Run linters to ensure code quality standards
  - Run type checkers to catch type errors
  - Run any other validation tools specified in the PRD
- **Analyze results**:
  - Check exit codes (0 = success, non-zero = failure)
  - Review error messages and warnings
  - Verify all tests pass
  - Ensure no compilation or linting errors
- **Fix issues before completion**:
  - If validation fails, fix the issues
  - Re-run validation commands after fixes
  - Do not mark task as DONE until all validations pass

**Examples of validation execution**:
```bash
# Java projects
mvn clean compile    # Verify compilation
mvn test            # Run unit tests
mvn checkstyle:check # Code style validation

# JavaScript/TypeScript projects
npm run build       # Verify build succeeds
npm test           # Run test suite
npm run lint       # Code quality check
tsc --noEmit       # Type checking

# Python projects
python -m py_compile src/**/*.py  # Compilation check
pytest             # Run tests
pylint src/        # Linting
mypy src/          # Type checking
```

**Never skip this step**: Validation execution is mandatory for all code-related tasks.

#### 5. Dependency Management
- Check task dependencies before execution
- Ensure prerequisite tasks are completed
- Handle blocking issues appropriately
- Update task list if dependencies change

### Handling Different Task Types

Different types of tasks require different execution approaches:

#### Analysis and Design Tasks
- Create or update documentation
- Generate diagrams or specifications
- Include stakeholder review steps
- Document design decisions and trade-offs

#### Code Implementation Tasks
- Create or modify source files
- Follow coding standards and conventions
- Include unit tests
- Ensure code reviews (if applicable)

#### Testing Tasks
- Implement test cases and scenarios
- Verify test coverage requirements
- Report and track bugs
- Document test results

### Error Handling

#### During Execution
- If a task fails during execution:
  - Identify the root cause
  - Update task status to `BLOCKED` with explanation
  - Suggest solutions or workarounds
  - Ask user for direction on how to proceed

#### If Task PRD is Insufficient
- If the task PRD doesn't provide enough guidance:
  - Ask user for additional requirements or clarification
  - Propose a specific approach and get approval
  - Document the decision in the task PRD

#### If Dependencies Are Blocked
- If prerequisite tasks are not completed:
  - Update task status to `BLOCKED`
  - Identify which tasks need to be completed first
  - Suggest executing those tasks first
  - Ask user for confirmation

## Usage

To use this instruction, the AI model should:

1. **Receive Feature Selection**: Get the feature ID or name from the user
2. **Detect Language**: Detect and set the response language
3. **Validate Feature**: Check if the feature directory and necessary files exist
4. **Load Context**: Read task list, feature PRD, and any additional context files
5. **Present Tasks**: Display available tasks with their status to the user
6. **Select Task**: Either use user-specified task ID or prompt user to select a task
7. **Check Task PRD**: Verify task PRD exists, prompt user to use `/asdm-prd-breakdown` if missing
8. **Confirm Execution**: Present task details and get user confirmation
9. **Update Status**: Mark task as `IN PROGRESS` in the task list
10. **Execute Task**: Implement the task based on task PRD requirements
11. **Validate Completion**: **Execute validation commands** specified in the task PRD
    - Extract validation steps and tools from task PRD
    - Run each validation command using terminal
    - Verify all validations pass
    - Fix any issues and re-run validations
12. **Update Status**: Mark task as `DONE` only if all validations pass, or `BLOCKED` if validations fail
    - **If all tasks are now DONE**: Update feature status to `COMPLETED` in `features-list.md`
    - **If some tasks remain incomplete**: Continue with next task
13. **Present Summary**: Show execution summary with validation results and suggest next steps

### User Interaction Guidelines

#### Before Starting Execution
- Ask the user to specify which feature to execute tasks for
- If multiple features exist, present a list of features from `features-list.md`
- Present all available tasks with their status (task ID, task name, status)
- If user doesn't specify a task, prompt them to select one from the list

#### During Task Selection
- Show task ID, task name, current status, and brief description
- Highlight tasks that are ready for execution (TODO status, no blockers)
- Show task dependencies if any
- Ask user to confirm the selected task

#### Before Execution
- Present detailed task information from task PRD
- Show acceptance criteria
- Highlight any risks or dependencies
- Ask for explicit confirmation before starting execution

#### During Execution
- Provide regular progress updates
- Notify user of any issues or warnings
- Ask for clarification if requirements are ambiguous
- Report any unexpected results

#### After Execution
- Present a comprehensive summary of what was done
- List files that were created or modified
- Show final task status
- Suggest next steps (e.g., execute next task, review feature)
- Ask if user wants to execute additional tasks

## Task Status Management

**Note**: Detailed task status management guidelines are available in `.asdm/toolsets/task-planner-executor/spec/task-list.md`, including:
- Status values and their meanings
- Valid status transitions
- Status update procedures
- Summary table maintenance

Refer to the spec template for comprehensive guidelines on managing task status during execution.

### Updating Task List
When updating the task list:
- Update the status immediately when it changes
- Update the Last Updated date
- Maintain accurate tracking of task progress
- Save the updated task list after each status change
- Keep the Summary table accurate

## Output Summary

After completing task execution, the following outputs will be generated:

### Required Documents (Pre-Existing)
- **Task PRD** (must exist before execution):
  - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/<task-id>-<task-name>-prd.md`
  - Contains detailed task requirements and guidance
  - If missing, user should use `/asdm-prd-breakdown` to generate it first

### Updated Documents
- **Task List**: Updated with current task status
  - Path: `.asdm/workspace/features/<feature-id>-<feature-name>/task-list.md`

### Implementation Artifacts
- **Source Files**: Created or modified based on task requirements
- **Test Files**: Unit tests or integration tests (if required)
- **Documentation**: Updated or created documentation (if applicable)

### Execution Summary
The execution process should provide a summary that includes:
- Task ID and task name
- Final task status
- Description of what was accomplished
- List of files created or modified
- **Validation results**:
  - Commands executed for validation
  - Validation status (passed/failed) for each command
  - Summary of test results (e.g., "15/15 tests passed")
  - Any warnings or issues detected during validation
- Any issues or warnings encountered
- Recommendations for next steps

**Example Execution Summary**:
```
Task Execution Summary
======================
Task ID: T001
Task Name: Implement User Service API
Status: DONE

Accomplishments:
- Created UserController.java with REST endpoints
- Implemented UserService business logic
- Added unit tests for all methods
- Updated API documentation

Files Modified:
- src/main/java/com/example/UserController.java (created)
- src/main/java/com/example/UserService.java (created)
- src/test/java/com/example/UserServiceTest.java (created)

Validation Results:
✓ Compilation: mvn clean compile - PASSED
✓ Unit Tests: mvn test - PASSED (12/12 tests)
✓ Code Style: mvn checkstyle:check - PASSED
✓ Integration Tests: mvn verify - PASSED

Next Steps:
- Execute task T002: Implement User Repository
- Review changes and commit to version control
```

## Continuous Execution Mode

### Execute All Tasks
For executing all tasks in a feature:
- Present all tasks in execution order
- Explain the execution plan and dependencies
- Get user confirmation to proceed
- Execute tasks sequentially
- **After each task implementation**:
  - Execute all validation commands specified in task PRD
  - Verify all validations pass
  - Only mark task as DONE if validations succeed
  - If validation fails, stop and fix issues
  - **After marking a task as DONE**:
    - Check if all tasks in the feature are now DONE
    - If yes: Update feature status to `COMPLETED` in `features-list.md`
    - If no: Continue with next task
- After each task completion, present summary with validation results
- Ask to continue to next task
- Stop if a task fails validation or is blocked
- **When all tasks are complete**: Feature status will be automatically updated to `COMPLETED` in `features-list.md`

### Handling Task Dependencies
When executing multiple tasks:
- Identify task dependencies from task list
- Execute tasks in dependency order
- Ensure prerequisite tasks are completed before dependent tasks
- Update task list as tasks are completed
- Handle blocking tasks appropriately

### Progress Tracking
When executing multiple tasks:
- Track overall progress (e.g., 3/10 tasks completed)
- Highlight remaining tasks
- Show estimated remaining effort
- Provide progress updates after each task completion

## Error Handling

### Common Scenarios and Solutions

#### Feature Not Found
- **Error**: Feature directory or task list doesn't exist
- **Solution**: Inform the user and suggest using `/asdm-prd-planning` to create the feature first

#### Task Not Found
- **Error**: Specified task ID doesn't exist in the task list
- **Solution**: Present available tasks and ask user to select a valid task

#### Task Already Completed
- **Error**: Task is already marked as `DONE`
- **Solution**: Inform the user and ask if they want to re-execute the task or select a different task

#### Task Blocked
- **Error**: Task is marked as `BLOCKED`
- **Solution**: Identify blocking issues, resolve them, or ask user for direction

#### Execution Failed
- **Error**: Task execution encountered errors or issues
- **Solution**: Update status to `BLOCKED` with explanation, identify root cause, suggest solutions, and ask user for direction

#### Validation Failed
- **Error**: Validation commands failed (compilation errors, test failures, linting errors, etc.)
- **Solution**: 
  - Do not mark task as DONE
  - Analyze the error output from validation commands
  - Fix the issues reported by the validation tools
  - Re-run the validation commands
  - Only mark as DONE when all validations pass
  - If unable to fix, mark as BLOCKED with detailed explanation

#### Task PRD Missing
- **Error**: Task PRD doesn't exist for the selected task
- **Solution**: Prompt user to use `/asdm-prd-breakdown` to generate the task PRD first
  - Explain that task PRD is required for proper execution
  - Offer to generate all missing task PRDs or only the selected task's PRD
  - Wait for user to complete task breakdown before proceeding with execution

#### Insufficient Context
- **Error**: Cannot execute task due to missing or unclear requirements
- **Solution**: Ask the user for clarification or additional requirements

#### Dependency Issues
- **Error**: Prerequisite tasks are not completed
- **Solution**: Identify blocking tasks, suggest executing them first, or ask user to update task status

### Recovery Strategies

When execution fails or is blocked:

1. **Identify Root Cause**: Determine why the task failed or is blocked
2. **Document Issues**: Update task list with detailed explanation
3. **Propose Solutions**: Suggest specific actions to resolve the issue
4. **Seek User Input**: Ask user for direction on how to proceed
5. **Plan Next Steps**: Define clear next steps for resuming execution

## Integration with Other Actions

### asdm-prd-planning
- Use `/asdm-prd-planning` to create new features and task plans
- Ensure feature and task list exist before attempting execution

### asdm-prd-breakdown
- Use `/asdm-prd-breakdown` to generate task PRDs for all tasks before execution
- Task PRDs must exist before task execution can proceed
- If task PRD is missing during execution, user will be prompted to use `/asdm-prd-breakdown` first

### Context Builder
- Reference project context from `.asdm/contexts/`
- Ensure task execution aligns with project standards and architecture
- Use context files for implementation guidance
