# Implementation Plan

- [x] 1. Set up project structure and core infrastructure
  - Create web application directory structure with HTML, CSS, and JS folders
  - Set up basic HTML templates for landing, dashboard, and account pages with Anchored branding
  - Create main.css with ocean-themed glassmorphism design tokens matching extension styles
  - Implement responsive breakpoints for mobile-first design
  - Apply dark blue ocean anchor theme throughout the application
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 2. Adapt core libraries from extension for web environment
  - [x] 2.1 Port encryption.js library for web application
    - Copy encryption.js from extension and adapt for web environment (remove Chrome APIs)
    - Test encryption/decryption functionality in browser environment
    - Ensure compatibility with existing extension encryption format
    - _Requirements: 11.1, 10.1_

  - [x] 2.2 Adapt api.js for web application authentication
    - Copy and modify api.js to work without Chrome extension APIs
    - Implement web-based localStorage/sessionStorage instead of chrome.storage.local
    - Adapt authentication methods for web environment
    - _Requirements: 11.3, 1.2, 2.2_

  - [x] 2.3 Create simplified storage adapter for web


    - Create ultra-aggressive caching storage adapter (cache-first, API-minimal)
    - Implement localStorage-based caching with 24+ hour cache duration
    - Batch API saves: only sync after 10+ changes, 30+ minutes, or tab close
    - Use emergency sync on beforeunload, batch queue for multiple notes
    - Load from cache immediately, fetch from API only once per day
    - No IndexedDB complexity - just localStorage cache + smart cloud sync
    - _Requirements: 11.2_

  - [x] 2.4 Port export-formats.js for web downloads
    - Copy export-formats.js and adapt for web file downloads
    - Implement browser-based file download functionality
    - Test all export formats (JSON, Markdown, Obsidian, Notion, Plain Text, Google Docs)
    - _Requirements: 11.5, 7.1_

- [x] 3. Adapt existing authentication system for web




  - [x] 3.1 Port authentication UI from extension

    - Copy authentication forms and validation from extension settings.js

    - Adapt handleSignUp(), handleSignIn(), and handleForgotPassword() methods for web
    - Reuse existing Supabase Auth integration from api.js
    - Ensure encryption key generation works the same as extension
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_


  - [x] 3.2 Implement web-specific authentication flow

    - Adapt session management for web environment (localStorage instead of chrome.storage)
    - Handle authentication success and redirect to dashboard
    - Implement password reset flow with existing resetPassword() method
    - Add encryption key migration for password changes (reuse extension logic)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.1, 10.2_

- [x] 4. Build notes dashboard interface




  - [x] 4.1 Create notes display and organization system


    - Build notes dashboard layout with domain/URL organization
    - Implement note cards with preview functionality (read-only focus)
    - Add domain and URL filtering capabilities
    - Create search functionality across note content
    - Focus on note management, viewing, and organization rather than intensive editing
    - _Requirements: 6.1, 6.2, 11.4_

  - [x] 4.2 Implement simplified note editing functionality


    - Create basic note editor interface with auto-save on blur/close
    - Integrate with encryption for secure note storage
    - Implement direct cloud sync (no local storage complexity)
    - Add note deletion functionality with confirmation
    - Focus on note management rather than full editing experience
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] 5. Deploy website to production
  - [x] 5.1 Configure production environment and GitHub Pages hosting





    - Set up automated deployment from main branch
    - Configure environment variables and build process if needed
    - Ensure HTTPS is enabled through GitHub Pages
    - _Requirements: Security and performance requirements_

  - [x] 5.2 Deploy and monitor application

    - ✅ Deploy application to production environment
    - ✅ Update Supabase configuration for production domain
    - ✅ Set up monitoring and error tracking
    - ✅ Configure backup and disaster recovery
    - ✅ Perform final production testing and validation
    
    **Completion Summary:**
    - ✅ Production deployment live at https://anchored.site
    - ✅ Direct GitHub Pages deployment from URL-Notes repository
    - ✅ All files accessible: config.js, health.json, monitoring.js
    - ✅ All pages functional: landing, dashboard, account
    - ✅ Client-side monitoring and error tracking implemented
    - ✅ Security headers configured via HTML meta tags
    - ✅ Backup and disaster recovery plan documented
    - ✅ HTTPS enforced with valid SSL certificate
    - ✅ Simplified deployment process (no cross-repository complexity)
    
    **Deployment Method:**
    - Direct GitHub Pages from main branch, root folder
    - Custom domain: anchored.site
    - Instant updates on push to main branch
    - Drag-and-drop file editing supported
    - _Requirements: All requirements in production environment_

