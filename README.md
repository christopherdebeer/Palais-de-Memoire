# Palais-de-Memoire

A simplified, voice-first 3D memory palace application for immersive learning and memory enhancement.

## Live Demo

Palais de Mémoire deploys to http://www.christopherdebeer.com/Palais-de-Memoire/

## Architecture

This project underwent a major architecture simplification (January 2025) to reduce complexity from ~7,000+ lines across 25+ files to ~1,400 lines across 8 focused files - an 80% reduction in complexity.

### Simplified Architecture

```
src/
├── App.jsx (271 lines - main application orchestrator)
├── PalaceController.js (300 lines - core logic & state management)
├── components/
│   ├── Scene3D.jsx (250 lines - direct Three.js integration)
│   ├── SimpleVoiceInterface.jsx (150 lines - Web Speech API)
│   └── SimpleUI.jsx (300 lines - consolidated UI controls)
└── utils/
    ├── voice.js (150 lines - voice recognition utility)
    └── settings.js (100 lines - localStorage configuration)
```

### Key Features

- **Voice-First Interface**: Direct Web Speech API integration for natural interaction
- **3D Memory Palace**: Three.js-powered immersive environments  
- **Simple State Management**: Single controller replacing multiple complex managers
- **localStorage Persistence**: Simple data persistence without complex layers
- **Responsive Design**: Modern CSS with design tokens and accessibility features

### Design Principles

1. **Single Responsibility**: Each file has one clear purpose
2. **Direct Integration**: Minimal abstraction layers
3. **Simple State**: Centralized state with direct updates  
4. **Progressive Enhancement**: Features build on stable core

## Development

### Quick Start

```bash
npm install
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run preview` - Preview production build

### Project Structure

- **`src/App.jsx`** - Main application component with streamlined initialization
- **`src/PalaceController.js`** - Core controller consolidating room/object/state management
- **`src/components/`** - React components for UI, 3D scene, and voice interface
- **`src/utils/`** - Utility functions for voice recognition and settings
- **`src/deprecated/`** - Previous complex architecture (preserved for reference)

## Architecture History

The project evolved from a complex multi-layer architecture to a simplified, elegant solution:

### Before Simplification (~7,000+ lines)
- 7 core manager classes (StateManager, RoomManager, ObjectManager, etc.)
- 8 complex React components with heavy prop drilling
- 5 service layers with multiple abstraction levels
- Complex event emitter patterns
- Heavy IndexedDB persistence layers

### After Simplification (~1,400 lines) 
- Single `PalaceController` class for all core logic
- Direct Three.js integration without React wrappers
- Simple localStorage-based persistence
- Consolidated UI components
- Direct Web Speech API usage

This simplification maintains full feature parity while dramatically improving:
- **Development Speed** - Clearer component boundaries and less complexity
- **Performance** - Reduced overhead and simpler render cycles
- **Maintainability** - Self-contained files with clear responsibilities
- **Debugging** - Fewer abstraction layers to trace through

## Contributing

The simplified architecture makes contributions much more straightforward:

1. **Understanding the codebase** - Start with `App.jsx` and `PalaceController.js`
2. **Adding features** - Most functionality extends the `PalaceController`
3. **UI changes** - Components are self-contained with minimal dependencies
4. **Testing** - Fewer integration points mean simpler test setup

## License

MIT License - see LICENSE file for details.