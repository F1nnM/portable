# Portable UI Feature Catalog

Complete inventory of all user-facing features and actions. This document covers **what users can do**, not how it looks or is laid out.

---

## Main App (Nuxt)

### Authentication

- Sign in with GitHub OAuth
- Sign out
- Automatic redirect to login when unauthenticated
- Automatic redirect to dashboard when already authenticated
- Session persistence across page loads (cookie-based)
- Access restriction by GitHub username allowlist (error if denied)

### Dashboard

- View all projects as a list
- See each project's name, slug, and current status (running / stopped / starting / creating / stopping / error)
- See real-time startup progress with human-readable phase labels during transitions:
  - "Setting up database..."
  - "Creating repository..."
  - "Scaffolding application..."
  - "Initializing workspace..."
  - "Cloning repository..."
  - "Installing dependencies..."
  - "Starting server..."
  - "Launching container..."
  - "Almost ready..."
- Auto-poll project list every 3 seconds while any project is in a transitional state
- Poll individual project status every 2 seconds during creation/startup
- Loading state
- Error state with retry
- Empty state

### Project Actions

- **Open** a running project (navigates to editor in new tab via subdomain URL)
- **Start** a stopped or errored project
- **Stop** a running or starting project
- **Rename** a project
- **Delete** a project (with option to also delete the GitHub repository)
- Delete requires confirmation before executing

### Project Creation

- **Two creation modes:**
  1. **From Scaffold** -- select a template from available scaffolds
  2. **Import Repo** -- select an existing GitHub repository

#### From Scaffold

- View available scaffold templates (name + description)
- Select a scaffold

#### Import Repo

- View list of user's GitHub repositories (up to 100, sorted by most recently updated)
- Search/filter repositories by name, full name, or description
- See repo metadata: name, private badge, description, language
- Select a repository

#### Common to Both

- Enter project name (1-100 characters)
- Auto-generated slug preview
- Submit to create/import (redirects to dashboard on success)
- Validation: name required, length limit, scaffold/repo selection required
- Error display on creation failure

### Settings

- **Theme toggle**: System / Light / Dark (persisted to localStorage)
- **View GitHub username** (read-only)
- **Anthropic credential management**:
  - See whether a credential is configured
  - Save an API key or OAuth token
  - Remove a saved credential
  - Success/error feedback messages
- **AGE key management** (same pattern as Anthropic credential):
  - See whether an AGE key is configured
  - Save an AGE private key
  - Remove a saved AGE key
  - Success/error feedback messages

### Navigation

- Navigate to home/dashboard
- See current username
- Navigate to create new project
- Navigate to settings

---

## Editor SPA (served from project pod)

### Navigation

- Navigate between four views: Chat, Files, Git, Preview
- Default view is Chat
- Theme preference shared with main app

### Chat

#### Session List (default state)

- View all conversation sessions sorted by most recent
- See session title (derived from custom title, summary, or first prompt)
- See last modified time in relative format ("2m ago", "1h ago", "3d ago")
- Delete a session
- Start a new conversation
- Loading state
- Empty state

#### Active Conversation

- Send a text message to Claude
- View streaming assistant responses in real-time
- View user messages and assistant messages in a scrollable thread
- See tool usage in assistant messages (tool name and input, expandable/collapsible)
- Interrupt an in-progress assistant response
- Streaming indicator while assistant is responding
- Auto-scroll to bottom on new messages
- Navigate back to session list
- Session persistence: resuming a session restores full history
- Auto-reconnect on WebSocket disconnect

#### Input

- Text input for composing messages
- Enter to send, Shift+Enter for newline
- Cannot send empty messages

### Files

#### File Tree

- Browse workspace files in a hierarchical tree
- Expand/collapse directories
- Directories sorted before files, alphabetical within each group
- Click a file to open it in the code viewer
- Loading state
- Error state

#### Code Viewer

- View file content with syntax highlighting
- Language detection for common web languages (JS, TS, JSX, TSX, JSON, CSS, SCSS, HTML, Vue, Markdown)
- Toggle between read-only and edit mode
- Edit file content in-place
- Save edited file (writes back via API)
- Exit edit mode (discards unsaved changes)
- Navigate back to file tree
- See which file is currently open

### Git

- View current branch name
- View staged file changes (path + status: modified, added, deleted, renamed, copied, untracked)
- View unstaged file changes (same format)
- "Clean working tree" message when no changes
- View commit history: hash, message, author, time
- Click a changed file to open it in the Files view
- Loading state
- Error state

### Preview

- View the project's dev server output (embedded)
- Refresh the preview
- Open preview in a new tab
- See the preview URL
- Loading state while preview loads

---

## Cross-Cutting Features

### State Sharing

- File state shared between Files view and Git view (clicking a file in Git opens it in Files)
- Theme preference shared between main app and editor

### Error Handling

- All API calls surface errors to the user
- Loading states on async operations
- Retry on fetch failures
- Form validation prevents invalid submissions

### Real-Time Updates

- Streaming chat responses via WebSocket
- Polling for project status during transitions
- Auto-reconnect on WebSocket disconnect
