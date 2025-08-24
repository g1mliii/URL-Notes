// URL Notes Web App - Client-side Encryption
// EXACTLY matches the browser extension implementation for compatibility

export class NoteEncryption {
  private algorithm = 'AES-GCM'
  private keyLength = 256
  private ivLength = 12 // 96 bits for GCM

  // Generate encryption key from password - EXACTLY matches extension
  async generateKey(password: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)
    const saltBuffer = encoder.encode(salt)

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derive actual encryption key - EXACTLY matches extension
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
    )
  }

  // Encrypt note content - EXACTLY matches extension
  async encryptNote(content: string, key: CryptoKey): Promise<{
    encrypted: number[]
    iv: number[]
    algorithm: string
  }> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength))

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv: iv },
        key,
        data
      )

      return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        algorithm: this.algorithm
      }
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt note content')
    }
  }

  // Decrypt note content - EXACTLY matches extension
  async decryptNote(encryptedData: any, key: CryptoKey): Promise<string> {
    try {
      console.log('🔐 Decrypting data:', {
        type: typeof encryptedData,
        isObject: typeof encryptedData === 'object',
        keys: encryptedData ? Object.keys(encryptedData) : 'no keys',
        data: encryptedData
      })

      // Handle different encryption data formats
      let encrypted: number[], iv: number[]
      
      if (encryptedData && typeof encryptedData === 'object') {
        // Check if it's the extension format (direct properties)
        if (Array.isArray(encryptedData.encrypted) && Array.isArray(encryptedData.iv)) {
          encrypted = encryptedData.encrypted
          iv = encryptedData.iv
          console.log('✅ Using extension format:', { encryptedLength: encrypted.length, ivLength: iv.length })
        }
        // Check if it's the web app format (nested in content_encrypted)
        else if (encryptedData.content_encrypted && Array.isArray(encryptedData.content_encrypted.encrypted)) {
          encrypted = encryptedData.content_encrypted.encrypted
          iv = encryptedData.content_encrypted.iv
          console.log('✅ Using web app format:', { encryptedLength: encrypted.length, ivLength: iv.length })
        }
        // Check if it's a different format
        else if (Array.isArray(encryptedData)) {
          // If it's just an array, assume it's the encrypted data and try to find IV
          encrypted = encryptedData
          // Try to find IV in the data or use a default
          iv = this.findIVInData(encryptedData)
          console.log('✅ Using array format:', { encryptedLength: encrypted.length, ivLength: iv.length })
        }
        else {
          console.error('❌ Unknown encryption data format:', encryptedData)
          throw new Error('Unknown encryption data format')
        }
      } else {
        console.error('❌ Invalid encryption data:', encryptedData)
        throw new Error('Invalid encryption data')
      }

      // Validate data before decryption
      if (!encrypted || !iv || encrypted.length === 0 || iv.length === 0) {
        console.error('❌ Invalid encrypted data or IV:', { encrypted, iv })
        throw new Error('Invalid encrypted data or IV')
      }

      // Check if data is too small for AES-GCM
      if (encrypted.length < 16) {
        console.error('❌ Encrypted data too small for AES-GCM:', encrypted.length)
        console.error('❌ This suggests the data is corrupted or not properly encrypted')
        console.error('❌ Raw data:', encrypted)
        
        // Try to provide helpful information about what this might be
        if (encrypted.length === 9) {
          console.error('❌ 9 bytes suggests this might be a test string like "Test Note"')
          const possibleText = String.fromCharCode(...encrypted)
          console.error('❌ As text, this would be:', possibleText)
        }
        
        throw new Error(`Encrypted data too small for AES-GCM (${encrypted.length} bytes, minimum 16 bytes). This suggests the data is corrupted or not properly encrypted.`)
      }

      if (iv.length !== 12) {
        console.error('❌ IV length incorrect for AES-GCM:', iv.length)
        throw new Error('IV length incorrect for AES-GCM (must be 12 bytes)')
      }

      console.log('🔑 Attempting decryption with:', { 
        algorithm: this.algorithm, 
        encryptedLength: encrypted.length, 
        ivLength: iv.length 
      })

      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv: new Uint8Array(iv) },
        key,
        new Uint8Array(encrypted)
      )

      const decoder = new TextDecoder()
      const result = decoder.decode(decrypted)
      console.log('✅ Decryption successful, result length:', result.length)
      return result
    } catch (error) {
      console.error('❌ Decryption failed:', error)
      throw new Error(`Failed to decrypt note content: ${error}`)
    }
  }

  // Helper method to find IV in encrypted data (fallback for extension compatibility)
  private findIVInData(data: number[]): number[] {
    // For extension compatibility, try to extract IV from the data
    // This is a fallback method when IV is not explicitly provided
    if (data.length >= 12) {
      // Try to use first 12 bytes as IV (common pattern)
      return data.slice(0, 12)
    }
    // If no IV can be found, throw error
    throw new Error('No IV found in encrypted data')
  }

  // Generate content hash for conflict resolution - EXACTLY matches extension
  async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    
    // Convert to hex string - EXACTLY matches extension
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Generate random salt - EXACTLY matches extension
  generateSalt(): string {
    const saltArray = crypto.getRandomValues(new Uint8Array(32))
    return Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Encrypt note for cloud storage - EXACTLY matches extension
  async encryptNoteForCloud(note: any, userKey: CryptoKey): Promise<any> {
    const encryptedContent = await this.encryptNote(note.content, userKey)
    const encryptedTitle = await this.encryptNote(note.title, userKey)
    const contentHash = await this.generateContentHash(note.content + note.title)

    return {
      ...note,
      title_encrypted: encryptedTitle,
      content_encrypted: encryptedContent,
      content_hash: contentHash,
      // Keep url and domain as plaintext for proper sync - EXACTLY matches extension
      // Remove plaintext content
      title: null,
      content: null
    }
  }

  // Decrypt note from cloud storage - EXACTLY matches extension
  async decryptNoteFromCloud(encryptedNote: any, userKey: CryptoKey): Promise<any> {
    try {
      let decryptedContent: string, decryptedTitle: string

      // Try to decrypt content
      try {
        decryptedContent = await this.decryptNote(encryptedNote.content_encrypted, userKey)
      } catch (error) {
        console.warn('Failed to decrypt content, trying alternative format:', error)
        // Try alternative decryption method for extension compatibility
        decryptedContent = await this.decryptNote(encryptedNote, userKey)
      }

      // Try to decrypt title
      try {
        decryptedTitle = await this.decryptNote(encryptedNote.title_encrypted, userKey)
      } catch (error) {
        console.warn('Failed to decrypt title, using fallback:', error)
        decryptedTitle = 'Note from Extension'
      }

      return {
        ...encryptedNote,
        title: decryptedTitle,
        content: decryptedContent,
        // Remove encrypted fields
        title_encrypted: undefined,
        content_encrypted: undefined
      }
    } catch (error) {
      console.error('Complete decryption failure:', error)
      throw error
    }
  }

  // Verify content integrity - EXACTLY matches extension
  async verifyContentIntegrity(note: any): Promise<boolean> {
    const expectedHash = await this.generateContentHash(note.content + note.title)
    return expectedHash === note.content_hash
  }

  // Debug method to analyze encryption data format
  debugEncryptionData(data: any): string {
    if (!data) return 'No data provided'
    
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return `Array data: length=${data.length}, first few values: ${data.slice(0, 5).join(', ')}`
      }
      
      const keys = Object.keys(data)
      const hasEncrypted = keys.includes('encrypted')
      const hasIv = keys.includes('iv')
      const hasAlgorithm = keys.includes('algorithm')
      
      return `Object data: keys=[${keys.join(', ')}], hasEncrypted=${hasEncrypted}, hasIv=${hasIv}, hasAlgorithm=${hasAlgorithm}`
    }
    
    return `Unknown data type: ${typeof data}`
  }

  // Try multiple decryption methods for maximum compatibility
  async decryptNoteWithFallback(encryptedData: any, key: CryptoKey): Promise<string> {
    const errors: string[] = []
    
    // Method 1: Standard decryption
    try {
      return await this.decryptNote(encryptedData, key)
    } catch (error) {
      errors.push(`Standard decryption failed: ${error}`)
    }
    
    // Method 2: Try to extract data from different formats
    try {
      if (encryptedData && typeof encryptedData === 'object') {
        // Try different property combinations
        const possibleFormats = [
          { encrypted: encryptedData.encrypted, iv: encryptedData.iv },
          { encrypted: encryptedData.content, iv: encryptedData.iv },
          { encrypted: encryptedData.data, iv: encryptedData.iv },
          { encrypted: encryptedData, iv: Array.from(crypto.getRandomValues(new Uint8Array(12))) }
        ]
        
        for (const format of possibleFormats) {
          try {
            if (format.encrypted && Array.isArray(format.encrypted)) {
              return await this.decryptNote(format, key)
            }
          } catch (e) {
            // Continue to next format
          }
        }
      }
    } catch (error) {
      errors.push(`Format extraction failed: ${error}`)
    }
    
    // Method 3: Try to recover from corrupted data
    try {
      if (encryptedData && typeof encryptedData === 'object' && Array.isArray(encryptedData.encrypted)) {
        const corruptedData = encryptedData.encrypted
        
        // If data is too small, it might be plaintext that was never encrypted
        if (corruptedData.length < 16) {
          console.warn('⚠️ Data appears to be corrupted or plaintext, attempting recovery...')
          
          // Try to decode as plaintext
          try {
            const possibleText = String.fromCharCode(...corruptedData)
            if (possibleText.match(/^[a-zA-Z0-9\s\-_.,!?]+$/)) {
              console.log('✅ Recovered plaintext:', possibleText)
              return possibleText
            }
          } catch (e) {
            // Continue to next method
          }
        }
      }
    } catch (error) {
      errors.push(`Recovery attempt failed: ${error}`)
    }
    
    // If all methods fail, throw comprehensive error
    throw new Error(`All decryption methods failed. Errors: ${errors.join('; ')}. Data format: ${this.debugEncryptionData(encryptedData)}`)
  }

  // Handle corrupted or invalid encrypted data
  handleCorruptedData(encryptedData: any): string {
    if (!encryptedData) {
      return 'No data available'
    }
    
    if (typeof encryptedData === 'object' && Array.isArray(encryptedData.encrypted)) {
      const data = encryptedData.encrypted
      
      if (data.length < 16) {
        // Try to recover as plaintext
        try {
          const possibleText = String.fromCharCode(...data)
          if (possibleText.match(/^[a-zA-Z0-9\s\-_.,!?]+$/)) {
            return `Recovered: ${possibleText}`
          }
        } catch (e) {
          // Ignore recovery errors
        }
        
        return `Corrupted data (${data.length} bytes) - too small for AES-GCM`
      }
    }
    
    return 'Invalid or corrupted encrypted data'
  }
}

// Export singleton instance
export const noteEncryption = new NoteEncryption()