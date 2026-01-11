// Test real message receiving between two users
const WebSocket = require('ws');

console.log('🧪 Testing Two-User Chat...');

// User 1 (Sender) - ID 3
const wsSender = new WebSocket('ws://localhost:5000/ws');
// User 2 (Receiver) - ID 4  
const wsReceiver = new WebSocket('ws://localhost:5000/ws');

let senderReady = false;
let receiverReady = false;

// Setup Sender (User 3)
wsSender.on('open', () => {
  console.log('👤 SENDER connected (User 3)');
  wsSender.send(JSON.stringify({ type: 'join', userId: 3 }));
  senderReady = true;
  startTestWhenReady();
});

wsSender.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 SENDER received:', msg.type);
});

// Setup Receiver (User 4)
wsReceiver.on('open', () => {
  console.log('👤 RECEIVER connected (User 4)');
  wsReceiver.send(JSON.stringify({ type: 'join', userId: 4 }));
  receiverReady = true;
  startTestWhenReady();
});

wsReceiver.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📥 RECEIVER received:', msg.type, msg.message ? 'MESSAGE!' : '');
  
  if (msg.type === 'new_message') {
    console.log('🎉 SUCCESS: Receiver got the message!');
    console.log('📖 Message content:', msg.message.content);
    process.exit(0);
  }
});

function startTestWhenReady() {
  if (senderReady && receiverReady) {
    console.log('🚀 Both users ready - sending test message...');
    
    setTimeout(() => {
      const testMessage = {
        type: 'message',
        chatId: 1,
        senderId: 3,
        receiverId: 4,
        content: 'Hello from Sender to Receiver!',
        messageType: 'text',
        destructTimer: 3600
      };
      
      console.log('📤 Sender sending message...');
      wsSender.send(JSON.stringify(testMessage));
      
      // Timeout after 5 seconds if no message received
      setTimeout(() => {
        console.log('❌ TIMEOUT: Receiver did not get message');
        process.exit(1);
      }, 5000);
      
    }, 1000);
  }
}

wsSender.on('error', (error) => console.log('❌ Sender error:', error.message));
wsReceiver.on('error', (error) => console.log('❌ Receiver error:', error.message));