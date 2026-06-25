# Git Commit Message Specification

**Document Version**: 1.0  
**Last Updated**: 2026-01-21

## Overview

This specification defines the standard format and conventions for git commit messages in the project. It ensures consistency, readability, and maintainability of the commit history.

## Commit Message Format

All commit messages MUST follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Components

#### 1. Header (Required)

The header is a single line consisting of `<type>`, `<scope>`, and `<subject>`.

**Type** (required)
- Describes the nature of the change
- Must be one of the following:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `refactor`: Code refactoring without feature or bug fix changes
  - `docs`: Documentation updates
  - `style`: Code style changes (formatting, missing semicolons, etc.)
  - `test`: Adding or updating tests
  - `chore`: Build process, dependencies, tooling, or package updates
  - `ci`: CI/CD configuration changes
  - `perf`: Performance improvements

**Scope** (optional)
- Specifies the area or component affected by the change
- Examples: `auth`, `api`, `ui`, `database`, `payment`, etc.
- Use lowercase and hyphens for multi-word scopes
- If no scope applies, omit the parentheses

**Subject** (required)
- Concise description of the change (50 characters or less)
- Use imperative, present tense: "add" not "added" or "adds"
- Don't capitalize the first letter (unless it's a proper noun)
- Don't end with a period (.)
- Be specific and descriptive

#### 2. Body (Optional)

- Explain WHAT and WHY, not HOW
- Separate from header with a blank line
- Use imperative, present tense
- Wrap at 72 characters per line
- Include information about breaking changes
- Bullet points are acceptable

#### 3. Footer (Optional)

- Reference related issues or tickets
- Indicate breaking changes with `BREAKING CHANGE:`
- Use the format: `Closes #123` or `Fixes #456`
- Multiple footers can be included

## Examples

### Simple Feature
```
feat(auth): add password reset functionality

- Add email verification step
- Generate secure reset tokens
- Send reset email with token link
- Validate token before allowing password change

Closes #234
```

### Bug Fix
```
fix(api): handle null values in user response

Previously, the API would crash when user data contained null values.
Added proper null checks and default values.

Closes #567
```

### Refactoring
```
refactor(database): extract connection logic into separate module

Improve code maintainability and testability by separating database
connection logic from business logic.
```

### Documentation
```
docs: update API documentation for v2.0 endpoints
```

### Chore with Breaking Change
```
chore(deps): upgrade Spring Boot to 3.0

BREAKING CHANGE: Java 17 is now required (previously supported Java 11+)
```

## Best Practices

1. **Commit Frequently**: Make small, logical commits rather than large ones
2. **Be Descriptive**: Provide enough context for future developers to understand the change
3. **Reference Issues**: Always link related issues or tickets using closing keywords
4. **Avoid Vague Messages**: Don't use "fix stuff", "update", or "misc changes"
5. **Use Present Tense**: Write as if you're describing what the commit does
6. **Separate Concerns**: Don't mix multiple unrelated changes in a single commit

## Validation Rules

✅ Valid commit messages:
- `feat(user): add email verification`
- `fix: correct typo in welcome message`
- `docs(readme): update installation instructions`
- `style(css): format button styles`

❌ Invalid commit messages:
- `Updated user service` (capitalized, past tense)
- `fix bug in auth` (missing scope clarity)
- `asdm-123: implemented feature` (ticket number in subject)
- `Fixed a lot of stuff` (vague, too general)

## References

- This specification is based on the Conventional Commits standard
- See [Conventional Commits](https://www.conventionalcommits.org/) for more information
