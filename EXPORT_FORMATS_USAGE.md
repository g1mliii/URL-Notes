# Export Formats Usage Guide

This document explains how to use the ported export-formats.js library in the web application.

## Overview

The `ExportFormats` class has been successfully ported from the browser extension to work in the web environment. It provides the same export functionality with browser-based file downloads.

## Key Changes from Extension Version

1. **Browser File Downloads**: Uses `Blob` and `URL.createObjectURL()` for file downloads instead of Chrome extension APIs
2. **Web Environment**: Adapted to work in standard web browsers without extension permissions
3. **Download Method**: Added `downloadFile()` and `exportAndDownload()` methods for seamless file downloads

## Supported Export Formats

- **JSON Backup** (`.json`) - Complete data backup in JSON format
- **Markdown** (`.md`) - Human-readable markdown format
- **Obsidian** (`.md`) - Markdown with YAML frontmatter for Obsidian
- **Notion HTML** (`.html`) - Styled HTML compatible with Notion
- **Plain Text** (`.txt`) - Simple text format
- **Google Docs** (`.docx`) - HTML format that opens in Word/Google Docs

## Basic Usage

### 1. Initialize the Export Class

```javascript
const exportFormats = new ExportFormats();
```

### 2. Prepare Notes Data

```javascript
const notesData = {
    'example.com': [
        {
            id: '1',
            title: 'Sample Note',
            content: 'Note content here...',
            url: 'https://example.com/page',
            pageTitle: 'Page Title',
            domain: 'example.com',
            tags: ['tag1', 'tag2'],
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-16T14:45:00Z'
        }
    ]
};
```

### 3. Export and Download

```javascript
// Export and automatically download
try {
    const result = await exportFormats.exportAndDownload(notesData, 'markdown');
    console.log('Export successful:', result.filename);
} catch (error) {
    console.error('Export failed:', error.message);
}
```

### 4. Export Without Download (for preview)

```javascript
// Get export content without downloading
const result = exportFormats.exportToFormat(notesData, 'json');
console.log('Filename:', result.filename);
console.log('Content:', result.content);
console.log('MIME Type:', result.mimeType);
```

## Advanced Usage

### Single Note Export

For plain text exports, you can use single note formatting:

```javascript
const singleNoteData = {
    'example.com': [notesData['example.com'][0]]
};

await exportFormats.exportAndDownload(singleNoteData, 'txt', true);
```

### Get Available Formats

```javascript
const formats = exportFormats.getSupportedFormats();
console.log(formats);
// Output: { json: { name: 'JSON Backup', extension: '.json', ... }, ... }
```

### Manual File Download

```javascript
const result = exportFormats.exportToFormat(notesData, 'markdown');
exportFormats.downloadFile(result.content, result.filename, result.mimeType);
```

## Integration Example

Here's how to integrate export functionality into a web application:

```html
<!-- HTML -->
<select id="format-select">
    <option value="json">JSON Backup</option>
    <option value="markdown">Markdown</option>
    <option value="txt">Plain Text</option>
</select>
<button onclick="exportNotes()">Export</button>

<script>
// JavaScript
async function exportNotes() {
    const format = document.getElementById('format-select').value;
    const exportFormats = new ExportFormats();
    
    try {
        await exportFormats.exportAndDownload(notesData, format);
        alert('Export successful!');
    } catch (error) {
        alert('Export failed: ' + error.message);
    }
}
</script>
```

## Error Handling

The export functionality includes comprehensive error handling:

```javascript
try {
    await exportFormats.exportAndDownload(notesData, 'invalid-format');
} catch (error) {
    if (error.message.includes('Unsupported format')) {
        console.log('Invalid format selected');
    } else if (error.message.includes('Failed to download')) {
        console.log('Browser download failed');
    } else {
        console.log('Unknown error:', error.message);
    }
}
```

## Browser Compatibility

The export functionality works in all modern browsers that support:
- `Blob` constructor
- `URL.createObjectURL()`
- `document.createElement()`
- ES6 classes and async/await

## Testing

Use the provided test files to verify functionality:
- `test-export-formats.html` - Interactive browser testing
- `test-export-script.js` - Programmatic testing with Node.js
- `export-integration-example.html` - Integration example

## File Structure

```
web-app/
├── js/
│   └── lib/
│       └── export-formats.js          # Main export library
├── test-export-formats.html           # Browser test page
├── test-export-script.js              # Node.js test script
├── export-integration-example.html    # Integration example
└── EXPORT_FORMATS_USAGE.md           # This documentation
```

## Requirements Satisfied

This implementation satisfies the following requirements:
- **Requirement 11.5**: Reuse existing extension logic in web application
- **Requirement 7.1**: Export functionality with format options and note selection

The export functionality maintains complete compatibility with the browser extension while providing seamless file downloads in the web environment.