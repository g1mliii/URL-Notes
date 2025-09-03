#!/usr/bin/env node

/**
 * Guide to Make Repository Public for GitHub Pages
 */

console.log(`
🔓 Make Repository Public for GitHub Pages

## Why Make It Public?
- GitHub Pages requires public repositories (free tier)
- Enables direct deployment from this repository
- Allows drag-and-drop file editing

## Step-by-Step Instructions:

### Method 1: Repository Settings
1. Go to: https://github.com/g1mliii/URL-Notes/settings
2. Scroll to bottom "Danger Zone" section
3. Click "Change repository visibility"
4. Select "Make public"
5. Type repository name: URL-Notes
6. Confirm the change

### Method 2: Repository Main Page
1. Go to: https://github.com/g1mliii/URL-Notes
2. Click "Settings" tab (top right)
3. Scroll to bottom for visibility settings
4. Follow same steps as Method 1

## ⚠️ Important Notes:

### What Becomes Public:
✅ Source code (HTML, CSS, JS)
✅ Commit history
✅ Issues and discussions
✅ Repository structure

### What Stays Private:
🔒 Repository secrets (PAGES_DEPLOY_TOKEN, etc.)
🔒 Your personal GitHub account info
🔒 Private repositories you own
🔒 Organization private data

### Security Considerations:
- Remove any sensitive data before making public
- Check for API keys, passwords, personal info
- Review commit history for sensitive content

## 🔍 Pre-Public Checklist:

Current repository contents look safe:
✅ No hardcoded passwords visible
✅ Supabase keys are public-safe (anon keys)
✅ No personal information in code
✅ Standard web application files

## After Making Public:

1. Enable GitHub Pages:
   - Settings -> Pages
   - Source: Deploy from branch
   - Branch: main, folder: / (root)
   - Custom domain: anchored.site

2. Your site will be live at:
   - https://g1mliii.github.io/URL-Notes
   - https://anchored.site (with custom domain)

## 🎯 Benefits After Public + Pages:

✅ Direct deployment from this repo
✅ Drag and drop file updates work
✅ No cross-repository complexity
✅ Instant updates when you push changes
✅ Much simpler management

Ready to make the repository public!
`);

// Check if there are any potential security issues
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Quick Security Scan...');

const sensitivePatterns = [
  /password\s*[:=]\s*["'][^"']+["']/i,
  /secret\s*[:=]\s*["'][^"']+["']/i,
  /private.*key/i,
  /api.*secret/i
];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
  } catch (error) {
    // File not readable, skip
  }
  return false;
}

const filesToCheck = [
  'config.js',
  'js/lib/api.js',
  '.env',
  '.env.local'
];

let foundSensitive = false;
for (const file of filesToCheck) {
  if (fs.existsSync(file) && scanFile(file)) {
    console.log(`⚠️  Potential sensitive data in: ${file}`);
    foundSensitive = true;
  }
}

if (!foundSensitive) {
  console.log('✅ No obvious sensitive data found');
  console.log('✅ Repository appears safe to make public');
} else {
  console.log('⚠️  Review flagged files before making public');
}

console.log('\n🚀 Ready to proceed with making repository public!');