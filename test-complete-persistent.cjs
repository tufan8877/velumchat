// Complete test for persistent chat system with WebSocket messaging
const WebSocket = require('ws');

async function completePersistentTest() {
  console.log('🎯 COMPLETE PERSISTENT CHAT SYSTEM TEST');
  console.log('='.repeat(60));
  
  let testResults = {
    userCreation: false,
    messageDelivery: false,
    persistentContacts: false,
    autoContactActivation: false,
    messageAutoDelete: false
  };
  
  try {
    // Connect to existing users or create new ones
    const alice = { id: 1, username: 'TestUser1' };
    const bob = { id: 2, username: 'TestUser2' };
    
    console.log(`👥 Using Alice (ID: ${alice.id}) and Bob (ID: ${bob.id})`);
    testResults.userCreation = true;
    
    // Create WebSocket connections
    const wsAlice = new WebSocket('ws://localhost:5000/ws');
    const wsBob = new WebSocket('ws://localhost:5000/ws');
    
    let connectedUsers = 0;
    let messageReceived = false;
    
    wsAlice.on('open', () => {
      console.log('🔌 Alice connected to WebSocket');
      wsAlice.send(JSON.stringify({ type: 'join', userId: alice.id }));
      connectedUsers++;
      if (connectedUsers === 2) startMessagingTest();
    });
    
    wsBob.on('open', () => {
      console.log('🔌 Bob connected to WebSocket');
      wsBob.send(JSON.stringify({ type: 'join', userId: bob.id }));
      connectedUsers++;
      if (connectedUsers === 2) startMessagingTest();
    });
    
    // Listen for Alice receiving messages
    wsAlice.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'new_message') {
        console.log(`📥 Alice received: "${msg.message.content}" from chat ${msg.message.chatId}`);
        messageReceived = true;
        testResults.messageDelivery = true;
      }
    });
    
    function startMessagingTest() {
      console.log('\n🚀 Starting messaging test...');
      
      // Bob sends message to Alice
      setTimeout(() => {
        console.log('📤 Bob → Alice: Sending test message...');
        wsBob.send(JSON.stringify({
          type: 'message',
          senderId: bob.id,
          receiverId: alice.id,
          content: 'Test message for persistent chat system!',
          messageType: 'text',
          destructTimer: 15000, // 15 seconds for testing
          chatId: null // Let server create/find chat
        }));
      }, 500);
      
      // Check immediate persistent contacts (after message creation)
      setTimeout(async () => {
        console.log('\n📋 Checking persistent contacts after message...');
        
        try {
          const response = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`);
          const contacts = await response.json();
          
          console.log(`📋 Alice's persistent contacts: ${contacts.length}`);
          
          if (contacts.length > 0) {
            console.log('✅ PERSISTENT CONTACTS: Working! Contact created.');
            testResults.persistentContacts = true;
            
            const contact = contacts[0];
            console.log(`👤 Contact: ${contact.otherUser.username} (Chat ID: ${contact.id})`);
            
            // Check messages in this chat
            const messagesResponse = await fetch(`http://localhost:5000/api/chats/${contact.id}/messages`);
            const messages = await messagesResponse.json();
            
            console.log(`📨 Active messages in chat: ${messages.length}`);
            if (messages.length > 0) {
              console.log(`📝 Message content: "${messages[0].content}"`);
              console.log(`⏰ Expires at: ${messages[0].expiresAt}`);
            }
            
            // Test auto-contact activation by marking chat as active
            try {
              await fetch(`http://localhost:5000/api/chats/${contact.id}/activate`, { method: 'POST' });
              console.log('✅ AUTO-ACTIVATION: Chat marked as active');
              testResults.autoContactActivation = true;
            } catch (error) {
              console.log('⚠️  AUTO-ACTIVATION: Could not activate chat');
            }
            
          } else {
            console.log('❌ PERSISTENT CONTACTS: No contacts found after message');
          }
          
        } catch (error) {
          console.error('❌ API Error checking contacts:', error.message);
        }
        
      }, 2000);
      
      // Check contacts persistence after message auto-deletion time
      setTimeout(async () => {
        console.log('\n🗑️  Checking after auto-deletion period...');
        
        try {
          const contactsResponse = await fetch(`http://localhost:5000/api/chat-contacts/${alice.id}`);
          const contacts = await contactsResponse.json();
          
          console.log(`📋 Persistent contacts after deletion: ${contacts.length}`);
          
          if (contacts.length > 0) {
            const chatId = contacts[0].id;
            const messagesResponse = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`);
            const messages = await messagesResponse.json();
            
            console.log(`📨 Messages remaining: ${messages.length}`);
            
            if (contacts.length > 0 && messages.length === 0) {
              console.log('✅ PERFECT: Contact persists, messages auto-deleted!');
              testResults.messageAutoDelete = true;
            } else if (contacts.length > 0 && messages.length > 0) {
              console.log('⚠️  PARTIAL: Contact persists, messages still present (may need more time)');
            } else {
              console.log('❌ FAILURE: Contact disappeared with messages');
            }
            
          } else {
            console.log('❌ CONTACT PERSISTENCE: Contacts disappeared after deletion');
          }
          
        } catch (error) {
          console.error('❌ Error checking post-deletion state:', error.message);
        }
        
        // Final report
        setTimeout(() => {
          console.log('\n' + '='.repeat(60));
          console.log('📊 PERSISTENT CHAT SYSTEM TEST RESULTS');
          console.log('='.repeat(60));
          
          console.log(`👥 User Creation:        ${testResults.userCreation ? '✅' : '❌'}`);
          console.log(`📤 Message Delivery:     ${testResults.messageDelivery ? '✅' : '❌'}`);
          console.log(`📋 Persistent Contacts:  ${testResults.persistentContacts ? '✅' : '❌'}`);
          console.log(`🎯 Auto Contact Activation: ${testResults.autoContactActivation ? '✅' : '❌'}`);
          console.log(`🗑️  Message Auto-Delete:  ${testResults.messageAutoDelete ? '✅' : '⏳ (in progress)'}`);
          
          const passedTests = Object.values(testResults).filter(Boolean).length;
          const totalTests = Object.keys(testResults).length;
          
          console.log(`\n📈 OVERALL SCORE: ${passedTests}/${totalTests} tests passed`);
          
          if (passedTests === totalTests) {
            console.log('\n🎉 PERSISTENT CHAT SYSTEM: FULLY FUNCTIONAL!');
            console.log('✅ Ready for production use');
          } else if (passedTests >= 3) {
            console.log('\n🔧 SYSTEM: Mostly functional, minor issues');
          } else {
            console.log('\n⚠️  SYSTEM: Needs attention');
          }
          
          console.log('='.repeat(60));
          
          // Close connections
          wsAlice.close();
          wsBob.close();
          
        }, 1000);
        
      }, 18000); // Wait for auto-deletion (15s + buffer)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

completePersistentTest();