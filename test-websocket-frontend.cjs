// Test WebSocket connection from frontend perspective
const WebSocket = require('ws');

async function testWebSocketFrontend() {
  console.log('🔌 Testing WebSocket connection like frontend...');
  
  // Test exact URL the frontend would use
  const wsUrl = 'ws://localhost:5000/ws';
  console.log('🔌 Connecting to:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully!');
    
    // Test join message
    const joinMessage = { type: 'join', userId: 999 };
    ws.send(JSON.stringify(joinMessage));
    console.log('📤 Join message sent:', joinMessage);
    
    // Close after test
    setTimeout(() => {
      ws.close();
      console.log('✅ Test completed successfully!');
    }, 2000);
  });
  
  ws.on('message', (data) => {
    console.log('📥 Received:', data.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    console.log('🔌 WebSocket closed:', code, reason.toString());
  });
}

testWebSocketFrontend();