// URL Notes Web Application - Export Format Converters
// Handles conversion of notes data to different export formats with browser file downloads

class ExportFormats {
  constructor() {
    this.supportedFormats = {
      'json': { name: 'JSON Backup', extension: '.json', mimeType: 'application/json' },
      'markdown': { name: 'Markdown', extension: '.md', mimeType: 'text/markdown' },
      'obsidian': { name: 'Obsidian', extension: '.md', mimeType: 'text/markdown' },
      'notion': { name: 'Notion', extension: '.html', mimeType: 'text/html' },
      'txt': { name: 'Plain Text', extension: '.txt', mimeType: 'text/plain' },
      'docx': { name: 'Google Docs', extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    };
  }

  // Clean note data by removing encryption fields
  cleanNoteData(note) {
    const cleanNote = { ...note };
    
    // Remove encryption-related fields
    delete cleanNote.title_encrypted;
    delete cleanNote.content_encrypted;
    delete cleanNote.tags_encrypted;
    delete cleanNote.content_hash;
    
    // Ensure we have plain text versions
    if (!cleanNote.title && cleanNote.title_encrypted) {
      cleanNote.title = 'Encrypted Title';
    }
    if (!cleanNote.content && cleanNote.content_encrypted) {
      cleanNote.content = 'Encrypted Content';
    }
    if (!cleanNote.tags && cleanNote.tags_encrypted) {
      cleanNote.tags = [];
    }
    
    // Ensure tags is always an array
    if (!Array.isArray(cleanNote.tags)) {
      cleanNote.tags = [];
    }
    
    return cleanNote;
  }

  // Convert notes data to JSON format (existing format, cleaned)
  toJSON(notesData) {
    const cleanedData = {};
    
    for (const domain in notesData) {
      if (Array.isArray(notesData[domain])) {
        cleanedData[domain] = notesData[domain].map(note => this.cleanNoteData(note));
      }
    }
    
    return JSON.stringify(cleanedData, null, 2);
  }

  // Convert notes data to Markdown format
  toMarkdown(notesData) {
    let markdown = `# URL Notes Export\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        markdown += `## ${domain}\n\n`;
        
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          markdown += `### ${cleanNote.title || 'Untitled Note'}\n\n`;
          
          if (cleanNote.url) {
            markdown += `**URL:** [${cleanNote.url}](${cleanNote.url})\n\n`;
          }
          
          if (cleanNote.pageTitle) {
            markdown += `**Page Title:** ${cleanNote.pageTitle}\n\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            markdown += `**Tags:** ${cleanNote.tags.map(tag => `\`${tag}\``).join(', ')}\n\n`;
          }
          
          if (cleanNote.content) {
            markdown += `${cleanNote.content}\n\n`;
          }
          
          markdown += `*Created: ${new Date(cleanNote.createdAt).toLocaleString()}*\n`;
          markdown += `*Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}*\n\n`;
          markdown += `---\n\n`;
        });
      }
    }
    
    return markdown;
  }

  // Convert notes data to Obsidian format with YAML frontmatter
  toObsidian(notesData) {
    let markdown = `# URL Notes Export\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          // YAML frontmatter
          markdown += `---\n`;
          markdown += `title: "${cleanNote.title || 'Untitled Note'}"\n`;
          markdown += `domain: "${domain}"\n`;
          if (cleanNote.url) markdown += `url: "${cleanNote.url}"\n`;
          if (cleanNote.pageTitle) markdown += `pageTitle: "${cleanNote.pageTitle}"\n`;
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            markdown += `tags: [${cleanNote.tags.map(tag => `"${tag}"`).join(', ')}]\n`;
          }
          markdown += `created: "${cleanNote.createdAt}"\n`;
          markdown += `updated: "${cleanNote.updatedAt}"\n`;
          markdown += `---\n\n`;
          
          // Content
          if (cleanNote.content) {
            markdown += `${cleanNote.content}\n\n`;
          }
          
          markdown += `---\n\n`;
        });
      }
    }
    
    return markdown;
  }

  // Convert notes data to Notion-compatible HTML
  toNotion(notesData) {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `<meta charset="UTF-8">\n`;
    html += `<title>URL Notes Export</title>\n`;
    html += `<style>\n`;
    html += `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }\n`;
    html += `h1 { color: #37352f; border-bottom: 1px solid #e3e2e0; padding-bottom: 10px; }\n`;
    html += `h2 { color: #37352f; margin-top: 30px; }\n`;
    html += `h3 { color: #37352f; margin-top: 25px; }\n`;
    html += `.note { background: #f7f6f3; border-left: 3px solid #9b9a97; padding: 15px; margin: 15px 0; border-radius: 3px; }\n`;
    html += `.metadata { font-size: 14px; color: #787774; margin: 10px 0; }\n`;
    html += `.tags { display: flex; gap: 5px; flex-wrap: wrap; margin: 10px 0; }\n`;
    html += `.tag { background: #e3e2e0; padding: 2px 8px; border-radius: 3px; font-size: 12px; }\n`;
    html += `a { color: #0d6efd; text-decoration: none; }\n`;
    html += `a:hover { text-decoration: underline; }\n`;
    html += `</style>\n</head>\n<body>\n`;
    
    html += `<h1>URL Notes Export</h1>\n`;
    html += `<p><em>Exported on ${new Date().toLocaleString()}</em></p>\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        html += `<h2>${domain}</h2>\n\n`;
        
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          html += `<div class="note">\n`;
          html += `<h3>${cleanNote.title || 'Untitled Note'}</h3>\n`;
          
          if (cleanNote.url) {
            html += `<p><strong>URL:</strong> <a href="${cleanNote.url}" target="_blank">${cleanNote.url}</a></p>\n`;
          }
          
          if (cleanNote.pageTitle) {
            html += `<p><strong>Page Title:</strong> ${cleanNote.pageTitle}</p>\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            html += `<div class="tags">\n`;
            cleanNote.tags.forEach(tag => {
              html += `<span class="tag">${tag}</span>\n`;
            });
            html += `</div>\n`;
          }
          
          if (cleanNote.content) {
            html += `<div>${cleanNote.content.replace(/\n/g, '<br>')}</div>\n`;
          }
          
          html += `<div class="metadata">\n`;
          html += `<p>Created: ${new Date(cleanNote.createdAt).toLocaleString()}</p>\n`;
          html += `<p>Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}</p>\n`;
          html += `</div>\n`;
          html += `</div>\n\n`;
        });
      }
    }
    
    html += `</body>\n</html>`;
    return html;
  }

  // Convert notes data to plain text format
  toTXT(notesData, isSingleNote = false) {
    let text = '';
    
    // For single note export, use minimal formatting
    if (isSingleNote) {
      for (const domain in notesData) {
        if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
          const note = notesData[domain][0]; // Single note
          const cleanNote = this.cleanNoteData(note);
          
          text += `${cleanNote.title || 'Untitled Note'}\n`;
          text += `${'='.repeat(50)}\n\n`;
          
          if (cleanNote.content) {
            text += `${cleanNote.content}\n\n`;
          }
          
          if (cleanNote.url) {
            text += `Source: ${cleanNote.url}\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            text += `Tags: ${cleanNote.tags.join(', ')}\n`;
          }
          
          text += `Created: ${new Date(cleanNote.createdAt).toLocaleDateString()}\n`;
          text += `Updated: ${new Date(cleanNote.updatedAt).toLocaleDateString()}\n`;
        }
      }
      return text;
    }
    
    // For multiple notes export, use full formatting
    text = `URL Notes Export\n`;
    text += `Exported on ${new Date().toLocaleString()}\n`;
    text += `==========================================\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        text += `DOMAIN: ${domain}\n`;
        text += `==========================================\n\n`;
        
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          text += `TITLE: ${cleanNote.title || 'Untitled Note'}\n`;
          text += `------------------------------------------\n`;
          
          if (cleanNote.url) {
            text += `URL: ${cleanNote.url}\n`;
          }
          
          if (cleanNote.pageTitle) {
            text += `PAGE TITLE: ${cleanNote.pageTitle}\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            text += `TAGS: ${cleanNote.tags.join(', ')}\n`;
          }
          
          if (cleanNote.content) {
            text += `\nCONTENT:\n${cleanNote.content}\n`;
          }
          
          text += `\nCreated: ${new Date(cleanNote.createdAt).toLocaleString()}\n`;
          text += `Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}\n`;
          text += `\n==========================================\n\n`;
        });
      }
    }
    
    return text;
  }

  // Convert notes data to DOCX format (simplified HTML that can be opened in Word/Google Docs)
  toDOCX(notesData) {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `<meta charset="UTF-8">\n`;
    html += `<title>URL Notes Export</title>\n`;
    html += `<style>\n`;
    html += `body { font-family: 'Times New Roman', serif; line-height: 1.5; margin: 1in; }\n`;
    html += `h1 { color: #000; text-align: center; font-size: 18pt; margin-bottom: 20pt; }\n`;
    html += `h2 { color: #000; font-size: 14pt; margin-top: 20pt; margin-bottom: 10pt; }\n`;
    html += `h3 { color: #000; font-size: 12pt; margin-top: 15pt; margin-bottom: 8pt; }\n`;
    html += `.note { margin: 15pt 0; padding: 10pt; border: 1px solid #ccc; }\n`;
    html += `.metadata { font-size: 10pt; color: #666; margin: 5pt 0; }\n`;
    html += `.tags { margin: 5pt 0; }\n`;
    html += `.tag { background: #f0f0f0; padding: 2pt 6pt; margin-right: 5pt; font-size: 9pt; }\n`;
    html += `a { color: #0000ff; }\n`;
    html += `</style>\n</head>\n<body>\n`;
    
    html += `<h1>URL Notes Export</h1>\n`;
    html += `<p style="text-align: center; font-style: italic;">Exported on ${new Date().toLocaleString()}</p>\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        html += `<h2>${domain}</h2>\n\n`;
        
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          html += `<div class="note">\n`;
          html += `<h3>${cleanNote.title || 'Untitled Note'}</h3>\n`;
          
          if (cleanNote.url) {
            html += `<p><strong>URL:</strong> <a href="${cleanNote.url}">${cleanNote.url}</a></p>\n`;
          }
          
          if (cleanNote.pageTitle) {
            html += `<p><strong>Page Title:</strong> ${cleanNote.pageTitle}</p>\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            html += `<div class="tags">\n`;
            cleanNote.tags.forEach(tag => {
              html += `<span class="tag">${tag}</span>\n`;
            });
            html += `</div>\n`;
          }
          
          if (cleanNote.content) {
            html += `<div>${cleanNote.content.replace(/\n/g, '<br>')}</div>\n`;
          }
          
          html += `<div class="metadata">\n`;
          html += `<p>Created: ${new Date(cleanNote.createdAt).toLocaleString()}</p>\n`;
          html += `<p>Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}</p>\n`;
          html += `</div>\n`;
          html += `</div>\n\n`;
        });
      }
    }
    
    html += `</body>\n</html>`;
    return html;
  }

  // Browser-based file download functionality
  downloadFile(content, filename, mimeType) {
    try {
      // Validate inputs
      if (!content) {
        throw new Error('No content to export');
      }
      
      if (!filename) {
        throw new Error('Invalid filename');
      }

      // Check if browser supports required APIs
      if (!window.Blob) {
        throw new Error('Your browser does not support file downloads');
      }

      if (!URL.createObjectURL) {
        throw new Error('Your browser does not support file downloads');
      }

      // Create blob with the content
      const blob = new Blob([content], { type: mimeType });
      
      // Check blob size (warn if very large)
      if (blob.size > 50 * 1024 * 1024) { // 50MB
        console.warn('Large export file detected:', blob.size, 'bytes');
      }
      
      // Create download URL
      const url = URL.createObjectURL(blob);
      
      // Create temporary download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  // Main export method that converts data to the specified format and triggers download
  exportToFormat(notesData, format, isSingleNote = false) {
    // Validate inputs
    if (!notesData || typeof notesData !== 'object') {
      throw new Error('Invalid notes data provided');
    }

    // Check if we have any notes to export
    const totalNotes = Object.values(notesData).reduce((total, domainNotes) => {
      return total + (Array.isArray(domainNotes) ? domainNotes.length : 0);
    }, 0);

    if (totalNotes === 0) {
      throw new Error('No notes found to export');
    }

    const formatInfo = this.supportedFormats[format];
    if (!formatInfo) {
      throw new Error(`Unsupported export format: ${format}. Supported formats: ${Object.keys(this.supportedFormats).join(', ')}`);
    }

    let content;
    try {
      switch (format) {
        case 'json':
          content = this.toJSON(notesData);
          break;
        case 'markdown':
          content = this.toMarkdown(notesData);
          break;
        case 'obsidian':
          content = this.toObsidian(notesData);
          break;
        case 'notion':
          content = this.toNotion(notesData);
          break;
        case 'txt':
          content = this.toTXT(notesData, isSingleNote);
          break;
        case 'docx':
          content = this.toDOCX(notesData);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to convert notes to ${format.toUpperCase()} format: ${error.message}`);
    }

    if (!content || content.trim().length === 0) {
      throw new Error(`Generated ${format.toUpperCase()} content is empty`);
    }

    // Generate filename with timestamp and note count
    const timestamp = new Date().toISOString().split('T')[0];
    const noteCountSuffix = totalNotes > 1 ? `-${totalNotes}notes` : '';
    const filename = `url-notes-export-${timestamp}${noteCountSuffix}${formatInfo.extension}`;
    
    return {
      content,
      filename,
      mimeType: formatInfo.mimeType,
      noteCount: totalNotes
    };
  }

  // Export and download in one step
  async exportAndDownload(notesData, format, isSingleNote = false) {
    try {
      // Add a small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const exportResult = this.exportToFormat(notesData, format, isSingleNote);
      
      // Add another small delay before download
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.downloadFile(exportResult.content, exportResult.filename, exportResult.mimeType);
      
      return {
        ...exportResult,
        success: true,
        message: `Successfully exported ${exportResult.noteCount} note${exportResult.noteCount !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Export and download failed:', error);
      
      // Provide more specific error messages
      let userMessage = error.message;
      if (error.message.includes('browser does not support')) {
        userMessage = 'Your browser does not support file downloads. Please try using a modern browser like Chrome, Firefox, or Safari.';
      } else if (error.message.includes('No notes found')) {
        userMessage = 'No notes were selected for export. Please select at least one note.';
      } else if (error.message.includes('Invalid notes data')) {
        userMessage = 'There was an issue with the note data. Please try refreshing the page and selecting your notes again.';
      }
      
      throw new Error(userMessage);
    }
  }

  // Get list of supported formats for UI
  getSupportedFormats() {
    return this.supportedFormats;
  }
}

// Export for use in web application
window.ExportFormats = ExportFormats;