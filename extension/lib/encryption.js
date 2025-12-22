// Client-side AES-256-GCM encryption for cloud sync
class NoteEncryption {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96 bits for GCM
  }

  async generateKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

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
      throw new Error('Failed to encrypt note content');
    }
  }

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
      throw new Error('Failed to decrypt note content');
    }
  }

  async generateContentHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  generateSalt() {
    const saltArray = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async encryptNoteForCloud(note, userKey) {
    const encryptedContent = await this.encryptNote(note.content, userKey);
    const encryptedTitle = await this.encryptNote(note.title, userKey);

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
      // Remove plaintext for cloud storage
      title: null,
      content: null,
      tags: null
    };

    return result;
  }

  async decryptNoteFromCloud(encryptedNote, userKey) {
    const decryptedContent = await this.decryptNote(encryptedNote.content_encrypted, userKey);
    const decryptedTitle = await this.decryptNote(encryptedNote.title_encrypted, userKey);

    let decryptedTags = [];
    if (encryptedNote.tags_encrypted) {
      try {
        const tagsJson = await this.decryptNote(encryptedNote.tags_encrypted, userKey);
        decryptedTags = JSON.parse(tagsJson);
      } catch (error) {
        decryptedTags = [];
      }
    }

    return {
      ...encryptedNote,
      title: decryptedTitle,
      content: decryptedContent,
      tags: decryptedTags,
      title_encrypted: undefined,
      content_encrypted: undefined,
      tags_encrypted: undefined
    };
  }

  async verifyContentIntegrity(note) {
    const expectedHash = await this.generateContentHash(note.content + note.title + (note.tags ? JSON.stringify(note.tags) : ''));
    return expectedHash === note.content_hash;
  }
}

window.noteEncryption = new NoteEncryption();
