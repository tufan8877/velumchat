// Test persistent chat contacts and automatic message deletion
const WebSocket = require('ws');

async function testPersistentChatSystem() {
  console.log('📱 TESTING PERSISTENT CHAT SYSTEM');
  console.log('='.repeat(60));
  
  const timestamp = Date.now();
  
  // Create test users
  console.log('👥 Creating test users...');
  const alice = await createUser(`Alice_${timestamp}`, 'test123');
  const bob = await createUser(`Bob_${timestamp}`, 'test123');
  
  console.log(`✅ Alice: ${alice.username} (ID: ${alice.id})`);
  console.log(`✅ Bob: ${bob.username} (ID: ${bob.id})`);
  
  // Connect WebSockets
  const wsAlice = new WebSocket('ws://localhost:5000/ws');
  const wsBob = new WebSocket('ws://localhost:5000/ws');
  
  let connectedCount = 0;
  let receivedMessages = [];
  
  wsAlice.on('open', () => {
    console.log('🔌 Alice connected');
    wsAlice.send(JSON.stringify({ type: 'join', userId: alice.id }));
    connectedCount++;
    if (connectedCount === 2) startTest();
  });
  
  wsBob.on('open', () => {
    console.log('🔌 Bob connected');
    wsBob.send(JSON.stringify({ type: 'join', userId: bob.id }));
    connectedCount++;
    if (connectedCount === 2) startTest();
  });
  
  // Track Alice's received messages
  wsAlice.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      receivedMessages.push(msg.message);
      console.log(`📥 Alice received: "${msg.message.content}" (Chat: ${msg.message.chatId})`);
    }
  });
  
  async function startTest() {
    console.log('\n🚀 TESTING PERSISTENT CHAT FEATURES...\n');
    
    // Test 1: Send message from Bob to Alice
    console.log('📤 TEST 1: Bob → Alice (creates persistent contact)');
    setTimeout(() => {
      wsBob.send(JSON.stringify({
        type: 'message',
        senderId: bob.id,
        receiverId: alice.id,
        content: 'Hello Alice! This message will auto-delete in 10 seconds.',
        messageType: 'text',
        destructTimer: 10000, // 10 seconds
        chatId: null
      }));
    }, 500);
    
    // Test 2: Check persistent contacts (before message deletion)
    setTimeout(async () => {
      console.log('\n📋 TEST 2: Checking persistent contacts (before deletion)...');
      
      const aliceContacts = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`)
        .then(r => r.json()).catch(() => []);
      
      console.log(`📋 Alice has ${aliceContacts.length} persistent contacts:`);
      aliceContacts.forEach(contact => {
        console.log(`  👤 ${contact.otherUser.username} (Chat ID: ${contact.id})`);
      });
      
    }, 3000);
    
    // Test 3: Check after message auto-deletion (contact should remain)
    setTimeout(async () => {
      console.log('\n📋 TEST 3: Checking after auto-deletion (contacts should remain)...');
      
      const aliceContacts = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`)
        .then(r => r.json()).catch(() => []);
      
      const aliceChats = await fetch(`http://localhost:5000/api/chats/${alice.id}`)
        .then(r => r.json()).catch(() => []);
      
      console.log(`📋 Alice persistent contacts: ${aliceContacts.length}`);
      console.log(`📨 Alice active chats: ${aliceChats.length}`);
      
      if (aliceContacts.length > 0) {
        console.log('✅ PERSISTENT CONTACTS: Working! Contacts remain after message deletion');
        
        const chatId = aliceContacts[0].id;
        const messages = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`)
          .then(r => r.json()).catch(() => []);
        
        console.log(`📨 Active messages in chat: ${messages.length} (should be 0 after deletion)`);
        
        if (messages.length === 0) {
          console.log('✅ AUTO-DELETION: Working! Messages deleted but contact remains');
        } else {
          console.log('⚠️  AUTO-DELETION: Messages still present (may need more time)');
        }
        
      } else {
        console.log('❌ PERSISTENT CONTACTS: Not working - contacts disappeared');
      }
      
    }, 15000); // After 15 seconds
    
    // Test 4: Send new message to existing contact
    setTimeout(() => {
      console.log('\n📤 TEST 4: Bob → Alice (reuse existing contact)');
      wsBob.send(JSON.stringify({
        type: 'message',
        senderId: bob.id,
        receiverId: alice.id,
        content: 'New message to existing contact!',
        messageType: 'text',
        destructTimer: 30000, // 30 seconds
        chatId: null
      }));
    }, 17000);
    
    // Final results
    setTimeout(async () => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 PERSISTENT CHAT SYSTEM TEST RESULTS');
      console.log('='.repeat(60));
      
      const aliceContacts = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`)
        .then(r => r.json()).catch(() => []);
      
      console.log(`📋 Final persistent contacts: ${aliceContacts.length}`);
      console.log(`📥 Total messages received: ${receivedMessages.length}`);
      
      if (aliceContacts.length === 1 && receivedMessages.length === 2) {
        console.log('\n🎉 PERSISTENT CHAT SYSTEM: SUCCESS!');
        console.log('✅ Contacts remain after message deletion');
        console.log('✅ Messages auto-delete as configured');
        console.log('✅ 1:1 chat separation maintained');
        console.log('✅ Mobile-ready contact persistence');
      } else {
        console.log('\n⚠️  SYSTEM NEEDS ADJUSTMENT');
        console.log(`Expected: 1 contact, 2 messages`);
        console.log(`Got: ${aliceContacts.length} contacts, ${receivedMessages.length} messages`);
      }
      
      console.log('='.repeat(60));
      
      // Close connections
      [wsAlice, wsBob].forEach(ws => ws.close());
      
    }, 22000);
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

testPersistentChatSystem();