#!/usr/bin/env node

/**
 * Firefox Extension Setup Validation Script
 * Verifies that the Firefox extension directory is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🦊 Firefox Extension Setup Validation\n');

// Required files and directories
const requiredStructure = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.js',
  'background/background.js',
  'content/content.js',
  'lib/storage.js',
  'lib/sync.js',
  'lib/api.js',
  'assets/icons'
];

let allValid = true;

// Check directory structure
console.log('📁 Checking directory structure...');
requiredStructure.forEach(item => {
  const fullPath = path.join(__dirname, item);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${item}`);
  if (!exists) allValid = false;
});

// Validate manifest.json
console.log('\n📋 Validating manifest.json...');
try {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Check required fields
  const requiredFields = ['manifest_version', 'name', 'version', 'permissions'];
  requiredFields.forEach(field => {
    const exists = manifest.hasOwnProperty(field);
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${field}: ${exists ? manifest[field] : 'MISSING'}`);
    if (!exists) allValid = false;
  });
  
  // Check Firefox compatibility
  console.log('\n🔧 Firefox Compatibility Checks...');
  
  // Manifest version (should be 2 for Firefox, but 3 is acceptable for newer versions)
  const manifestVersion = manifest.manifest_version;
  console.log(`📝 Manifest Version: ${manifestVersion} ${manifestVersion === 2 || manifestVersion === 3 ? '✅' : '❌'}`);
  
  // Required permissions
  const hasStorage = manifest.permissions.includes('storage');
  const hasTabs = manifest.permissions.includes('tabs') || manifest.permissions.includes('activeTab');
  console.log(`🗄️  Storage permission: ${hasStorage ? '✅' : '❌'}`);
  console.log(`🔗 Tabs permission: ${hasTabs ? '✅' : '❌'}`);
  
} catch (error) {
  console.log('❌ Error reading manifest.json:', error.message);
  allValid = false;
}

// Check development tools
console.log('\n🛠️  Development Tools...');
try {
  const packageJsonExists = fs.existsSync(path.join(__dirname, 'package.json'));
  const webExtConfigExists = fs.existsSync(path.join(__dirname, 'web-ext-config.js'));
  
  console.log(`📦 package.json: ${packageJsonExists ? '✅' : '❌'}`);
  console.log(`⚙️  web-ext-config.js: ${webExtConfigExists ? '✅' : '❌'}`);
  
  if (!packageJsonExists || !webExtConfigExists) allValid = false;
} catch (error) {
  console.log('❌ Error checking development tools:', error.message);
  allValid = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('🎉 Firefox extension setup is VALID!');
  console.log('✨ Ready for Firefox development');
  console.log('\nNext steps:');
  console.log('1. Install Firefox Developer Edition');
  console.log('2. Run: npm run dev');
  console.log('3. Test extension functionality');
} else {
  console.log('⚠️  Firefox extension setup has ISSUES!');
  console.log('🔧 Please fix the missing files/configurations above');
}
console.log('='.repeat(50));

process.exit(allValid ? 0 : 1);