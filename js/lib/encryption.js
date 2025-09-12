// Anchored Web Application - Client-side Encryption
// Handles AES-256-GCM encryption for cloud sync
// Adapted from extension/lib/encryption.js for web environment

class NoteEncryption {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
  }

  // Generate encryption key from password
  async generateKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive actual encryption key
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt note content
  async encryptNote(content, key) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv: iv },
        key,
        data
      );

      return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        algorithm: this.algorithm
      };
    } catch (error) {
      // Encryption failed
      throw new Error('Failed to encrypt note content');
    }
  }

  // Decrypt note content
  async decryptNote(encryptedData, key) {
    try {
      const { encrypted, iv } = encryptedData;
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv: new Uint8Array(iv) },
        key,
        new Uint8Array(encrypted)
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      // Decryption failed
      throw new Error('Failed to decrypt note content');
    }
  }

  // Generate content hash for conflict resolution
  async generateContentHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate random salt
  generateSalt() {
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Encrypt note for cloud storage
  async encryptNoteForCloud(note, userKey) {
    
    const encryptedContent = await this.encryptNote(note.content, userKey);
    const encryptedTitle = await this.encryptNote(note.title, userKey);
    
    // Encrypt tags if they exist
    let encryptedTags = null;
    if (note.tags && Array.isArray(note.tags) && note.tags.length > 0) {
      const tagsJson = JSON.stringify(note.tags);
      encryptedTags = await this.encryptNote(tagsJson, userKey);
    }
    
    const contentHash = await this.generateContentHash(note.content + note.title + (note.tags ? JSON.stringify(note.tags) : ''));

    const result = {
      ...note,
      title_encrypted: encryptedTitle,
      content_encrypted: encryptedContent,
      tags_encrypted: encryptedTags,
      content_hash: contentHash,
      // Keep url and domain as plaintext for proper sync
      // Remove plaintext content
      title: null,
      content: null,
      tags: null
    };
    
    return result;
  }

  // Decrypt note from cloud storage
  async decryptNoteFromCloud(encryptedNote, userKey) {
    const decryptedContent = await this.decryptNote(encryptedNote.content_encrypted, userKey);
    const decryptedTitle = await this.decryptNote(encryptedNote.title_encrypted, userKey);
    
    // Decrypt tags if they exist
    let decryptedTags = [];
    if (encryptedNote.tags_encrypted) {
      try {
        const tagsJson = await this.decryptNote(encryptedNote.tags_encrypted, userKey);
        decryptedTags = JSON.parse(tagsJson);
      } catch (error) {
        // Failed to decrypt tags
        decryptedTags = [];
      }
    }

    return {
      ...encryptedNote,
      title: decryptedTitle,
      content: decryptedContent,
      tags: decryptedTags,
      // Remove encrypted fields
      title_encrypted: undefined,
      content_encrypted: undefined,
      tags_encrypted: undefined
    };
  }

  // Verify content integrity
  async verifyContentIntegrity(note) {
    const expectedHash = await this.generateContentHash(note.content + note.title + (note.tags ? JSON.stringify(note.tags) : ''));
    return expectedHash === note.content_hash;
  }

  // Web-specific utility: Check if Web Crypto API is available
  static isSupported() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  }

  // Web-specific utility: Get encryption status for debugging
  getEncryptionInfo() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      supported: NoteEncryption.isSupported()
    };
  }
}

// Export for web application (no window global needed)
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = NoteEncryption;
} else {
  // Browser environment
  window.NoteEncryption = NoteEncryption;
  window.noteEncryption = new NoteEncryption();
}