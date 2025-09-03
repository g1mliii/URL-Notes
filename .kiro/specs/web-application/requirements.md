# Requirements Document

## Introduction

The Anchored Web Application is a companion web platform that provides premium users with comprehensive account management, note synchronization, and advanced note management capabilities. This web application extends the Anchored browser extension functionality by offering a full-featured interface for managing notes across devices, handling subscriptions, and providing account management features while maintaining the zero-knowledge encryption architecture.

The application features a dark blue ocean anchor theme with glassmorphism design elements, creating a cohesive brand experience that evokes the concept of "anchoring" ideas to specific web locations.

## Requirements

### Requirement 1

**User Story:** As a new user, I want to create an account on the web platform, so that I can access premium features and sync my notes across devices.

#### Acceptance Criteria

1. WHEN a user visits the registration page THEN the system SHALL display email and password input fields
2. WHEN a user submits valid registration credentials THEN the system SHALL create a new account using Supabase authentication
3. WHEN account creation is successful THEN the system SHALL generate encryption keys using the same logic as the browser extension
4. WHEN a user registers THEN the system SHALL send a verification email for account activation
5. IF registration fails due to existing email THEN the system SHALL display an appropriate error message

### Requirement 2

**User Story:** As an existing user, I want to sign in to my account, so that I can access my synced notes and manage my subscription.

#### Acceptance Criteria

1. WHEN a user visits the login page THEN the system SHALL display email and password input fields
2. WHEN a user submits valid login credentials THEN the system SHALL authenticate using Supabase Auth
3. WHEN authentication is successful THEN the system SHALL redirect to the dashboard
4. IF authentication fails THEN the system SHALL display an appropriate error message
5. WHEN a user is already logged in THEN the system SHALL automatically redirect to the dashboard

### Requirement 3

**User Story:** As a user who forgot my password, I want to reset my password, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user clicks "Forgot Password" THEN the system SHALL display a password reset form
2. WHEN a user submits their email for password reset THEN the system SHALL send a reset email via Supabase Auth
3. WHEN a user clicks the reset link THEN the system SHALL display a new password form
4. WHEN a user submits a new password THEN the system SHALL update their credentials and migrate existing notes to new encryption keys
5. IF the reset token is invalid or expired THEN the system SHALL display an appropriate error message

### Requirement 4

**User Story:** As a free user, I want to upgrade to premium for $2.50/month, so that I can access cloud sync and advanced features.

#### Acceptance Criteria

1. WHEN a free user accesses premium features THEN the system SHALL display subscription options with $2.50/month pricing
2. WHEN a user selects the premium plan THEN the system SHALL integrate with Stripe payment processor for monthly billing
3. WHEN payment is successful THEN the system SHALL update the user's account status via edge function
4. WHEN subscription is activated THEN the system SHALL enable premium features immediately
5. WHEN subscription fails THEN the system SHALL display payment error and retry options
6. WHEN displaying pricing THEN the system SHALL clearly show free tier limitations vs premium benefits

### Requirement 5

**User Story:** As a premium user paying $2.50/month, I want to manage my subscription, so that I can update payment methods or cancel if needed.

#### Acceptance Criteria

1. WHEN a premium user accesses account settings THEN the system SHALL display current subscription status including next billing date and $2.50/month rate
2. WHEN a user wants to update payment method THEN the system SHALL provide secure payment update interface via Stripe
3. WHEN a user cancels subscription THEN the system SHALL process cancellation and set expiration date while maintaining access until period end
4. WHEN subscription expires THEN the system SHALL downgrade account to free tier and disable premium features
5. WHEN subscription is renewed THEN the system SHALL maintain premium access without interruption and charge $2.50/month

### Requirement 6

**User Story:** As a premium user, I want to view and manage my synced notes, so that I can organize and maintain my note collection.

#### Acceptance Criteria

