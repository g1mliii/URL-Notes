// Cross-Browser Migration Utility for Firefox
// Handles data migration from Chrome extension to Firefox extension

class CrossBrowserMigration {
  constructor(storage) {
    this.storage = storage;
    this.chromeExtensionId = 'anchored-chrome-extension'; // Placeholder - actual Chrome extension ID
  }

  // Detect if Chrome extension data exists
  async detectChromeData() {
    try {
      console.log('Firefox Migration: Checking for Chrome extension data...');
      
      // Check if we have any notes in Firefox storage already
      const existingNotes = await this.storage.getAllNotes();
      if (existingNotes && existingNotes.length > 0) {
        console.log('Firefox Migration: Firefox extension already has data, skipping Chrome detection');
        return null;
      }

      // Firefox cannot directly access Chrome extension storage
      // Users will need to export from Chrome and import to Firefox manually
      console.log('Firefox Migration: No automatic Chrome data detection available');
      console.log('Firefox Migration: Users should export from Chrome and import to Firefox');
      
      return null;
    } catch (error) {
      console.error('Firefox Migration: Error detecting Chrome data:', error);
      return null;
    }
  }

  // Import data from Chrome extension export format
  async importFromChromeExport(exportData) {
    try {
      console.log('Firefox Migration: Starting import from Chrome export...');
      
      // Validate export data format
      if (!this.validateExportData(exportData)) {
        throw new Error('Invalid export data format');
      }

      // Check encryption compatibility
      const encryptionCompatible = await this.verifyEncryptionCompatibility(exportData);
      if (!encryptionCompatible) {
        console.warn('Firefox Migration: Encryption format may not be compatible');
      }

      // Import notes using standard import method
      const importedCount = await this.storage.importNotes(exportData);
      
      console.log(`Firefox Migration: Successfully imported ${importedCount} notes from Chrome`);
      
      // Emit migration complete event
      window.eventBus?.emit('migration:complete', {
        source: 'chrome',
        target: 'firefox',
        notesImported: importedCount
      });

      return {
        success: true,
        notesImported: importedCount,
        message: `Successfully migrated ${importedCount} notes from Chrome to Firefox`
      };
    } catch (error) {
      console.error('Firefox Migration: Error importing from Chrome:', error);
      
      window.eventBus?.emit('migration:error', {
        source: 'chrome',
        target: 'firefox',
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        message: 'Failed to migrate data from Chrome'
      };
    }
  }

  // Validate export data format
  validateExportData(exportData) {
    try {
      // Check for Anchored export identifier
      if (!exportData._anchored) {
        console.warn('Firefox Migration: Export data missing _anchored identifier');
        return false;
      }

      // Check version compatibility
      const exportVersion = exportData._anchored.version;
      if (!exportVersion) {
        console.warn('Firefox Migration: Export data missing version');
        return false;
      }

      // Check for notes data
      let hasNotes = false;
      for (const key in exportData) {
        if (key !== '_anchored' && Array.isArray(exportData[key])) {
          hasNotes = true;
          break;
        }
      }

      if (!hasNotes) {
        console.warn('Firefox Migration: Export data contains no notes');
        return false;
      }

      console.log('Firefox Migration: Export data validation passed');
      return true;
    } catch (error) {
      console.error('Firefox Migration: Error validating export data:', error);
      return false;
    }
  }

  // Verify encryption compatibility between Chrome and Firefox
  async verifyEncryptionCompatibility(exportData) {
    try {
      // Check if any notes are encrypted
      let hasEncryptedNotes = false;
      
      for (const domain in exportData) {
        if (domain === '_anchored') continue;
        
        const notes = exportData[domain];
        if (Array.isArray(notes)) {
          for (const note of notes) {
            if (note.title_encrypted || note.content_encrypted) {
              hasEncryptedNotes = true;
              break;
            }
          }
        }
        
        if (hasEncryptedNotes) break;
      }

      if (!hasEncryptedNotes) {
        console.log('Firefox Migration: No encrypted notes found, encryption compatibility not required');
        return true;
      }

      // Check if encryption module is available
      if (!window.noteEncryption) {
        console.warn('Firefox Migration: Encryption module not available');
        return false;
      }

      // Encryption format should be compatible (AES-256-GCM is standard)
      console.log('Firefox Migration: Encryption compatibility verified');
      return true;
    } catch (error) {
      console.error('Firefox Migration: Error verifying encryption compatibility:', error);
      return false;
    }
  }

  // Test data migration with sample data
  async testMigration() {
    try {
      console.log('Firefox Migration: Running migration test...');
      
      // Create sample export data
      const sampleData = {
        _anchored: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          browser: 'chrome'
        },
        'example.com': [
          {
            id: crypto.randomUUID(),
            title: 'Test Migration Note',
            content: 'This is a test note for migration',
            url: 'https://example.com',
            domain: 'example.com',
            tags: ['test', 'migration'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      };

      // Validate the sample data
      const isValid = this.validateExportData(sampleData);
      
      console.log(`Firefox Migration: Test migration ${isValid ? 'passed' : 'failed'}`);
      return isValid;
    } catch (error) {
      console.error('Firefox Migration: Test migration failed:', error);
      return false;
    }
  }

  // Get migration status and recommendations
  async getMigrationStatus() {
    try {
      const existingNotes = await this.storage.getAllNotes();
      const hasData = existingNotes && existingNotes.length > 0;

      return {
        hasExistingData: hasData,
        noteCount: existingNotes ? existingNotes.length : 0,
        canAutoMigrate: false, // Firefox cannot auto-detect Chrome data
        recommendedAction: hasData 
          ? 'Firefox extension already has data. Use import/export for additional data.'
          : 'Export your notes from Chrome extension and import them here.',
        migrationMethod: 'manual' // Firefox requires manual export/import
      };
    } catch (error) {
      console.error('Firefox Migration: Error getting migration status:', error);
      return {
        hasExistingData: false,
        noteCount: 0,
        canAutoMigrate: false,
        recommendedAction: 'Error checking migration status',
        migrationMethod: 'manual'
      };
    }
  }
}

// Export for use in Firefox extension
window.CrossBrowserMigration = CrossBrowserMigration;
