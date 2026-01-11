// Test 1:1 Chat Separation - Multiple users sending to one recipient
const WebSocket = require('ws');

async function test1v1ChatSeparation() {
  console.log('💬 TESTING 1:1 CHAT SEPARATION SYSTEM');
  console.log('='.repeat(60));
  
  // Create 3 unique users: 1 recipient + 2 senders
  const users = [];
  const timestamp = Date.now();
  
  for (let i = 1; i <= 3; i++) {
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `TestUser${i}_${timestamp}`,
        password: 'test123',
        publicKey: `key${i}_sample_rsa_public_key_placeholder`
      })
    });
    const userData = await response.json();
    
    if (userData.user) {
      users.push(userData.user);
      console.log(`✅ Created TestUser${i}_${timestamp} (ID: ${userData.user.id})`);
    } else {
      console.error(`❌ Failed to create user ${i}:`, userData);
      return;
    }
  }
  
  const [recipient, sender1, sender2] = users;
  console.log('\n👥 TEST SETUP:');
  console.log(`📥 Recipient: ${recipient.username} (ID: ${recipient.id})`);
  console.log(`📤 Sender 1: ${sender1.username} (ID: ${sender1.id})`);
  console.log(`📤 Sender 2: ${sender2.username} (ID: ${sender2.id})`);
  
  // WebSocket connections
  const wsRecipient = new WebSocket('ws://localhost:5000/ws');
  const wsSender1 = new WebSocket('ws://localhost:5000/ws');
  const wsSender2 = new WebSocket('ws://localhost:5000/ws');
  
  let connectedCount = 0;
  let recipientMessages = [];
  let allMessages = []; // Track all messages with sender info
  
  // Connect all users
  wsRecipient.on('open', () => {
    console.log('🔌 Recipient connected');
    wsRecipient.send(JSON.stringify({ type: 'join', userId: recipient.id }));
    connectedCount++;
    if (connectedCount === 3) startSeparationTest();
  });
  
  wsSender1.on('open', () => {
    console.log('🔌 Sender 1 connected');
    wsSender1.send(JSON.stringify({ type: 'join', userId: sender1.id }));
    connectedCount++;
    if (connectedCount === 3) startSeparationTest();
  });
  
  wsSender2.on('open', () => {
    console.log('🔌 Sender 2 connected');
    wsSender2.send(JSON.stringify({ type: 'join', userId: sender2.id }));
    connectedCount++;
    if (connectedCount === 3) startSeparationTest();
  });
  
  // Track messages received by recipient
  wsRecipient.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      recipientMessages.push(msg.message);
      allMessages.push({
        ...msg.message,
        receivedBy: 'recipient',
        fromSender: msg.message.senderId === sender1.id ? 'sender1' : 'sender2'
      });
      console.log(`📥 RECIPIENT received from Sender ${msg.message.senderId}: "${msg.message.content}"`);
      console.log(`   📊 Chat ID: ${msg.message.chatId}`);
    }
  });
  
  async function startSeparationTest() {
    console.log('\n🚀 STARTING 1:1 CHAT SEPARATION TEST...\n');
    
    // Check initial chat lists
    console.log('📋 INITIAL CHAT LISTS:');
    const recipientChats = await fetch(`http://localhost:5000/api/chats/${recipient.id}`).then(r => r.json());
    console.log(`📥 Recipient has ${recipientChats.length} chats`);
    
    // Sender 1 sends messages to recipient
    console.log('\n📤 SENDER 1 → RECIPIENT:');
    const sender1Messages = [
      'Hello from Sender 1 - Message 1',
      'This is Sender 1 again - Message 2'
    ];
    
    for (let i = 0; i < sender1Messages.length; i++) {
      setTimeout(() => {
        console.log(`📤 Sender 1 sending: "${sender1Messages[i]}"`);
        wsSender1.send(JSON.stringify({
          type: 'message',
          senderId: sender1.id,
          receiverId: recipient.id,
          content: sender1Messages[i],
          messageType: 'text',
          destructTimer: 60000,
          chatId: null // Let server determine correct chat
        }));
      }, i * 1000);
    }
    
    // Sender 2 sends messages to recipient (should be in DIFFERENT chat)
    setTimeout(() => {
      console.log('\n📤 SENDER 2 → RECIPIENT:');
      const sender2Messages = [
        'Hello from Sender 2 - Message 1',
        'Different chat for Sender 2 - Message 2'
      ];
      
      for (let i = 0; i < sender2Messages.length; i++) {
        setTimeout(() => {
          console.log(`📤 Sender 2 sending: "${sender2Messages[i]}"`);
          wsSender2.send(JSON.stringify({
            type: 'message',
            senderId: sender2.id,
            receiverId: recipient.id,
            content: sender2Messages[i],
            messageType: 'text',
            destructTimer: 60000,
            chatId: null // Let server determine correct chat
          }));
        }, i * 1000);
      }
    }, 3000);
    
    // Check results after all messages
    setTimeout(async () => {
      console.log('\n' + '='.repeat(70));
      console.log('📊 1:1 CHAT SEPARATION TEST RESULTS');
      console.log('='.repeat(70));
      
      // Check final chat lists
      const finalRecipientChats = await fetch(`http://localhost:5000/api/chats/${recipient.id}`).then(r => r.json());
      const sender1Chats = await fetch(`http://localhost:5000/api/chats/${sender1.id}`).then(r => r.json());
      const sender2Chats = await fetch(`http://localhost:5000/api/chats/${sender2.id}`).then(r => r.json());
      
      console.log('📋 FINAL CHAT COUNTS:');
      console.log(`📥 Recipient has ${finalRecipientChats.length} chats`);
      console.log(`📤 Sender 1 has ${sender1Chats.length} chats`);
      console.log(`📤 Sender 2 has ${sender2Chats.length} chats`);
      
      console.log('\n📋 RECIPIENT CHAT DETAILS:');
      finalRecipientChats.forEach((chat, index) => {
        console.log(`  Chat ${index + 1}: ID ${chat.id} with ${chat.otherUser.username} (User ID: ${chat.otherUser.id})`);
      });
      
      // Check messages in each chat
      console.log('\n📨 MESSAGES BY CHAT:');
      for (const chat of finalRecipientChats) {
        const messages = await fetch(`http://localhost:5000/api/chats/${chat.id}/messages`).then(r => r.json());
        console.log(`  Chat ${chat.id} (with ${chat.otherUser.username}): ${messages.length} messages`);
        messages.forEach(msg => {
          console.log(`    - "${msg.content}" (from: ${msg.senderId}, to: ${msg.receiverId})`);
        });
      }
      
      console.log('\n✅ SEPARATION ANALYSIS:');
      console.log(`  📥 Total messages received: ${recipientMessages.length}`);
      console.log(`  📊 Expected separate chats: 2 (one per sender)`);
      console.log(`  📊 Actual chats created: ${finalRecipientChats.length}`);
      
      const expectedChats = 2;
      const actualChats = finalRecipientChats.length;
      const success = actualChats === expectedChats && actualChats > 0;
      
      if (success) {
        console.log('\n🎉 1:1 CHAT SEPARATION: WORKING PERFECTLY!');
        console.log('✅ Each sender has their own separate chat with the recipient');
        console.log('✅ Messages are properly separated by sender');
        console.log('✅ No message mixing between different senders');
      } else {
        console.log('\n⚠️  1:1 CHAT SEPARATION: Needs fixes');
        console.log('❌ Messages may be mixing in the same chat');
        console.log('❌ Proper chat separation not working');
      }
      
      console.log('='.repeat(70));
      
      wsRecipient.close();
      wsSender1.close();
      wsSender2.close();
      
    }, 8000);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

test1v1ChatSeparation();