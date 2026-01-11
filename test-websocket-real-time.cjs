#!/usr/bin/env node

/**
 * TEST REAL-TIME WEBSOCKET NACHRICHTEN-ÜBERTRAGUNG
 */

const WebSocket = require('ws');

console.log("🔄 TESTING REAL-TIME WEBSOCKET MESSAGE DELIVERY");
console.log("=".repeat(60));

async function testWebSocketMessaging() {
  try {
    // Wait for server
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Get existing chats for id1 (user 6)
    console.log("📋 Step 1: Getting existing chats for id1...");
    const chatsResponse = await fetch('http://localhost:5000/api/chats/6');
    
    if (chatsResponse.ok) {
      const chats = await chatsResponse.json();
      console.log(`✅ Found ${chats.length} chats for id1`);
      
      if (chats.length > 0) {
        const testChat = chats[0];
        console.log(`🎯 Using chat ${testChat.id} with ${testChat.otherUser?.username}`);
        
        // Test 2: Create WebSocket connection for receiver
        console.log("\n📡 Step 2: Creating WebSocket connection for receiver...");
        const receiverWs = new WebSocket('ws://localhost:5000/ws');
        
        await new Promise((resolve, reject) => {
          receiverWs.onopen = () => {
            console.log("✅ Receiver WebSocket connected");
            // Join as receiver
            receiverWs.send(JSON.stringify({
              type: 'join',
              userId: testChat.otherUser.id
            }));
            resolve();
          };
          receiverWs.onerror = reject;
          setTimeout(reject, 5000);
        });
        
        // Test 3: Send message via HTTP and check WebSocket delivery
        console.log("\n📤 Step 3: Sending message via HTTP...");
        const messageResponse = await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: testChat.id,
            senderId: 6, // id1
            content: 'Real-time test message ' + Date.now(),
            messageType: 'text',
            destructTimer: 300
          })
        });
        
        if (messageResponse.ok) {
          const message = await messageResponse.json();
          console.log("✅ Message sent via HTTP, ID:", message.id);
          
          // Test 4: Wait for WebSocket delivery
          console.log("\n📥 Step 4: Waiting for WebSocket delivery...");
          let messageReceived = false;
          
          receiverWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("📨 WebSocket message received:", data.type);
            if (data.type === 'new_message' && data.message.id === message.id) {
              console.log("✅ REAL-TIME DELIVERY WORKS! Message received instantly");
              messageReceived = true;
            }
          };
          
          // Wait 3 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (!messageReceived) {
            console.log("❌ PROBLEM: Message not received via WebSocket");
            console.log("💡 This explains why page refresh is needed");
          }
          
        } else {
          console.log("❌ Failed to send message:", await messageResponse.text());
        }
        
        receiverWs.close();
        
      } else {
        console.log("❌ No chats found - need to create one first");
      }
      
    } else {
      console.log("❌ Failed to get chats:", await chatsResponse.text());
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎯 DIAGNOSE:");
    console.log("• Wenn WebSocket funktioniert: Nachrichten erscheinen sofort");
    console.log("• Wenn WebSocket nicht funktioniert: Page refresh nötig");
    console.log("• Problem liegt wahrscheinlich im Frontend WebSocket Hook");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testWebSocketMessaging().catch(console.error);