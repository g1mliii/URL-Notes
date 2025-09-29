# Export Formats Guide

This guide explains the improved export formats for URL Notes, specifically optimized for importing into Obsidian and Notion.

## Export Format Improvements

### Obsidian Export (Enhanced with Domain Organization)

**Format:** Hierarchical Obsidian Vault Structure  
**File Extension:** `.json` (contains multiple `.md` files with folder structure)  
**Best For:** Importing into Obsidian with proper domain-based organization

#### What's New:
- **Domain-Based Folders**: Notes organized in folders by domain (e.g., `github.com/`, `stackoverflow.com/`)
- **Date-Sorted Filenames**: Files prefixed with creation date for chronological sorting
- **Domain Hub Files**: MOC (Map of Content) files for each domain with monthly organization
- **Master Index**: Central navigation hub linking to all domain hubs
- **Enhanced YAML Frontmatter**: Includes domain hub links and hierarchical tags
- **Navigation Links**: Breadcrumb navigation between notes, hubs, and master index
- **Tag Cloud**: Automatic tag analysis for each domain

#### Import Instructions for Obsidian:
1. Export your notes using the "Obsidian Vault" format
2. Download the generated file (contains structured vault data)
3. Create a new Obsidian vault or open an existing one
4. Copy the folder structure and files from the export
5. Start with the "URL Notes - Master Index" file
6. Navigate through domain hubs to explore your notes

#### Example Vault Structure:
```
URL Notes - Master Index.md
github.com - Domain Hub.md
github.com/
  ├── 2024-01-15 - Repository Notes.md
  ├── 2024-01-10 - API Documentation.md
stackoverflow.com - Domain Hub.md
stackoverflow.com/
  ├── 2024-01-12 - JavaScript Question.md
  ├── 2024-01-08 - CSS Flexbox Help.md
```

#### Enhanced YAML Frontmatter Example:
```yaml
---
title: "GitHub Repository Notes"
domain: "github.com"
domain_hub: "[[github.com - Domain Hub]]"
url: "https://github.com/user/repo"
page_title: "User/Repo - GitHub"
tags:
  - "development"
  - "git"
  - "open-source"
  - "domain/github.com"
created: "2024-01-15T10:30:00Z"
updated: "2024-01-16T14:45:00Z"
source: "URL Notes"
---
```

#### Domain Hub Features:
- **Monthly Organization**: Notes grouped by creation month
- **Tag Cloud**: Most used tags for the domain
- **Quick Actions**: Search and filter suggestions
- **Statistics**: Note count, date range, and overview

### Notion Export (Enhanced with Domain Organization)

**Format:** Enhanced CSV with Domain Grouping  
**File Extension:** `.csv`  
**Best For:** Bulk importing into Notion databases with proper organization

#### What's New:
- **Domain-First Sorting**: Notes sorted by domain, then by date (newest first)
- **Enhanced Columns**: Added Domain Group, Month Created, Year Created for better organization
- **Visual Grouping**: Domain Group column uses emojis (📁) for visual distinction
- **Automatic Domain Tags**: Each note gets a `domain-{domain}` tag automatically
- **Temporal Organization**: Month and year columns for time-based views and filters

#### Import Instructions for Notion:
1. Export your notes using the "Notion CSV" format
2. Download the CSV file
3. In Notion, create a new database or open an existing one
4. Click "Import" and select your CSV file
5. Map the columns to appropriate database properties:
   - **Domain Group** → Select property (for filtering by domain)
   - **Month Created** → Select property (for monthly views)
   - **Year Created** → Select property (for yearly analysis)
6. Create views grouped by Domain Group for organized browsing
7. Set up filters and sorts as needed

#### Enhanced CSV Structure:
```csv
Title,Content,Tags,URL,Domain,Page Title,Created,Updated,Domain Group,Month Created,Year Created
"GitHub Repository Notes","This is a note about...","development, git, domain-github.com","https://github.com/user/repo","github.com","User/Repo - GitHub","2024-01-15T10:30:00Z","2024-01-16T14:45:00Z","📁 github.com","January 2024","2024"
```

#### Recommended Notion Database Setup:
- **Group by**: Domain Group (for domain-based organization)
- **Sort by**: Created (descending, for newest first within each domain)
- **Filter options**: Year Created, Month Created, Domain
- **Views**: Create separate views for each major domain

## Other Export Formats

### Anchored Backup (JSON Format)
- **Purpose**: Complete backup and re-import into URL Notes
- **Structure**: Organized by domain with all note metadata
- **Use Case**: Data backup, migration between devices

### Markdown
- **Purpose**: General markdown export for any markdown-compatible app
- **Structure**: Single file with hierarchical organization
- **Use Case**: Documentation, general note sharing

### Plain Text
- **Purpose**: Simple text format for basic text editors
- **Structure**: Clean text with minimal formatting
- **Use Case**: Basic text editors, printing, simple sharing

### Google Docs (DOCX)
- **Purpose**: Import into Microsoft Word or Google Docs
- **Structure**: HTML format that opens in word processors
- **Use Case**: Document editing, collaboration, formatting

## Best Practices

### For Obsidian Users:
1. Use tags consistently for better organization
2. Include descriptive titles for better linking
3. Consider using the domain-based organization in your vault structure
4. Take advantage of the YAML frontmatter for advanced queries

### For Notion Users:
1. Set up your database properties before importing
2. Use the CSV column headers to map to your database structure
3. Consider creating templates based on the imported structure
4. Use the URL field to create relation properties

### General Tips:
1. Export regularly as backup
2. Test imports with a small subset first
3. Clean up note titles and content before exporting for better organization
4. Use consistent tagging for better categorization

## Troubleshooting

### Obsidian Import Issues:
- **File names too long**: The system automatically truncates long titles
- **Special characters**: Automatically replaced with safe alternatives
- **Large exports**: Consider exporting by domain for better organization

### Notion Import Issues:
- **CSV parsing errors**: Check for unescaped quotes in your note content
- **Date format issues**: Dates are exported in ISO format for compatibility
- **Large content**: Notion has limits on cell content size

### General Issues:
- **Browser compatibility**: Use modern browsers (Chrome, Firefox, Safari, Edge)
- **File size limits**: Large exports may take time to process
- **Character encoding**: All exports use UTF-8 encoding

## Migration Workflows

### From Extension to Obsidian:
1. Export all notes using "Obsidian Vault" format
2. Create a new Obsidian vault or use existing one
3. Follow the import instructions in the downloaded file
4. Organize notes into folders by domain if desired
5. Set up templates for future note-taking

### From Extension to Notion:
1. Set up a Notion database with appropriate properties
2. Export notes using "Notion CSV" format
3. Import CSV into your Notion database
4. Configure views and filters for better organization
5. Set up templates for consistent formatting

This improved export system ensures your notes are properly formatted for seamless import into your preferred note-taking applications.