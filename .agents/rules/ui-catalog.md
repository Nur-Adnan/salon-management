---
trigger: model_decision
description: 21st.dev UI component discovery, design system alignment, and UI review workflow
---

# 21st.dev Component Discovery & UI Standards

## 1. Purpose & Integration
21st.dev is integrated into the engineering workflow via `@21st-dev/cli` and the MCP protocol:
- Discovering modern, high-quality component patterns (heroes, cards, bento grids, pricing, inputs).
- Exploring alternative design directions and UI variants.
- Inspecting accessible interaction patterns and animations.
- Deterministic UI review via `21st review <path...>`.

## 2. STRICT RULE: Preserve the Project Design System
Never blindly paste third-party components or replace the project's design system tokens:
1. **Inspect Existing Tokens First**:
   - Primary palette: Emerald, Champagne Gold, Slate/Zinc neutral dark mode.
   - Typography: Sans-serif (Outfit/Inter/Geist), serif accents where used.
   - Border Radius: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px).
   - Glassmorphism: `backdrop-blur-md bg-card/80 border border-border/50`.
2. **Adapt Colors & Tokens**:
   - Replace imported colors with project CSS variables or semantic Tailwind classes (`bg-card`, `text-primary`, `border-border`).
3. **No Unnecessary Dependencies**:
   - If a component requires an external utility like Lucide icons or Framer Motion, confirm they are already in `package.json` before installing additional dependencies.

## 3. CLI Commands
- Search brand/UI SVG logos (no auth required):
  `21st logo <query> --json`
- Review UI files against deterministic design rules:
  `21st review <path...> --json`
- Initialize design context:
  `21st init --design-context`
