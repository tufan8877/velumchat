// Browser Test Script - Copy this into browser console
console.log('🧪 TESTING REAL BROWSER WEBSOCKET CONNECTION...');

// Test 1: Can we connect to WebSocket?
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  console.log('✅ WebSocket connected in browser!');
  
  // Test 2: Can we join as a user?
  ws.send(JSON.stringify({ type: 'join', userId: 1 }));
  
  // Test 3: Can we send a message?
  setTimeout(() => {
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify({
      type: 'message',
      chatId: 1,
      senderId: 1,
      receiverId: 2,
      content: 'BROWSER TEST MESSAGE',
      messageType: 'text',
      destructTimer: 10
    }));
  }, 1000);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📥 BROWSER RECEIVED:', data);
};

ws.onerror = (error) => {
  console.error('❌ BROWSER WEBSOCKET ERROR:', error);
};

ws.onclose = (event) => {
  console.log('❌ BROWSER WEBSOCKET CLOSED:', event.code, event.reason);
};

// Test will run for 5 seconds
setTimeout(() => {
  console.log('🏁 Browser test completed');
  ws.close();
}, 5000);