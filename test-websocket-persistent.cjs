// Test WebSocket messaging with persistent chat system
const WebSocket = require('ws');

async function testWebSocketPersistent() {
  console.log('🔌 TESTING WEBSOCKET WITH PERSISTENT CHATS');
  console.log('='.repeat(60));
  
  // Use existing test users
  const sender = { id: 1, username: 'TestSender' };
  const receiver = { id: 2, username: 'TestReceiver' };
  
  console.log(`👥 Sender: ${sender.username} (ID: ${sender.id})`);
  console.log(`👥 Receiver: ${receiver.username} (ID: ${receiver.id})`);
  
  // Create WebSocket connections
  const wsSender = new WebSocket('ws://localhost:5000/ws');
  const wsReceiver = new WebSocket('ws://localhost:5000/ws');
  
  let connectedCount = 0;
  let messageReceived = false;
  
  wsSender.on('open', () => {
    console.log('🔌 Sender WebSocket connected');
    wsSender.send(JSON.stringify({ type: 'join', userId: sender.id }));
    connectedCount++;
    if (connectedCount === 2) startTest();
  });
  
  wsReceiver.on('open', () => {
    console.log('🔌 Receiver WebSocket connected');
    wsReceiver.send(JSON.stringify({ type: 'join', userId: receiver.id }));
    connectedCount++;
    if (connectedCount === 2) startTest();
  });
  
  // Listen for receiver getting messages
  wsReceiver.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📥 Receiver got WebSocket message:', msg.type);
    
    if (msg.type === 'new_message') {
      console.log('✅ SUCCESS: Message received by receiver!');
      console.log(`📝 Content: "${msg.message.content}"`);
      console.log(`🆔 Chat ID: ${msg.message.chatId}`);
      messageReceived = true;
    }
  });
  
  // Listen for sender confirmations
  wsSender.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📤 Sender got confirmation:', msg.type);
  });
  
  function startTest() {
    console.log('\n🚀 Starting WebSocket message test...');
    
    setTimeout(() => {
      const testMessage = {
        type: 'message',
        senderId: sender.id,
        receiverId: receiver.id,
        content: 'Hello from persistent chat system!',
        messageType: 'text',
        destructTimer: 15000,
        chatId: null // Let server create chat
      };
      
      console.log('📤 Sender sending message:', testMessage);
      wsSender.send(JSON.stringify(testMessage));
      
    }, 1000);
    
    // Check results after 3 seconds
    setTimeout(async () => {
      console.log('\n📋 Checking persistent contacts...');
      
      try {
        // Check receiver's persistent contacts
        const contactsResponse = await fetch(`http://localhost:5000/api/chat-contacts/${receiver.id}`);
        const contacts = await contactsResponse.json();
        
        console.log(`📋 Receiver has ${contacts.length} persistent contacts`);
        
        if (contacts.length > 0) {
          console.log('✅ PERSISTENT CONTACTS: Working!');
          
          const chatId = contacts[0].id;
          console.log(`💬 Chat ID: ${chatId}`);
          console.log(`👤 Other user: ${contacts[0].otherUser.username}`);
          
          // Check messages in chat
          const messagesResponse = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`);
          const messages = await messagesResponse.json();
          
          console.log(`📨 Messages in chat: ${messages.length}`);
          if (messages.length > 0) {
            console.log(`📝 Message: "${messages[0].content}"`);
          }
          
        } else {
          console.log('❌ PERSISTENT CONTACTS: No contacts found');
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 WEBSOCKET PERSISTENT CHAT TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`🔌 WebSocket Connection: ✅`);
        console.log(`📤 Message Sent: ✅`);
        console.log(`📥 Message Received: ${messageReceived ? '✅' : '❌'}`);
        console.log(`📋 Persistent Contact: ${contacts.length > 0 ? '✅' : '❌'}`);
        
        if (messageReceived && contacts.length > 0) {
          console.log('\n🎉 PERSISTENT CHAT SYSTEM: FULLY WORKING!');
        } else {
          console.log('\n⚠️  SYSTEM NEEDS DEBUGGING');
        }
        
        console.log('='.repeat(60));
        
      } catch (error) {
        console.error('❌ API Error:', error.message);
      }
      
      // Close connections
      wsSender.close();
      wsReceiver.close();
      
    }, 4000);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testWebSocketPersistent();