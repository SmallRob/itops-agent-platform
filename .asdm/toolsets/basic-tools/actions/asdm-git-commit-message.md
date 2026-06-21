# ASDM Action: Generate Git Commit Message

## Overview

This action generates a standard git commit message based on the current changes in the repository.

## Purpose

- Automatically generate consistent, well-formatted commit messages
- Follow standard commit message conventions
- Improve code history readability and maintainability
- Enable quick commit workflows

## Steps

1. Analyze staged and unstaged changes
2. Categorize changes (feature, bugfix, refactor, docs, etc.)
3. Extract relevant context from code changes
4. Generate a commit message following the standard spec
5. Present the generated message for review and approval

## Usage

This action is invoked when the user needs to create a commit and wants AI assistance in generating an appropriate commit message.

## Input

- Current git repository status
- Staged changes
- Unstaged changes
- Diff information

## Output

- Generated commit message
- Message type/category
- Suggested related changes (if any)

## Language Detection

Before generating any commit messages or providing guidance, you must detect and use the current environment's response language:

1. **Detect Response Language**: Analyze the environment settings to determine the primary language:
   - Check system/user language settings or environment configuration
   - Identify the primary language used in project documentation and comments
   - Determine the language preference based on workspace context

2. **Apply Language Consistency**: Ensure all generated content uses the detected language:
   - Use the same language for all commit message examples, explanations, and documentation
   - Maintain language consistency across all generated content
   - Follow the detected language's writing conventions and formatting

3. **Supported Languages**:
   - English (en)
   - Chinese (zh)
   - Other languages as needed based on environment detection

**IMPORTANT**: The language detection is the FIRST step before any commit message generation or guidance. All output must consistently use the detected language throughout the entire process.

## Commit Message Format

The generated commit messages follow these conventions:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: A new feature
- **fix**: A bug fix
- **refactor**: Code refactoring without feature changes
- **docs**: Documentation updates
- **style**: Code style changes (formatting, semicolons, etc.)
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, tools

### Example
```
feat(user-auth): add login form validation

- Add email format validation
- Add password strength checker
- Display error messages on validation failure

Closes #123
```