- [x] 6. Implement subscription management system





  - [x] 6.1 Create subscription upgrade interface


    - Build premium plan selection interface with $2.50/month pricing
    - Integrate Stripe  payment processing for monthly subscriptions
    - Create edge function for subscription status updates
    - create upgrade fucntion and end of subcscription for already existing users and thier ai usage to 500 and back to 5, 
    - Handle successful payment and account activation
    - Display clear free vs premium feature comparison
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Build subscription management dashboard


    - Display current subscription status and details using stripe integraion
    - Implement payment method update functionality using strip integration
    - Add subscription cancellation with expiration handling using stripe integration 
    - Create billing history and invoice access using stripe integration
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. ~~Standardize encryption~~ (COMPLETE - Both platforms already use identical encryption)
  - [x] 8.1 ~~Update web app encryption~~ (COMPLETE - Already uses `user.id:user.email + salt`)
  - [x] 8.2 ~~Verify extension encryption~~ (COMPLETE - Already uses `user.id:user.email + salt`)
  - **Status**: Both extension and web app use identical key derivation: `PBKDF2(user.id:user.email, salt, 100000 iterations)`
  - **Verified**: Same encryption logic, same salt storage, full compatibility
  - _Requirements: 10.1, 11.1, 3.4, 10.2 - All satisfied_

- [x] 9. Complete password reset functionality implementation 


  - [x] 9.1 Configure password reset redirect and callback handling


    - Configure Supabase Auth redirect URL to point to anchored.site password reset page
    - Create password reset callback handler to process email link parameters
    - Build password reset form interface for entering new password
    - Implement Supabase Auth password update using access token from email link
    - Test complete forgot password → email → reset → login flow
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 9.2 Handle password reset edge cases and user experience
    - Add proper error handling for invalid/expired reset tokens
    - Add user feedback for successful reset email sending
    - Ensure proper redirect flow after successful password reset
    - Add loading states and success/error messages
    - Note: No encryption migration needed with email-based keys
    - _Requirements: 3.5_

- [x] 10. Implement export functionality build from same code as extension export since they should behave the same way

  - [x] 10.1 Create export interface with note selection build from same code as extension export since they should behave the same way mostly with some additiona features in webpage





    - Build export modal with format selection dropdown
    - Implement individual note selection with checkboxes
    - Add bulk selection options by domain/URL
    - Create progress indicators for export processing
    - also fix the domain and datefilter from looking differnet in dashboard for mac os safari webpage not mobile, verion style is not the same as other browsers.
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 10.2 Implement export processing and download

    - implement actual export functionality similir to extension export since file structur should be similar,
    - Generate export files using adapted export-formats.js
    - Implement browser file download functionality
    - Handle export errors with retry options
    - _Requirements: 7.3, 7.5_
    
- [x] 11 Implement import functionality i dont think our extension encrypts on import so we can just import normal and when syncs it should encrypt just like extenion unless our wepbage behaves differntl
    - Build file upload interface with format validation
    - Support JSON imports rename export and import from json to anchored so user doenst get confused.
    - Implement file parsing and validation
    - Display import preview before processing
    - _Requirements: 8.1, 8.2_

- [ ] 12. Testing and quality assurance
  - [ ] 12.1 Implement unit tests for core functionality
    - remove logging in webpage for public use, as well as any logging that is send from edge functions to console
    - immplement performacne optimizations without changing style or design of webpage and mobile page
    - fix dashboard notes not showing up when creating a new note and requirind a refresh of the page to be visible
    - make sure monitoring.js loggin and errors are ready so that we are publish and user ready for public. making sure we dont show console logs if that is industry standard for this not sure
    - Verify data model validation and sanitization
    - _Requirements: All requirements validation_

  - [ ] 12.2 Perform integration and end-to-end testing
    - Test complete user registration and onboarding flow
    - Validate note synchronization between web app and extension.
    - Test subscription management and payment processing
    - Verify export/import functionality.
    - Test complete forgot password → reset → login flow
    - _Requirements: All requirements validation_

- [ ] 14. Transition Stripe integration to live production keys
  - if not already trigger sync subscriptin status when opening account section so that users dont have to do it manually. and so that when we redirect bck to account from stripe it works properluy.
  - update toast notification for sync subscription status to reword premium subscrition cancelled expired at wahtever date to be less confusing should be subscription expires at date subscritopn recurring billing cancelled something like that but shorter and more precise less confusing to user.
  - Replace test Stripe API keys with live production keys i think they are only used in supabase so i can do that just tell me what need to be changed. just check as im not sure where i need to replace any keys for live versions
  - Update customer portal links to use live Stripe environment https://billing.stripe.com/p/login/7sY7sN0nf3Vl3IY6gW3oA00
  - Test live payment processing
  - Verify production and subscription management
  - _Requirements: Production payment processing_

- [ ] 15. Consolidate subscription management interface
  - Replace separate "Manage Subscription" and "Billing History" buttons with single "Manage subscription"
  - Update button to open unified Stripe customer portal with url https://billing.stripe.com/p/login/7sY7sN0nf3Vl3IY6gW3oA00
  - _Requirements: Simplified user experience_


- [-] 20. Implement password change using existing reset logic

  - Replace current change password section in account area with forgot password implmentation keeping the ui the same but reusing the same logic with the same listeners as forgot password so we dont run into issues of not detecting/oppening modal.
  - update description in this area as well as we dont need to reinecrypt data or do any transition step anymore since password does not effect this.
  - Reuse existing password reset modal and validation logic
  - Ensure consistent password change experience across platform
  - _Requirements: Consistent password management_
