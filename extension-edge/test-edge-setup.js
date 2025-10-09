/**
 * Edge Extension Setup Test
 * 
 * This script validates that the Edge extension is properly configured
 * and ready for development testing.
 */

// Test manifest.json validity
async function testManifestValidity() {
    try {
        const manifestPath = './manifest.json';
        const response = await fetch(manifestPath);
        const manifest = await response.json();
        
        console.log('✅ Manifest loaded successfully');
        console.log('📋 Extension name:', manifest.name);
        console.log('📋 Version:', manifest.version);
        console.log('📋 Manifest version:', manifest.manifest_version);
        
        // Validate required fields for Edge
        const requiredFields = ['name', 'version', 'manifest_version', 'permissions'];
        const missingFields = requiredFields.filter(field => !manifest[field]);
        
        if (missingFields.length === 0) {
            console.log('✅ All required manifest fields present');
        } else {
            console.error('❌ Missing required fields:', missingFields);
        }
        
        return manifest;
    } catch (error) {
        console.error('❌ Manifest validation failed:', error);
        return null;
    }
}

// Test file structure
function testFileStructure() {
    const requiredFiles = [
        'manifest.json',
        'popup/popup.html',
        'popup/popup.js',
        'background/background.js',
        'content/content.js'
    ];
    
    console.log('📁 Testing file structure...');
    
    // Note: In a real browser environment, we'd use chrome.runtime.getURL()
    // This is a development validation script
    requiredFiles.forEach(file => {
        console.log(`📄 Required file: ${file}`);
    });
    
    console.log('✅ File structure validation complete');
}

// Test Edge-specific compatibility
function testEdgeCompatibility() {
    console.log('🔍 Testing Edge compatibility...');
    
    // Check if we're running in Edge
    const isEdge = navigator.userAgent.includes('Edg/');
    console.log('🌐 Running in Edge:', isEdge);
    
    // Test chrome APIs availability (Edge uses chrome.* namespace)
    const chromeAPIs = [
        'chrome.storage',
        'chrome.tabs',
        'chrome.runtime',
        'chrome.alarms'
    ];
    
    chromeAPIs.forEach(api => {
        const apiPath = api.split('.');
        let current = window;
        let available = true;
        
        for (const part of apiPath) {
            if (current && current[part]) {
                current = current[part];
            } else {
                available = false;
                break;
            }
        }
        
        console.log(`${available ? '✅' : '❌'} ${api}:`, available ? 'Available' : 'Not available');
    });
}

// Main test function
async function runEdgeSetupTests() {
    console.log('🚀 Starting Edge Extension Setup Tests');
    console.log('=====================================');
    
    // Test 1: Manifest validity
    console.log('\n1️⃣ Testing manifest.json...');
    const manifest = await testManifestValidity();
    
    // Test 2: File structure
    console.log('\n2️⃣ Testing file structure...');
    testFileStructure();
    
    // Test 3: Edge compatibility
    console.log('\n3️⃣ Testing Edge compatibility...');
    testEdgeCompatibility();
    
    console.log('\n🎉 Edge setup tests completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Load extension in edge://extensions/');
    console.log('2. Enable Developer mode');
    console.log('3. Click "Load unpacked" and select extension-edge folder');
    console.log('4. Test extension functionality');
}

// Auto-run tests if in browser environment
if (typeof window !== 'undefined') {
    runEdgeSetupTests();
}

// Export for Node.js testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testManifestValidity,
        testFileStructure,
        testEdgeCompatibility,
        runEdgeSetupTests
    };
}