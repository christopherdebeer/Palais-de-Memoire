# Styling Guidelines for Palais de Mémoire

When styling this application, follow these comprehensive guidelines to ensure consistency, maintainability, and performance.

## 1. CSS Custom Properties (Design Tokens)

### Root Variables Structure
All design tokens must be defined at the `:root` level and organized by category:

```css
:root {
  /* Colors */
  --color-primary: #007AFF;
  --color-secondary: #00D4FF;
  --color-success: #30D158;
  --color-warning: #FF9500;
  --color-error: #FF3B30;
  
  /* Spacing Scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Typography */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  
  /* Animations */
  --transition-fast: 0.15s ease;
  --transition-base: 0.3s ease;
  --transition-slow: 0.5s ease;
}
```

### Variable Usage
- **ALWAYS** use CSS custom properties instead of hardcoded values
- Reference variables using `var(--variable-name)`
- Provide fallbacks for critical properties: `var(--color-primary, #007AFF)`

## 2. Component-Based Architecture

### BEM Methodology
Use Block-Element-Modifier naming convention:
- **Block**: `.voice-interface`
- **Element**: `.voice-interface__button`
- **Modifier**: `.voice-interface__button--active`

### Reusable Component Classes
Create base component classes that can be extended:

```css
/* Base button component */
.btn {
  /* Base button styles */
}

.btn--primary {
  /* Primary button variant */
}

.btn--secondary {
  /* Secondary button variant */
}
```

### File Organization
- `index.css` - Reset, base styles, typography, utilities
- `components.css` - Reusable component classes
- `App.css` - Application-specific styles and layouts
- `utilities.css` - Utility classes for spacing, colors, etc.

## 3. Responsive Design System

### Mobile-First Approach
- Start with mobile styles as the base
- Use `min-width` media queries to enhance for larger screens
- Test on actual devices, not just browser dev tools

### Breakpoint System
```css
/* Mobile: 0-768px (base styles) */
/* Tablet: 769px-1024px */
@media (min-width: 48.0625em) { /* 769px */ }
/* Desktop: 1025px+ */
@media (min-width: 64.0625em) { /* 1025px */ }
```

### Fluid Typography and Spacing
- Use `clamp()` for fluid scaling: `clamp(1rem, 2.5vw, 1.5rem)`
- Prefer `rem` for typography and spacing
- Use `em` for component-relative sizing
- Use viewport units (`vw`, `vh`) sparingly and with fallbacks

## 4. Sizing and Units

### Unit Hierarchy
1. **rem** - Typography, spacing, component dimensions
2. **em** - Component-relative sizing (padding in buttons)
3. **%** - Layout widths, flexible containers
4. **vw/vh** - Full viewport elements, fluid scaling
5. **px** - Only for borders, shadows, and precise pixel requirements

### Avoid Fixed Pixel Values
- Replace `padding: 16px` with `padding: var(--space-md)`
- Replace `font-size: 14px` with `font-size: var(--font-size-sm)`
- Replace `width: 300px` with `width: 18.75rem` or percentage-based

## 5. Color System

### Semantic Color Usage
- Use semantic color names: `--color-primary`, `--color-error`
- Avoid generic names: `--blue`, `--red`
- Include opacity variants: `--color-primary-10` (10% opacity)

### Accessibility
- Maintain WCAG AA contrast ratios (4.5:1 for normal text)
- Test with color blindness simulators
- Provide focus indicators with sufficient contrast

## 6. Animation and Transitions

### Performance-First Animations
- Animate only `transform` and `opacity` when possible
- Use `will-change` sparingly and remove after animation
- Provide `prefers-reduced-motion` alternatives

### Consistent Timing
- Use predefined timing variables: `var(--transition-base)`
- Standard easing: `ease`, `ease-in-out` for most cases
- Custom easing for specific brand animations

## 7. Layout Patterns

### Flexbox and Grid
- Use Flexbox for 1D layouts (navigation, button groups)
- Use Grid for 2D layouts (card grids, complex layouts)
- Avoid floats and absolute positioning when possible

### Container Queries (Future)
- Prepare for container queries by designing component-centric
- Avoid deep nesting that would complicate container query adoption

## 8. Accessibility Requirements

### Focus Management
- Visible focus indicators on all interactive elements
- Logical tab order
- Skip links for keyboard navigation

### Screen Reader Support
- Use semantic HTML elements
- Provide `aria-label` for icon-only buttons
- Include `.sr-only` class for screen reader only content

### Color and Contrast
- Don't rely solely on color to convey information
- Test with high contrast mode
- Provide alternative indicators (icons, text)

## 9. Performance Considerations

### CSS Optimization
- Minimize selector specificity
- Avoid deep nesting (max 3 levels)
- Use efficient selectors (avoid universal selectors in complex rules)

### Critical CSS
- Inline critical above-the-fold styles
- Defer non-critical CSS loading
- Use `font-display: swap` for web fonts

## 10. Code Organization

### File Structure
```
src/styles/
├── index.css          # Reset, base, typography
├── components.css     # Reusable components
├── utilities.css      # Utility classes
├── App.css           # App-specific styles
└── CLAUDE.md         # This file
```

### Import Order
1. Reset/normalize styles
2. Base typography and elements
3. Layout utilities
4. Component styles
5. Application-specific styles

## 11. Maintenance Guidelines

### Documentation
- Comment complex calculations and magic numbers
- Document color choices and accessibility considerations
- Maintain a living style guide

### Refactoring
- Regular audits for unused CSS
- Consolidate similar patterns into reusable classes
- Update design tokens when design system evolves

### Testing
- Test across browsers and devices
- Validate CSS with tools like stylelint
- Performance test with large datasets

## 12. Common Patterns

### Glass Morphism Effects
```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

### Interactive States
```css
.interactive {
  transition: var(--transition-base);
}

.interactive:hover {
  transform: translateY(-2px);
}

.interactive:active {
  transform: translateY(0);
}
```

### Loading States
```css
.loading {
  position: relative;
  pointer-events: none;
  opacity: 0.6;
}

.loading::after {
  content: '';
  position: absolute;
  /* spinner styles */
}
```

Remember: These guidelines ensure our styles are maintainable, accessible, performant, and consistent across the entire application.
