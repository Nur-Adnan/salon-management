# MCP Architecture & Agent Scoping Matrix

This document defines the Model Context Protocol (MCP) server architecture, security boundaries, and agent access controls for this workspace.

---

## 1. Configured MCP Servers & Capabilities

| MCP Server | Transport | Primary Purpose | Security Boundary |
| :--- | :--- | :--- | :--- |
| **playwright** | stdio (`@playwright/mcp@latest --headless`) | Browser automation, E2E testing, visual snapshots, element interaction | Local browser sandbox; localhost access |
| **chrome-devtools** | stdio (`chrome-devtools-mcp@latest`) | Runtime console error checks, network inspection, JS DOM eval, heap audit | Read-only browser runtime inspection |
| **context7** | stdio (`@upstash/context7-mcp@latest`) | Official, version-specific library documentation lookup | Read-only documentation service |
| **github** | stdio (`@modelcontextprotocol/server-github`) | Repository metadata, PR reviews, issue search, commit tracking | Authenticated repository scope |
| **twentyfirst** | SSE/HTTP (`https://21st.dev/api/mcp`) | Modern UI component catalog, layout inspirations, code retrieval | Read-only component catalog |
| **figma** | SSE/HTTP (`https://mcp.figma.com/mcp`) | Figma design system inspection, token resolution | Read-only design inspection |
| **vercel** | SSE/HTTP (`https://mcp.vercel.com`) | Deployment status inspection, preview URL verification | Read-only deployment visibility |
| **pencil** | stdio (`mcp-server-darwin-arm64`) | Canvas wireframing and design mockups | Local extension boundary |

---

## 2. Agent Scoping Matrix

MCP servers are strictly scoped by specialist role. No agent receives unnecessary or dangerous tool access.

| Agent | Scoped MCP Servers | Rationale |
| :--- | :--- | :--- |
| **Primary Agent** | All configured | Global coordination and user intent routing |
| **architect** | `context7` | Framework docs and architectural references only (no runtime tools) |
| **frontend-engineer** | `playwright`, `chrome-devtools`, `context7`, `twentyfirst` | UI development, component testing, live docs, and component discovery |
| **ui-ux-engineer** | `playwright`, `chrome-devtools`, `twentyfirst`, `figma` | Visual hierarchy, responsive testing, screenshot QA, design tokens |
| **backend-engineer** | `context7` | Framework specs and Node/NestJS docs; no browser or UI tools |
| **qa-engineer** | `playwright`, `chrome-devtools` | Automated browser testing, assertions, console error monitoring |
| **security-engineer** | None (uses native search/read tools) | Audits code statically; no external SaaS MCP access to prevent token leakage |
| **performance-engineer** | `chrome-devtools`, `playwright` | Runtime performance tracing, network waterfalls, layout shift audits |
| **code-reviewer** | `github` | PR comments, commit inspection, repository diffs (read-only) |
| **debugging-engineer** | `chrome-devtools`, `playwright` | Live console inspection, network request failures, error reproduction |
| **production-auditor** | `github`, `vercel` | Deployment status and release tag verification |

---

## 3. Strict Boundary Rules

1. **No Database Writes from Frontend/Review Agents**: Frontend and reviewer agents do not have direct DB write tools.
2. **No Blind Deployments**: Deployment MCP tools (Vercel) are limited to reading deployment status and preview URLs.
3. **No Unauthenticated Credential Leakage**: Remote SaaS MCPs (Figma, Vercel, 21st.dev) never receive secrets via prompt text.
