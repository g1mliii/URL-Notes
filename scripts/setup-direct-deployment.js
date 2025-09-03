#!/usr/bin/env node

/**
 * Setup Direct Deployment from URL-Notes Repository
 * 
 * This script helps you set up direct GitHub Pages deployment from this repository
 * instead of the complex cross-repository setup.
 */

console.log(`
🚀 Setup Direct GitHub Pages Deployment

MUCH SIMPLER APPROACH - Deploy directly from this repository!

## Step 1: Enable GitHub Pages in This Repository

1. Go to: https://github.com/g1mliii/URL-Notes/settings/pages

2. Under "Source", select: "Deploy from a branch"

3. Select branch: "main" 

4. Select folder: "/ (root)" or create a "docs" folder

5. Custom domain: "anchored.site"

6. Check "Enforce HTTPS"

## Step 2: Move Files to Root or Docs Folder

Option A - Root deployment (simplest):
- Move all files from web-app/ to root directory
- GitHub Pages will serve from root

Option B - Docs folder deployment:
- Create /docs folder
- Move all files from web-app/ to /docs
- GitHub Pages will serve from /docs

## Step 3: Update DNS (if needed)

Your DNS should point to:
- CNAME: anchored.site -> g1mliii.github.io
- Or A records to GitHub Pages IPs

## Benefits of Direct Deployment:

✅ No complex workflows
✅ No token permissions issues  
✅ Instant updates when you push
✅ Drag and drop files work immediately
✅ Much easier to manage
✅ No cross-repository complications

## Current Status:

Your files are ready in web-app/:
- index.html ✅
- config.js ✅  
- health.json ✅
- js/monitoring.js ✅
- All CSS and JS files ✅

Just move them to root or /docs and enable Pages!

Would you like me to help move the files?
`);

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nWould you like me to move web-app files to root directory for direct deployment? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    moveFilesToRoot();
  } else {
    console.log('\n📋 Manual steps:');
    console.log('1. Go to repository settings -> Pages');
    console.log('2. Enable Pages from main branch');
    console.log('3. Set custom domain to anchored.site');
    console.log('4. Move files from web-app/ to desired location');
  }
  rl.close();
});

function moveFilesToRoot() {
  const fs = require('fs');
  const path = require('path');
  
  console.log('\n📁 Moving files from web-app/ to root directory...');
  
  try {
    // Get all files in web-app directory
    const webAppDir = 'web-app';
    const files = fs.readdirSync(webAppDir, { withFileTypes: true });
    
    for (const file of files) {
      const sourcePath = path.join(webAppDir, file.name);
      const targetPath = file.name;
      
      if (file.isDirectory()) {
        // Copy directory recursively
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        copyDirectory(sourcePath, targetPath);
        console.log(`📂 Copied directory: ${file.name}/`);
      } else if (file.isFile() && !fs.existsSync(targetPath)) {
        // Copy file only if it doesn't exist in root
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`📄 Copied file: ${file.name}`);
      } else if (file.isFile()) {
        console.log(`⚠️  Skipped (exists): ${file.name}`);
      }
    }
    
    console.log('\n✅ Files moved successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to: https://github.com/g1mliii/URL-Notes/settings/pages');
    console.log('2. Enable Pages from main branch, root folder');
    console.log('3. Set custom domain: anchored.site');
    console.log('4. Commit and push the changes');
    
  } catch (error) {
    console.error('❌ Error moving files:', error.message);
  }
}

function copyDirectory(source, target) {
  const fs = require('fs');
  const path = require('path');
  
  const files = fs.readdirSync(source, { withFileTypes: true });
  
  for (const file of files) {
    const sourcePath = path.join(source, file.name);
    const targetPath = path.join(target, file.name);
    
    if (file.isDirectory()) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}