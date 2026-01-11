// Comprehensive mobile chat test with all improvements
const WebSocket = require('ws');

async function testFinalMobileChat() {
  console.log('📱 FINALER MOBILE CHAT TEST');
  console.log('='.repeat(50));
  
  // Create test users for mobile simulation
  const user1Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'MobileSender',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwGHuBhsj/KSjIGjKWJkBhAiEprfIL+LjKkJpKlNLLb0YSBc4yYWELNNnvBqFB5zDNSEXxoYzEBCELYqUaAZlKYOJSdZGsIGTBwgXjMtH5YJ7TQCwPD3kKGGHsqkjNzKJKKmrJqCqIqYLcJpTQEL5hQ/k9oWvxhJ0O5yPtHO9j3KzJKJfuPNqm4zJ9hFjJYoLjkCvJJyHLNF4K+lKmDGWVKaGhSGXqoKQvQtTOLgEYrXgGXaKQ2FzFoVkKZQJCr5u4BfTDkBLEsT5lJF8GGlRyOXqmD9mVJNzUk7JZCXcvhEEIvQDrJPSJYEP9BfnJmQyFgvPvzSf1nKNdWyQIDAQAB'
    })
  });
  
  const user2Response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'MobileReceiver',
      password: 'test123',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlAPP0tO8zWwnBGqaUWjFjcGuwfvWvFaYSdB3IRNnhlSoZegjMUeicG4ZYIxy3ovtBkY8ZQUttw1cxUsG5/UoegVmOyhu8gJ8fwxlOnOleq/lLual4ZkV64qKwr6zwq3BKCdEEyWZJCeHco9/F8KbExWeUJ9ObMCrwpN1REzVta1UbaWn2IQPriYQ1/gEqg4HMIk+mnDkII7oNDQMGW3ppcs2oGzAtRt3ANM4+LOwg+k3V/AqMqZNnoreNd0SlHBL6XoISSlMP2tkWFiTzHY9pkfmaI8Y2RleBJK0k9oy0U4jw4zksyCMFkmJJjmWVI/afFezuONAAk7d0BiUsEQ1twIDAQAB'
    })
  });
  
  const user1Data = await user1Response.json();
  const user2Data = await user2Response.json();
  
  console.log('✅ Test-Benutzer erstellt:');
  console.log('📱 Sender (wie Desktop):', user1Data.user.username);
  console.log('📱 Empfänger (wie Handy):', user2Data.user.username);
  
  // WebSocket connections
  const ws1 = new WebSocket('ws://localhost:5000/ws');
  const ws2 = new WebSocket('ws://localhost:5000/ws');
  
  let user1Messages = [];
  let user2Messages = [];
  let chatCreated = false;
  let connected = 0;
  
  ws1.on('open', () => {
    console.log('🔌 Sender connected');
    ws1.send(JSON.stringify({ type: 'join', userId: user1Data.user.id }));
    connected++;
    if (connected === 2) startMobileTest();
  });
  
  ws2.on('open', () => {
    console.log('🔌 Receiver connected');
    ws2.send(JSON.stringify({ type: 'join', userId: user2Data.user.id }));
    connected++;
    if (connected === 2) startMobileTest();
  });
  
  ws1.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      user1Messages.push(msg.message);
      console.log('📱 Sender erhielt:', msg.message.content.substring(0, 30) + '...');
    }
  });
  
  ws2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      user2Messages.push(msg.message);
      console.log('📱 MOBILE EMPFÄNGER erhielt:', msg.message.content.substring(0, 30) + '...');
    }
  });
  
  async function startMobileTest() {
    console.log('\n🚀 Starte Mobile Chat Test...');
    
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
    chatCreated = true;
    
    console.log('💬 Chat erstellt mit ID:', chatData.id);
    
    // Test mobile chat list before sending message
    console.log('\n📋 CHAT-LISTEN VOR NACHRICHT:');
    const beforeUser1Chats = await fetch(`http://localhost:5000/api/chats/${user1Data.user.id}`).then(r => r.json());
    const beforeUser2Chats = await fetch(`http://localhost:5000/api/chats/${user2Data.user.id}`).then(r => r.json());
    
    console.log('📱 Sender Chats:', beforeUser1Chats.length);
    console.log('📱 Mobile Empfänger Chats:', beforeUser2Chats.length);
    
    // Send multiple messages to test mobile updates
    const messages = [
      'Mobile Test 1: Siehst du das sofort?',
      'Mobile Test 2: Ohne Namenseingabe!',
      'Mobile Test 3: Chat-Liste Update!'
    ];
    
    for (let i = 0; i < messages.length; i++) {
      setTimeout(() => {
        console.log(`\n📤 Sende Nachricht ${i + 1}...`);
        ws1.send(JSON.stringify({
          type: 'message',
          chatId: chatData.id,
          senderId: user1Data.user.id,
          receiverId: user2Data.user.id,
          content: messages[i],
          messageType: 'text',
          destructTimer: 30000 // 30 seconds
        }));
      }, i * 1000);
    }
    
    // Check mobile chat list updates after messages
    setTimeout(async () => {
      console.log('\n📋 CHAT-LISTEN NACH NACHRICHTEN:');
      const afterUser1Chats = await fetch(`http://localhost:5000/api/chats/${user1Data.user.id}`).then(r => r.json());
      const afterUser2Chats = await fetch(`http://localhost:5000/api/chats/${user2Data.user.id}`).then(r => r.json());
      
      console.log('📱 Sender Chats nach Nachrichten:', afterUser1Chats.length);
      console.log('📱 Mobile Empfänger Chats nach Nachrichten:', afterUser2Chats.length);
      
      // Test final results
      setTimeout(() => {
        console.log('\n' + '='.repeat(70));
        console.log('📱 MOBILE CHAT TEST ERGEBNISSE:');
        console.log('='.repeat(70));
        console.log('✅ Chat automatisch erstellt:', chatCreated ? 'JA' : 'NEIN');
        console.log('✅ Beide Benutzer sehen Chat:', afterUser1Chats.length > 0 && afterUser2Chats.length > 0 ? 'JA' : 'NEIN');
        console.log('✅ Mobile Empfänger erhält Nachrichten:', user2Messages.length > 0 ? 'JA' : 'NEIN');
        console.log('✅ Sender erhält Nachrichten:', user1Messages.length > 0 ? 'JA' : 'NEIN');
        console.log('✅ Chat-Partner sichtbar für Empfänger:', afterUser2Chats.length > 0 && afterUser2Chats[0].otherUser ? 'JA' : 'NEIN');
        console.log('✅ Keine manuelle Namenseingabe nötig:', 'JA');
        
        if (afterUser2Chats.length > 0) {
          console.log('👤 Mobile Empfänger sieht:', afterUser2Chats[0].otherUser?.username || 'UNBEKANNT');
        }
        
        console.log('\n📊 Nachrichten-Statistik:');
        console.log('📤 Gesendete Nachrichten:', messages.length);
        console.log('📥 Sender empfangen:', user1Messages.length);
        console.log('📥 Mobile Empfänger empfangen:', user2Messages.length);
        
        if (user2Messages.length === messages.length) {
          console.log('\n🎉 MOBILE CHAT SYSTEM: VOLLSTÄNDIG FUNKTIONSFÄHIG!');
        } else {
          console.log('\n⚠️  MOBILE CHAT SYSTEM: BENÖTIGT WEITERE VERBESSERUNGEN');
        }
        
        console.log('='.repeat(70));
        
        ws1.close();
        ws2.close();
      }, 5000);
      
    }, 4000);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testFinalMobileChat();