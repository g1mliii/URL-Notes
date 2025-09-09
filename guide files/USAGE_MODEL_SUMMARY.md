# AI Usage Model Summary

## Current AI Usage Credits System

### **Monthly Limits**
- **Free Users**: 5 credits/month
- **Premium Users**: 500 credits/month

### **Feature Usage Costs**

#### **Domain Summary** (existing)
- **Cost**: 1 credit per note summarized
- **Example**: Summarizing 10 notes from a domain = 10 credits

#### **Site Content Summary** (new feature)
- **Cost**: 20 credits per page summarized
- **Rationale**: Equivalent to summarizing 20 individual notes
- **Example**: Summarizing 1 webpage = 20 credits

### **Usage Examples**

#### **Free User (5 credits/month)**
- Can summarize 5 individual notes OR
- Can summarize 0.25 webpages (not practical) OR
- Mix: 1 webpage (20 credits) - not possible with only 5 credits

#### **Premium User (500 credits/month)**
- Can summarize 500 individual notes OR
- Can summarize 25 webpages OR
- Mix: 10 webpages (200 credits) + 300 individual notes

### **Technical Implementation**

```javascript
// Domain Summary
context: {
  feature: 'summarize',
  noteCount: actualNoteCount // e.g., 5 notes = 5 credits
}

// Site Content Summary  
context: {
  feature: 'summarize',
  noteCount: 20 // Always 20 credits per page
}
```

### **Edge Function Logic**
```typescript
let usageIncrement = 1;
if (context?.feature === 'summarize' && context?.noteCount) {
  usageIncrement = Math.max(1, parseInt(String(context.noteCount)) || 1);
}
// For site content: usageIncrement = 20
// For domain summary: usageIncrement = actual note count
```

This ensures consistent pricing where site content summarization is equivalent to summarizing 20 individual notes.