# Anchored Web Application

A companion web platform for the Anchored browser extension, providing premium users with comprehensive account management, note synchronization, and advanced note management capabilities.

## Brand Identity

**Anchored** represents the concept of anchoring your ideas and notes to specific web locations. The application features a dark blue ocean anchor theme with glassmorphism design elements, creating a cohesive nautical-inspired brand experience.

## Project Structure

```
web-app/
├── index.html              # Landing/login page
├── dashboard.html          # Main notes dashboard
├── account.html           # Account management
├── css/
│   ├── main.css           # Core styles with glassmorphism design tokens
│   ├── components.css     # Reusable UI components
│   └── responsive.css     # Mobile-first responsive breakpoints
├── js/
│   ├── app.js            # Main application orchestrator
│   ├── auth.js           # Authentication management (task 3)
│   ├── dashboard.js      # Notes dashboard functionality (task 4)
│   ├── account.js        # Account management (task 5)
│   └── lib/              # Shared libraries (adapted from extension)
│       └── placeholder.js # Placeholder for future libraries
└── README.md             # This file
```

## Features

- **Ocean-Themed Glassmorphism**: Modern glass-like surfaces with ocean-blue backdrop blur effects
- **Responsive Layout**: Mobile-first design with breakpoints for tablet and desktop
- **Authentication System**: User registration, login, and password reset (to be implemented)
- **Notes Dashboard**: View, search, and manage synced notes (to be implemented)
- **AI-Powered Summarization**: 
  - **Domain Summary**: Summarize all notes from a specific domain
  - **Site Content Summary**: Extract and summarize content from the current webpage
- **Subscription Management**: $2.50/month premium tier with Stripe integration (to be implemented)
- **Export/Import**: Note data portability with multiple formats (to be implemented)

## Pricing

- **Free Tier**: Browser extension with local storage
- **Premium Tier**: $2.50/month for cloud sync, web access, and advanced features

## Design Tokens

The application uses CSS custom properties for consistent ocean-themed styling:

### Ocean Anchor Theme
- **Primary Colors**: Deep ocean blues (#1B4F72, #2E86AB) representing depth and stability
- **Secondary Colors**: Lighter ocean tones (#A8DADC, #457B9D) for accents and highlights
- **Background**: Ocean gradient from light aqua to deep navy
- **Typography**: Apple system font stack with ocean-blue text colors
- **Glassmorphism**: Translucent panels with ocean-blue tinted backgrounds
- **Shadows**: Layered shadows with ocean-inspired color overlays
- **Future Branding**: Anchor logo integration planned for navigation and loading states

### Responsive Design
- **Mobile-First**: Base styles for 320px+ with progressive enhancement
- **Breakpoints**: Tablet (768px+) and Desktop (1024px+) optimizations
- **Touch-Friendly**: 44px minimum touch targets for mobile interactions
- **Accessibility**: WCAG compliant contrast ratios with ocean color palette

## Development Status

This is the initial project structure created in Task 1. Subsequent tasks will implement:

- Task 2: Core libraries adapted from extension
- Task 3: Authentication system with Supabase
- Task 4: Notes dashboard functionality
- Task 5: Subscription management
- Task 6: Export functionality
- Task 7: Import functionality
- Task 8: Mobile optimization
- Task 9: Encryption migration
- Task 10: Edge functions
- Task 11: Testing
- Task 12: Deployment

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Color contrast compliance
- Reduced motion support