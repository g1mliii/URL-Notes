# Development Guide

This repository contains the public-facing code for Anchored. Some development files are kept private to maintain a clean public repository.

## Hidden Files (Local Development Only)

The following directories are excluded from the public repository but may exist in local development:

- `.kiro/` - Kiro AI assistant configuration and specs
- `guide files/` - Internal documentation and implementation guides  
- `scripts/` - Deployment and utility scripts
- `supabase/migrations/` - Database migration files
- `webhook-server/` - Webhook handling server code

## Public Repository Structure

```
anchored/
├── index.html              # Landing/login page
├── dashboard.html          # Main notes dashboard  
├── account.html           # Account management
├── privacy.html           # Privacy policy
├── terms.html             # Terms of service
├── css/                   # Stylesheets
├── js/                    # JavaScript modules
├── extension/             # Browser extension code
├── supabase/functions/    # Edge Functions (public)
└── _layouts/              # Jekyll layouts for GitHub Pages
```

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase CLI for local development
4. Configure environment variables as needed

## Contributing

This is a private project. For support or inquiries, contact support@anchored.site.