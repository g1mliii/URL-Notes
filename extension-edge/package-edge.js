/**
 * Edge Extension Packaging Script
 * 
 * This script creates a production-ready .zip file for Microsoft Edge Add-ons submission.
 * Edge uses the same Chromium engine as Chrome, so the extension structure is identical.
 * 
 * Usage: node package-edge.js
 * Output: anchored-edge-extension-v{version}.zip
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Files and directories to exclude from the package
const EXCLUDE_PATTERNS = [
  'package-edge.js',
  'test-edge-setup.js',
  'BROWSER_API_MIGRATION_STATUS.md',
  'README.md',
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'web-ext-artifacts',
  '.vscode',
  '.idea'
];

/**
 * Check if a file should be excluded from the package
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

/**
 * Read version from manifest.json
 */
function getVersion() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

/**
 * Create the Edge extension package
 */
async function packageExtension() {
  const version = getVersion();
  const outputFileName = `anchored-edge-extension-v${version}.zip`;
  const outputPath = path.join(__dirname, '..', outputFileName);

  console.log('📦 Packaging Edge Extension...');
  console.log(`   Version: ${version}`);
  console.log(`   Output: ${outputFileName}`);

  // Create a file to stream archive data to
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  // Listen for archive events
  output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`✅ Package created successfully!`);
    console.log(`   Size: ${sizeInMB} MB`);
    console.log(`   Location: ${outputPath}`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Test the package by loading it in Edge (edge://extensions/)');
    console.log('   2. Submit to Microsoft Edge Add-ons: https://partner.microsoft.com/dashboard');
    console.log('   3. Reuse Chrome Web Store metadata and screenshots');
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('Warning:', err);
    } else {
      throw err;
    }
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Add files from the extension-edge directory
  const extensionDir = __dirname;
  
  function addDirectory(dirPath, archivePath = '') {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(extensionDir, fullPath);
      const archiveItemPath = archivePath ? path.join(archivePath, item) : item;
      
      // Skip excluded files
      if (shouldExclude(relativePath)) {
        console.log(`   Skipping: ${relativePath}`);
        return;
      }
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        addDirectory(fullPath, archiveItemPath);
      } else {
        archive.file(fullPath, { name: archiveItemPath });
        console.log(`   Adding: ${relativePath}`);
      }
    });
  }

  // Add all files
  addDirectory(extensionDir);

  // Finalize the archive
  await archive.finalize();
}

// Run the packaging process
packageExtension().catch(err => {
  console.error('❌ Packaging failed:', err);
  process.exit(1);
});
