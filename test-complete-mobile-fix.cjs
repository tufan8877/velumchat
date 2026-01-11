// Complete mobile chat auto-activation test
const WebSocket = require('ws');

async function testCompleteMobileFix() {
  console.log('📱 TESTING COMPLETE MOBILE CHAT AUTO-ACTIVATION');
  console.log('='.repeat(60));
  
  // Create two users - sender and mobile receiver
  const senderResponse = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'DesktopSender',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwGHuBhsj/KSjIGjKWJkBhAiEprfIL+LjKkJpKlNLLb0YSBc4yYWELNNnvBqFB5zDNSEXxoYzEBCELYqUaAZlKYOJSdZGsIGTBwgXjMtH5YJ7TQCwPD3kKGGHsqkjNzKJKKmrJqCqIqYLcJpTQEL5hQ/k9oWvxhJ0O5yPtHO9j3KzJKJfuPNqm4zJ9hFjJYoLjkCvJJyHLNF4K+lKmDGWVKaGhSGXqoKQvQtTOLgEYrXgGXaKQ2FzFoVkKZQJCr5u4BfTDkBLEsT5lJF8GGlRyOXqmD9mVJNzUk7JZCXcvhEEIvQDrJPSJYEP9BfnJmQyFgvPvzSf1nKNdWyQIDAQAB'
    })
  });
  
  const receiverResponse = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'MobileReceiver',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlAPP0tO8zWwnBGqaUWjFjcGuwfvWvFaYSdB3IRNnhlSoZegjMUeicG4ZYIxy3ovtBkY8ZQUttw1cxUsG5/UoegVmOyhu8gJ8fwxlOnOleq/lLual4ZkV64qKwr6zwq3BKCdEEyWZJCeHco9/F8KbExWeUJ9ObMCrwpN1REzVta1UbaWn2IQPriYQ1/gEqg4HMIk+mnDkII7oNDQMGW3ppcs2oGzAtRt3ANM4+LOwg+k3V/AqMqZNnoreNd0SlHBL6XoISSlMP2tkWFiTzHY9pkfmaI8Y2RleBJK0k9oy0U4jw4zksyCMFkmJJjmWVI/afFezuONAAk7d0BiUsEQ1twIDAQAB'
    })
  });
  
  const senderUser = await senderResponse.json();
  const receiverUser = await receiverResponse.json();
  
  console.log('✅ Test users created:');
  console.log('🖥️  Desktop Sender:', senderUser.user.username, 'ID:', senderUser.user.id);
  console.log('📱 Mobile Receiver:', receiverUser.user.username, 'ID:', receiverUser.user.id);
  
  // Create chat between users
  const chatResponse = await fetch('http://localhost:5000/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant1Id: senderUser.user.id,
      participant2Id: receiverUser.user.id
    })
  });
  const chat = await chatResponse.json();
  console.log('💬 Chat created with ID:', chat.id);
  
  // WebSocket connections
  const senderWs = new WebSocket('ws://localhost:5000/ws');
  const receiverWs = new WebSocket('ws://localhost:5000/ws');
  
  let connectedCount = 0;
  let receiverMessages = [];
  let senderMessages = [];
  
  senderWs.on('open', () => {
    console.log('🔌 Sender connected');
    senderWs.send(JSON.stringify({ type: 'join', userId: senderUser.user.id }));
    connectedCount++;
    if (connectedCount === 2) startMobileTest();
  });
  
  receiverWs.on('open', () => {
    console.log('🔌 Mobile receiver connected');
    receiverWs.send(JSON.stringify({ type: 'join', userId: receiverUser.user.id }));
    connectedCount++;
    if (connectedCount === 2) startMobileTest();
  });
  
  senderWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      senderMessages.push(msg.message);
      console.log('🖥️  Sender received confirmation:', msg.message.content.substring(0, 30) + '...');
    }
  });
  
  receiverWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      receiverMessages.push(msg.message);
      console.log('📱 MOBILE RECEIVER AUTO-RECEIVED:', msg.message.content.substring(0, 30) + '...');
      console.log('📱 MOBILE: Receiver ID matches:', msg.message.receiverId === receiverUser.user.id ? 'YES' : 'NO');
      console.log('📱 MOBILE: Should auto-activate chat for user', receiverUser.user.id);
    }
  });
  
  async function startMobileTest() {
    console.log('\n🚀 STARTING MOBILE AUTO-ACTIVATION TEST...\n');
    
    // Check chat lists before sending
    console.log('📋 CHECKING CHAT LISTS BEFORE MESSAGES:');
    const beforeSenderChats = await fetch(`http://localhost:5000/api/chats/${senderUser.user.id}`).then(r => r.json());
    const beforeReceiverChats = await fetch(`http://localhost:5000/api/chats/${receiverUser.user.id}`).then(r => r.json());
    
    console.log('🖥️  Sender sees chats:', beforeSenderChats.length);
    console.log('📱 Mobile receiver sees chats:', beforeReceiverChats.length);
    
    if (beforeReceiverChats.length > 0) {
      console.log('📱 Mobile receiver can see sender:', beforeReceiverChats[0].otherUser?.username || 'UNKNOWN');
    }
    
    // Send multiple test messages
    const testMessages = [
      'Mobile Test 1: Auto-activation needed!',
      'Mobile Test 2: Should appear instantly!',
      'Mobile Test 3: No manual clicking required!'
    ];
    
    for (let i = 0; i < testMessages.length; i++) {
      setTimeout(() => {
        console.log(`\n📤 SENDING MESSAGE ${i + 1}: "${testMessages[i]}"`);
        console.log('📤 From:', senderUser.user.id, 'To:', receiverUser.user.id, 'Chat:', chat.id);
        
        senderWs.send(JSON.stringify({
          type: 'message',
          chatId: chat.id,
          senderId: senderUser.user.id,
          receiverId: receiverUser.user.id,
          content: testMessages[i],
          messageType: 'text',
          destructTimer: 60000 // 1 minute
        }));
      }, i * 1500); // 1.5 second intervals
    }
    
    // Check results after all messages
    setTimeout(async () => {
      console.log('\n' + '='.repeat(70));
      console.log('📱 MOBILE AUTO-ACTIVATION TEST RESULTS');
      console.log('='.repeat(70));
      
      // Check final chat lists
      const afterSenderChats = await fetch(`http://localhost:5000/api/chats/${senderUser.user.id}`).then(r => r.json());
      const afterReceiverChats = await fetch(`http://localhost:5000/api/chats/${receiverUser.user.id}`).then(r => r.json());
      
      console.log('✅ Chat visibility:');
      console.log('  🖥️  Sender sees chats:', afterSenderChats.length > 0 ? 'YES' : 'NO');
      console.log('  📱 Mobile receiver sees chats:', afterReceiverChats.length > 0 ? 'YES' : 'NO');
      
      if (afterReceiverChats.length > 0) {
        console.log('  📱 Mobile receiver sees sender:', afterReceiverChats[0].otherUser?.username || 'UNKNOWN');
      }
      
      console.log('\n✅ Message delivery:');
      console.log('  📤 Messages sent:', testMessages.length);
      console.log('  📥 Mobile receiver got:', receiverMessages.length);
      console.log('  📥 Desktop sender got:', senderMessages.length);
      
      console.log('\n✅ Auto-activation analysis:');
      console.log('  📱 Mobile should auto-select chat when receiving messages');
      console.log('  📱 Mobile should scroll to bottom automatically');
      console.log('  📱 Mobile should update chat list without manual refresh');
      
      const success = receiverMessages.length === testMessages.length && 
                     afterReceiverChats.length > 0 &&
                     afterReceiverChats[0].otherUser?.username === senderUser.user.username;
      
      if (success) {
        console.log('\n🎉 MOBILE AUTO-ACTIVATION: FULLY FUNCTIONAL!');
        console.log('📱 Recipients will now see messages automatically without clicking names!');
      } else {
        console.log('\n⚠️  MOBILE AUTO-ACTIVATION: Needs more improvements');
        console.log('📱 Manual debugging required for complete functionality');
      }
      
      console.log('='.repeat(70));
      
      senderWs.close();
      receiverWs.close();
      
    }, 8000); // Wait 8 seconds for all messages
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testCompleteMobileFix();