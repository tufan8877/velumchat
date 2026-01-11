// Quick test for persistent chat functionality
const WebSocket = require('ws');

async function quickPersistentTest() {
  console.log('🚀 QUICK PERSISTENT CHAT TEST');
  console.log('='.repeat(50));
  
  try {
    // Create two users
    const alice = await createUser(`Alice_${Date.now()}`, 'test123');
    const bob = await createUser(`Bob_${Date.now()}`, 'test123');
    
    console.log(`✅ Created Alice (ID: ${alice.id}) and Bob (ID: ${bob.id})`);
    
    // Connect WebSockets
    const wsAlice = new WebSocket('ws://localhost:5000/ws');
    const wsBob = new WebSocket('ws://localhost:5000/ws');
    
    let connected = 0;
    
    wsAlice.on('open', () => {
      wsAlice.send(JSON.stringify({ type: 'join', userId: alice.id }));
      connected++;
      if (connected === 2) runTest();
    });
    
    wsBob.on('open', () => {
      wsBob.send(JSON.stringify({ type: 'join', userId: bob.id }));
      connected++;
      if (connected === 2) runTest();
    });
    
    function runTest() {
      console.log('📤 Bob sending message to Alice...');
      
      // Send message
      wsBob.send(JSON.stringify({
        type: 'message',
        senderId: bob.id,
        receiverId: alice.id,
        content: 'Hello from Bob! Auto-delete in 10s',
        messageType: 'text',
        destructTimer: 10000,
        chatId: null
      }));
      
      // Check persistent contacts after 2 seconds
      setTimeout(async () => {
        console.log('📋 Checking persistent contacts...');
        
        try {
          const contactsResponse = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`);
          const contacts = await contactsResponse.json();
          
          console.log(`📋 Alice has ${contacts.length} persistent contacts:`);
          contacts.forEach(contact => {
            console.log(`  👤 ${contact.otherUser.username} (Chat ID: ${contact.id})`);
          });
          
          if (contacts.length > 0) {
            console.log('✅ SUCCESS: Persistent contacts working!');
            
            // Check messages in chat
            const chatId = contacts[0].id;
            const messagesResponse = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`);
            const messages = await messagesResponse.json();
            
            console.log(`📨 Current messages in chat: ${messages.length}`);
            if (messages.length > 0) {
              console.log(`📝 Message: "${messages[0].content}"`);
            }
            
          } else {
            console.log('❌ FAILURE: No persistent contacts found');
          }
          
        } catch (error) {
          console.error('❌ API Error:', error.message);
        }
        
        // Close connections
        wsAlice.close();
        wsBob.close();
        
        console.log('='.repeat(50));
        
      }, 3000);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
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

quickPersistentTest();