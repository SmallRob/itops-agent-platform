# Feature PRD Template

## Language Guidelines

This Feature PRD must use the detected response language from the environment. Ensure all content in this document follows:

1. **Language Consistency**: Use the same language throughout the entire document
2. **Writing Conventions**: Follow the detected language's writing style and formatting
3. **Clarity**: Ensure content is clear and understandable in the chosen language

**Supported Languages**:
- English (en)
- Chinese (zh)
- Other languages based on environment detection

---

## Document Structure

Use the following template structure when generating a Feature PRD:

```markdown
# Feature PRD: <Feature Name>

**Feature ID**: <unique-feature-id>
**Created Date**: <YYYY-MM-DD>
**Status**: PLANNED | IN PROGRESS | COMPLETED | CANCELLED
**Language**: <detected-language>

## 1. Overview

### 1.1 Feature Summary
Provide a concise summary of the feature:
- What the feature does
- Why it's needed
- Who benefits from it

### 1.2 Objectives
List the primary objectives of this feature:
- Objective 1: ...
- Objective 2: ...
- ...

## 2. User Stories

Describe the feature from the user's perspective:

### Story 1
**As a** <user role>
**I want to** <action>
**So that** <benefit>

**Acceptance Criteria**:
- Criterion 1
- Criterion 2
- ...

### Story 2
...

## 3. Functional Requirements

List the functional requirements for this feature:

### Requirement 1
- **ID**: REQ-001
- **Description**: Detailed description of the requirement
- **Priority**: High | Medium | Low
- **Related Stories**: Story 1, Story 2

### Requirement 2
...

## 4. Non-Functional Requirements

### 4.1 Performance
- Performance requirement 1
- Performance requirement 2

### 4.2 Security
- Security requirement 1
- Security requirement 2

### 4.3 Scalability
- Scalability requirement 1
- ...

### 4.4 Reliability
- Reliability requirement 1
- ...

## 5. Technical Requirements

### 5.1 Architecture Considerations
- Architecture constraint or consideration 1
- Architecture constraint or consideration 2

### 5.2 Dependencies
- Dependency 1 (internal/external)
- Dependency 2

### 5.3 Constraints
- Technical constraint 1
- Technical constraint 2

## 6. Success Criteria

Define measurable criteria for successful completion:
- Success criterion 1 (measurable)
- Success criterion 2 (measurable)
- ...

## 7. Task Breakdown Principles

When breaking down this feature into tasks, follow these principles:

### 7.1 Granularity
- Each task should be limited to 1-2 hours of work for a human developer (approximately 5-10 minutes for an AI model)
- Tasks should be manageable and focused

### 7.2 Independence
- Minimize dependencies between tasks
- Enable parallel execution where possible

### 7.3 Testability
- Each task should have clear acceptance criteria
- Ensure tasks can be verified independently

### 7.4 Task Categories
Tasks may fall into these categories:
- Analysis and design
- Code implementation
- Testing (unit)

### 7.5 Task Count Limitation
- The feature should ideally have 10 or fewer tasks
- If task count exceeds 10, the feature should be decomposed into smaller sub-features

## 8. Implementation Notes

Provide additional context or notes for implementation:
- Note 1
- Note 2
- ...

## 9. Risks and Mitigations

### Risk 1
- **Description**: Describe the risk
- **Impact**: High | Medium | Low
- **Mitigation**: How to mitigate this risk

### Risk 2
...

## 10. Appendix

### 10.1 References
- Reference 1
- Reference 2

### 10.2 Glossary
- Term 1: Definition
- Term 2: Definition

---

## Task Count Validation

After generating the task list for this feature, validate:

- If task count is **10 or fewer**: Proceed with task breakdown and execution
- If task count is **more than 10**:
  - The feature is too large and needs to be decomposed
  - Break down the feature into smaller, more manageable sub-features
  - Re-plan each sub-feature individually

## Status Management

This feature's status will be tracked using these values:
- **PLANNED**: Feature is planned but not yet started
- **IN PROGRESS**: Feature is currently being implemented
- **COMPLETED**: Feature has been successfully implemented
- **CANCELLED**: Feature has been cancelled
```

---

## Usage Guidelines

When generating a Feature PRD using this template:

1. **Detect Language First**: Always detect and use the response language before generating any content
2. **Read Context**: Read `.asdm/contexts/index.md` to understand the workspace context
3. **Load Additional Context**: Progressively load additional context files as needed based on the feature requirements
4. **Generate Unique ID**: Ensure the feature ID is unique by checking `.asdm/workspace/features/features-list.md`
5. **Complete All Sections**: Fill out all relevant sections of the template
6. **Be Specific**: Use clear, specific, and measurable language
7. **Consider Task Granularity**: Keep in mind that this feature will be broken down into 10 or fewer tasks
8. **Align with Project Standards**: Ensure alignment with project architecture, coding style, and conventions

---

## Related Spec Documents

This spec template works with the following spec documents:

- **task-prd-spec.md**: Template for generating detailed task PRDs
- **task-list.md**: Template for the task list document
- **features-list.md**: Template for the features tracking list

---

## Related Actions

This spec template is used by the following actions:

- **/asdm-task-planning**: Generates the Feature PRD using this template
- **/asdm-task-breakdown**: Breaks down tasks based on the Feature PRD generated from this template
- **/asdm-task-execution**: Executes tasks based on the Feature PRD and task PRDs
