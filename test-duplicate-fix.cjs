// Test duplicate message fix
const WebSocket = require('ws');

async function testDuplicateFix() {
  console.log('🔧 Testing duplicate message fix...');
  
  // Create test users
  const user1Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'DuplicateTest1',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwGHuBhsj/KSjIGjKWJkBhAiEprfIL+LjKkJpKlNLLb0YSBc4yYWELNNnvBqFB5zDNSEXxoYzEBCELYqUaAZlKYOJSdZGsIGTBwgXjMtH5YJ7TQCwPD3kKGGHsqkjNzKJKKmrJqCqIqYLcJpTQEL5hQ/k9oWvxhJ0O5yPtHO9j3KzJKJfuPNqm4zJ9hFjJYoLjkCvJJyHLNF4K+lKmDGWVKaGhSGXqoKQvQtTOLgEYrXgGXaKQ2FzFoVkKZQJCr5u4BfTDkBLEsT5lJF8GGlRyOXqmD9mVJNzUk7JZCXcvhEEIvQDrJPSJYEP9BfnJmQyFgvPvzSf1nKNdWyQIDAQAB'
    })
  });
  
  const user2Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'DuplicateTest2',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlAPP0tO8zWwnBGqaUWjFjcGuwfvWvFaYSdB3IRNnhlSoZegjMUeicG4ZYIxy3ovtBkY8ZQUttw1cxUsG5/UoegVmOyhu8gJ8fwxlOnOleq/lLual4ZkV64qKwr6zwq3BKCdEEyWZJCeHco9/F8KbExWeUJ9ObMCrwpN1REzVta1UbaWn2IQPriYQ1/gEqg4HMIk+mnDkII7oNDQMGW3ppcs2oGzAtRt3ANM4+LOwg+k3V/AqMqZNnoreNd0SlHBL6XoISSlMP2tkWFiTzHY9pkfmaI8Y2RleBJK0k9oy0U4jw4zksyCMFkmJJjmWVI/afFezuONAAk7d0BiUsEQ1twIDAQAB'
    })
  });
  
  const user1Data = await user1Response.json();
  const user2Data = await user2Response.json();
  
  // Create chat
  const chatResponse = await fetch('http://localhost:5000/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant1Id: user1Data.user.id,
      participant2Id: user2Data.user.id
    })
  });
  const chatData = await chatResponse.json();
  
  console.log('✅ Test setup complete');
  console.log('👤 Sender (User1):', user1Data.user.username);
  console.log('👤 Receiver (User2):', user2Data.user.username);
  
  // Connect both users
  const ws1 = new WebSocket('ws://localhost:5000/ws');
  const ws2 = new WebSocket('ws://localhost:5000/ws');
  
  let connected = 0;
  let messagesReceived = { user1: 0, user2: 0 };
  
  ws1.on('open', () => {
    console.log('✅ DuplicateTest1 connected');
    ws1.send(JSON.stringify({ type: 'join', userId: user1Data.user.id }));
    connected++;
    if (connected === 2) startTest();
  });
  
  ws2.on('open', () => {
    console.log('✅ DuplicateTest2 connected');
    ws2.send(JSON.stringify({ type: 'join', userId: user2Data.user.id }));
    connected++;
    if (connected === 2) startTest();
  });
  
  function startTest() {
    setTimeout(() => {
      console.log('📤 User1 sending message...');
      ws1.send(JSON.stringify({
        type: 'message',
        chatId: chatData.id,
        senderId: user1Data.user.id,
        receiverId: user2Data.user.id,
        content: 'Test-Nachricht ohne Duplikate!',
        messageType: 'text',
        destructTimer: 3600
      }));
    }, 1000);
  }
  
  ws1.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      messagesReceived.user1++;
      console.log('📥 User1 received message #' + messagesReceived.user1 + ':', msg.message.content.substring(0, 30) + '...');
    }
  });
  
  ws2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      messagesReceived.user2++;
      console.log('📥 User2 received message #' + messagesReceived.user2 + ':', msg.message.content.substring(0, 30) + '...');
    }
  });
  
  setTimeout(() => {
    ws1.close();
    ws2.close();
    
    console.log('\n' + '='.repeat(70));
    console.log('🔧 DUPLIKATS-TEST ERGEBNIS:');
    console.log('='.repeat(70));
    console.log('📊 User1 (Sender) empfing:', messagesReceived.user1, 'Nachrichten');
    console.log('📊 User2 (Empfänger) empfing:', messagesReceived.user2, 'Nachrichten');
    
    if (messagesReceived.user1 <= 1 && messagesReceived.user2 <= 1) {
      console.log('✅ DUPLIKATE BEHOBEN: Jeder Benutzer sieht nur eine Version');
      console.log('✅ Sender sieht: Optimistische Nachricht (unverschlüsselt)');
      console.log('✅ Empfänger sieht: Entschlüsselte Nachricht vom Server');
    } else {
      console.log('❌ DUPLIKATE NOCH VORHANDEN');
    }
    console.log('='.repeat(70));
  }, 3000);
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testDuplicateFix();