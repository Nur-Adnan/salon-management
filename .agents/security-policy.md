# Security & Policy Engine Guidelines

This policy defines the operational security envelope for all agents operating in this workspace.

---

## 1. Core Permission Model: Read Freely, Write Carefully, Gate Destructive Actions

```
┌─────────────────────────────────────────────────────────────┐
│ READ OPERATIONS: ALLOWED BY DEFAULT                         │
│ • view_file, grep_search, list_dir, read_url_content        │
│ • Localhost HTTP requests & test API inspections            │
│ • git status, git log, git diff                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WRITE OPERATIONS: SURGICAL & MINIMAL                        │
│ • Targeted code edits to existing project files             │
│ • Creating test files, documentation, and mock data         │
│ • Formatting and linting touched files                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ DESTRUCTIVE OPERATIONS: HARD BLOCKED / REQUIRE APPROVAL      │
│ • Hard git resets (git reset --hard)                        │
│ • Force pushes (git push --force)                           │
│ • Deleting tracked files / git clean -fd                    │
│ • Dropping databases / destructive schema wipes             │
│ • Modifying production secrets, credentials, or .env files  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Protected Files & Secrets

The following files and patterns are strictly protected:
- `.env`, `.env.local`, `.env.production`
- `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- Any file containing raw API keys, bearer tokens, or database passwords

### Rules for Secret Handling:
1. **Never print secrets to stdout** or embed them in markdown artifacts.
2. **Never commit secrets to git**.
3. **Always use dummy mock values** in tests and `.env.example`.

---

## 3. Sandboxing & Boundaries

- **Workspace Scoping**: Agents must not read or modify files outside `/Users/adnan/Desktop/Projects/Management Systems/salon-management` without explicit instruction.
- **Port Isolation**: Services run on allocated local ports:
  - NestJS API: 4000
  - Next.js Booking: 3001
  - Next.js Admin: 3000
- **Process Termination**: Background processes started by agents must be tracked and safely terminated after test runs.
