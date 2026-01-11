// Test unencrypted messages
const WebSocket = require('ws');

async function testUnencrypted() {
  console.log('🧪 Testing unencrypted message delivery...');

  const ws1 = new WebSocket('ws://localhost:5000/ws');
  const ws2 = new WebSocket('ws://localhost:5000/ws');
  
  return new Promise((resolve) => {
    let connections = 0;
    let messageReceived = false;

    function checkConnections() {
      if (connections === 2) {
        setTimeout(() => {
          console.log('📤 Sending unencrypted message...');
          const message = {
            type: 'message',
            chatId: 1,
            senderId: 1,
            receiverId: 2,
            content: 'Hallo, das ist eine unverschlüsselte Nachricht!',
            messageType: 'text',
            destructTimer: 3600
          };
          ws1.send(JSON.stringify(message));
        }, 1000);
      }
    }

    ws1.on('open', () => {
      console.log('✅ User1 connected');
      ws1.send(JSON.stringify({ type: 'join', userId: 1 }));
      connections++;
      checkConnections();
    });

    ws2.on('open', () => {
      console.log('✅ User2 connected');
      ws2.send(JSON.stringify({ type: 'join', userId: 2 }));
      connections++;
      checkConnections();
    });

    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 User1 received:', msg.type);
    });

    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 User2 received:', msg.type);
      
      if (msg.type === 'new_message' && msg.message) {
        messageReceived = true;
        console.log('🎉 SUCCESS: User2 received unencrypted message!');
        console.log('📝 Content:', msg.message.content);
        console.log('📏 Content length:', msg.message.content.length);
        
        ws1.close();
        ws2.close();
        resolve({ success: true, content: msg.message.content });
      }
    });

    setTimeout(() => {
      console.log('⏰ Test timeout');
      ws1.close();
      ws2.close();
      resolve({ success: messageReceived, content: null });
    }, 6000);
  });
}

testUnencrypted().then(result => {
  if (result.success) {
    console.log('\n🎉 UNENCRYPTED MESSAGE TEST PASSED!');
    console.log('✅ Message content:', result.content);
  } else {
    console.log('\n❌ UNENCRYPTED MESSAGE TEST FAILED!');
  }
  process.exit(result.success ? 0 : 1);
});