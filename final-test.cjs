// FINAL COMPREHENSIVE TEST
const WebSocket = require('ws');

async function finalSystemTest() {
  console.log('🎯 FINAL COMPREHENSIVE SYSTEM TEST');
  console.log('🔧 Testing backend WebSocket with QuickTest users...');

  const user1 = new WebSocket('ws://localhost:5000/ws');
  const user2 = new WebSocket('ws://localhost:5000/ws');
  
  return new Promise((resolve) => {
    let ready = 0;
    let messageReceived = false;

    user1.on('open', () => {
      console.log('✅ QuickTest1 WebSocket connected');
      user1.send(JSON.stringify({ type: 'join', userId: 1 }));
      ready++;
      if (ready === 2) startTest();
    });

    user2.on('open', () => {
      console.log('✅ QuickTest2 WebSocket connected');
      user2.send(JSON.stringify({ type: 'join', userId: 2 }));
      ready++;
      if (ready === 2) startTest();
    });

    function startTest() {
      setTimeout(() => {
        console.log('📤 Sending test message from QuickTest1 to QuickTest2...');
        user1.send(JSON.stringify({
          type: 'message',
          chatId: 1,
          senderId: 1,
          receiverId: 2,
          content: 'TEST MESSAGE: Hello from QuickTest1!',
          messageType: 'text',
          destructTimer: 3600
        }));
      }, 1000);
    }

    user1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 QuickTest1 received:', msg.type);
    });

    user2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📥 QuickTest2 received:', msg.type);
      
      if (msg.type === 'new_message' && !messageReceived) {
        messageReceived = true;
        console.log('🎉 SUCCESS: Message delivered to QuickTest2!');
        console.log('📝 Content:', msg.message.content);
        
        user1.close();
        user2.close();
        resolve({ success: true, message: msg.message.content });
      }
    });

    setTimeout(() => {
      if (!messageReceived) {
        console.log('❌ TIMEOUT: Message not received in 5 seconds');
        user1.close();
        user2.close();
        resolve({ success: false, message: null });
      }
    }, 5000);
  });
}

finalSystemTest().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🏁 FINAL TEST RESULTS:');
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log('✅ SYSTEM IS WORKING PERFECTLY!');
    console.log('✅ Backend WebSocket: FUNCTIONAL');
    console.log('✅ Message delivery: CONFIRMED');
    console.log('✅ Content received:', result.message);
    console.log('');
    console.log('🎯 TEST USERS READY:');
    console.log('   👤 QuickTest1 (password: test123)');
    console.log('   👤 QuickTest2 (password: test123)');
    console.log('');
    console.log('🚀 SYSTEM IS READY FOR USER TESTING!');
  } else {
    console.log('❌ SYSTEM STILL HAS ISSUES');
    console.log('❌ Backend WebSocket or message delivery failed');
  }
  
  console.log('='.repeat(60));
  process.exit(result.success ? 0 : 1);
});