# Git Commit Specification

**Document Version**: 1.0  
**Last Updated**: 2026-01-21

## Overview

This specification defines the standard process and requirements for committing changes to the repository. It works in conjunction with the [git-commit-message-spec.md](./git-commit-message-spec.md) which defines the commit message format.

## Commit Process

### Prerequisites

Before committing changes, ensure:

1. **Working Directory is Clean**: No unintended changes are staged
2. **Changes Are Relevant**: Related changes are grouped together logically
3. **Commit Message is Ready**: A descriptive message following the commit message spec
4. **Tests Pass**: All relevant tests pass before committing
5. **Code Review**: Changes have been reviewed (if required by project policy)

### Steps

#### 1. Review Changes

```bash
git status                    # Check what files have been modified
git diff                      # Review detailed changes
git diff --staged             # Review staged changes
```

#### 2. Stage Changes

```bash
git add <file>                # Stage specific files
# or
git add .                     # Stage all changes (use with caution)
```

#### 3. Review Staged Changes

```bash
git diff --staged             # Verify staged changes
```

#### 4. Create Commit

```bash
git commit -m "message"       # Commit with inline message
# or
git commit                    # Opens editor for longer messages
```

#### 5. Verify Commit

```bash
git log -1 --stat             # View the most recent commit
```

## Commit Guidelines

### Logical Commits

- **One Concern Per Commit**: Each commit should represent one logical change
- **Atomic Commits**: Changes should be complete and not break the build
- **Related Changes**: Group related changes together (e.g., feature implementation + tests)
- **Separate Concerns**: Don't mix refactoring with feature additions in the same commit

### Commit Frequency

- **Commit Often**: Aim for multiple commits per feature/fix
- **Avoid Large Commits**: Commits with 100+ lines of changes should be reviewed
- **Reasonable Size**: Aim for 10-50 lines of changes per commit when possible

### File Organization in Commits

✅ Good:
- Commit A: Add new authentication module
- Commit B: Update UI to use authentication
- Commit C: Add authentication tests

❌ Poor:
- Commit A: Add authentication, update UI, fix database, update docs (too many changes)

## Commit Message Requirements

All commits MUST include:

1. **Type**: One of: feat, fix, refactor, docs, style, test, chore, ci, perf
2. **Scope**: Affected component or area (optional but recommended)
3. **Subject**: Clear, concise description (50 chars or less)
4. **Body**: Explanation of what and why (optional for simple commits)
5. **Footer**: Related issues or breaking changes (use Closes #123 format)

Refer to [git-commit-message-spec.md](./git-commit-message-spec.md) for detailed message format requirements.

## Special Cases

### Commits Referencing Issues

When your commit addresses an issue, reference it in the footer:

```
feat(api): add user endpoint

Closes #456
```

Supported keywords:
- `Closes`, `Fixes`, `Resolves` (closes the issue)
- `Related to`, `Ref` (references without closing)

### Breaking Changes

If your commit introduces breaking changes, clearly indicate this:

```
refactor(api): restructure authentication API

BREAKING CHANGE: The old login endpoint is deprecated.
Use the new /auth/login endpoint instead.
```

### Co-authored Commits

For collaborative work:

```
feat(feature): implement new functionality

Co-authored-by: John Doe <john@example.com>
Co-authored-by: Jane Smith <jane@example.com>
```

## Restrictions

### DO NOT

- ❌ Commit directly to `main` or `master` (use feature branches)
- ❌ Include debugging code or console.log statements
- ❌ Commit binary files unnecessarily
- ❌ Mix multiple unrelated changes
- ❌ Force push to shared branches
- ❌ Include secrets, passwords, or API keys
- ❌ Commit with vague messages like "fixed stuff" or "updates"

### DO

- ✅ Create descriptive, meaningful commit messages
- ✅ Commit logical, related changes together
- ✅ Reference related issues and pull requests
- ✅ Test before committing
- ✅ Review diffs before committing
- ✅ Use feature branches for development

## Workflow Integration

### With Pull Requests

1. Create a feature branch
2. Make logical commits following this spec
3. Push commits to remote branch
4. Create a pull request with comprehensive description
5. Commits should be clean and meaningful for code review

### With Continuous Integration

- CI/CD systems will validate commits
- Failed commits in CI may require reverting
- Clean commits enable easier bisecting and debugging

## Tools and Automation

### Git Hooks

Consider using git hooks to enforce commit message format:
- `commit-msg` hook: Validate message format
- `pre-commit` hook: Run tests before committing

### Commit Helpers

Use the `asdm-git-commit` and `asdm-git-commit-message` actions for:
- Automatic commit message generation
- Message validation
- Commit automation

## Examples

### Example 1: Feature Addition
```bash
git commit -m "feat(payment): add stripe payment integration

- Integrate Stripe API for payment processing
- Add payment controller endpoint
- Implement transaction logging

Closes #789"
```

### Example 2: Bug Fix
```bash
git commit -m "fix(auth): resolve token expiration issue

Previously, expired tokens were not properly validated,
allowing unauthorized access. Added token validation
before executing protected endpoints.

Fixes #234"
```

### Example 3: Simple Change
```bash
git commit -m "docs: update contributing guidelines"
```

## References

- [Git Commit Message Spec](./git-commit-message-spec.md)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Documentation](https://git-scm.com/doc)
