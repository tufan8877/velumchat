#!/usr/bin/env node

/**
 * COMPLETE SYSTEM TEST BEFORE DEPLOYMENT
 * Tests: User search, Chat creation, Real-time messaging, PostgreSQL persistence
 */

const WebSocket = require('ws');

console.log("🚀 COMPLETE SYSTEM TEST BEFORE DEPLOYMENT");
console.log("=".repeat(70));

async function completeSystemTest() {
  let testsPassed = 0;
  let totalTests = 0;
  
  try {
    // Test 1: User Search
    totalTests++;
    console.log("\n📋 TEST 1: User Search (id1 → id2)");
    const searchResponse = await fetch('http://localhost:5000/api/search-users?q=id2&exclude=6');
    
    if (searchResponse.ok) {
      const users = await searchResponse.json();
      if (users.length > 0 && users[0].username === 'id2') {
        console.log("✅ User search works: Found id2");
        testsPassed++;
      } else {
        console.log("❌ User search failed: No results");
      }
    } else {
      console.log("❌ User search API failed");
    }

    // Test 2: Chat Creation
    totalTests++;
    console.log("\n💬 TEST 2: Chat Creation (id1 ↔ id2)");
    const chatResponse = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant1Id: 6, participant2Id: 7 })
    });
    
    let chatId;
    if (chatResponse.ok) {
      const chat = await chatResponse.json();
      chatId = chat.id;
      console.log(`✅ Chat creation works: Chat ID ${chatId}`);
      testsPassed++;
    } else {
      console.log("❌ Chat creation failed");
      return;
    }

    // Test 3: Message Sending via HTTP
    totalTests++;
    console.log("\n📤 TEST 3: Message Sending (HTTP API)");
    const testMessage = `Deployment Test ${Date.now()}`;
    const messageResponse = await fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        senderId: 6,
        receiverId: 7,
        content: testMessage,
        messageType: 'text'
      })
    });
    
    let messageId;
    if (messageResponse.ok) {
      const message = await messageResponse.json();
      messageId = message.id;
      console.log(`✅ Message sending works: Message ID ${messageId}`);
      testsPassed++;
    } else {
      console.log("❌ Message sending failed");
    }

    // Test 4: WebSocket Real-time
    totalTests++;
    console.log("\n📡 TEST 4: WebSocket Real-time Delivery");
    
    let wsConnected = false;
    let messageReceived = false;
    
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 5000);
      
      ws.onopen = () => {
        wsConnected = true;
        clearTimeout(timeout);
        
        // Join as receiver (id2)
        ws.send(JSON.stringify({ type: 'join', userId: 7 }));
        
        // Listen for messages
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            messageReceived = true;
            console.log(`✅ WebSocket real-time works: Received "${data.message.content}"`);
          }
        };
        
        // Send test message after joining
        setTimeout(async () => {
          const wsTestResponse = await fetch('http://localhost:5000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: chatId,
              senderId: 6,
              receiverId: 7,
              content: `WebSocket Test ${Date.now()}`,
              messageType: 'text'
            })
          });
          
          // Wait for WebSocket delivery
          setTimeout(() => {
            resolve();
          }, 2000);
        }, 1000);
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
    
    if (wsConnected && messageReceived) {
      console.log("✅ WebSocket real-time delivery works");
      testsPassed++;
    } else if (wsConnected) {
      console.log("⚠️ WebSocket connected but no message received");
    } else {
      console.log("❌ WebSocket connection failed");
    }
    
    ws.close();

    // Test 5: Message Persistence
    totalTests++;
    console.log("\n💾 TEST 5: Message Persistence (PostgreSQL)");
    const messagesResponse = await fetch(`http://localhost:5000/api/chats/${chatId}/messages?userId=7`);
    
    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();
      if (messages.length >= 2) {
        console.log(`✅ Message persistence works: ${messages.length} messages stored`);
        testsPassed++;
      } else {
        console.log("⚠️ Some messages may not be persisted");
      }
    } else {
      console.log("❌ Message retrieval failed");
    }

    // Test 6: Chat List with Unread Counts
    totalTests++;
    console.log("\n📊 TEST 6: Chat List with Unread Counts");
    const chatsResponse = await fetch(`http://localhost:5000/api/chats/7`); // id2's chats
    
    if (chatsResponse.ok) {
      const chats = await chatsResponse.json();
      if (chats.length > 0) {
        const chat = chats.find(c => c.id === chatId);
        if (chat && chat.otherUser) {
          console.log(`✅ Chat list works: Chat with ${chat.otherUser.username}, unread: ${chat.unreadCount}`);
          testsPassed++;
        } else {
          console.log("⚠️ Chat found but missing otherUser data");
        }
      } else {
        console.log("❌ No chats found for user");
      }
    } else {
      console.log("❌ Chat list retrieval failed");
    }

    // Final Results
    console.log("\n" + "=".repeat(70));
    console.log("🎯 DEPLOYMENT TEST RESULTS");
    console.log("=".repeat(70));
    console.log(`Tests Passed: ${testsPassed}/${totalTests}`);
    console.log(`Success Rate: ${Math.round((testsPassed/totalTests)*100)}%`);
    
    if (testsPassed === totalTests) {
      console.log("\n🎉 🎉 🎉 ALL TESTS PASSED - READY FOR DEPLOYMENT! 🎉 🎉 🎉");
      console.log("");
      console.log("✅ User search works");
      console.log("✅ Chat creation works");
      console.log("✅ Message sending works");
      console.log("✅ WebSocket real-time works");
      console.log("✅ PostgreSQL persistence works");
      console.log("✅ Chat lists with unread counts work");
      console.log("");
      console.log("🚀 SYSTEM IS READY FOR PRODUCTION DEPLOYMENT!");
    } else {
      console.log("\n❌ ❌ ❌ SOME TESTS FAILED - FIX BEFORE DEPLOYMENT ❌ ❌ ❌");
      console.log("");
      console.log("🔧 Issues to fix:");
      if (testsPassed < 1) console.log("- User search not working");
      if (testsPassed < 2) console.log("- Chat creation not working");
      if (testsPassed < 3) console.log("- Message sending not working");
      if (testsPassed < 4) console.log("- WebSocket real-time not working");
      if (testsPassed < 5) console.log("- Message persistence not working");
      if (testsPassed < 6) console.log("- Chat lists not working");
    }
    
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
    console.log("\n🚫 DEPLOYMENT NOT RECOMMENDED - SYSTEM ERRORS DETECTED");
  }
}

completeSystemTest().catch(console.error);