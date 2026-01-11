// Test the WebSocket frontend integration with real users
const WebSocket = require('ws');

console.log('🧪 Testing Frontend WebSocket Integration...');

const userA = new WebSocket('ws://localhost:5000/ws');
const userB = new WebSocket('ws://localhost:5000/ws');

let receivedMessages = [];

userA.on('open', () => {
  console.log('✅ UserA (ID 1) connected');
  userA.send(JSON.stringify({ type: 'join', userId: 1 }));
});

userB.on('open', () => {
  console.log('✅ UserB (ID 2) connected');
  userB.send(JSON.stringify({ type: 'join', userId: 2 }));
  
  // Wait a moment then send test message
  setTimeout(() => {
    console.log('📤 UserA sending message to UserB...');
    const message = {
      type: 'message',
      chatId: 1,
      senderId: 1,
      receiverId: 2,
      content: 'Hello from UserA to UserB!',
      messageType: 'text',
      destructTimer: 3600
    };
    userA.send(JSON.stringify(message));
  }, 1000);
});

userA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 UserA received:', msg.type);
  receivedMessages.push({ user: 'A', type: msg.type, content: msg.message?.content });
});

userB.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 UserB received:', msg.type);
  receivedMessages.push({ user: 'B', type: msg.type, content: msg.message?.content });
  
  if (msg.type === 'new_message') {
    console.log('🎉 SUCCESS: UserB received message from UserA!');
    console.log('📖 Message content:', msg.message.content);
    console.log('📊 All received messages:', receivedMessages);
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('⏰ Test timeout - checking results...');
  console.log('📊 Received messages:', receivedMessages);
  if (receivedMessages.some(m => m.type === 'new_message' && m.user === 'B')) {
    console.log('✅ Test PASSED: Messages are being received correctly');
  } else {
    console.log('❌ Test FAILED: UserB did not receive message');
  }
  process.exit(1);
}, 5000);