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

- [ ] 10. Implement export functionality build from same code as extension export since they should behave the same way
  - [ ] 10.1 Create export interface with note selection
    - Build export modal with format selection dropdown
    - Implement individual note selection with checkboxes
    - Add bulk selection options by domain/URL
    - Create progress indicators for export processing
    - also fix the domain and datefilter from looking differnet in dashboard for mac os safari webpage not mobile, verion style is not the same as other browsers.
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ] 10.2 Implement export processing and download
    - implement actual export functionality similir to extension export since file structur should be similar,
    - Generate export files using adapted export-formats.js
    - Implement browser file download functionality
    - Handle export errors with retry options
    - _Requirements: 7.3, 7.5_

- [ ] 11. Implement import functionality i dont think our extension encrypts on import so we can just import normal and when syncs it should encrypt just like extenion unless our wepbage behaves differntly.
  - [ ] 11.1 Create import interface and file handling
    - Build file upload interface with format validation
    - Support JSON, Markdown, and Plain Text import formats
    - Implement file parsing and validation
    - Display import preview before processing
    - _Requirements: 8.1, 8.2_

- [ ] 12. Testing and quality assurance
  - [ ] 12.1 Implement unit tests for core functionality
    - Test updated encryption/decryption with email-based keys
    - Validate export format conversion accuracy with new encryption
    - Test complete authentication flows including password reset
    - Verify data model validation and sanitization
    - _Requirements: All requirements validation_

  - [ ] 12.2 Perform integration and end-to-end testing
    - Test complete user registration and onboarding flow
    - Validate note synchronization between web app and extension.
    - Test subscription management and payment processing
    - Verify export/import functionality.
    - Test complete forgot password → reset → login flow
    - _Requirements: All requirements validation_

- [ ] 13. Implement extension uninstall redirect to website
  - Configure extension uninstall URL to redirect to anchored.site
  - _Requirements: User retention and feedback collection_

- [ ] 14. Transition Stripe integration to live production keys
  - Replace test Stripe API keys with live production keys
  - Update customer portal links to use live Stripe environment
  - Test live payment processing and webhook handling
  - Verify production billing and subscription management
  - _Requirements: Production payment processing_

- [ ] 15. Consolidate subscription management interface
  - Replace separate "Manage Subscription" and "Billing History" buttons with single "Manage Billing" button
  - Update button to open unified Stripe customer portal
  - Ensure portal provides access to both subscription management and billing history
  - _Requirements: Simplified user experience_

- [ ] 16. Fix extension premium upgrade redirect
  - Update premium ad in extension to redirect to account page instead of placeholder
  - Ensure seamless transition from extension to web account page
  - _Requirements: Consistent upgrade experience_

- [ ] 17. Fix extension settings UI z-index issues
  - Resolve ads appearing above settings area blocking help and onboarding buttons
  - Adjust z-index values to ensure proper layering
  - Test settings accessibility on all screen sizes
  - _Requirements: Accessible settings interface_

- [ ] 18. Update extension onboarding to use web-based flow
  - Ensure settings onboarding button uses same flow as new user login onboarding/ opens that new page with the onbarding instead of the current implmentation 
  - Maintain consistent onboarding experience across platforms
  - _Requirements: Unified onboarding experience_

- [ ] 19. Remove delete account functionality from web interface
  - Remove delete account section from account page
  - Update account page layout to remove delete account UI
  - Ensure account deletion is only available through support channels
  - _Requirements: Account security and support workflow_

- [ ] 20. Implement password change using existing reset logic
  - Replace current change password section with password reset implementation
  - Reuse existing password reset modal and validation logic
  - Ensure consistent password change experience across platform
  - _Requirements: Consistent password management_

  
- [x] 22. Correct AI usage limits and pricing model on webstie feature and pricing areaas show 500 tokens total





  - Update AI rewrite and AI summary to show ai reqrite 1 token per note ai summary 20 uses per site, and ai domain ummary 1 use pernote in domain summary, for features
  - Correct pricing and feature descriptions to reflect actual usage model
  - _Requirements: Accurate usage tracking and billing_

- [x] 23. Update free tier feature restrictions on website features and pricing area





  - Remove and replace export format restrictions feature list
  - Remove version history feature from free tier feature list
  - _Requirements: Accurate free tier feature set_