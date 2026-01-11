// Direct WebSocket test for debugging
import WebSocket from 'ws';

console.log('Testing WebSocket connection...');

// Test connection to local server
const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully!');
  
  // Send join message
  const joinMessage = { type: 'join', userId: 999 };
  console.log('📤 Sending join message:', joinMessage);
  ws.send(JSON.stringify(joinMessage));
  
  // Send test message after 1 second
  setTimeout(() => {
    const testMessage = {
      type: 'message',
      chatId: 1,
      senderId: 999,
      receiverId: 1,
      content: 'Test message from debug script',
      messageType: 'text',
      destructTimer: 10
    };
    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
  }, 1000);
});

ws.on('message', function message(data) {
  console.log('📥 Received:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Keep script running for 5 seconds
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 5000);