# Requirements Document

## Introduction

The Firefox Extension Migration project aims to adapt the existing Anchored Chrome extension to be fully compatible with Firefox's WebExtensions API. This migration will create a separate Firefox-compatible version while maintaining feature parity with the Chrome extension, ensuring users can access the same note-taking functionality across both browsers.

The Firefox extension will maintain the same glassmorphism design, local-first architecture, and zero-knowledge encryption while adapting to Firefox-specific APIs and manifest requirements. After Firefox compatibility is achieved, a subsequent Safari migration will be planned.

## Requirements

### Requirement 1

**User Story:** As a Firefox user, I want to install and use the Anchored extension, so that I can take domain/URL-specific notes with the same functionality as Chrome users.

#### Acceptance Criteria

1. WHEN a user installs the extension in Firefox THEN the system SHALL load successfully with all core functionality available
2. WHEN the extension initializes THEN the system SHALL use Firefox-compatible WebExtensions APIs instead of Chrome-specific APIs
3. WHEN a user opens the popup THEN the system SHALL display the same 400x600px interface with glassmorphism design
4. WHEN a user creates notes THEN the system SHALL store them locally using Firefox's storage.local API
5. IF the extension fails to load THEN the system SHALL display appropriate error messages for Firefox-specific issues

### Requirement 2

**User Story:** As a developer, I want the Firefox extension to use WebExtensions APIs, so that it complies with Firefox's extension standards and security requirements.

#### Acceptance Criteria

1. WHEN implementing storage operations THEN the system SHALL use browser.storage.local instead of chrome.storage.local
2. WHEN implementing tab operations THEN the system SHALL use browser.tabs API with Firefox-compatible permissions
3. WHEN implementing background scripts THEN the system SHALL use Firefox-compatible background page or event page patterns
4. WHEN implementing content scripts THEN the system SHALL use browser.runtime messaging instead of Chrome-specific messaging
5. WHEN implementing context menus THEN the system SHALL use browser.contextMenus API with Firefox-compatible options

### Requirement 3

**User Story:** As a user, I want my notes to sync between Firefox and Chrome extensions, so that I can switch browsers without losing data.

#### Acceptance Criteria

1. WHEN a user has premium subscription THEN the system SHALL sync notes between Firefox and Chrome extensions using the same Supabase backend
2. WHEN notes are encrypted THEN the system SHALL use the same AES-256-GCM encryption format as the Chrome extension
3. WHEN syncing occurs THEN the system SHALL maintain the same data structure and API endpoints
4. WHEN conflicts arise THEN the system SHALL use the same last-write-wins resolution strategy
5. WHEN encryption keys are derived THEN the system SHALL use identical PBKDF2 parameters for cross-browser compatibility

### Requirement 4

**User Story:** As a Firefox user, I want the extension to work offline, so that I can take notes even without internet connectivity.

#### Acceptance Criteria

1. WHEN the extension loads without internet THEN the system SHALL provide full local note-taking functionality
2. WHEN notes are created offline THEN the system SHALL store them in Firefox's IndexedDB using the same schema
3. WHEN internet connectivity returns THEN the system SHALL sync offline notes to the cloud automatically
4. WHEN storage quota is reached THEN the system SHALL handle Firefox's storage limitations gracefully
5. WHEN the browser restarts THEN the system SHALL restore all locally stored notes and settings

### Requirement 5

**User Story:** As a Firefox user, I want the same premium features as Chrome users, so that I have feature parity across browsers.

#### Acceptance Criteria

1. WHEN a user has premium subscription THEN the system SHALL provide cloud sync, unlimited history, and ad-free experience
2. WHEN a user is on free tier THEN the system SHALL display CodeFuel ads in the same respectful placement as Chrome
3. WHEN premium features are accessed THEN the system SHALL validate subscription status using the same Supabase integration
4. WHEN subscription expires THEN the system SHALL downgrade to free tier with the same limitations as Chrome
5. WHEN billing is managed THEN the system SHALL redirect to the same web application for subscription management

### Requirement 6

**User Story:** As a developer, I want to maintain separate codebases for Chrome and Firefox, so that browser-specific optimizations can be implemented without affecting the other platform.

#### Acceptance Criteria

1. WHEN developing Firefox features THEN the system SHALL maintain code in the separate extension-firefox directory
2. WHEN shared logic is updated THEN the system SHALL provide clear guidelines for syncing changes between codebases
3. WHEN browser-specific APIs are used THEN the system SHALL document the differences and compatibility requirements
4. WHEN testing is performed THEN the system SHALL have separate test suites for Firefox-specific functionality
5. WHEN releases are made THEN the system SHALL maintain independent versioning for Chrome and Firefox extensions

### Requirement 7

**User Story:** As a Firefox user, I want the extension to handle Firefox-specific security and permission requirements, so that it operates safely within Firefox's security model.

#### Acceptance Criteria

1. WHEN requesting permissions THEN the system SHALL use Firefox-compatible permission declarations in manifest.json
2. WHEN accessing web pages THEN the system SHALL comply with Firefox's Content Security Policy requirements
3. WHEN storing sensitive data THEN the system SHALL use Firefox's secure storage mechanisms
4. WHEN making network requests THEN the system SHALL handle Firefox's CORS and security restrictions
5. WHEN the extension updates THEN the system SHALL maintain user data integrity during Firefox's update process

### Requirement 8

**User Story:** As a user, I want the Firefox extension to have the same performance characteristics as the Chrome version, so that my note-taking experience is consistent across browsers.

#### Acceptance Criteria

1. WHEN the popup opens THEN the system SHALL load within 200ms matching Chrome performance targets
2. WHEN searching notes THEN the system SHALL return results within 100ms for local queries
3. WHEN syncing notes THEN the system SHALL use the same batching and caching strategies as Chrome
4. WHEN handling large note collections THEN the system SHALL maintain responsive UI through virtual scrolling and lazy loading
5. WHEN memory usage is monitored THEN the system SHALL stay within Firefox's extension memory limits

### Requirement 9

**User Story:** As a developer, I want to plan for Safari migration after Firefox completion, so that the extension can eventually support all major browsers.

#### Acceptance Criteria

1. WHEN Firefox migration is complete THEN the system SHALL document Safari-specific requirements and API differences
2. WHEN architecture decisions are made THEN the system SHALL consider Safari WebExtensions compatibility for future migration
3. WHEN shared components are designed THEN the system SHALL create abstractions that can support Safari's extension model
4. WHEN testing frameworks are established THEN the system SHALL plan for Safari-specific testing requirements
5. WHEN the codebase is structured THEN the system SHALL prepare for a three-browser architecture (Chrome, Firefox, Safari)

### Requirement 10

**User Story:** As a quality assurance engineer, I want comprehensive testing for Firefox-specific functionality, so that the extension works reliably across different Firefox versions and configurations.

#### Acceptance Criteria

1. WHEN testing is performed THEN the system SHALL validate functionality across Firefox ESR, stable, and beta versions
2. WHEN API compatibility is tested THEN the system SHALL verify all WebExtensions API calls work correctly in Firefox
3. WHEN performance is measured THEN the system SHALL benchmark against Chrome extension performance metrics
4. WHEN edge cases are tested THEN the system SHALL handle Firefox-specific scenarios like private browsing mode
5. WHEN regression testing occurs THEN the system SHALL maintain automated test suites for Firefox-specific functionality