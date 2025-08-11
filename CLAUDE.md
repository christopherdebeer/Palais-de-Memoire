Consider referencing docs or prototype implementation as needed, but keep in mind that they are/were precursors not necessarily correct.

Make sure to keep main README.md up to date as you make changes.

Commit (and push to branch) progress in small incremental chunks not in one large commit.

## Recent Updates

### Styles System Overhaul (2025-01-08)
- ✅ **Updated styling guidelines** in `src/styles/CLAUDE.md` with comprehensive best practices
- ✅ **Implemented design token system** in `src/styles/index.css` with CSS custom properties
- ✅ **Created reusable component library** in `src/styles/components.css` following BEM methodology
- ✅ **Refactored App.css** to use new design tokens and follow updated guidelines
- ✅ **Updated import order** in `src/main.jsx` to follow new CSS architecture

**Key Improvements:**
- Comprehensive CSS custom properties for colors, spacing, typography, and animations
- Consistent design token usage throughout the application
- Reusable component classes (buttons, cards, modals, forms, etc.)
- Improved accessibility with focus management and reduced motion support
- Mobile-first responsive design approach
- Better performance with optimized selectors and animations
- Enhanced maintainability with organized file structure

**Files Updated:**
- `src/styles/CLAUDE.md` - Comprehensive styling guidelines
- `src/styles/index.css` - Design tokens and base styles
- `src/styles/components.css` - Reusable component library (new)
- `src/styles/App.css` - Application-specific styles using new system
- `src/main.jsx` - Updated CSS import order

The styling system now follows modern CSS best practices with a scalable design token system, making future development more consistent and maintainable.
