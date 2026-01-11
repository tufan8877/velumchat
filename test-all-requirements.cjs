// Test alle 4 Anforderungen: Auto-Aktivierung, getrennte Chats, Selbstlöschung, Mobile
const WebSocket = require('ws');

async function testAllRequirements() {
  console.log('🎯 TESTING ALLE 4 ANFORDERUNGEN');
  console.log('='.repeat(60));
  
  // Erstelle 3 Benutzer für getrennte Chat-Tests
  const user1 = await createUser(`User1_${Date.now()}`, 'test123');
  const user2 = await createUser(`User2_${Date.now()}`, 'test123');
  const user3 = await createUser(`User3_${Date.now()}`, 'test123');
  
  console.log(`👥 User1: ${user1.username} (ID: ${user1.id})`);
  console.log(`👥 User2: ${user2.username} (ID: ${user2.id})`);
  console.log(`👥 User3: ${user3.username} (ID: ${user3.id})`);
  
  // WebSocket Verbindungen
  const ws1 = new WebSocket('ws://localhost:5000/ws');
  const ws2 = new WebSocket('ws://localhost:5000/ws');
  const ws3 = new WebSocket('ws://localhost:5000/ws');
  
  let connected = 0;
  let results = {
    autoActivation: false,
    separateChats: false,
    autoDelete: false,
    contactPersistence: false
  };
  
  // Verbindungen setup
  [ws1, ws2, ws3].forEach((ws, index) => {
    const userId = [user1.id, user2.id, user3.id][index];
    const username = [user1.username, user2.username, user3.username][index];
    
    ws.on('open', () => {
      console.log(`🔌 ${username} verbunden`);
      ws.send(JSON.stringify({ type: 'join', userId }));
      connected++;
      if (connected === 3) startTests();
    });
    
    // Auto-Aktivierung Test: User2 empfängt Nachricht
    if (index === 1) {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'new_message') {
          console.log('✅ ANFORDERUNG 1: Auto-Aktivierung - User2 empfängt Nachricht automatisch');
          results.autoActivation = true;
        }
      });
    }
  });
  
  function startTests() {
    console.log('\n🚀 TESTE ALLE 4 ANFORDERUNGEN...\n');
    
    // TEST 1: User1 → User2 (erster Chat)
    setTimeout(() => {
      console.log('📤 TEST 1: User1 → User2 (Auto-Aktivierung testen)');
      ws1.send(JSON.stringify({
        type: 'message',
        senderId: user1.id,
        receiverId: user2.id,
        content: 'Nachricht 1: Auto-Aktivierung Test',
        messageType: 'text',
        destructTimer: 8000, // 8 Sekunden für Selbstlöschung
        chatId: null
      }));
    }, 1000);
    
    // TEST 2: User3 → User2 (getrennter Chat)
    setTimeout(() => {
      console.log('📤 TEST 2: User3 → User2 (getrennte Chats testen)');
      ws3.send(JSON.stringify({
        type: 'message',
        senderId: user3.id,
        receiverId: user2.id,
        content: 'Nachricht 2: Getrennter Chat Test',
        messageType: 'text',
        destructTimer: 12000, // 12 Sekunden
        chatId: null
      }));
    }, 3000);
    
    // TEST 3: Getrennte Chats prüfen
    setTimeout(async () => {
      console.log('\n📋 TEST 3: Getrennte Chats prüfen...');
      
      const user2Contacts = await fetch(`http://localhost:5000/api/chat-contacts/${user2.id}`)
        .then(r => r.json()).catch(() => []);
      
      console.log(`📋 User2 hat ${user2Contacts.length} separate Chat-Kontakte:`);
      user2Contacts.forEach((contact, i) => {
        console.log(`  ${i+1}. Chat mit ${contact.otherUser.username} (Chat ID: ${contact.id})`);
      });
      
      if (user2Contacts.length >= 2) {
        console.log('✅ ANFORDERUNG 2: Getrennte Chats - User2 hat separate Chats mit User1 und User3');
        results.separateChats = true;
      } else {
        console.log('❌ ANFORDERUNG 2: Getrennte Chats - Nicht genug separate Chats');
      }
      
    }, 6000);
    
    // TEST 4: Selbstlöschung und Kontakt-Persistierung prüfen
    setTimeout(async () => {
      console.log('\n🗑️ TEST 4: Selbstlöschung und Kontakt-Persistierung...');
      
      const user2Contacts = await fetch(`http://localhost:5000/api/chat-contacts/${user2.id}`)
        .then(r => r.json()).catch(() => []);
      
      console.log(`📋 Nach Selbstlöschung: ${user2Contacts.length} Kontakte noch vorhanden`);
      
      if (user2Contacts.length >= 2) {
        console.log('✅ ANFORDERUNG 4: Kontakt-Persistierung - Chats bleiben nach Nachrichtenlöschung');
        results.contactPersistence = true;
        
        // Prüfe ob Nachrichten gelöscht wurden
        let totalMessages = 0;
        for (const contact of user2Contacts) {
          const messages = await fetch(`http://localhost:5000/api/chats/${contact.id}/messages`)
            .then(r => r.json()).catch(() => []);
          totalMessages += messages.length;
          console.log(`💬 Chat ${contact.id}: ${messages.length} Nachrichten`);
        }
        
        if (totalMessages === 0) {
          console.log('✅ ANFORDERUNG 3: Selbstlöschung - Nachrichten automatisch gelöscht, Chats bleiben');
          results.autoDelete = true;
        } else {
          console.log('⏳ ANFORDERUNG 3: Selbstlöschung - Nachrichten noch vorhanden (brauchen mehr Zeit)');
        }
      }
      
    }, 15000);
    
    // FINAL REPORT
    setTimeout(() => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 FINAL REPORT - ALLE 4 ANFORDERUNGEN');
      console.log('='.repeat(60));
      
      console.log(`1️⃣ Auto-Aktivierung (id2 sieht Chat automatisch): ${results.autoActivation ? '✅' : '❌'}`);
      console.log(`2️⃣ Getrennte Chats (id3 bekommt eigenen Chat): ${results.separateChats ? '✅' : '❌'}`);
      console.log(`3️⃣ Selbstlöschung (Nachrichten weg, Chat bleibt): ${results.autoDelete ? '✅' : '⏳'}`);
      console.log(`4️⃣ Kontakt-Persistierung (Chat-Kanäle bleiben): ${results.contactPersistence ? '✅' : '❌'}`);
      
      const passedTests = Object.values(results).filter(Boolean).length;
      console.log(`\n🎯 GESAMT: ${passedTests}/4 Anforderungen erfüllt`);
      
      if (passedTests === 4) {
        console.log('\n🎉 ALLE ANFORDERUNGEN ERFÜLLT!');
        console.log('✅ System bereit für Produktion');
      } else if (passedTests >= 3) {
        console.log('\n🔧 Fast fertig - kleinere Anpassungen nötig');
      } else {
        console.log('\n⚠️ Weitere Entwicklung erforderlich');
      }
      
      console.log('='.repeat(60));
      
      // Verbindungen schließen
      [ws1, ws2, ws3].forEach(ws => ws.close());
      
    }, 18000);
  }
}

async function createUser(username, password) {
  const response = await fetch('http://localhost:5000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      publicKey: `key_${username}_${Date.now()}`
    })
  });
  const data = await response.json();
  return data.user;
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testAllRequirements();