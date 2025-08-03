# Development Guidelines

## Python Environment Management

### Virtual Environment Setup

Always use virtual environments for Python projects to avoid dependency conflicts.

#### Creating and Using venv

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install packages
pip install package_name

# Deactivate when done
deactivate
```

#### Important Notes

- ALWAYS activate the virtual environment before running pip install
- Install requirements: `pip install -r requirements.txt`
- Generate requirements: `pip freeze > requirements.txt`
- Never install packages globally unless absolutely necessary

## Git Workflow & Testing

### Regular Commits with GitHub CLI

Commit code frequently to maintain good version control hygiene:

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: brief description of changes"

# Push to remote
git push

# Create pull request using GitHub CLI
gh pr create --title "Feature: descriptive title" --body "Brief description of changes"
```

### Testing Best Practices

- Write tests BEFORE or ALONGSIDE code implementation
- Run tests after every significant change
- Ensure all tests pass before committing
- Use test-driven development (TDD) approach when possible

```bash
# Run tests frequently
python -m pytest
# or
npm test
# or appropriate test command for your project

# Run tests with coverage
python -m pytest --cov=src
```

### Development Workflow

1. **Test First**: Write or update tests for new functionality
2. **Code**: Implement the feature or fix
3. **Test Again**: Ensure all tests pass
4. **Commit**: Make atomic commits with clear messages
5. **Repeat**: Continue with small, incremental changes

### Important Notes

- Never commit broken code
- Always verify functionality works before pushing
- Write meaningful commit messages
- Keep commits small and focused on single changes