1. WHEN a premium user accesses the notes dashboard THEN the system SHALL display all synced notes organized by domain/URL with filtering options
2. WHEN a user filters notes THEN the system SHALL provide filtering by specific domain, URL, or date ranges
3. WHEN a user searches for notes THEN the system SHALL provide real-time search across all note content within selected filters
3. WHEN a user selects a note THEN the system SHALL display the note content in an editor interface
4. WHEN a user edits a note THEN the system SHALL sync changes to the cloud while maintaining encryption
5. WHEN a user deletes a note THEN the system SHALL remove it from cloud storage and update all connected devices

### Requirement 7

**User Story:** As a premium user, I want to export my notes, so that I can backup my data or migrate to another system.

#### Acceptance Criteria

1. WHEN a user requests note export THEN the system SHALL provide the same format options as the extension (JSON, Markdown, Obsidian, Notion, Plain Text, Google Docs) and note selection interface
2. WHEN a user selects notes for export THEN the system SHALL allow individual note selection or bulk selection by domain/URL
3. WHEN export is initiated THEN the system SHALL decrypt and compile only the selected notes
4. WHEN export is complete THEN the system SHALL provide a downloadable file
4. WHEN exporting large datasets THEN the system SHALL show progress indicators
5. IF export fails THEN the system SHALL display error message and retry options

### Requirement 8

**User Story:** As a premium user, I want to import notes from other systems, so that I can consolidate my note-taking workflow.

#### Acceptance Criteria

1. WHEN a user accesses import functionality THEN the system SHALL support the same formats as export (JSON, Markdown, Plain Text) for importing notes
2. WHEN a user uploads an import file THEN the system SHALL validate file format and structure
3. WHEN import is processed THEN the system SHALL encrypt and sync imported notes to cloud storage
4. WHEN import contains duplicates THEN the system SHALL provide conflict resolution options
5. IF import fails THEN the system SHALL display detailed error messages and suggestions

### Requirement 9

**User Story:** As a user, I want the web application to work seamlessly on both mobile and desktop, so that I can access my notes from any device.

#### Acceptance Criteria

1. WHEN the application loads on mobile devices THEN the system SHALL display a responsive mobile-optimized interface
2. WHEN the application loads on desktop THEN the system SHALL utilize available screen space effectively
3. WHEN switching between devices THEN the system SHALL maintain consistent functionality across platforms
4. WHEN using touch interfaces THEN the system SHALL provide appropriate touch targets and gestures
5. WHEN using keyboard navigation THEN the system SHALL support standard keyboard shortcuts and accessibility

### Requirement 10

**User Story:** As a security-conscious user, I want my notes to remain accessible when I change my password, so that my data is migrated to new encryption keys seamlessly.

#### Acceptance Criteria

1. WHEN a user changes their password THEN the system SHALL decrypt existing notes with old keys and re-encrypt with new keys
2. WHEN password reset occurs THEN the system SHALL migrate all encrypted notes to use the new password-derived encryption keys
3. WHEN encryption migration is in progress THEN the system SHALL show progress indicators and prevent concurrent operations
4. WHEN migration completes successfully THEN the system SHALL verify all notes are accessible with new encryption keys
5. IF encryption migration fails THEN the system SHALL rollback changes and maintain access with original keys

### Requirement 11

**User Story:** As a developer, I want to reuse existing extension logic in the web application, so that functionality remains consistent and migration between platforms is seamless.

#### Acceptance Criteria

1. WHEN implementing encryption functionality THEN the system SHALL use the same encryption logic as the browser extension
2. WHEN implementing note storage operations THEN the system SHALL reuse the storage patterns from the extension's storage.js module
3. WHEN implementing sync functionality THEN the system SHALL utilize the existing sync.js and api.js logic from the extension
4. WHEN implementing note organization THEN the system SHALL maintain the same domain/URL grouping logic as the extension
5. WHEN implementing search functionality THEN the system SHALL use consistent search algorithms with the extension