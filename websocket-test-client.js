// WebSocket Test Client to verify chat functionality
const WebSocket = require('ws');

console.log('🧪 Starting WebSocket Chat Test...');

// Create two WebSocket connections to simulate two users
const ws1 = new WebSocket('ws://localhost:5000/ws');
const ws2 = new WebSocket('ws://localhost:5000/ws');

let user1Connected = false;
let user2Connected = false;
let messagesSent = 0;
let messagesReceived = 0;

// User 1 (Alice) connection
ws1.on('open', () => {
  console.log('👤 User 1 (Alice) connected');
  user1Connected = true;
  
  // Send join message
  ws1.send(JSON.stringify({
    type: 'join',
    userId: 1
  }));
  
  checkAndStartTest();
});

// User 2 (Bob) connection  
ws2.on('open', () => {
  console.log('👤 User 2 (Bob) connected');
  user2Connected = true;
  
  // Send join message
  ws2.send(JSON.stringify({
    type: 'join',
    userId: 2
  }));
  
  checkAndStartTest();
});

// Listen for messages on User 1
ws1.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 User 1 received:', message.type, message);
  
  if (message.type === 'new_message') {
    messagesReceived++;
    console.log('✅ User 1 received chat message!');
  }
});

// Listen for messages on User 2
ws2.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 User 2 received:', message.type, message);
  
  if (message.type === 'new_message') {
    messagesReceived++;
    console.log('✅ User 2 received chat message!');
  }
});

function checkAndStartTest() {
  if (user1Connected && user2Connected) {
    console.log('🚀 Both users connected, starting message test...');
    
    setTimeout(() => {
      // Send message from User 1 to User 2
      const testMessage = {
        type: 'message',
        chatId: 1,
        senderId: 1,
        receiverId: 2,
        content: 'Hello from Alice to Bob!',
        messageType: 'text',
        destructTimer: 3600
      };
      
      console.log('📤 User 1 sending message:', testMessage.content);
      ws1.send(JSON.stringify(testMessage));
      messagesSent++;
      
      // Send reply from User 2 to User 1
      setTimeout(() => {
        const replyMessage = {
          type: 'message',
          chatId: 1,
          senderId: 2,
          receiverId: 1,
          content: 'Hi Alice, this is Bob replying!',
          messageType: 'text',
          destructTimer: 3600
        };
        
        console.log('📤 User 2 sending reply:', replyMessage.content);
        ws2.send(JSON.stringify(replyMessage));
        messagesSent++;
        
        // Check results after 2 seconds
        setTimeout(() => {
          console.log('\n=== TEST RESULTS ===');
          console.log('Messages sent:', messagesSent);
          console.log('Messages received:', messagesReceived);
          console.log('Success rate:', (messagesReceived / messagesSent * 100) + '%');
          
          if (messagesReceived === messagesSent) {
            console.log('🎉 CHAT SYSTEM WORKS PERFECTLY!');
          } else {
            console.log('❌ CHAT SYSTEM HAS ISSUES');
          }
          
          process.exit(0);
        }, 2000);
        
      }, 1000);
      
    }, 1000);
  }
}

// Error handling
ws1.on('error', (error) => console.log('❌ User 1 error:', error));
ws2.on('error', (error) => console.log('❌ User 2 error:', error));
ws1.on('close', () => console.log('🔌 User 1 disconnected'));
ws2.on('close', () => console.log('🔌 User 2 disconnected'));