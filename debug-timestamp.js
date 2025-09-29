// Debug timestamp formats
console.log('Testing timestamp formats:');

const now = new Date();
console.log('new Date().toISOString():', now.toISOString());
console.log('new Date().toString():', now.toString());
console.log('new Date().toJSON():', now.toJSON());

// Test validation
function isValidTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') return false;
  
  try {
    const date = new Date(timestamp);
    return date.toISOString() === timestamp;
  } catch {
    return false;
  }
}

const testTimestamps = [
  now.toISOString(),
  now.toString(),
  now.toJSON(),
  '2024-01-15T10:00:00.000Z',
  '2024-01-15T10:00:00Z',
  '2024-01-15 10:00:00',
  'invalid'
];

testTimestamps.forEach(ts => {
  console.log(`"${ts}" -> ${isValidTimestamp(ts)}`);
});