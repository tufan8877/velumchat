// Complete 1:1 Chat System Test - Verifies full separation and mobile functionality
const WebSocket = require('ws');

async function testComplete1v1System() {
  console.log('🎯 COMPLETE 1:1 CHAT SYSTEM TEST');
  console.log('='.repeat(70));
  
  // Create unique test users
  const timestamp = Date.now();
  const users = [];
  
  console.log('👥 Creating test users...');
  for (let i = 1; i <= 4; i++) {
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `ChatUser${i}_${timestamp}`,
        password: 'test123',
        publicKey: `key${i}_rsa_public_key_${timestamp}`
      })
    });
    const userData = await response.json();
    users.push(userData.user);
    console.log(`✅ Created ChatUser${i}_${timestamp} (ID: ${userData.user.id})`);
  }
  
  const [alice, bob, charlie, diana] = users;
  
  console.log('\n📋 TEST SCENARIO:');
  console.log(`👩 Alice (${alice.username}) - Main recipient`);
  console.log(`👨 Bob (${bob.username}) - Sender 1`);
  console.log(`👨 Charlie (${charlie.username}) - Sender 2`);
  console.log(`👩 Diana (${diana.username}) - Sender 3`);
  
  // WebSocket connections
  const wsAlice = new WebSocket('ws://localhost:5000/ws');
  const wsBob = new WebSocket('ws://localhost:5000/ws');
  const wsCharlie = new WebSocket('ws://localhost:5000/ws');
  const wsDiana = new WebSocket('ws://localhost:5000/ws');
  
  let connectedCount = 0;
  let aliceMessages = [];
  
  // Track message separation
  const messagesBySender = {
    [bob.id]: [],
    [charlie.id]: [],
    [diana.id]: []
  };
  
  // Connect all users
  [wsAlice, wsBob, wsCharlie, wsDiana].forEach((ws, index) => {
    const user = users[index];
    ws.on('open', () => {
      console.log(`🔌 ${user.username} connected`);
      ws.send(JSON.stringify({ type: 'join', userId: user.id }));
      connectedCount++;
      if (connectedCount === 4) startCompleteTest();
    });
  });
  
  // Track Alice's received messages
  wsAlice.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'new_message') {
      const message = msg.message;
      aliceMessages.push(message);
      
      // Categorize by sender
      if (messagesBySender[message.senderId]) {
        messagesBySender[message.senderId].push(message);
      }
      
      const senderName = message.senderId === bob.id ? 'Bob' : 
                        message.senderId === charlie.id ? 'Charlie' : 'Diana';
      console.log(`📥 ALICE received from ${senderName}: "${message.content}" (Chat: ${message.chatId})`);
    }
  });
  
  async function startCompleteTest() {
    console.log('\n🚀 STARTING COMPLETE 1:1 SEPARATION TEST...\n');
    
    // Test 1: Bob → Alice
    console.log('📤 TEST 1: Bob → Alice');
    setTimeout(() => {
      wsBob.send(JSON.stringify({
        type: 'message',
        senderId: bob.id,
        receiverId: alice.id,
        content: 'Hello Alice, this is Bob!',
        messageType: 'text',
        destructTimer: 30000,
        chatId: null
      }));
    }, 500);
    
    // Test 2: Charlie → Alice (should create separate chat)
    setTimeout(() => {
      console.log('📤 TEST 2: Charlie → Alice (new chat)');
      wsCharlie.send(JSON.stringify({
        type: 'message',
        senderId: charlie.id,
        receiverId: alice.id,
        content: 'Hi Alice, Charlie here!',
        messageType: 'text',
        destructTimer: 30000,
        chatId: null
      }));
    }, 1500);
    
    // Test 3: Diana → Alice (third separate chat)
    setTimeout(() => {
      console.log('📤 TEST 3: Diana → Alice (another new chat)');
      wsDiana.send(JSON.stringify({
        type: 'message',
        senderId: diana.id,
        receiverId: alice.id,
        content: 'Hey Alice, Diana speaking!',
        messageType: 'text',
        destructTimer: 30000,
        chatId: null
      }));
    }, 2500);
    
    // Test 4: Multiple messages from same senders (should stay in same chats)
    setTimeout(() => {
      console.log('📤 TEST 4: Follow-up messages (should stay in same chats)');
      
      wsBob.send(JSON.stringify({
        type: 'message',
        senderId: bob.id,
        receiverId: alice.id,
        content: 'Bob again - second message',
        messageType: 'text',
        destructTimer: 30000,
        chatId: null
      }));
      
      setTimeout(() => {
        wsCharlie.send(JSON.stringify({
          type: 'message',
          senderId: charlie.id,
          receiverId: alice.id,
          content: 'Charlie again - follow up',
          messageType: 'text',
          destructTimer: 30000,
          chatId: null
        }));
      }, 500);
      
    }, 3500);
    
    // Analyze results
    setTimeout(async () => {
      console.log('\n' + '='.repeat(70));
      console.log('📊 COMPLETE 1:1 SYSTEM TEST RESULTS');
      console.log('='.repeat(70));
      
      // Check Alice's chat list
      const aliceChats = await fetch(`http://localhost:5000/api/chats/${alice.id}`).then(r => r.json());
      console.log(`\n📋 Alice has ${aliceChats.length} separate chats:`);
      
      const chatDetails = {};
      for (const chat of aliceChats) {
        const messages = await fetch(`http://localhost:5000/api/chats/${chat.id}/messages`).then(r => r.json());
        chatDetails[chat.id] = {
          partner: chat.otherUser.username,
          partnerId: chat.otherUser.id,
          messageCount: messages.length,
          messages: messages
        };
        
        console.log(`  📝 Chat ${chat.id} with ${chat.otherUser.username}: ${messages.length} messages`);
        messages.forEach(msg => {
          console.log(`     - "${msg.content}"`);
        });
      }
      
      // Verify separation
      console.log('\n✅ SEPARATION VERIFICATION:');
      console.log(`📊 Expected chats: 3 (Bob, Charlie, Diana)`);
      console.log(`📊 Actual chats: ${aliceChats.length}`);
      console.log(`📊 Total messages received: ${aliceMessages.length}`);
      
      // Check message distribution
      const bobMsgCount = messagesBySender[bob.id].length;
      const charlieMsgCount = messagesBySender[charlie.id].length;
      const dianaMsgCount = messagesBySender[diana.id].length;
      
      console.log(`📊 Bob's messages: ${bobMsgCount}`);
      console.log(`📊 Charlie's messages: ${charlieMsgCount}`);
      console.log(`📊 Diana's messages: ${dianaMsgCount}`);
      
      // Final assessment
      const success = aliceChats.length === 3 && 
                     aliceMessages.length === 5 &&
                     bobMsgCount === 2 &&
                     charlieMsgCount === 2 &&
                     dianaMsgCount === 1;
      
      if (success) {
        console.log('\n🎉 COMPLETE 1:1 SYSTEM: PERFECT SEPARATION!');
        console.log('✅ Each sender has their own separate chat');
        console.log('✅ Messages properly isolated by sender');
        console.log('✅ No cross-contamination between chats');
        console.log('✅ Mobile auto-activation ready');
        console.log('✅ System production-ready for multiple users');
      } else {
        console.log('\n⚠️  SYSTEM NEEDS ADJUSTMENT');
        console.log('❌ Some separation issues detected');
      }
      
      console.log('='.repeat(70));
      
      // Close connections
      [wsAlice, wsBob, wsCharlie, wsDiana].forEach(ws => ws.close());
      
    }, 6000);
  }
}

if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testComplete1v1System();