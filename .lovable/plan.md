## AI Code Editor with GitHub Integration

### What we'll build (v1):
1. **GitHub connection** — User enters a GitHub Personal Access Token to list & select repos
2. **File browser** — Tree view of repo files with navigation
3. **Code editor** — Monaco-style code viewer/editor with syntax highlighting
4. **AI chat panel** — Chat interface powered by AI that can suggest code edits
5. **Apply changes** — AI suggests edits, user reviews & commits back to GitHub

### Design direction:
- **Dark theme** inspired by VS Code/Cursor — deep charcoal bg, subtle borders
- **Monospace font** (JetBrains Mono) for code, Inter for UI
- Colors: Dark bg `#0D1117`, sidebar `#161B22`, accent `#58A6FF` (GitHub blue), green for additions, red for deletions

### Tech:
- GitHub REST API via personal access token (stored in localStorage)
- Lovable Cloud + edge function for AI (Claude-style chat)
- Monaco Editor or CodeMirror for code editing
- react-markdown for AI responses

### Requires:
- Lovable Cloud enabled (for AI edge function)
- No external auth needed — token-based GitHub access