// URL Notes Extension - Export Format Converters
// Handles conversion of notes data to different export formats

class ExportFormats {
  constructor() {
    this.supportedFormats = {
      'json': { name: 'Anchored Backup', extension: '.json', mimeType: 'application/json' },
      'markdown': { name: 'Markdown', extension: '.md', mimeType: 'text/markdown' },
      'obsidian': { name: 'Obsidian Vault', extension: '.json', mimeType: 'application/json' },
      'notion': { name: 'Notion CSV', extension: '.csv', mimeType: 'text/csv' },
      'txt': { name: 'Plain Text', extension: '.txt', mimeType: 'text/plain' },
      'docx': { name: 'Google Docs', extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    };
  }

  // Clean note data by removing encryption and internal fields
  cleanNoteData(note) {
    const cleanNote = { ...note };
    
    // Remove encryption-related fields
    delete cleanNote.title_encrypted;
    delete cleanNote.content_encrypted;
    delete cleanNote.tags_encrypted;
    delete cleanNote.content_hash;
    
    // Remove internal storage fields
    delete cleanNote.is_deleted;
    delete cleanNote.deleted_at;
    delete cleanNote.version;
    delete cleanNote.sync_pending;
    delete cleanNote.needs_decryption_retry;
    delete cleanNote.decryption_error;
    delete cleanNote.last_synced_at;
    
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

  // Convert internal formatting to target format
  convertContentForFormat(content, targetFormat) {
    if (!content) return '';

    switch (targetFormat) {
      case 'markdown':
      case 'obsidian':
        return this.convertToMarkdown(content);
      case 'html':
      case 'docx':
        return this.convertToHtml(content);
      case 'plain':
      case 'txt':
        return this.convertToPlainText(content);
      case 'notion':
        return this.convertToNotionMarkdown(content);
      default:
        return content; // Return as-is for JSON and other formats
    }
  }

  // Convert internal formatting to Markdown
  convertToMarkdown(content) {
    if (!content) return '';

    let text = content;

    // Convert our internal formatting to standard Markdown
    // Bold: **text** -> **text** (already correct)
    // Italic: *text* -> *text* (already correct)
    // Underline: __text__ -> <u>text</u> (Markdown doesn't have underline, use HTML)
    text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, (match, content) => {
      return `<u>${this.escapeHtml(content)}</u>`;
    });
    
    // Strikethrough: ~~text~~ -> ~~text~~ (already correct)
    // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
    // Sanitize color values to prevent XSS
    text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, (match, color, content) => {
      const safeColor = this.sanitizeColor(color);
      if (safeColor) {
        return `<span style="color:${safeColor}">${this.escapeHtml(content)}</span>`;
      }
      return this.escapeHtml(content); // If color is unsafe, just return escaped content
    });
    
    // Citation: {citation}text{/citation} -> > text (blockquote style)
    text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '> *$1*');
    
