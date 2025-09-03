# Project Structure

## Root Directory
```
url-notes/
├── extension/           # Browser extension (main application)
├── supabase/           # Database migrations and edge functions
├── guide files/        # Project documentation and specifications
├── .kiro/              # Kiro steering rules and settings
├── package.json        # Supabase CLI dependency only
└── README files        # Feature documentation and summaries
```

## Extension Structure (`/extension`)
```
extension/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup/             # Main UI (popup interface)
│   ├── popup.html     # Main popup interface
│   ├── popup.js       # Orchestrator - coordinates modules
│   ├── popup.css      # Styles with design tokens
│   └── modules/       # Modular architecture
│       ├── notes.js   # Note rendering and destructive UI
│       ├── editor.js  # Editor lifecycle and transforms
│       ├── settings.js # Settings UI and preferences
│       ├── storage.js # Data access layer
│       ├── theming.js # Theme management
│       └── utils.js   # Stateless helpers
├── content/
│   └── content.js     # Page detection and highlighting
├── background/
│   └── background.js  # Service worker
├── lib/               # Core libraries
│   ├── storage.js     # IndexedDB wrapper
│   ├── sync.js        # Cloud sync engine
│   ├── encryption.js  # Client-side encryption
│   ├── api.js         # Supabase client
│   └── ads.js         # CodeFuel integration
└── assets/            # Icons and images
```

## Supabase Structure (`/supabase`)
```
supabase/
├── migrations/        # Database schema versions
├── functions/         # Edge functions (TypeScript)
│   ├── sync-notes/    # Main sync endpoint
│   └── resolve-conflict/ # Conflict resolution
└── config.toml        # Supabase configuration
```

## Key Architecture Principles

### Popup Module Ownership
- **popup.js**: Orchestrator only - initializes modules, manages view state, routes actions
- **notes.js**: Owns all note rendering, grouping, and destructive UI patterns
- **editor.js**: Owns editor lifecycle, content transforms, draft persistence
- **storage.js**: Data access layer with no DOM knowledge
- **settings.js**: Settings UI and font preferences

### File Naming Conventions
- **Modules**: Lowercase with descriptive names (notes.js, editor.js)
- **Libraries**: Lowercase, single purpose (storage.js, sync.js, encryption.js)
- **Documentation**: UPPERCASE with underscores (PROJECT_SPECIFICATION.md)

### Import/Export Patterns
- **No build system**: Direct script tags in manifest.json
- **Module pattern**: Each module exports functions via global objects
- **Dependency injection**: Modules receive dependencies as parameters

### Data Flow
```
User Action → popup.js → Module → storage.js → IndexedDB
                    ↓
            sync.js → api.js → Supabase Edge Functions
```

## Documentation Structure (`/guide files`)
- **PROJECT_SPECIFICATION.md**: Complete feature specification
- **IMPLEMENTATION_SUMMARY.md**: Phase completion summaries  
- **STYLE_GUIDE.md**: Design tokens and UI patterns
- **Deployment guides**: Supabase and edge function setup