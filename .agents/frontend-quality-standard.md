# Frontend Quality Standard & Anti-Slop Guidelines

This document establishes the mandatory visual and behavioral standards for all frontend code in `apps/booking` and `apps/admin`.

---

## 1. Anti-Slop Visual Philosophy
Generic, cookie-cutter "AI generated" user interfaces are strictly prohibited. Interfaces must reflect the craftsmanship of a world-class design engineering team:
- **Deliberate Typography**: Expressive, legible font scale with clear contrast between display headlines and body copy.
- **Visual Depth & Hierarchy**: Layering with subtle glassmorphism (`backdrop-blur-md bg-card/80`), fine borders (`border-border/50`), and soft elevation shadows.
- **Palette Discipline**: Dominated by deep neutrals (slate/zinc dark mode) with calibrated luxury accents (champagne gold, emerald). Never use raw default primaries (`#0000ff`, `#ff0000`).
- **Whitespace & Rhythm**: Generous, intentional padding following a strict 4px / 8px rhythm.

---

## 2. Mandatory Interaction State Coverage

Every component, card, button, and input must implement all 7 standard states:

| State | Visual Treatment | Accessibility Requirement |
| :--- | :--- | :--- |
| **Default** | Balanced, readable, styled with design tokens | High contrast ratio (>= 4.5:1) |
| **Hover** | Subtle scale (`scale-[1.01]`) or brightness shift | Cursor pointer; non-jarring transition |
| **Focus-Visible** | Pronounced ring (`ring-2 ring-primary ring-offset-2`) | Visible on keyboard <kbd>Tab</kbd> navigation |
| **Active / Pressed** | Slight compression (`scale-[0.98]`) | Tactile feedback |
| **Loading** | Skeleton shimmer or spinner matching container height | `aria-busy="true"`, layout preserved (no jump) |
| **Error** | Destructive border and clear inline message | `aria-invalid="true"`, `aria-describedby` |
| **Disabled** | Reduced opacity (`opacity-50`), pointer-events-none | `aria-disabled="true"`, excluded from tab order |

---

## 3. Responsive Execution Matrix

Test every user journey across 4 canonical viewports:
- **Mobile (375px - 414px)**: Single column, touch-friendly tap targets (minimum 44x44px), sticky bottom actions.
- **Tablet (768px - 834px)**: 2-column grids, collapsible sidebars, adaptive navigation drawers.
- **Desktop (1024px - 1440px)**: Multi-column layouts, expanded data tables, rich preview modals.
- **Ultra-Wide (1920px+)**: Constrained maximum container widths (`max-w-7xl mx-auto`) to prevent awkward line lengths.

---

## 4. Visual Evidence Protocol
- Whenever UI changes are implemented, verify rendering in a real browser using Playwright or Chrome DevTools MCP.
- Capture screenshots for evidence and inspect them for text wrapping, overlapping elements, or broken layouts.
