// Test mobile chat list update
const WebSocket = require('ws');

async function testMobileChatList() {
  console.log('📱 Testing mobile chat list updates...');
  
  // Create users
  const user1Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'MobileTest1',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwGHuBhsj/KSjIGjKWJkBhAiEprfIL+LjKkJpKlNLLb0YSBc4yYWELNNnvBqFB5zDNSEXxoYzEBCELYqUaAZlKYOJSdZGsIGTBwgXjMtH5YJ7TQCwPD3kKGGHsqkjNzKJKKmrJqCqIqYLcJpTQEL5hQ/k9oWvxhJ0O5yPtHO9j3KzJKJfuPNqm4zJ9hFjJYoLjkCvJJyHLNF4K+lKmDGWVKaGhSGXqoKQvQtTOLgEYrXgGXaKQ2FzFoVkKZQJCr5u4BfTDkBLEsT5lJF8GGlRyOXqmD9mVJNzUk7JZCXcvhEEIvQDrJPSJYEP9BfnJmQyFgvPvzSf1nKNdWyQIDAQAB'
    })
  });
  
  const user2Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'MobileTest2',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlAPP0tO8zWwnBGqaUWjFjcGuwfvWvFaYSdB3IRNnhlSoZegjMUeicG4ZYIxy3ovtBkY8ZQUttw1cxUsG5/UoegVmOyhu8gJ8fwxlOnOleq/lLual4ZkV64qKwr6zwq3BKCdEEyWZJCeHco9/F8KbExWeUJ9ObMCrwpN1REzVta1UbaWn2IQPriYQ1/gEqg4HMIk+mnDkII7oNDQMGW3ppcs2oGzAtRt3ANM4+LOwg+k3V/AqMqZNnoreNd0SlHBL6XoISSlMP2tkWFiTzHY9pkfmaI8Y2RleBJK0k9oy0U4jw4zksyCMFkmJJjmWVI/afFezuONAAk7d0BiUsEQ1twIDAQAB'
    })
  });
  
  const user1Data = await user1Response.json();
  const user2Data = await user2Response.json();
  
  console.log('✅ Users created:');
  console.log('👤 User1:', user1Data.user.username);
  console.log('👤 User2:', user2Data.user.username);
  
  // Check initial chat lists (should be empty)
  let user1Chats = await fetch(`http://localhost:5000/api/chats/${user1Data.user.id}`).then(r => r.json());
  let user2Chats = await fetch(`http://localhost:5000/api/chats/${user2Data.user.id}`).then(r => r.json());
  
  console.log('📋 Initial chat counts:');
  console.log('👤 User1 chats:', user1Chats.length);
  console.log('👤 User2 chats:', user2Chats.length);
  
  // Create chat by sending a message
  const ws1 = new WebSocket('ws://localhost:5000/ws');
  const ws2 = new WebSocket('ws://localhost:5000/ws');
  
  let connected = 0;
  
  ws1.on('open', () => {
    console.log('✅ MobileTest1 connected');
    ws1.send(JSON.stringify({ type: 'join', userId: user1Data.user.id }));
    connected++;
    if (connected === 2) startTest();
  });
  
  ws2.on('open', () => {
    console.log('✅ MobileTest2 connected');
    ws2.send(JSON.stringify({ type: 'join', userId: user2Data.user.id }));
    connected++;
    if (connected === 2) startTest();
  });
  
  function startTest() {
    setTimeout(async () => {
      // First create a chat
      const chatResponse = await fetch('http://localhost:5000/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant1Id: user1Data.user.id,
          participant2Id: user2Data.user.id
        })
      });
      const chatData = await chatResponse.json();
      
      console.log('💬 Chat created:', chatData.id);
      
      // Send a message to trigger chat list update
      console.log('📤 Sending message to trigger chat list update...');
      ws1.send(JSON.stringify({
        type: 'message',
        chatId: chatData.id,
        senderId: user1Data.user.id,
        receiverId: user2Data.user.id,
        content: 'Hallo! Diese Nachricht sollte in der Chat-Liste erscheinen!',
        messageType: 'text',
        destructTimer: 3600
      }));
      
      // Check chat lists after message
      setTimeout(async () => {
        user1Chats = await fetch(`http://localhost:5000/api/chats/${user1Data.user.id}`).then(r => r.json());
        user2Chats = await fetch(`http://localhost:5000/api/chats/${user2Data.user.id}`).then(r => r.json());
        
        console.log('\n📋 Chat counts after message:');
        console.log('👤 User1 chats:', user1Chats.length);
        console.log('👤 User2 chats:', user2Chats.length);
        
        if (user1Chats.length > 0 && user2Chats.length > 0) {
          console.log('✅ Chats appear in both users\' lists');
          console.log('👤 User1 chat with:', user1Chats[0].otherUser?.username);
          console.log('👤 User2 chat with:', user2Chats[0].otherUser?.username);
        } else {
          console.log('❌ Chat list not updated properly');
        }
        
        ws1.close();
        ws2.close();
        
        console.log('\n' + '='.repeat(70));
        console.log('📱 MOBILE CHAT-LISTE TEST ERGEBNIS:');
        console.log('='.repeat(70));
        console.log('📊 Nachrichten auslösen Chat-Listen-Updates:', user1Chats.length > 0 && user2Chats.length > 0 ? 'JA' : 'NEIN');
        console.log('📱 Mobile Benutzer sehen Chat automatisch:', user2Chats.length > 0 ? 'JA' : 'NEIN');
        console.log('='.repeat(70));
      }, 2000);
      
    }, 1000);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testMobileChatList();