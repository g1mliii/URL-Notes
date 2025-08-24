# URL Notes Web Application

A modern web application for managing website notes with cloud sync, built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Authentication**: Secure user authentication with Supabase Auth
- 📝 **Notes Management**: Create, edit, and organize notes by domain/URL
- 🔍 **Advanced Search**: Search across all notes with filtering and sorting
- 🏷️ **Tag System**: Organize notes with customizable tags
- ☁️ **Cloud Sync**: Premium feature for cross-device synchronization
- 🌙 **Dark Mode**: Beautiful light and dark themes
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- 🔒 **End-to-End Encryption**: Client-side encryption for note privacy

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Custom component library with Lucide icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project (for authentication and database)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd web-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page (protected)
│   ├── layout.tsx         # Root layout with auth provider
│   └── page.tsx           # Home page with auth form
├── components/            # Reusable UI components
│   ├── auth/             # Authentication components
│   ├── dashboard/        # Dashboard layout components
│   ├── notes/            # Notes-related components
│   └── ui/               # Base UI components
├── contexts/              # React contexts
│   └── auth-context.tsx  # Authentication context
├── lib/                   # Utility libraries
│   ├── encryption.ts     # Client-side encryption
│   ├── store.ts          # Zustand state store
│   ├── supabase.ts       # Supabase client
│   ├── types.ts          # TypeScript type definitions
│   └── utils.ts          # Utility functions
```

## Key Components

### Authentication
- **AuthForm**: Sign in/sign up form with validation
- **AuthProvider**: Context provider for authentication state
- **Protected Routes**: Automatic redirection for unauthenticated users

### Dashboard
- **DashboardLayout**: Main layout with sidebar and header
- **Sidebar**: Navigation and quick actions
- **Header**: Search bar and user menu

### Notes
- **NotesView**: Main notes interface
- **NotesList**: Scrollable list of notes
- **NoteEditor**: Rich text editor for notes

## State Management

The application uses Zustand for state management with the following stores:

- **User State**: Authentication status and user data
- **Notes State**: Notes data, filtering, and selection
- **UI State**: Theme, sidebar state, and preferences
- **Sync State**: Cloud synchronization status

## Authentication Flow

1. **Sign Up**: Users create accounts with email/password
2. **Email Verification**: Supabase sends confirmation emails
3. **Sign In**: Users authenticate with credentials
4. **Session Management**: Automatic session persistence
5. **Protected Routes**: Dashboard access requires authentication

## Database Schema

The application integrates with Supabase using the following tables:

- **profiles**: User metadata and subscription info
- **notes**: Encrypted note content and metadata
- **note_versions**: Version history for notes

## Encryption

- **Client-side Encryption**: AES-256 encryption using Web Crypto API
- **Key Derivation**: PBKDF2 for secure key generation
- **Zero-knowledge**: Server never sees unencrypted content

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Automatic code formatting
- **Tailwind**: Utility-first CSS approach

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

- **Netlify**: Similar to Vercel deployment
- **Railway**: Full-stack deployment platform
- **Self-hosted**: Docker container deployment

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `NEXT_PUBLIC_APP_URL` | Application URL for redirects | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the development team

## Roadmap

- [ ] Advanced note organization (folders, collections)
- [ ] Collaborative notes and sharing
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations
- [ ] Advanced export formats (PDF, Word)
- [ ] Offline support with service workers
