// Simple WebSocket test in CommonJS format
const WebSocket = require('ws');

console.log('🧪 Testing WebSocket Message Flow...');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket');
  
  // Join as user 1
  ws.send(JSON.stringify({
    type: 'join',
    userId: 1
  }));
  
  setTimeout(() => {
    // Send a test message
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify({
      type: 'message',
      chatId: 1,
      senderId: 1,
      receiverId: 2,
      content: 'Test message content',
      messageType: 'text',
      destructTimer: 3600
    }));
    
    setTimeout(() => {
      console.log('⏱️ Test completed, closing connection');
      ws.close();
    }, 2000);
    
  }, 1000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 Received:', msg.type, msg.message || '');
});

ws.on('error', (error) => {
  console.log('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
  process.exit(0);
});