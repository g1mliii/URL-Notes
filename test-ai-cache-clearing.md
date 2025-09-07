# AI Usage Cache Clearing Test Plan

## Test Scenarios

### 1. **AI Rewrite Cache Clearing**
**Steps:**
1. Open AI rewrite modal → note usage count (e.g., "25/500")
2. Perform AI rewrite operation
3. Wait for success message
4. Close and reopen AI rewrite modal
5. **Expected:** Usage count should be updated (e.g., "24/500")

### 2. **Domain Summary Cache Clearing**
**Steps:**
1. Open AI Summary modal → note usage count (e.g., "25/500")
2. Generate domain summary (uses variable credits based on note count)
3. Wait for success message
4. Close and reopen AI Summary modal
5. **Expected:** Usage count should be reduced by number of notes summarized

### 3. **Site Content Summary Cache Clearing**
**Steps:**
1. Open AI Summary modal → note usage count (e.g., "25/500")
2. Click "Summarize Current Page" (uses 20 credits)
3. Wait for success message
4. Close and reopen AI Summary modal
5. **Expected:** Usage count should be reduced by 20 (e.g., "5/500")

### 4. **Authentication Change Cache Clearing**
**Steps:**
1. Sign in as User A → note usage count
2. Sign out
3. Sign in as User B
4. Open AI modal
5. **Expected:** Usage count should reflect User B's usage, not User A's

### 5. **Tier Change Cache Clearing**
**Steps:**
1. As free user → note usage limit (e.g., "3/5")
2. Upgrade to premium
3. Open AI modal
4. **Expected:** Usage limit should update to premium limits (e.g., "500/500")

## Cache Behavior Verification

### **Cache Hit (Good Performance)**
- Open AI modal multiple times within 1 hour
- Should not make API calls (check network tab)
- Should show same usage count instantly

### **Cache Miss After Operation (Good Accuracy)**
- Perform AI operation
- Reopen modal immediately
- Should make fresh API call (check network tab)
- Should show updated usage count

### **Cache Miss After Auth Change (Good Security)**
- Change authentication state
- Open modal
- Should make fresh API call for new user/tier
- Should show correct limits for new context

## Expected Cache Clearing Events

| Event | Cache Cleared | Reason |
|-------|--------------|---------|
| AI Rewrite Success | ✅ | Show updated usage |
| Domain Summary Success | ✅ | Show updated usage |
| Site Content Summary Success | ✅ | Show updated usage |
| User Login | ✅ | Different user limits |
| User Logout | ✅ | Clear previous user data |
| Tier Change (Free ↔ Premium) | ✅ | Different tier limits |
| Modal Open (cache < 1hr) | ❌ | Use cached data for performance |
| Modal Open (cache > 1hr) | ✅ | Refresh stale data |

This ensures optimal balance of performance and accuracy!