# Anchored - Smart Note-Taking for the Web

**Anchored** is a comprehensive note-taking solution that lets you anchor your ideas to specific web locations. Available as both a browser extension and web application, Anchored provides secure, encrypted note storage with intelligent organization and AI-powered features.

🌊 **Live Web App**: [anchored.site](https://anchored.site)  
🔗 **Browser Extension**: [Chrome Web Store](https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg)

## ⚓ What is Anchored?

Anchored represents the concept of anchoring your thoughts and insights to specific web locations. Whether you're researching, learning, or working, Anchored helps you capture and organize notes contextually with the websites you visit.

### Key Features

✨ **Smart Organization**: Notes automatically organized by domain and URL  
🔒 **Zero-Knowledge Encryption**: Your notes are encrypted client-side before cloud storage  
🌊 **Ocean-Themed Design**: Beautiful glassmorphism UI with nautical-inspired aesthetics  
📱 **Cross-Platform**: Browser extension + responsive web application  
🤖 **AI-Powered**: Intelligent summarization and content extraction (500 tokens/month for premium)  
💰 **Affordable Premium**: Full-featured premium tier for just $2.50/month  

## 🚀 Getting Started

### Browser Extension
1. **[Install from Chrome Web Store](https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg)** 
2. Click the Anchored icon in your browser toolbar
3. Start taking notes on any website
4. Notes are automatically organized by domain/URL
5. Use keyboard shortcuts: Alt+E (open popup), Alt+N (new note)

### Web Application
1. Visit [anchored.site](https://anchored.site)
2. Create your account or sign in
3. Access your synced notes from any device
4. Manage your subscription and export your data
5. Premium users get full web app access with advanced features

## 💎 Pricing

### Free Tier
- ✅ Browser extension with local storage
- ✅ Unlimited notes on your device
- ✅ Domain/URL organization
- ✅ Multi-highlight mode and context menu
- ✅ Rich text formatting and tags
- ✅ Keyboard shortcuts and themes
- ✅ Basic export functionality
- ✅ AI features (30 tokens/month)

### Premium Tier - $2.50/month
- ✅ Everything in Free tier
- ✅ **Cloud synchronization** across all devices
- ✅ **Web application access**
- ✅ **AI features** (500 tokens/month)
  - AI Rewrite (1 token per note)
  - AI Summary (20 uses per site)
  - AI Domain Summary (1 use per note)
- ✅ **Advanced search** across all notes
- ✅ **Full export/import** (JSON, Markdown, Obsidian, Notion, Plain Text, Google Docs)
- ✅ **Version history** and note recovery
- ✅ **Ad-free experience**
- ✅ **Priority support**

## 🎨 Design Philosophy

Anchored features a distinctive **ocean anchor theme** with modern glassmorphism design:

- **Deep Ocean Blues**: Primary colors (#1B4F72, #2E86AB) representing depth and stability
- **Aqua Accents**: Lighter ocean tones (#A8DADC, #457B9D) for highlights
- **Glass Surfaces**: Translucent panels with ocean-blue backdrop blur effects
- **Responsive Design**: Mobile-first approach with seamless desktop experience

## 🏗️ Architecture

### Browser Extension
- **Manifest V3** compliant
- **Local-first** architecture with IndexedDB
- **Zero-knowledge encryption** using AES-256-GCM
- **Offline-capable** with background sync

### Web Application
- **Static hosting** on GitHub Pages
- **Supabase backend** for authentication and data sync
- **Client-side encryption** maintains zero-knowledge architecture
- **Progressive Web App** capabilities

### Security & Privacy
- 🔐 **Client-side encryption**: Notes encrypted before leaving your device
- 🔑 **Password-derived keys**: Encryption keys derived from your password + salt
- 🚫 **Zero-knowledge**: Server never sees your unencrypted notes
- 🛡️ **Row-level security**: Database policies enforce strict data isolation

## 🛠️ Technology Stack

### Frontend
- **Vanilla JavaScript**: No build system, direct browser compatibility
- **CSS3**: Modern features with glassmorphism effects and ocean theme
- **Responsive Design**: Mobile-first with progressive enhancement
- **Progressive Web App**: Installable web app capabilities

### Backend
- **Supabase**: PostgreSQL database with real-time capabilities
- **Edge Functions**: TypeScript serverless functions for sync and AI
- **Stripe Integration**: Secure payment processing ($2.50/month premium)
- **GitHub Pages**: Static hosting with custom domain

### Browser Extension
- **Manifest V3**: Modern extension architecture
- **IndexedDB**: Local storage for offline capability
- **Service Workers**: Background sync and processing
- **Chrome APIs**: Tabs, storage, alarms, context menus

## 📱 Browser Support

- **Chrome** 90+ (Primary) - [Install Extension](https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg)
- **Brave** (Chromium-based) - Compatible with Chrome extension
- **Microsoft Edge** 90+ (Chromium-based) - Compatible with Chrome extension
- **Firefox** support planned for future release

## 🌐 Accessibility

Anchored is built with accessibility in mind:

- ♿ **WCAG 2.1 AA** compliant
- ⌨️ **Keyboard navigation** support
- 🎯 **Focus management** for screen readers
- 🎨 **High contrast** color ratios
- 📱 **Touch-friendly** interface (44px minimum targets)

## 📄 License

This project is proprietary software. All rights reserved.

## 🚀 Development

This project uses a local-first architecture with cloud sync:

- **Extension**: No build system required - load `/extension/` folder directly in Chrome
- **Web App**: Static files deployed to GitHub Pages
- **Database**: Supabase PostgreSQL with Row Level Security
- **Sync**: Client-side encryption with zero-knowledge architecture

### Quick Start
1. Clone the repository
2. Load `/extension/` folder as unpacked extension in Chrome
3. Visit [anchored.site](https://anchored.site) for web app
4. Create account to test sync functionality

## 🤝 Support

- 📧 **Email**: support@anchored.site
- 🌐 **Website**: [anchored.site](https://anchored.site)
- 🔗 **Extension**: [Chrome Web Store](https://chromewebstore.google.com/detail/anchored-%E2%80%93-notes-highligh/llkmfidpbpfgdgjlohgpomdjckcfkllg)
- 📚 **Help**: Available at [anchored.site/help](https://anchored.site/help)

---

**Anchor your ideas to the web with Anchored** ⚓
