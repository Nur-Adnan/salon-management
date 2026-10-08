---
trigger: glob
glob: apps/{booking,admin}/**
description: Frontend standards for Next.js 14, React, Tailwind CSS v4, and UI animations
---

# Frontend Engineering Standards

## 1. Framework & Rendering Strategy
- Use Next.js 14 App Router patterns. Keep route handlers and page shells as Server Components where feasible.
- Mark leaf components with `"use client"` only when managing interactive state (`useState`, `useReducer`), effects (`useEffect`), or browser APIs.
- Optimize image assets with `next/image`, specifying explicit dimensions or responsive fill rules to eliminate cumulative layout shifts (CLS).

## 2. Styling & Design Tokens
- Style with Tailwind CSS v4. Use project design tokens defined in `@salon/tailwind-config` and `index.css`.
- Rely on semantic color tokens (e.g., `text-primary`, `bg-card`, `border-border`, `accent-gold`) rather than arbitrary hex values.
- Maintain consistent spacing based on the 4px / 8px scale.
- Implement responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) starting from mobile-first.

## 3. UI Component Completeness
Every interactive component or form must handle all standard interaction states:
- **Default State**: Clean, balanced layout and typography.
- **Hover & Focus-Visible**: Subtle scale/highlight and accessible focus rings for keyboard users.
- **Active / Pressed**: Immediate tactile visual feedback.
- **Loading State**: Skeleton loaders or spinners without layout jumping.
- **Error State**: Clear, inline validation messages with `aria-live` or `aria-describedby`.
- **Empty State**: Meaningful fallback with an action callout when no items exist.
- **Disabled State**: Reduced opacity and `aria-disabled="true"` with pointer-events disabled.

## 4. Animation & Motion Design
- Use Framer Motion and GSAP with intention. Avoid excessive animations that degrade usability.
- Always respect `prefers-reduced-motion`: disable or reduce movement transitions for sensitive users.
- Use GPU-accelerated properties (`transform`, `opacity`) instead of animating layout properties (`width`, `height`, `top`).