    // Links: [text](url) -> [text](url) - validate URLs for safety
    text = text.replace(/\[(.+?)\]\(([^\s)]+)\)/g, (match, linkText, url) => {
      const safeUrl = this.sanitizeUrl(url);
      if (safeUrl) {
        return `[${linkText}](${safeUrl})`;
      }
      return linkText; // If URL is unsafe, just show the text
    });

    return text;
  }

  // Convert internal formatting to HTML
  convertToHtml(content) {
    if (!content) return '';

    let text = content;

    // First escape all HTML to prevent XSS
    text = this.escapeHtml(text);

    // Convert our internal formatting to HTML (now safe since content is escaped)
    // Bold: **text** -> <strong>text</strong>
    text = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text* -> <em>text</em>
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Underline: __text__ -> <u>text</u>
    text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, '<u>$1</u>');
    
    // Strikethrough: ~~text~~ -> <s>text</s>
    text = text.replace(/~~([^~]*(?:~(?!~)[^~]*)*?)~~/g, '<s>$1</s>');
    
    // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
    // Sanitize color values to prevent XSS
    text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, (match, color, content) => {
      const safeColor = this.sanitizeColor(color);
      if (safeColor) {
        return `<span style="color:${safeColor}">${content}</span>`;
      }
      return content; // If color is unsafe, just return the content without styling
    });
    
    // Citation: {citation}text{/citation} -> <blockquote><em>text</em></blockquote>
    text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '<blockquote><em>$1</em></blockquote>');
    
    // Links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
    // Sanitize URLs to prevent XSS
    text = text.replace(/\[(.+?)\]\(([^\s)]+)\)/g, (match, linkText, url) => {
      const safeUrl = this.sanitizeUrl(url);
      if (safeUrl) {
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      }
      return linkText; // If URL is unsafe, just show the text
    });
    
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  // Convert internal formatting to plain text
  convertToPlainText(content) {
    if (!content) return '';

    let text = content;

    // Remove all formatting markers, keeping just the text
    // Bold: **text** -> text
    text = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '$1');
    
    // Italic: *text* -> text
    text = text.replace(/\*([^*]+)\*/g, '$1');
    
    // Underline: __text__ -> text
    text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, '$1');
    
    // Strikethrough: ~~text~~ -> text
    text = text.replace(/~~([^~]*(?:~(?!~)[^~]*)*?)~~/g, '$1');
    
    // Color: {color:#ff0000}text{/color} -> text
    text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, '$2');
    
    // Citation: {citation}text{/citation} -> "text"
    text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '"$1"');
    
    // Links: [text](url) -> text (url) - validate URLs for safety
    text = text.replace(/\[(.+?)\]\(([^\s)]+)\)/g, (match, linkText, url) => {
      const safeUrl = this.sanitizeUrl(url);
      if (safeUrl) {
        return `${linkText} (${safeUrl})`;
      }
      return linkText; // If URL is unsafe, just show the text
    });

    return text;
  }

  // Convert internal formatting to Notion-compatible Markdown
  convertToNotionMarkdown(content) {
    if (!content) return '';

    let text = content;

    // Notion supports standard Markdown formatting
    // Bold: **text** -> **text** (already correct)
    // Italic: *text* -> *text* (already correct)
    // Strikethrough: ~~text~~ -> ~~text~~ (already correct)
    
    // Underline: __text__ -> <u>text</u> (Notion supports HTML underline)
    text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, (match, content) => {
      return `<u>${this.escapeHtml(content)}</u>`;
    });
    
    // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
    // Notion has limited color support, but supports HTML spans
    text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, (match, color, content) => {
      const safeColor = this.sanitizeColor(color);
      if (safeColor) {
        return `<span style="color:${safeColor}">${this.escapeHtml(content)}</span>`;
      }
      return this.escapeHtml(content);
    });
    
    // Citation: {citation}text{/citation} -> > text (Notion supports blockquotes)
    text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '> *$1*');
    
    // Links: [text](url) -> [text](url) (Notion supports Markdown links)
    text = text.replace(/\[(.+?)\]\(([^\s)]+)\)/g, (match, linkText, url) => {
      const safeUrl = this.sanitizeUrl(url);
      if (safeUrl) {
        return `[${linkText}](${safeUrl})`;
      }
      return linkText;
    });

    return text;
  }

  // Security helper functions
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Sanitize color values to prevent XSS
  sanitizeColor(color) {
    if (!color) return null;
    
    const trimmedColor = color.trim();
    
    // Allow hex colors (#fff, #ffffff)
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
      return trimmedColor;
    }
    
    // Allow rgb/rgba colors
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
      return trimmedColor;
    }
    
    // Allow hsl/hsla colors
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
      return trimmedColor;
    }
    
    // Allow CSS variables (for theme colors)
    if (/^var\(--[a-zA-Z0-9-]+\)$/.test(trimmedColor)) {
      return trimmedColor;
    }
    
    // Allow common named colors (basic set for safety)
    const safeNamedColors = [
      'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 
      'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
      'maroon', 'olive', 'teal', 'silver', 'gold'
    ];
    
    if (safeNamedColors.includes(trimmedColor.toLowerCase())) {
      return trimmedColor;
    }
    
    return null; // Unsafe color
  }

  // Sanitize URLs to prevent XSS
  sanitizeUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        return url;
      }
    } catch (e) {
      // Invalid URL
    }
    
    return null; // Unsafe URL
  }

  // Convert notes data to JSON format (Anchored Backup format, cleaned)
  toJSON(notesData) {
    const cleanedData = {};
    
    // Preserve _anchored metadata if it exists
    if (notesData._anchored) {
      cleanedData._anchored = notesData._anchored;
    }
    
    for (const domain in notesData) {
      if (domain !== '_anchored' && Array.isArray(notesData[domain])) {
        cleanedData[domain] = notesData[domain].map(note => this.cleanNoteData(note));
      }
    }
    
    return JSON.stringify(cleanedData, null, 2);
  }

  // Convert notes data to Markdown format with domain organization
  toMarkdown(notesData) {
    let markdown = `# Anchored Export\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    
    // Calculate totals for overview (exclude _anchored metadata)
    const totalDomains = Object.keys(notesData).filter(key => key !== '_anchored').length;
    const totalNotes = Object.entries(notesData)
      .filter(([key]) => key !== '_anchored')
      .reduce((sum, [, notes]) => sum + (Array.isArray(notes) ? notes.length : 0), 0);
    
    markdown += `> **Export Summary**  \n`;
    markdown += `> ${totalDomains} domains  \n`;
    markdown += `> ${totalNotes} notes  \n`;
    markdown += `> ${new Date().toLocaleDateString()}\n\n`;
    markdown += `---\n\n`;

    // Sort domains by note count (most active first)
    const sortedDomains = Object.entries(notesData)
      .filter(([, notes]) => Array.isArray(notes) && notes.length > 0)
      .sort(([, a], [, b]) => b.length - a.length);

    // Create table of contents
    markdown += `## Table of Contents\n\n`;
    sortedDomains.forEach(([domain, notes]) => {
      markdown += `- [${domain}](#${domain.replace(/\./g, '')}) (${notes.length} notes)\n`;
    });
    markdown += `\n---\n\n`;

    // Process each domain
    sortedDomains.forEach(([domain, notes]) => {
      markdown += `## ${domain}\n\n`;
      markdown += `*${notes.length} note${notes.length !== 1 ? 's' : ''} from this domain*\n\n`;
      
      // Sort notes by creation date (newest first)
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      // Group notes by month for better organization
      const notesByMonth = {};
      sortedNotes.forEach(note => {
        const monthKey = new Date(note.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        if (!notesByMonth[monthKey]) notesByMonth[monthKey] = [];
        notesByMonth[monthKey].push(note);
      });
      
      // Sort months in reverse chronological order
      const sortedMonths = Object.keys(notesByMonth).sort((a, b) => 
        new Date(b + ' 1') - new Date(a + ' 1')
      );
      
      sortedMonths.forEach(month => {
        if (sortedMonths.length > 1) {
          markdown += `### ${month}\n\n`;
        }
        
        notesByMonth[month].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          markdown += `#### ${cleanNote.title || 'Untitled Note'}\n\n`;
          
          // Metadata box
          markdown += `| Field | Value |\n`;
          markdown += `|-------|-------|\n`;
          if (cleanNote.url) {
            markdown += `| URL | [${cleanNote.url}](${cleanNote.url}) |\n`;
          }
          if (cleanNote.pageTitle) {
            markdown += `| Page | ${cleanNote.pageTitle} |\n`;
          }
          markdown += `| Domain | ${domain} |\n`;
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            markdown += `| Tags | ${cleanNote.tags.map(tag => `\`${tag}\``).join(', ')} |\n`;
          }
          markdown += `| Created | ${new Date(cleanNote.createdAt).toLocaleString()} |\n`;
          markdown += `| Updated | ${new Date(cleanNote.updatedAt).toLocaleString()} |\n`;
          markdown += `\n`;
          
          // Content
          if (cleanNote.content) {
            markdown += `**Content:**\n\n`;
            markdown += `${this.convertContentForFormat(cleanNote.content, 'markdown')}\n\n`;
          }
          
          markdown += `---\n\n`;
        });
      });
    });
    
    // Add footer with export info
    markdown += `## Export Information\n\n`;
    markdown += `- **Generated by:** Anchored Extension\n`;
    markdown += `- **Export Date:** ${new Date().toLocaleString()}\n`;
    markdown += `- **Format:** Markdown\n`;
    markdown += `- **Organization:** Domain-first, chronologically sorted\n`;
    
    return markdown;
  }

  // Convert notes data to Obsidian format with hierarchical domain organization
  toObsidian(notesData) {
    const obsidianFiles = [];
    const domainHubs = {};
    
    // Sort notes by date within each domain
    const sortedNotesData = {};
    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        sortedNotesData[domain] = [...notesData[domain]].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
      }
    }
    
    // Create individual note files and collect domain info
    for (const domain in sortedNotesData) {
      const domainNotes = [];
      
      sortedNotesData[domain].forEach(note => {
        const cleanNote = this.cleanNoteData(note);
        
        // Create safe filename with date prefix for chronological sorting
        const datePrefix = new Date(cleanNote.createdAt).toISOString().split('T')[0];
        const safeTitle = (cleanNote.title || 'Untitled Note')
          .replace(/[<>:"/\\|?*]/g, '-')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 80);
        
        const filename = `${domain}/${datePrefix} - ${safeTitle}.md`;
        
        // Create note content with enhanced YAML frontmatter
        let noteContent = '';
        noteContent += `---\n`;
        noteContent += `title: "${cleanNote.title || 'Untitled Note'}"\n`;
        noteContent += `domain: "${domain}"\n`;
        noteContent += `domain_hub: "[[${domain} - Domain Hub]]"\n`;
        if (cleanNote.url) noteContent += `url: "${cleanNote.url}"\n`;
        if (cleanNote.pageTitle) noteContent += `page_title: "${cleanNote.pageTitle}"\n`;
        if (cleanNote.tags && cleanNote.tags.length > 0) {
          noteContent += `tags:\n`;
          cleanNote.tags.forEach(tag => {
            noteContent += `  - "${tag}"\n`;
          });
          // Add domain tag for organization
          noteContent += `  - "domain/${domain}"\n`;
        } else {
          noteContent += `tags:\n  - "domain/${domain}"\n`;
        }
        noteContent += `created: "${cleanNote.createdAt}"\n`;
        noteContent += `updated: "${cleanNote.updatedAt}"\n`;
        noteContent += `source: "Anchored"\n`;
        noteContent += `---\n\n`;
        
        // Add navigation links
        noteContent += `← [[${domain} - Domain Hub|Back to ${domain}]] | [[Anchored - Master Index|Home]]\n\n`;
        
        // Add source information as callout
        if (cleanNote.url) {
          noteContent += `> [!info] Source Information\n`;
          noteContent += `> **URL:** [${cleanNote.url}](${cleanNote.url})\n`;
          if (cleanNote.pageTitle) {
            noteContent += `> **Page:** ${cleanNote.pageTitle}\n`;
          }
          noteContent += `> **Domain:** ${domain}\n`;
          noteContent += `> **Created:** ${new Date(cleanNote.createdAt).toLocaleDateString()}\n\n`;
        }
        
        // Main content
        if (cleanNote.content) {
          noteContent += `## Content\n\n`;
          noteContent += `${this.convertContentForFormat(cleanNote.content, 'obsidian')}\n\n`;
        }
        
        // Add related notes section (placeholder for future enhancement)
        noteContent += `## Related Notes\n\n`;
        noteContent += `*Use Obsidian's graph view to discover related notes by tags and domain.*\n\n`;
        
        // Add metadata footer
        noteContent += `---\n\n`;
        noteContent += `**Metadata**  \n`;
        noteContent += `Created: ${new Date(cleanNote.createdAt).toLocaleString()}  \n`;
        noteContent += `Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}  \n`;
        noteContent += `Source: Anchored Extension\n`;
        
        obsidianFiles.push({
          filename: filename,
          content: noteContent,
          domain: domain,
          createdAt: cleanNote.createdAt,
          title: cleanNote.title || 'Untitled Note'
        });
        
        // Collect info for domain hub
        domainNotes.push({
          filename: filename,
          title: cleanNote.title || 'Untitled Note',
          createdAt: cleanNote.createdAt,
          url: cleanNote.url,
          tags: cleanNote.tags || []
        });
      });
      
      domainHubs[domain] = domainNotes;
    }
    
    // Create domain hub files (MOC - Map of Content pattern)
    for (const domain in domainHubs) {
      const notes = domainHubs[domain];
      let hubContent = '';
      
      // YAML frontmatter for domain hub
      hubContent += `---\n`;
      hubContent += `title: "${domain} - Domain Hub"\n`;
      hubContent += `type: "domain_hub"\n`;
      hubContent += `domain: "${domain}"\n`;
      hubContent += `note_count: ${notes.length}\n`;
      hubContent += `tags:\n  - "hub"\n  - "domain/${domain}"\n`;
      hubContent += `created: "${new Date().toISOString()}"\n`;
      hubContent += `source: "Anchored"\n`;
      hubContent += `---\n\n`;
      
      // Hub header
      hubContent += `# ${domain} - Domain Hub\n\n`;
      hubContent += `← [[Anchored - Master Index|Back to Master Index]]\n\n`;
      
      hubContent += `> [!abstract] Domain Overview\n`;
      hubContent += `> **Domain:** ${domain}\n`;
      hubContent += `> **Total Notes:** ${notes.length}\n`;
      hubContent += `> **Date Range:** ${new Date(Math.min(...notes.map(n => new Date(n.createdAt)))).toLocaleDateString()} - ${new Date(Math.max(...notes.map(n => new Date(n.createdAt)))).toLocaleDateString()}\n\n`;
      
      // Group notes by month for better organization
      const notesByMonth = {};
      notes.forEach(note => {
        const monthKey = new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        if (!notesByMonth[monthKey]) notesByMonth[monthKey] = [];
        notesByMonth[monthKey].push(note);
      });
      
      hubContent += `## Notes by Month\n\n`;
      
      // Sort months in reverse chronological order
      const sortedMonths = Object.keys(notesByMonth).sort((a, b) => 
        new Date(b + ' 1') - new Date(a + ' 1')
      );
      
      sortedMonths.forEach(month => {
        hubContent += `### ${month}\n\n`;
        notesByMonth[month].forEach(note => {
          const noteLink = note.filename.replace('.md', '');
          const dateStr = new Date(note.createdAt).toLocaleDateString();
          hubContent += `- [[${noteLink}|${note.title}]] *(${dateStr})*\n`;
          if (note.url) {
            hubContent += `  - [${note.url}](${note.url})\n`;
          }
          if (note.tags && note.tags.length > 0) {
            hubContent += `  - ${note.tags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ')}\n`;
          }
        });
        hubContent += `\n`;
      });
      
      // Add tag cloud for this domain
      const allTags = notes.flatMap(note => note.tags || []);
      const tagCounts = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      
      if (Object.keys(tagCounts).length > 0) {
        hubContent += `## Tag Cloud\n\n`;
        const sortedTags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20); // Top 20 tags
        
        sortedTags.forEach(([tag, count]) => {
          hubContent += `#${tag.replace(/\s+/g, '_')} (${count}) `;
        });
        hubContent += `\n\n`;
      }
      
      // Add quick actions
      hubContent += `## Quick Actions\n\n`;
      hubContent += `- Use graph view to explore connections\n`;
      hubContent += `- Search within domain: \`tag:#domain/${domain}\`\n`;
      hubContent += `- View by date: Sort by creation date\n`;
      hubContent += `- Filter by tags: Use tag search\n\n`;
      
      hubContent += `---\n\n`;
      hubContent += `*This hub was generated from Anchored export on ${new Date().toLocaleString()}*\n`;
      
      obsidianFiles.push({
        filename: `${domain} - Domain Hub.md`,
        content: hubContent,
        domain: domain,
        type: 'hub'
      });
    }
    
    // Create master index file
    let masterIndex = '';
    masterIndex += `---\n`;
    masterIndex += `title: "Anchored - Master Index"\n`;
    masterIndex += `type: "master_index"\n`;
    masterIndex += `total_domains: ${Object.keys(domainHubs).length}\n`;
    masterIndex += `total_notes: ${obsidianFiles.filter(f => f.type !== 'hub').length}\n`;
    masterIndex += `tags:\n  - "index"\n  - "anchored"\n`;
    masterIndex += `created: "${new Date().toISOString()}"\n`;
    masterIndex += `source: "Anchored"\n`;
    masterIndex += `---\n\n`;
    
    masterIndex += `# Anchored - Master Index\n\n`;
    masterIndex += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    
    masterIndex += `> [!tip] Welcome to Your Anchored Vault\n`;
    masterIndex += `> This vault contains ${obsidianFiles.filter(f => f.type !== 'hub').length} notes from ${Object.keys(domainHubs).length} domains.\n`;
    masterIndex += `> Each domain has its own hub for easy navigation.\n\n`;
    
    masterIndex += `## Domain Hubs\n\n`;
    
    // Sort domains by note count
    const sortedDomains = Object.entries(domainHubs)
      .sort(([, a], [, b]) => b.length - a.length);
    
    sortedDomains.forEach(([domain, notes]) => {
      masterIndex += `### [[${domain} - Domain Hub|${domain}]] (${notes.length} notes)\n\n`;
      
      // Show recent notes from this domain
      const recentNotes = notes.slice(0, 3);
      masterIndex += `**Recent notes:**\n`;
      recentNotes.forEach(note => {
        const noteLink = note.filename.replace('.md', '');
        const dateStr = new Date(note.createdAt).toLocaleDateString();
        masterIndex += `- [[${noteLink}|${note.title}]] *(${dateStr})*\n`;
      });
      
      if (notes.length > 3) {
        masterIndex += `- *...and ${notes.length - 3} more notes*\n`;
      }
      masterIndex += `\n`;
    });
    
    masterIndex += `## Quick Navigation\n\n`;
    masterIndex += `- **By Tags:** Use the tag pane to browse by topic\n`;
    masterIndex += `- **By Date:** Sort files by creation date\n`;
    masterIndex += `- **By Domain:** Use the domain hubs above\n`;
    masterIndex += `- **Graph View:** Explore connections between notes\n`;
    masterIndex += `- **Search:** Use global search to find specific content\n\n`;
    
    masterIndex += `## Import Instructions\n\n`;
    masterIndex += `1. Create a new Obsidian vault or open an existing one\n`;
    masterIndex += `2. Copy the folder structure and files from this export\n`;
    masterIndex += `3. Maintain the domain-based folder structure for best organization\n`;
    masterIndex += `4. Use the domain hubs as starting points for exploration\n\n`;
    
    masterIndex += `---\n\n`;
    masterIndex += `*Generated by Anchored Extension - ${new Date().toLocaleString()}*\n`;
    
    obsidianFiles.unshift({
      filename: 'Anchored - Master Index.md',
      content: masterIndex,
      type: 'master_index'
    });
    
    // For single note export (fallback)
    if (obsidianFiles.filter(f => !f.type).length === 1) {
      const singleNote = obsidianFiles.find(f => !f.type);
      return singleNote.content;
    }
    
    // Return structured format for multiple files
    return JSON.stringify({
      type: 'obsidian-vault',
      files: obsidianFiles.map(f => ({
        filename: f.filename,
        content: f.content
      })),
      structure: {
        domains: Object.keys(domainHubs),
        totalNotes: obsidianFiles.filter(f => !f.type).length,
        totalHubs: Object.keys(domainHubs).length
      }
    }, null, 2);
  }

  // Convert notes data to Notion-compatible CSV format with domain organization
  toNotion(notesData) {
    // Enhanced CSV format optimized for Notion database import
    // Columns: Title, Content, Tags, URL, Domain, Page Title, Created, Updated, Domain Group, Month Created, Year Created
    
    let csv = 'Title,Content,Tags,URL,Domain,Page Title,Created,Updated,Domain Group,Month Created,Year Created\n';
    
    // Collect all notes and sort by domain, then by date
    const allNotes = [];
    
    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        // Sort notes within domain by creation date (newest first)
        const sortedNotes = [...notesData[domain]].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        sortedNotes.forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          allNotes.push({
            ...cleanNote,
            domain: domain
          });
        });
      }
    }
    
    // Sort all notes by domain, then by date
    allNotes.sort((a, b) => {
      if (a.domain !== b.domain) {
        return a.domain.localeCompare(b.domain);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Generate CSV rows
    allNotes.forEach(note => {
      // Escape CSV values and handle quotes
      const escapeCSV = (value) => {
        if (!value) return '';
        const stringValue = String(value);
        // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
          return '"' + stringValue.replace(/"/g, '""') + '"';
        }
        return stringValue;
      };
      
      const createdDate = new Date(note.createdAt);
      const updatedDate = new Date(note.updatedAt);
      
      // Enhanced tags with domain tag
      const allTags = [...(note.tags || []), `domain-${note.domain}`];
      
      const title = escapeCSV(note.title || 'Untitled Note');
      const content = escapeCSV(this.convertContentForFormat(note.content || '', 'notion'));
      const tags = escapeCSV(allTags.join(', '));
      const url = escapeCSV(note.url || '');
      const domain = escapeCSV(note.domain);
      const pageTitle = escapeCSV(note.pageTitle || '');
      const created = escapeCSV(createdDate.toISOString());
      const updated = escapeCSV(updatedDate.toISOString());
      
      // Additional organization columns for Notion
      const domainGroup = escapeCSV(`📁 ${note.domain}`); // Emoji for visual grouping
      const monthCreated = escapeCSV(createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }));
      const yearCreated = escapeCSV(createdDate.getFullYear().toString());
      
      csv += `${title},${content},${tags},${url},${domain},${pageTitle},${created},${updated},${domainGroup},${monthCreated},${yearCreated}\n`;
    });
    
    return csv;
  }

  // Alternative Notion format: Markdown with proper structure
  toNotionMarkdown(notesData) {
    let markdown = `# Anchored Export\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;

    for (const domain in notesData) {
      if (Array.isArray(notesData[domain]) && notesData[domain].length > 0) {
        markdown += `## ${domain}\n\n`;
        
        notesData[domain].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          // Use Notion-style page structure
          markdown += `### ${cleanNote.title || 'Untitled Note'}\n\n`;
          
          // Add properties as a table (Notion recognizes this format)
          markdown += `| Property | Value |\n`;
          markdown += `|----------|-------|\n`;
          if (cleanNote.url) {
            markdown += `| URL | [${cleanNote.url}](${cleanNote.url}) |\n`;
          }
          if (cleanNote.pageTitle) {
            markdown += `| Page Title | ${cleanNote.pageTitle} |\n`;
          }
          markdown += `| Domain | ${domain} |\n`;
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            markdown += `| Tags | ${cleanNote.tags.join(', ')} |\n`;
          }
          markdown += `| Created | ${new Date(cleanNote.createdAt).toLocaleString()} |\n`;
          markdown += `| Updated | ${new Date(cleanNote.updatedAt).toLocaleString()} |\n`;
          markdown += `\n`;
          
          // Content section
          if (cleanNote.content) {
            markdown += `**Content:**\n\n`;
            markdown += `${this.convertContentForFormat(cleanNote.content, 'markdown')}\n\n`;
          }
          
          markdown += `---\n\n`;
        });
      }
    }
    
    return markdown;
  }

  // Convert notes data to plain text format with domain organization
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
            text += `${this.convertContentForFormat(cleanNote.content, 'plain')}\n\n`;
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
    
    // For multiple notes export, use enhanced domain-organized formatting (exclude _anchored metadata)
    const totalDomains = Object.keys(notesData).filter(key => key !== '_anchored').length;
    const totalNotes = Object.entries(notesData)
      .filter(([key]) => key !== '_anchored')
      .reduce((sum, [, notes]) => sum + (Array.isArray(notes) ? notes.length : 0), 0);
    
    text = `ANCHORED EXPORT\n`;
    text += `${'='.repeat(60)}\n\n`;
    text += `Export Date: ${new Date().toLocaleString()}\n`;
    text += `Total Domains: ${totalDomains}\n`;
    text += `Total Notes: ${totalNotes}\n`;
    text += `Organization: Domain-first, chronologically sorted\n\n`;
    text += `${'='.repeat(60)}\n\n`;

    // Sort domains by note count (most active first)
    const sortedDomains = Object.entries(notesData)
      .filter(([, notes]) => Array.isArray(notes) && notes.length > 0)
      .sort(([, a], [, b]) => b.length - a.length);

    // Table of contents
    text += `TABLE OF CONTENTS\n`;
    text += `${'-'.repeat(30)}\n`;
    sortedDomains.forEach(([domain, notes], index) => {
      text += `${index + 1}. ${domain} (${notes.length} notes)\n`;
    });
    text += `\n${'='.repeat(60)}\n\n`;

    // Process each domain
    sortedDomains.forEach(([domain, notes], domainIndex) => {
      text += `${domainIndex + 1}. DOMAIN: ${domain.toUpperCase()}\n`;
      text += `${'='.repeat(60)}\n`;
      text += `Notes in this domain: ${notes.length}\n\n`;
      
      // Sort notes by creation date (newest first)
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      // Group notes by month for better organization
      const notesByMonth = {};
      sortedNotes.forEach(note => {
        const monthKey = new Date(note.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        if (!notesByMonth[monthKey]) notesByMonth[monthKey] = [];
        notesByMonth[monthKey].push(note);
      });
      
      // Sort months in reverse chronological order
      const sortedMonths = Object.keys(notesByMonth).sort((a, b) => 
        new Date(b + ' 1') - new Date(a + ' 1')
      );
      
      sortedMonths.forEach(month => {
        if (sortedMonths.length > 1) {
          text += `   ${month}\n`;
          text += `   ${'-'.repeat(month.length)}\n`;
        }
        
        notesByMonth[month].forEach((note, noteIndex) => {
          const cleanNote = this.cleanNoteData(note);
          
          text += `\n   ${noteIndex + 1}. ${cleanNote.title || 'Untitled Note'}\n`;
          text += `      ${'-'.repeat(40)}\n`;
          
          if (cleanNote.url) {
            text += `      URL: ${cleanNote.url}\n`;
          }
          
          if (cleanNote.pageTitle) {
            text += `      Page: ${cleanNote.pageTitle}\n`;
          }
          
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            text += `      Tags: ${cleanNote.tags.join(', ')}\n`;
          }
          
          text += `      Created: ${new Date(cleanNote.createdAt).toLocaleString()}\n`;
          text += `      Updated: ${new Date(cleanNote.updatedAt).toLocaleString()}\n`;
          
          if (cleanNote.content) {
            text += `\n      CONTENT:\n`;
            // Indent content for better readability
            const convertedContent = this.convertContentForFormat(cleanNote.content, 'plain');
            const indentedContent = convertedContent
              .split('\n')
              .map(line => `      ${line}`)
              .join('\n');
            text += `${indentedContent}\n`;
          }
          
          text += `\n      ${'-'.repeat(40)}\n`;
        });
        
        if (sortedMonths.length > 1) {
          text += `\n`;
        }
      });
      
      text += `\n${'='.repeat(60)}\n\n`;
    });
    
    // Footer
    text += `EXPORT INFORMATION\n`;
    text += `${'-'.repeat(30)}\n`;
    text += `Generated by: Anchored Extension\n`;
    text += `Export Format: Plain Text\n`;
    text += `Character Encoding: UTF-8\n`;
    text += `Organization: Domain-first, chronologically sorted\n`;
    text += `\nEnd of Export\n`;
    
    return text;
  }

  // HTML escaping function to prevent XSS
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convert notes data to DOCX format with domain organization (HTML for Word/Google Docs)
  toDOCX(notesData) {
    // Calculate totals for overview (exclude _anchored metadata)
    const totalDomains = Object.keys(notesData).filter(key => key !== '_anchored').length;
    const totalNotes = Object.entries(notesData)
      .filter(([key]) => key !== '_anchored')
      .reduce((sum, [, notes]) => sum + (Array.isArray(notes) ? notes.length : 0), 0);
    
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `<meta charset="UTF-8">\n`;
    html += `<title>Anchored Export</title>\n`;
    html += `<style>\n`;
    html += `body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; margin: 1in; color: #333; }\n`;
    html += `h1 { color: #2c3e50; text-align: center; font-size: 24pt; margin-bottom: 20pt; border-bottom: 3pt solid #3498db; padding-bottom: 10pt; }\n`;
    html += `h2 { color: #2980b9; font-size: 18pt; margin-top: 30pt; margin-bottom: 15pt; border-left: 4pt solid #3498db; padding-left: 10pt; }\n`;
    html += `h3 { color: #34495e; font-size: 14pt; margin-top: 20pt; margin-bottom: 10pt; }\n`;
    html += `h4 { color: #7f8c8d; font-size: 12pt; margin-top: 15pt; margin-bottom: 8pt; }\n`;
    html += `.summary { background: #ecf0f1; padding: 15pt; border-radius: 5pt; margin: 20pt 0; }\n`;
    html += `.toc { background: #f8f9fa; padding: 15pt; border-left: 4pt solid #3498db; margin: 20pt 0; }\n`;
    html += `.toc ul { margin: 0; padding-left: 20pt; }\n`;
    html += `.toc li { margin: 5pt 0; }\n`;
    html += `.note { margin: 20pt 0; padding: 15pt; border: 1pt solid #bdc3c7; border-radius: 5pt; background: #fdfdfd; }\n`;
    html += `.note-header { background: #3498db; color: white; padding: 8pt 12pt; margin: -15pt -15pt 10pt -15pt; border-radius: 5pt 5pt 0 0; }\n`;
    html += `.metadata-table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; }\n`;
    html += `.metadata-table td { padding: 5pt 8pt; border: 1pt solid #ddd; }\n`;
    html += `.metadata-table td:first-child { background: #f8f9fa; font-weight: bold; width: 100pt; }\n`;
    html += `.content { margin: 15pt 0; padding: 10pt; background: #fafafa; border-left: 3pt solid #95a5a6; }\n`;
    html += `.tags { margin: 10pt 0; }\n`;
    html += `.tag { background: #e8f4fd; color: #2980b9; padding: 3pt 8pt; margin-right: 5pt; border-radius: 3pt; font-size: 9pt; display: inline-block; }\n`;
    html += `.month-section { margin: 25pt 0; }\n`;
    html += `.month-header { background: #34495e; color: white; padding: 8pt 12pt; font-size: 12pt; }\n`;
    html += `a { color: #3498db; text-decoration: none; }\n`;
    html += `a:hover { text-decoration: underline; }\n`;
    html += `.footer { margin-top: 40pt; padding-top: 20pt; border-top: 2pt solid #bdc3c7; font-size: 10pt; color: #7f8c8d; }\n`;
    html += `</style>\n</head>\n<body>\n`;
    
    html += `<h1>Anchored Export</h1>\n`;
    
    // Summary section
    html += `<div class="summary">\n`;
    html += `<h3>Export Summary</h3>\n`;
    html += `<p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>\n`;
    html += `<p><strong>Total Domains:</strong> ${totalDomains}</p>\n`;
    html += `<p><strong>Total Notes:</strong> ${totalNotes}</p>\n`;
    html += `<p><strong>Organization:</strong> Domain-first, chronologically sorted</p>\n`;
    html += `</div>\n\n`;

    // Sort domains by note count (most active first)
    const sortedDomains = Object.entries(notesData)
      .filter(([, notes]) => Array.isArray(notes) && notes.length > 0)
      .sort(([, a], [, b]) => b.length - a.length);

    // Table of contents
    html += `<div class="toc">\n`;
    html += `<h3>Table of Contents</h3>\n`;
    html += `<ul>\n`;
    sortedDomains.forEach(([domain, notes]) => {
      html += `<li><a href="#${domain.replace(/\./g, '')}">${domain}</a> (${notes.length} notes)</li>\n`;
    });
    html += `</ul>\n`;
    html += `</div>\n\n`;

    // Process each domain
    sortedDomains.forEach(([domain, notes]) => {
      html += `<h2 id="${domain.replace(/\./g, '')}">${domain}</h2>\n`;
      html += `<p><em>${notes.length} note${notes.length !== 1 ? 's' : ''} from this domain</em></p>\n\n`;
      
      // Sort notes by creation date (newest first)
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      // Group notes by month for better organization
      const notesByMonth = {};
      sortedNotes.forEach(note => {
        const monthKey = new Date(note.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        if (!notesByMonth[monthKey]) notesByMonth[monthKey] = [];
        notesByMonth[monthKey].push(note);
      });
      
      // Sort months in reverse chronological order
      const sortedMonths = Object.keys(notesByMonth).sort((a, b) => 
        new Date(b + ' 1') - new Date(a + ' 1')
      );
      
      sortedMonths.forEach(month => {
        if (sortedMonths.length > 1) {
          html += `<div class="month-section">\n`;
          html += `<div class="month-header">${month}</div>\n`;
        }
        
        notesByMonth[month].forEach(note => {
          const cleanNote = this.cleanNoteData(note);
          
          html += `<div class="note">\n`;
          html += `<div class="note-header">${this.escapeHtml(cleanNote.title || 'Untitled Note')}</div>\n`;
          
          // Metadata table
          html += `<table class="metadata-table">\n`;
          if (cleanNote.url) {
            html += `<tr><td>URL</td><td><a href="${this.escapeHtml(cleanNote.url)}">${this.escapeHtml(cleanNote.url)}</a></td></tr>\n`;
          }
          if (cleanNote.pageTitle) {
            html += `<tr><td>Page Title</td><td>${this.escapeHtml(cleanNote.pageTitle)}</td></tr>\n`;
          }
          html += `<tr><td>Domain</td><td>${this.escapeHtml(domain)}</td></tr>\n`;
          html += `<tr><td>Created</td><td>${this.escapeHtml(new Date(cleanNote.createdAt).toLocaleString())}</td></tr>\n`;
          html += `<tr><td>Updated</td><td>${this.escapeHtml(new Date(cleanNote.updatedAt).toLocaleString())}</td></tr>\n`;
          html += `</table>\n`;
          
          // Tags
          if (cleanNote.tags && cleanNote.tags.length > 0) {
            html += `<div class="tags">\n`;
            html += `<strong>Tags:</strong> `;
            cleanNote.tags.forEach(tag => {
              html += `<span class="tag">${this.escapeHtml(tag)}</span>\n`;
            });
            html += `</div>\n`;
          }
          
          // Content
          if (cleanNote.content) {
            html += `<div class="content">\n`;
            html += `<strong>Content:</strong><br>\n`;
            html += `${this.convertContentForFormat(cleanNote.content, 'html')}\n`;
            html += `</div>\n`;
          }
          
          html += `</div>\n\n`;
        });
        
        if (sortedMonths.length > 1) {
          html += `</div>\n\n`;
        }
      });
    });
    
    // Footer
    html += `<div class="footer">\n`;
    html += `<h4>Export Information</h4>\n`;
    html += `<p><strong>Generated by:</strong> Anchored Extension</p>\n`;
    html += `<p><strong>Export Format:</strong> DOCX-compatible HTML</p>\n`;
    html += `<p><strong>Recommended Use:</strong> Import into Microsoft Word or Google Docs</p>\n`;
    html += `<p><strong>Organization:</strong> Domain-first, chronologically sorted within each domain</p>\n`;
    html += `</div>\n`;
    
    html += `</body>\n</html>`;
    return html;
  }

  // Main export method that converts data to the specified format
  exportToFormat(notesData, format, isSingleNote = false) {
    const formatInfo = this.supportedFormats[format];
    if (!formatInfo) {
      throw new Error(`Unsupported format: ${format}`);
    }

    let content;
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
        throw new Error(`Unsupported format: ${format}`);
    }

    // Generate filename with timestamp and note count (matching webpage format)
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Count total notes for filename
    let totalNotes = 0;
    for (const domain in notesData) {
      if (domain !== '_anchored' && Array.isArray(notesData[domain])) {
        totalNotes += notesData[domain].length;
      }
    }
    
    const noteCountSuffix = totalNotes > 1 ? `-${totalNotes}notes` : '';
    
    let filename;
    if (format === 'json') {
      filename = `anchored-backup-${timestamp}${noteCountSuffix}${formatInfo.extension}`;
    } else {
      filename = `url-notes-export-${timestamp}${noteCountSuffix}${formatInfo.extension}`;
    }

    return {
      content,
      filename,
      mimeType: formatInfo.mimeType
    };
  }

  // Get list of supported formats for UI
  getSupportedFormats() {
    return this.supportedFormats;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportFormats;
} else {
  window.ExportFormats = ExportFormats;
}
