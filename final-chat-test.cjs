// FINAL DEFINITIVE CHAT TEST
const WebSocket = require('ws');

async function finalChatTest() {
  console.log('🚀 FINAL CHAT TEST - QuickTest1 to QuickTest2');

  const user1 = new WebSocket('ws://localhost:5000/ws');
  const user2 = new WebSocket('ws://localhost:5000/ws');
  
  let testComplete = false;

  return new Promise((resolve) => {
    let connectCount = 0;

    user1.on('open', () => {
      console.log('✅ QuickTest1 connected');
      user1.send(JSON.stringify({ type: 'join', userId: 1 }));
      connectCount++;
      if (connectCount === 2) sendTestMessage();
    });

    user2.on('open', () => {
      console.log('✅ QuickTest2 connected');
      user2.send(JSON.stringify({ type: 'join', userId: 2 }));
      connectCount++;
      if (connectCount === 2) sendTestMessage();
    });

    function sendTestMessage() {
      setTimeout(() => {
        console.log('📤 Sending message from QuickTest1 to QuickTest2...');
        const message = {
          type: 'message',
          chatId: 1,
          senderId: 1,
          receiverId: 2,
          content: 'FINAL TEST: Can you receive this message?',
          messageType: 'text',
          destructTimer: 3600
        };
        user1.send(JSON.stringify(message));
      }, 1000);
    }

    user1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 QuickTest1 received:', msg.type);
    });

    user2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 QuickTest2 received:', msg.type);
      
      if (msg.type === 'new_message' && msg.message && !testComplete) {
        testComplete = true;
        console.log('🎉 SUCCESS: QuickTest2 received the message!');
        console.log('📝 Message content:', msg.message.content);
        
        user1.close();
        user2.close();
        resolve({ success: true, content: msg.message.content });
      }
    });

    setTimeout(() => {
      if (!testComplete) {
        console.log('❌ TEST FAILED: No message received within 5 seconds');
        user1.close();
        user2.close();
        resolve({ success: false, content: null });
      }
    }, 5000);
  });
}

finalChatTest().then(result => {
  console.log('\n' + '='.repeat(50));
  if (result.success) {
    console.log('✅ CHAT SYSTEM WORKS PERFECTLY!');
    console.log('✅ Message received:', result.content);
    console.log('✅ Ready for user testing!');
  } else {
    console.log('❌ CHAT SYSTEM STILL BROKEN!');
    console.log('❌ Messages are not being received!');
  }
  console.log('='.repeat(50));
  process.exit(result.success ? 0 : 1);
});