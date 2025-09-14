// Test script to verify the authentication race condition fix
// Run this in browser console on the dashboard or account page

console.log('🧪 Starting authentication race condition fix test...');

// Test 1: Check if cached session is properly handled
function testCachedSessionHandling() {
    console.log('\n📋 Test 1: Cached Session Handling');
    
    const cachedSession = localStorage.getItem('supabase_session');
    if (cachedSession) {
        try {
            const sessionData = JSON.parse(cachedSession);
            console.log('✅ Cached session found:', {
                hasToken: !!sessionData.access_token,
                hasUser: !!sessionData.user,
                userEmail: sessionData.user?.email,
                expiresAt: sessionData.expires_at ? new Date(sessionData.expires_at * 1000).toLocaleString() : 'No expiry'
            });
            
            // Check if session is valid
            const expiresAt = sessionData.expires_at || 0;
            const now = Date.now() / 1000;
            const isValid = sessionData.access_token && sessionData.user && expiresAt > now;
            
            console.log(isValid ? '✅ Session is valid' : '❌ Session is invalid/expired');
            return isValid;
        } catch (e) {
            console.log('❌ Cached session is corrupted:', e);
            return false;
        }
    } else {
        console.log('❌ No cached session found');
        return false;
    }
}

// Test 2: Check if auth module is properly initialized
function testAuthModuleInitialization() {
    console.log('\n📋 Test 2: Auth Module Initialization');
    
    if (window.auth) {
        console.log('✅ Auth module exists');
        
        if (window.auth.supabaseClient) {
            console.log('✅ Supabase client exists');
            
            const isAuthenticated = window.auth.isAuthenticated();
            console.log(isAuthenticated ? '✅ Auth module reports authenticated' : '❌ Auth module reports not authenticated');
            
            const currentUser = window.auth.getCurrentUser();
            console.log(currentUser ? `✅ Current user: ${currentUser.email}` : '❌ No current user');
            
            return isAuthenticated && currentUser;
        } else {
            console.log('❌ Supabase client not initialized');
            return false;
        }
    } else {
        console.log('❌ Auth module not found');
        return false;
    }
}

// Test 3: Check if app authentication state is correct
function testAppAuthenticationState() {
    console.log('\n📋 Test 3: App Authentication State');
    
    if (window.app) {
        console.log('✅ App module exists');
        console.log(`App isAuthenticated: ${window.app.isAuthenticated}`);
        console.log(`App currentUser: ${window.app.currentUser?.email || 'None'}`);
        
        return window.app.isAuthenticated;
    } else {
        console.log('❌ App module not found');
        return false;
    }
}

// Test 4: Simulate navigation and check if race condition is prevented
function testNavigationRaceCondition() {
    console.log('\n📋 Test 4: Navigation Race Condition Prevention');
    
    if (window.app && window.app.checkAuthenticationForNavigation) {
        const result = window.app.checkAuthenticationForNavigation();
        console.log(result ? '✅ Navigation would succeed' : '❌ Navigation would fail');
        return result;
    } else {
        console.log('❌ Navigation check method not found');
        return false;
    }
}

// Test 5: Check current page protection
function testPageProtection() {
    console.log('\n📋 Test 5: Page Protection');
    
    const currentPath = window.location.pathname;
    const isProtectedPage = currentPath.includes('/dashboard') || currentPath.includes('/account');
    
    console.log(`Current path: ${currentPath}`);
    console.log(`Is protected page: ${isProtectedPage}`);
    
    if (isProtectedPage) {
        const hasValidAuth = testCachedSessionHandling() || testAuthModuleInitialization();
        console.log(hasValidAuth ? '✅ Protected page access is valid' : '❌ Protected page access should be blocked');
        return hasValidAuth;
    } else {
        console.log('ℹ️ Not on a protected page');
        return true;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Running all authentication tests...\n');
    
    const results = {
        cachedSession: testCachedSessionHandling(),
        authModule: testAuthModuleInitialization(),
        appState: testAppAuthenticationState(),
        navigation: testNavigationRaceCondition(),
        pageProtection: testPageProtection()
    };
    
    console.log('\n📊 Test Results Summary:');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
        console.log('🎉 Authentication race condition fix is working correctly!');
    } else {
        console.log('⚠️ There may still be authentication issues that need to be addressed.');
    }
    
    return results;
}

// Auto-run tests
runAllTests();

// Export functions for manual testing
window.authTests = {
    runAllTests,
    testCachedSessionHandling,
    testAuthModuleInitialization,
    testAppAuthenticationState,
    testNavigationRaceCondition,
    testPageProtection
};

console.log('\n💡 You can run individual tests by calling:');
console.log('   window.authTests.testCachedSessionHandling()');
console.log('   window.authTests.testAuthModuleInitialization()');
console.log('   window.authTests.testAppAuthenticationState()');
console.log('   window.authTests.testNavigationRaceCondition()');
console.log('   window.authTests.testPageProtection()');
console.log('   window.authTests.runAllTests()');