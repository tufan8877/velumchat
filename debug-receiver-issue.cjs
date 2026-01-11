// Debug: Test if receiver gets messages in frontend
const WebSocket = require('ws');

console.log('🔍 Debugging Message Reception...');

// Simulate two users like in the frontend
const userA = new WebSocket('ws://localhost:5000/ws');
const userB = new WebSocket('ws://localhost:5000/ws');

let userAReady = false;
let userBReady = false;

// User A setup (Sender)
userA.on('open', () => {
  console.log('👤 User A connected');
  userA.send(JSON.stringify({ type: 'join', userId: 1 }));
  userAReady = true;
  checkStart();
});

userA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'new_message') {
    console.log('📥 User A received own message (expected)');
  }
});

// User B setup (Receiver)  
userB.on('open', () => {
  console.log('👤 User B connected');
  userB.send(JSON.stringify({ type: 'join', userId: 2 }));
  userBReady = true;
  checkStart();
});

userB.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 User B received:', msg.type);
  
  if (msg.type === 'new_message') {
    console.log('🎉 SUCCESS: User B received message!');
    console.log('📖 Content:', msg.message.content);
    console.log('🏷️ From User:', msg.message.senderId, 'To User:', msg.message.receiverId);
    console.log('💬 Chat ID:', msg.message.chatId);
    process.exit(0);
  }
});

function checkStart() {
  if (userAReady && userBReady) {
    console.log('🚀 Both users ready - User A sending message to User B...');
    
    setTimeout(() => {
      const message = {
        type: 'message',
        chatId: 1,
        senderId: 1,     // User A
        receiverId: 2,   // User B  
        content: 'Test message from A to B',
        messageType: 'text',
        destructTimer: 3600
      };
      
      console.log('📤 User A sending:', message.content);
      userA.send(JSON.stringify(message));
      
      // Timeout if no response
      setTimeout(() => {
        console.log('❌ TIMEOUT: User B did not receive message');
        console.log('🔧 Check if frontend hooks are working correctly');
        process.exit(1);
      }, 5000);
      
    }, 1000);
  }
}

userA.on('error', (err) => console.log('❌ User A error:', err.message));
userB.on('error', (err) => console.log('❌ User B error:', err.message));