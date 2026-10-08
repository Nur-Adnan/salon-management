---
trigger: glob
glob: apps/{booking,admin}/**
description: Accessibility standards for WCAG 2.2 AA compliance, ARIA, keyboard navigation, and contrast
---

# Accessibility (a11y) Standards

## 1. Compliance Baseline
All interfaces in `apps/booking` and `apps/admin` must conform to **WCAG 2.2 Level AA**.

## 2. Semantic HTML & ARIA
- Use semantic HTML tags: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`.
- Every page must have exactly one `<h1>` that describes the primary topic of the page.
- Interactive elements must be native `<button>` or `<a>` tags. Never use a `<div>` or `<span>` with an `onClick` unless accompanied by `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers for Enter and Space.
- Form inputs must have an associated `<label>` element connected via `htmlFor` / `id`.
- Dynamic content updates must announce themselves to screen readers using `aria-live="polite"`.

## 3. Keyboard Usability & Focus
- All interactive controls must be navigable using <kbd>Tab</kbd> and operable with <kbd>Enter</kbd> / <kbd>Space</kbd>.
- Modals, drawers, and dialogs must implement focus trapping: focus moves into the modal on open, cannot tab out to background content, and returns to the triggering element on close (<kbd>Esc</kbd> key must dismiss).
- Visible focus indicators (`focus-visible:ring-2 focus-visible:ring-primary`) must never be suppressed without an accessible alternative.

## 4. Visual Accessibility & Contrast
- Text and interactive controls must meet minimum color contrast ratio of 4.5:1 for normal text and 3:1 for large text.
- Do not convey information solely through color (e.g. use both a badge icon/text and color to indicate appointment status).
