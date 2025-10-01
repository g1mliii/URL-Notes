# URL Notes - Workspace Structure

## Public Repository Structure

### Core Application
- `extension/` - Chrome/Brave browser extension (Manifest V3)
- `extension-firefox/` - Firefox browser extension
- `css/`, `js/`, `auth/` - Web application files
- `*.html` - Web pages (index, dashboard, account, etc.)
- `supabase/functions/` - Edge Functions (serverless API)

### Configuration
- `package.json` - Node.js dependencies
- `manifest.json` - Web app manifest
- `_config.yml` - Jekyll configuration
- `_layouts/` - Jekyll layouts
- `.github/workflows/` - CI/CD workflows

### Documentation
- `README.md` - Main project documentation
- `LICENSE` - Project license
- `docs/` - Technical documentation

## Local Development Structure (Not in Public Repo)

### Development Tools
- `dev-tools/scripts/` - Deployment and utility scripts
- `dev-tools/marketing/` - Marketing strategy and content
- `dev-tools/webhook-server/` - Development webhook server
- `supabase/migrations/` - Database schema migrations

### AI Tool Configurations
- `.kiro/` - Kiro AI assistant configuration
- `.serena/` - Serena AI tool configuration

## Key Files

### Browser Extension Entry Points
- `extension/manifest.json` - Chrome extension manifest
- `extension/popup/popup.html` - Extension popup interface
- `extension-firefox/manifest.json` - Firefox extension manifest

### Web Application Entry Points
- `index.html` - Landing page
- `dashboard.html` - Main application interface
- `account.html` - User account management

### Backend
- `supabase/functions/` - Serverless functions
- `config.js` - Application configuration

## Development Workflow

1. **Extension Development**: Work in `extension/` or `extension-firefox/`
2. **Web App Development**: Modify HTML, CSS, JS files in root
3. **Backend Development**: Add functions to `supabase/functions/`
4. **Database Changes**: Create new migrations in `supabase/migrations/`
5. **Documentation**: Update files in `docs/` directory

## Deployment

- **Web App**: Deployed via GitHub Pages from main branch
- **Extensions**: Manual upload to Chrome Web Store / Firefox Add-ons
- **Backend**: Supabase Edge Functions deployed via CLI