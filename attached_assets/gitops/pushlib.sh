#!/bin/bash
# pushlib.sh — shared helpers for Git operations

set -e

# Configure Git authentication using GITHUB_TOKEN
configure_git_auth() {
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "ERROR: GITHUB_TOKEN not set"
    exit 1
  fi
  
  # Get current remote URL
  local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
  
  if [ -z "$current_remote" ]; then
    echo "ERROR: No git remote 'origin' configured"
    exit 1
  fi
  
  # Extract repo path (owner/repo)
  # Handle both HTTPS and SSH formats
  local repo_path=$(echo "$current_remote" | sed -E 's|^https://([^@]*@)?github\.com/||' | sed -E 's|^git@github\.com:||' | sed 's|\.git$||')
  
  # Set authenticated remote URL
  git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${repo_path}.git"
  
  # Configure Git for non-interactive use
  git config user.email "${GIT_USER_EMAIL:-gitops@kingdom-connects.com}" || true
  git config user.name "${GIT_USER_NAME:-Kingdom Connects GitOps}" || true
}

# Pull with rebase (clean history)
pull_rebase() {
  local branch="$1"
  configure_git_auth
  git checkout "$branch" 2>/dev/null || git checkout -b "$branch"
  git fetch origin "$branch"
  git pull --rebase origin "$branch"
}

# Commit if there are changes (or allow empty)
commit_if_changed() {
  local message="$1"
  configure_git_auth
  if git diff-index --quiet HEAD --; then
    # No changes, make empty commit
    git commit --allow-empty -m "$message"
  else
    git add -A
    git commit -m "$message"
  fi
}

# Fast-forward merge only (safe sync)
fast_forward_merge() {
  local from_branch="$1"
  local to_branch="$2"
  
  configure_git_auth
  git checkout "$to_branch"
  git fetch origin "$to_branch"
  git pull --rebase origin "$to_branch"
  
  # Try fast-forward merge
  if git merge --ff-only "$from_branch"; then
    git push origin "$to_branch"
    echo "OK: fast-forwarded $to_branch from $from_branch"
    return 0
  else
    echo "ERROR: Cannot fast-forward. Branches have diverged."
    return 1
  fi
}
