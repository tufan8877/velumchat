#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🧪 MEHRFACH NACHRICHTEN TEST - Badge Zählung');
console.log('===========================================');

async function testMultipleMessages() {
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket verbunden');
      
      // Join als User 7 (id2)
      ws.send(JSON.stringify({
        type: 'join',
        userId: 7
      }));
      
      let messageCount = 0;
      const maxMessages = 3;
      
      // Sende 3 Nachrichten im Abstand von 1 Sekunde
      const sendMessages = setInterval(() => {
        messageCount++;
        console.log(`\n📤 Sende Nachricht ${messageCount}:`);
        
        ws.send(JSON.stringify({
          type: 'message',
          chatId: null,
          senderId: 6,
          receiverId: 7,
          content: `TEST NACHRICHT ${messageCount}`,
          messageType: 'text',
          destructTimer: 300000
        }));
        
        if (messageCount >= maxMessages) {
          clearInterval(sendMessages);
          
          // Warte 3 Sekunden und prüfe finale Badge-Zahl
          setTimeout(async () => {
            const response = await fetch('http://localhost:5000/api/chats/7');
            const data = await response.json();
            
            if (data && data.length > 0) {
              const chat = data[0];
              console.log(`\n🎯 FINALE BADGE ZÄHLUNG:`);
              console.log(`   unreadCount1: ${chat.unreadCount1}`);
              console.log(`   unreadCount2: ${chat.unreadCount2}`);
              
              const finalCount = chat.unreadCount2 || 0;
              console.log(`\n✅ User 7 Badge: ${finalCount}`);
              
              if (finalCount > 8) { // Startwert war 8
                console.log(`🎉 BADGE ZÄHLT KORREKT! (${finalCount} > 8)`);
                resolve(true);
              } else {
                console.log(`❌ BADGE ZÄHLT NICHT! (${finalCount} <= 8)`);
                resolve(false);
              }
            }
            
            ws.close();
          }, 3000);
        }
      }, 1000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'new_message') {
        console.log(`   📨 Nachricht empfangen in Chat ${message.message.chatId}`);
      }
    });
    
    setTimeout(() => {
      console.log('❌ Test Timeout');
      ws.close();
      resolve(false);
    }, 15000);
  });
}

// Test ausführen
testMultipleMessages().then(success => {
  console.log('\n===========================================');
  if (success) {
    console.log('🎉 BADGE ZÄHLUNG FUNKTIONIERT!');
  } else {
    console.log('💥 BADGE ZÄHLUNG KAPUTT!');
  }
  console.log('===========================================');
  process.exit(success ? 0 : 1);
});