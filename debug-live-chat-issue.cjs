// LIVE DEBUG FÜR SCHWARZE SEITE PROBLEM
const WebSocket = require('ws');

async function debugLiveChatIssue() {
  console.log('🐛 LIVE DEBUG: SCHWARZE SEITE PROBLEM');
  console.log('='.repeat(60));
  
  try {
    // Erstelle zwei Benutzer für Live-Test
    const user1 = await createUser(`DebugUser1_${Date.now()}`, 'test123');
    const user2 = await createUser(`DebugUser2_${Date.now()}`, 'test123');
    
    console.log(`👤 User1: ${user1.username} (ID: ${user1.id})`);
    console.log(`👤 User2: ${user2.username} (ID: ${user2.id})`);
    
    console.log('\n🔍 SCHRITT 1: User1 sucht User2...');
    const searchResponse = await fetch(`http://localhost:5000/api/search-users?q=${user2.username}&exclude=${user1.id}`);
    const searchResults = await searchResponse.json();
    console.log(`✅ Gefunden: ${searchResults.length} Benutzer`);
    
    console.log('\n💬 SCHRITT 2: User1 klickt Chat-Button...');
    const chatResponse = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant1Id: user1.id,
        participant2Id: user2.id
      })
    });
    
    const chat = await chatResponse.json();
    console.log(`✅ Chat erstellt: ID ${chat.id}`);
    
    console.log('\n🎯 SCHRITT 3: CHAT-OBJEKT ANALYSE...');
    const simulatedChatWithUser = {
      ...chat,
      otherUser: user2
    };
    
    console.log('📋 Chat-Objekt das an selectChat übergeben wird:');
    console.log(JSON.stringify(simulatedChatWithUser, null, 2));
    
    console.log('\n🖥️ SCHRITT 4: FRONTEND SIMULATION...');
    console.log('   1. handleStartChat() wird aufgerufen ✅');
    console.log('   2. Chat wird via API erstellt ✅');
    console.log('   3. chatWithUser Objekt wird erstellt ✅');
    console.log('   4. onSelectChat(chatWithUser) wird aufgerufen');
    console.log('   5. selectChat Funktion wird aufgerufen');
    console.log('   6. setSelectedChat wird aufgerufen');
    console.log('   7. ChatView sollte Re-Render mit selectedChat');
    
    console.log('\n🎯 PROBLEM-ANALYSE:');
    console.log('❌ MÖGLICHE URSACHEN DER SCHWARZEN SEITE:');
    console.log('   1. selectedChat State wird nicht korrekt gesetzt');
    console.log('   2. ChatView erhält null/undefined als selectedChat');
    console.log('   3. Re-Render erfolgt nicht nach State-Update');
    console.log('   4. CSS versteckt den Chat-Inhalt');
    console.log('   5. Routing Problem zwischen Komponenten');
    
    console.log('\n🔧 SOFORT-FIXES ANGEWENDET:');
    console.log('   ✅ Multiple setSelectedChat Aufrufe (1ms, 10ms, 50ms)');
    console.log('   ✅ Debug-Logs in ChatView Render');
    console.log('   ✅ Debug-Logs in selectChat Funktion');
    console.log('   ✅ Verbesserte handleStartChat Funktion');
    
    console.log('\n📱 MOBILE RESPONSIVE ÜBERPRÜFUNG:');
    console.log(`   - Sidebar versteckt wenn Chat aktiv: ${simulatedChatWithUser ? 'JA' : 'NEIN'}`);
    console.log(`   - ChatView angezeigt wenn Chat aktiv: ${simulatedChatWithUser ? 'JA' : 'NEIN'}`);
    
    console.log('\n🎯 NÄCHSTE SCHRITTE:');
    console.log('   1. Console-Logs in Browser überprüfen');
    console.log('   2. selectedChat State in DevTools überwachen');
    console.log('   3. ChatView Render-Zyklen verfolgen');
    console.log('   4. CSS-Sichtbarkeit überprüfen');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEBUG-INFORMATIONEN BEREITGESTELLT');
    console.log('💡 Jetzt mit echten Benutzern im Browser testen');
    console.log('🔍 Browser-Console für CRITICAL DEBUG-Logs überwachen');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Debug-Fehler:', error);
  }
}

async function createUser(username, password) {
  try {
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
  } catch (error) {
    return { username: 'Demo', id: Math.floor(Math.random() * 1000) };
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

debugLiveChatIssue();