#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🧪 ECHTER BADGE TEST - Live WebSocket Test');
console.log('========================================');

async function testBadgeSystem() {
  // 1. Backend API Test
  console.log('\n1. Backend API Test für User 7 (id2):');
  try {
    const response = await fetch('http://localhost:5000/api/chats/7');
    const data = await response.json();
    
    if (data && data.length > 0) {
      const chat = data[0];
      console.log(`✅ Backend: unreadCount1=${chat.unreadCount1}, unreadCount2=${chat.unreadCount2}`);
      console.log(`✅ Backend: User 7 sieht unreadCount=${chat.unreadCount}`);
    } else {
      console.log('❌ Keine Chat-Daten gefunden');
      return false;
    }
  } catch (error) {
    console.log('❌ Backend API Fehler:', error.message);
    return false;
  }

  // 2. WebSocket Connection Test
  console.log('\n2. WebSocket Verbindung testen:');
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket verbunden');
      
      // 3. Join als User 7 (id2)
      ws.send(JSON.stringify({
        type: 'join',
        userId: 7
      }));
      console.log('✅ Als User 7 (id2) beigetreten');
      
      // 4. Simuliere Nachricht von User 6 (id1) an User 7 (id2)
      setTimeout(() => {
        console.log('\n3. Simuliere Nachricht von id1 an id2:');
        ws.send(JSON.stringify({
          type: 'message',
          chatId: null,
          senderId: 6,
          receiverId: 7,
          content: 'TEST BADGE NACHRICHT',
          messageType: 'text',
          destructTimer: 300000  // 5 Minuten
        }));
        console.log('✅ Test-Nachricht gesendet');
      }, 1000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket empfangen:', message.type);
        
        if (message.type === 'new_message' && message.message?.receiverId === 7) {
          console.log('🎯 NEUE NACHRICHT für User 7 empfangen!');
          console.log('✅ Badge sollte jetzt +1 sein');
          
          // Test Badge Berechnung
          setTimeout(async () => {
            console.log('\n4. Badge Test nach Nachricht:');
            const response = await fetch('http://localhost:5000/api/chats/7');
            const data = await response.json();
            
            if (data && data.length > 0) {
              const chat = data[0];
              console.log(`📊 Nach Nachricht: unreadCount1=${chat.unreadCount1}, unreadCount2=${chat.unreadCount2}`);
              
              const userId = 7;
              let calculatedUnread = 0;
              if (userId === chat.participant1Id) {
                calculatedUnread = chat.unreadCount1 || 0;
              } else if (userId === chat.participant2Id) {
                calculatedUnread = chat.unreadCount2 || 0;  
              }
              
              console.log(`🔥 BERECHNETES UNREAD für User 7: ${calculatedUnread}`);
              if (calculatedUnread > 0) {
                console.log('✅ BADGE FUNKTIONIERT! Unread Count > 0');
                resolve(true);
              } else {
                console.log('❌ BADGE FEHLER! Unread Count = 0');
                resolve(false);
              }
            }
            
            ws.close();
          }, 2000);
        }
      } catch (error) {
        console.log('❌ Message parsing error:', error.message);
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket Fehler:', error.message);
      resolve(false);
    });
    
    // Timeout nach 10 Sekunden
    setTimeout(() => {
      console.log('❌ Test Timeout nach 10 Sekunden');
      ws.close();
      resolve(false);
    }, 10000);
  });
}

// Test ausführen
testBadgeSystem().then(success => {
  console.log('\n========================================');
  if (success) {
    console.log('🎉 BADGE SYSTEM FUNKTIONIERT!');
  } else {
    console.log('💥 BADGE SYSTEM KAPUTT!');
  }
  console.log('========================================');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.log('💥 TEST FEHLER:', error.message);
  process.exit(1);
});