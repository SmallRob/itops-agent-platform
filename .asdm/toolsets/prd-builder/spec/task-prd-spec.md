# Task PRD Template

## Language Guidelines

This Task PRD must use the detected response language from the environment. Ensure all content in this document follows:

1. **Language Consistency**: Use the same language throughout the entire document
2. **Writing Conventions**: Follow the detected language's writing style and formatting
3. **Clarity**: Ensure content is clear and understandable in the chosen language

**Supported Languages**:
- English (en)
- Chinese (zh)
- Other languages based on environment detection

---

## Document Structure

Use the following template structure when generating a Task PRD:

```markdown
# Task PRD: <Task Name>

**Feature ID**: <feature-id>
**Feature Name**: <feature-name>
**Task ID**: <unique-task-id>
**Created Date**: <YYYY-MM-DD>
**Status**: TODO | IN PROGRESS | DONE | BLOCKED | CANCELLED
**Language**: <detected-language>

## 1. Task Overview

### 1.1 Task Summary
Provide a concise summary of the task:
- What the task accomplishes
- Why the task is needed
- Which feature requirements this task fulfills

### 1.2 Task Objectives
List the primary objectives of this task:
- Objective 1: ...
- Objective 2: ...
- ...

### 1.3 Related Feature Requirements
Reference the feature PRD requirements this task fulfills:
- Feature requirement: <reference to feature requirement>
- Related user story: <reference to user story>
- ...

## 2. Detailed Requirements

### 2.1 Functional Requirements
List the functional requirements for this task:
- Requirement 1: Specific, actionable functional requirement
- Requirement 2: ...
- ...

### 2.2 Technical Requirements
List the technical requirements:
- Requirement 1: Specific technical constraint or requirement
- Requirement 2: ...
- ...

### 2.3 Constraints and Limitations
Specify any constraints or limitations:
- Constraint 1: Limitation or constraint
- Constraint 2: ...
- ...

## 3. Implementation Approach

### 3.1 Recommended Methodology
Describe the recommended approach or methodology:
- Approach 1: Description of the approach
- Approach 2: ...
- ...

### 3.2 Implementation Steps
Outline key steps or phases for implementation:
1. Step 1: Description
2. Step 2: Description
3. ...

**Important**: Always include a validation step using deterministic tools:
- **Validation Step**: Verify implementation using appropriate tools:
  - For code changes: Run compiler, linter, and formatter
  - For functionality: Run unit tests and integration tests
  - For configuration: Validate syntax and schema
  - For documentation: Check for broken links and formatting
  - Example: "Run `mvn clean compile` to verify Java code compiles without errors"
  - Example: "Execute `npm run test` to verify all unit tests pass"
  - Example: "Run `npm run lint` to ensure code meets style guidelines"

### 3.3 Technical Considerations
Identify any technical considerations or best practices:
- Consideration 1: Technical consideration or best practice
- Consideration 2: ...
- ...

### 3.4 Reference to Project Context
Reference relevant project context files:
- `.asdm/contexts/standard-project-structure.md`: Structure guidance
- `.asdm/contexts/standard-coding-style.md`: Coding standards
- `.asdm/contexts/architecture.md`: Architecture guidelines
- `.asdm/contexts/data-models.md`: Data model information
- `.asdm/contexts/api.md`: API specifications
- ...

## 4. Acceptance Criteria

Define clear, testable criteria for task completion:

### 4.1 Primary Criteria
- **Criterion 1**: Measurable and verifiable acceptance criterion
  - Test method: How to verify this criterion
  - **Validation tool**: Specify the deterministic tool to validate (e.g., compiler, test runner, linter)
- **Criterion 2**: ...
  - Test method: ...
  - **Validation tool**: ...

**Mandatory**: Each criterion must include at least one deterministic validation method:
- Code compilation: `mvn compile`, `npm run build`, `tsc`, `go build`, etc.
- Test execution: `mvn test`, `npm test`, `pytest`, `go test`, etc.
- Code quality: `eslint`, `checkstyle`, `pylint`, `golangci-lint`, etc.
- Type checking: `tsc --noEmit`, `mypy`, `flow`, etc.
- Security scanning: `npm audit`, `safety check`, `gosec`, etc.

### 4.2 Edge Cases
Specify any edge cases to handle:
- Edge case 1: Description and expected behavior
- Edge case 2: ...
- ...

### 4.3 Negative Tests
Include negative test cases:
- Negative test 1: Description and expected behavior
- Negative test 2: ...
- ...

## 5. Dependencies

### 5.1 Task Dependencies
Identify dependencies on other tasks:
- **Depends on**: <task-id>-<task-name> (reason)
- **Blocks**: <task-id>-<task-name> (reason)

### 5.2 External Dependencies
Identify external dependencies:
- API: <API name and version>
- Library: <library name and version>
- Service: <service name>
- ...

### 5.3 Prerequisites
Specify any prerequisites that must be met:
- Prerequisite 1: Description
- Prerequisite 2: ...
- ...

## 6. Estimated Effort

Provide a rough estimate of implementation effort:

### 6.1 Effort Estimate
- **Estimated effort**: <X hours> or <X story points>
- **Complexity**: Low | Medium | High
- **Risk**: Low | Medium | High

### 6.2 Effort Factors
Note any factors that could affect the estimate:
- Factor 1: How it affects effort
- Factor 2: ...
- ...

## 7. Testing Strategy

### 7.1 Automated Validation (Required)
Specify deterministic validation tools and commands:
- **Build validation**: Command to compile/build the code (e.g., `mvn clean install`, `npm run build`)
- **Test execution**: Command to run automated tests (e.g., `mvn test`, `npm test`)
- **Code quality**: Command to check code quality (e.g., `eslint .`, `mvn checkstyle:check`)
- **Type checking**: Command for type validation (e.g., `tsc --noEmit`, `mypy src/`)
- **Exit criteria**: All validation commands must exit with code 0 (success)

### 7.2 Unit Testing
- Unit test requirements: Description
- Test coverage target: <percentage>%
- **Validation command**: Specific command to run unit tests
- **Success criteria**: All tests pass and coverage meets target

### 7.3 Integration Testing
- Integration test requirements: Description
- Test scenarios: List scenarios
- **Validation command**: Specific command to run integration tests
- **Success criteria**: All integration tests pass

### 7.4 Manual Testing
- Manual test procedures: Description
- User acceptance criteria: Description
- **Note**: Manual testing supplements but does not replace automated validation

## 8. Implementation Notes

Provide additional context or notes for implementation:
- Note 1: Implementation guidance
- Note 2: ...
- ...

## 9. Risks and Mitigations

### Risk 1
- **Description**: Describe the risk
- **Impact**: High | Medium | Low
- **Mitigation**: How to mitigate this risk

### Risk 2
...

## 10. Deliverables

List the expected deliverables:
- Deliverable 1: Description
- Deliverable 2: ...
- ...

**Mandatory Deliverable**: Validation Results
- **Build output**: Evidence that code compiles successfully (build logs, exit code 0)
- **Test results**: Evidence that all tests pass (test reports, coverage reports)
- **Quality checks**: Evidence that code meets quality standards (linter output, static analysis results)
- **Validation log**: Complete log of all validation commands executed and their results

---

## Status Management

This task's status will be tracked using these values:
- **TODO**: Task not yet started
- **IN PROGRESS**: Task currently being worked on
- **DONE**: Task completed successfully
- **BLOCKED**: Task blocked by dependencies or issues
- **CANCELLED**: Task cancelled

### Status Transitions
Follow these status transitions during execution:
- `TODO` → `IN PROGRESS`: When task execution begins
- `IN PROGRESS` → `DONE`: When task completes successfully
- `IN PROGRESS` → `BLOCKED`: When task encounters blocking issues
- `IN PROGRESS` → `TODO`: When task needs to be restarted
- `BLOCKED` → `IN PROGRESS`: When blocking issues are resolved

---

---

## Task PRD Content Guidelines

When generating task PRDs, follow these guidelines:

### 1. Task Description
- Provide a clear, concise summary of what the task accomplishes
- Explain the purpose and value of the task
- Reference the feature requirements that this task fulfills

### 2. Detailed Requirements
- Break down requirements into specific, actionable items
- Include functional requirements (what the task should do)
- Include technical requirements (how the task should be implemented)
- Specify any constraints or limitations

### 3. Implementation Approach
- Suggest a recommended approach or methodology
- Outline key steps or phases for implementation
- Identify any technical considerations or best practices
- Reference relevant project context files (e.g., coding style, architecture)

### 4. Acceptance Criteria
- Define clear, testable criteria for task completion
- Include both positive and negative test cases
- Specify any edge cases to handle
- Ensure criteria are measurable and verifiable
- **Critical**: Specify deterministic validation tools for each criterion
- Include specific commands to verify each acceptance criterion
- Ensure validation can be automated (compiler, tests, linters, etc.)
- Define success criteria as tool exit codes (exit 0 = success)

### 5. Dependencies
- Identify any dependencies on other tasks
- Identify any external dependencies (APIs, libraries, etc.)
- Specify any prerequisites that must be met
- Identify any tasks that depend on this task

### 6. Estimated Effort
- Provide a rough estimate of implementation effort
- Consider complexity, dependencies, and risk factors
- Use appropriate effort units (hours, story points, etc.)
- Note any factors that could affect the estimate

---

## Task PRD Best Practices

### 1. Alignment with Feature PRD
- Ensure task requirements align with feature requirements
- Reference specific user stories or requirements from feature PRD
- Maintain consistency with feature scope and objectives

### 2. Clarity and Specificity
- Use clear, unambiguous language
- Avoid vague requirements or open-ended tasks
- Be specific about expected outcomes

### 3. Feasibility
- Ensure tasks are technically feasible
- Consider available resources and constraints
- Identify potential risks or challenges

### 4. Testability and Validation
- Ensure acceptance criteria are testable
- Define clear success metrics
- Include verification steps
- **Critical**: Specify deterministic validation tools for every task
- Use automated tools (compilers, test runners, linters) over manual verification
- Define explicit validation commands with expected exit codes
- Avoid subjective validation methods ("code looks good", "seems to work")
- Ensure validation steps can be executed by AI models and CI/CD systems
- Include validation commands in implementation steps

### 5. Maintainability
- Consider long-term maintenance implications
- Follow project coding standards and conventions
- Document any design decisions or trade-offs

---

## Handling Different Task Types

Different types of tasks may require different breakdown approaches:

### Analysis and Design Tasks
- Focus on documentation, diagrams, and specifications
- Include stakeholder review and approval steps
- Define deliverables clearly

### Code Implementation Tasks
- Include specific files or components to modify/create
- Reference coding standards and conventions
- Include unit testing requirements
- Consider code review process
- **Mandatory validation steps**:
  - Compilation check: Specify compiler command and version
  - Unit test execution: Specify test runner command
  - Linter/formatter: Specify code quality tool commands
  - Type checking: Specify type checker command (if applicable)
  - Integration test: Specify integration test command (if applicable)
  - Build verification: Specify build command to ensure deployability

### Testing Tasks
- Define test scenarios and test cases
- Specify test environment and data requirements
- Include test coverage requirements
- Define bug reporting and tracking process

---

## Usage Guidelines

When generating a Task PRD using this template:

1. **Detect Language First**: Always detect and use the response language before generating any content
2. **Read Feature Context**: Read the feature PRD and task list to understand requirements
3. **Load Additional Context**: Progressively load additional context files as needed
4. **Generate Unique ID**: Ensure the task ID matches the task list
5. **Complete All Sections**: Fill out all relevant sections of the template
6. **Be Specific**: Use clear, specific, and measurable language
7. **Align with Project Standards**: Ensure alignment with project architecture, coding style, and conventions
8. **Ensure Testability**: Make all acceptance criteria testable and verifiable10. **Include Validation Steps**: Every task MUST include deterministic validation steps:
    - Specify exact commands to validate the task completion
    - Use automated tools: compilers, test runners, linters, etc.
    - Define success criteria as tool exit codes
    - Avoid subjective validation ("looks good", "works fine")
    - Ensure AI models can execute validation commands
    - Document expected outputs and error conditions
---

## Related Spec Documents

This spec template works with the following spec documents:

- **feature-prd-spec.md**: Template for the feature PRD
- **task-list.md**: Template for the task list document
- **features-list.md**: Template for the features tracking list

---

## Related Actions

This spec template is used by the following actions:

- **/asdm-task-planning**: Generates the feature PRD and task list (task PRDs are generated later)
- **/asdm-task-breakdown**: Generates task PRDs using this template
- **/asdm-task-execution**: Executes tasks based on the task PRDs generated from this template
