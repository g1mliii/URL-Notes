# Design Document

## Overview

The Anchored Web Application is a responsive web platform that provides premium users with comprehensive account management and note synchronization capabilities. Built as a companion to the Anchored browser extension, it leverages the existing Supabase backend infrastructure while reusing core logic from the extension for consistency and maintainability.

The application follows a mobile-first responsive design approach with glassmorphism aesthetics featuring a dark blue ocean anchor theme. The visual identity evokes nautical concepts of anchoring ideas to specific web locations, using deep ocean blues, subtle anchor iconography, and fluid glass-like surfaces. It maintains the zero-knowledge encryption architecture where the server never sees unencrypted content.

## Visual Design System

### Ocean Anchor Theme
- **Primary Colors**: Deep ocean blues (#1B4F72, #2E86AB) representing depth and stability
- **Secondary Colors**: Lighter ocean tones (#A8DADC, #457B9D) for accents and highlights  
- **Neutral Colors**: Ocean-inspired grays and whites with blue undertones
- **Future Branding**: Anchor logo integration planned for navigation and loading states

### Glassmorphism with Ocean Theme
- **Glass Surfaces**: Translucent panels with ocean-blue tinted backgrounds
- **Backdrop Effects**: Enhanced blur effects with subtle blue color overlays
- **Depth Layers**: Multiple glass surfaces creating ocean depth illusion
- **Animations**: Gentle wave-like transitions and anchor-themed loading animations

## Pricing Strategy

### Free Tier
- Local note storage via browser extension
- Basic note organization by domain/URL
- Limited export functionality
- No cloud synchronization

### Premium Tier ($2.50/month)
- **Cloud Synchronization**: Secure encrypted sync across all devices
- **Web Application Access**: Full-featured web interface
- **Advanced Search**: Search across all notes and domains
- **Unlimited Export**: All export formats (JSON, Markdown, Obsidian, Notion, Plain Text, Google Docs)
- **Import Functionality**: Import notes from other systems
- **Version History**: Unlimited note version tracking
- **Priority Support**: Enhanced customer support

## Architecture

### Technology Stack

- **Frontend Framework**: Vanilla JavaScript (no build system, matching extension approach)
- **Styling**: CSS with ocean-themed glassmorphism design tokens from extension
- **Authentication**: Supabase Auth (reusing existing infrastructure)
- **Database**: Existing Supabase PostgreSQL with current schema
- **Encryption**: Client-side AES-256-GCM (reusing extension's encryption.js)
- **Payment Processing**: Stripe integration via Supabase Edge Functions ($2.50/month premium tier)
- **Hosting**: Static hosting (Vercel, Netlify, or Supabase hosting)
- **Branding**: Anchored ocean anchor theme with dark blue color palette

### Application Structure

```
web-app/
├── index.html              # Landing/login page
├── dashboard.html          # Main notes dashboard
├── account.html           # Account management
├── css/
│   ├── main.css           # Core styles with glassmorphism
│   ├── components.css     # Reusable UI components
│   └── responsive.css     # Mobile/desktop breakpoints
├── js/
│   ├── app.js            # Main application orchestrator
│   ├── auth.js           # Authentication management
│   ├── dashboard.js      # Notes dashboard functionality
│   ├── account.js        # Account management
│   ├── subscription.js   # Premium subscription handling
│   └── lib/              # Shared libraries (from extension)
│       ├── api.js        # Supabase client (adapted)
│       ├── encryption.js # Note encryption (reused)
│       ├── storage.js    # Web storage adapter
│       ├── sync.js       # Sync engine (adapted)
│       └── export-formats.js # Export functionality (reused)
└── components/
    ├── note-card.js      # Individual note display
    ├── note-editor.js    # Note editing interface
    ├── filter-bar.js     # Domain/URL filtering
    └── export-modal.js   # Export selection interface
```

## Components and Interfaces

### Authentication System

**Login/Registration Interface**
- Email/password authentication using Supabase Auth
- Password reset functionality with email verification
- Automatic encryption key generation using existing logic from extension

**Session Management**
- JWT token handling with automatic refresh
- Persistent login state across browser sessions
- Secure logout with complete session cleanup

### Dashboard Interface

**Notes Organization**
- Domain-based grouping matching extension's storage pattern
- URL-specific filtering within domains
- Search functionality across all note content
- Date range filtering for note discovery

**Note Display Components**
- Card-based layout for note previews
- Expandable note content with syntax highlighting
- Tag display and filtering
- Last modified timestamps

**Note Management**
- Inline editing with auto-save functionality
- Bulk selection for export/deletion operations
- Drag-and-drop organization (future enhancement)

### Account Management Interface

**Subscription Management**
- Current plan display with usage statistics (Free vs Premium $2.50/month)
- Upgrade/downgrade options with Stripe integration for monthly billing
- Payment method management for $2.50/month subscriptions
- Billing history and invoice downloads
- Clear feature comparison between free and premium tiers

**Security Settings**
- Password change with encryption migration
- Account deletion with data export option
- Two-factor authentication setup (future enhancement)

### Export/Import System

**Export Interface**
- Format selection matching extension's ExportFormats class
- Individual note selection with checkboxes
- Bulk selection by domain/URL patterns
- Progress indicators for large exports

**Import Interface**
- File upload with format detection
- Preview of import data before processing
- Conflict resolution for duplicate notes
- Batch processing with error handling

## Data Models

### User Profile Model
```javascript
{
  id: "uuid",
  email: "string",
  subscription_tier: "free|premium",
  subscription_expires_at: "timestamp",
  salt: "string", // For encryption key derivation
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

### Note Model (Decrypted)
```javascript
{
  id: "uuid",
  title: "string",
  content: "string",
  url: "string",
  domain: "string", 
  tags: ["string"],
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

### Note Model (Encrypted for Storage)
```javascript
{
  id: "uuid",
  user_id: "uuid",
  title_encrypted: "jsonb", // {encrypted: [], iv: [], algorithm: "AES-GCM"}
  content_encrypted: "jsonb",
  tags_encrypted: "jsonb",
  content_hash: "string",
  url: "string", // Plaintext for filtering
  domain: "string", // Plaintext for organization
  is_deleted: "boolean",
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

## Error Handling

### Authentication Errors
- Invalid credentials with clear error messages
- Session expiration with automatic redirect to login
- Network connectivity issues with retry mechanisms
- Rate limiting with exponential backoff

### Sync Errors
- Encryption/decryption failures with fallback options
- Network timeouts with offline mode indicators
- Conflict resolution for simultaneous edits
- Data corruption detection and recovery

### Payment Errors
- Failed payment processing with retry options
- Subscription expiration notifications
- Billing address validation errors
- Currency conversion issues for international users

### Data Validation
- Note content size limits with warnings
- Invalid file format detection for imports
- Malformed data sanitization
- XSS prevention for user-generated content

## Testing Strategy

### Unit Testing
- Encryption/decryption functionality validation
- Export format conversion accuracy
- Authentication flow edge cases
- Data model validation and sanitization

### Integration Testing
- Supabase API interaction testing
- Stripe payment flow validation
- Email delivery verification
- Cross-browser compatibility testing

### End-to-End Testing
- Complete user registration and onboarding flow
- Note creation, editing, and synchronization
- Subscription upgrade and management workflow
- Export/import functionality with various formats

### Security Testing
- Encryption key derivation validation
- SQL injection prevention
- XSS vulnerability scanning
- Authentication bypass attempt detection

## Security Considerations

### Encryption Architecture
- Client-side encryption using Web Crypto API
- Password-derived encryption keys with PBKDF2
- Per-user salt storage for key derivation
- Zero-knowledge architecture maintenance

### Data Protection
- HTTPS enforcement for all communications
- Secure cookie configuration for session management
- Content Security Policy implementation
- Input sanitization and output encoding

### Privacy Compliance
- GDPR-compliant data handling procedures
- User consent management for data processing
- Right to deletion implementation
- Data portability through export functionality

## Performance Optimization

### Frontend Performance
- Lazy loading for large note collections
- Virtual scrolling for extensive lists
- Image optimization and compression
- CSS and JavaScript minification

### Backend Optimization
- Database query optimization with proper indexing
- Edge function caching strategies
- CDN utilization for static assets
- Connection pooling for database access

### Mobile Performance
- Touch-optimized interface elements
- Reduced data usage for mobile connections
- Offline functionality with service workers
- Progressive Web App capabilities

## Responsive Design Strategy

### Mobile-First Approach
- Base styles designed for mobile screens (320px+)
- Progressive enhancement for larger screens
- Touch-friendly interface elements (44px minimum)
- Swipe gestures for navigation

### Breakpoint Strategy
```css
/* Mobile: 320px - 767px (base styles) */
/* Tablet: 768px - 1023px */
/* Desktop: 1024px+ */
```

### Component Adaptations
- Collapsible navigation for mobile
- Stacked layouts on small screens
- Expandable cards for note content
- Modal overlays for complex interactions

## Integration with Existing Extension

### Code Reuse Strategy
- Direct adaptation of encryption.js for web environment
- Modified api.js for web-specific authentication flows
- Adapted export-formats.js for web file downloads
- Shared data models and validation logic

### Synchronization Consistency
- Same encryption algorithms and key derivation
- Identical note storage format and structure
- Consistent domain/URL organization patterns
- Unified conflict resolution strategies

### Migration Path
- Seamless transition between extension and web app
- Shared authentication sessions where possible
- Consistent user experience across platforms
- Data format compatibility for import/export