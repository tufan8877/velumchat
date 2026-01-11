#!/usr/bin/env node

/**
 * COMPLETE REAL-TIME TEST - FRONTEND UND BACKEND ZUSAMMEN
 */

const WebSocket = require('ws');

console.log("🔄 COMPLETE REAL-TIME WEBSOCKET TEST");
console.log("=".repeat(60));

async function testCompleteRealTime() {
  try {
    console.log("📡 Step 1: Create WebSocket connection as id2 (receiver)...");
    
    const receiverWs = new WebSocket('ws://localhost:5000/ws');
    let messageReceived = false;
    
    await new Promise((resolve, reject) => {
      receiverWs.onopen = () => {
        console.log("✅ Receiver WebSocket connected");
        // Join as id2 (user 7)
        receiverWs.send(JSON.stringify({
          type: 'join',
          userId: 7
        }));
        console.log("📤 id2 joined WebSocket");
        resolve();
      };
      receiverWs.onerror = reject;
      setTimeout(reject, 5000);
    });
    
    // Listen for incoming messages
    receiverWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📨 RECEIVER GOT:", data.type);
      
      if (data.type === 'new_message') {
        console.log("✅ ✅ ✅ REAL-TIME MESSAGE RECEIVED!");
        console.log("Message:", data.message.content);
        messageReceived = true;
      }
    };
    
    // Wait a moment for connection stability
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("\n📤 Step 2: Send message as id1 via HTTP...");
    const messageContent = "Real-time test " + Date.now();
    
    const response = await fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: 3,
        senderId: 6, // id1
        receiverId: 7, // id2  
        content: messageContent,
        messageType: 'text'
      })
    });
    
    if (response.ok) {
      const message = await response.json();
      console.log("✅ Message sent via HTTP, ID:", message.id);
      
      // Wait for WebSocket delivery
      console.log("\n⏳ Step 3: Waiting 3 seconds for WebSocket delivery...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (messageReceived) {
        console.log("\n🎉 🎉 🎉 SUCCESS: REAL-TIME SYSTEM WORKS!");
        console.log("✅ Nachrichten erscheinen sofort ohne Page Refresh");
      } else {
        console.log("\n❌ ❌ ❌ PROBLEM: WebSocket message not received");
        console.log("💡 This is why page refresh is needed!");
        console.log("🔧 Check: Frontend WebSocket hooks, message handlers");
      }
      
    } else {
      console.log("❌ Failed to send message:", await response.text());
    }
    
    receiverWs.close();
    
    console.log("\n" + "=".repeat(60));
    console.log("🎯 ERGEBNIS:");
    if (messageReceived) {
      console.log("✅ REAL-TIME FUNKTIONIERT - Nachrichten sofort sichtbar");
    } else {
      console.log("❌ REAL-TIME NICHT FUNKTIONIERT - Page Refresh nötig");
      console.log("💡 Frontend WebSocket Hook muss repariert werden");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testCompleteRealTime().catch(console.error);