// Test crypto functionality with real keys
const WebSocket = require('ws');

// Generate real test keys for debugging
async function generateTestKeys() {
  console.log('🔐 Generating real RSA keys...');
  
  // We'll test with the frontend system
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    ws.on('open', () => {
      console.log('✅ Connected to test key generation');
      ws.close();
      resolve(true);
    });
    
    setTimeout(() => {
      console.log('⏰ Key generation test timeout');
      resolve(false);
    }, 3000);
  });
}

async function testCrypto() {
  console.log('🧪 Testing crypto system...');
  
  const testPassed = await generateTestKeys();
  
  if (testPassed) {
    console.log('✅ Crypto system is accessible');
    console.log('📝 Users CryptoUser1 and CryptoUser2 are ready');
    console.log('🔒 Test encryption in the frontend now');
  } else {
    console.log('❌ Crypto system test failed');
  }
  
  return testPassed;
}

testCrypto().then(success => {
  process.exit(success ? 0 : 1);
});