#!/usr/bin/env node

/**
 * FINAL DEPLOYMENT CHECK - COMPLETE SYSTEM VERIFICATION
 */

const WebSocket = require('ws');

console.log("🚀 FINAL DEPLOYMENT CHECK - COMPLETE SYSTEM VERIFICATION");
console.log("=".repeat(70));

async function finalDeploymentCheck() {
  let totalTests = 0;
  let passedTests = 0;
  
  const testStatus = {
    backend: false,
    websocket: false,
    realtime: false,
    badges: false,
    database: false,
    frontend: false
  };

  try {
    // Test 1: Backend API Health
    totalTests++;
    console.log("\n🔧 TEST 1: Backend API Health Check");
    try {
      const response = await fetch('http://localhost:5000/api/search-users?q=test&exclude=1');
      if (response.ok) {
        console.log("✅ Backend API is running and accessible");
        testStatus.backend = true;
        passedTests++;
      } else {
        console.log(`❌ Backend API error: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Backend API failed: ${error.message}`);
    }

    // Test 2: User Search & Chat System
    totalTests++;
    console.log("\n👥 TEST 2: User Search & Chat Creation");
    try {
      // Search for id2
      const searchResponse = await fetch('http://localhost:5000/api/search-users?q=id2&exclude=6');
      if (searchResponse.ok) {
        const users = await searchResponse.json();
        if (users.length > 0 && users[0].username === 'id2') {
          console.log("✅ User search works: Found id2");
          
          // Test chat creation/retrieval
          const chatResponse = await fetch('http://localhost:5000/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participant1Id: 6, participant2Id: 7 })
          });
          
          if (chatResponse.ok) {
            const chat = await chatResponse.json();
            console.log(`✅ Chat system works: Chat ID ${chat.id}`);
            passedTests++;
          } else {
            console.log("❌ Chat creation failed");
          }
        } else {
          console.log("❌ User search returned no results");
        }
      } else {
        console.log("❌ User search API failed");
      }
    } catch (error) {
      console.log(`❌ User/Chat test failed: ${error.message}`);
    }

    // Test 3: WebSocket Connection
    totalTests++;
    console.log("\n📡 TEST 3: WebSocket Connection");
    let wsConnected = false;
    try {
      const ws = new WebSocket('ws://localhost:5000/ws');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        ws.onopen = () => {
          wsConnected = true;
          clearTimeout(timeout);
          console.log("✅ WebSocket connection established");
          testStatus.websocket = true;
          passedTests++;
          resolve();
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
      
      ws.close();
    } catch (error) {
      console.log(`❌ WebSocket connection failed: ${error.message}`);
    }

    // Test 4: Real-time Messaging
    totalTests++;
    console.log("\n⚡ TEST 4: Real-time Message Delivery");
    let messageReceived = false;
    
    try {
      const receiverWs = new WebSocket('ws://localhost:5000/ws');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket setup timeout'));
        }, 5000);
        
        receiverWs.onopen = () => {
          clearTimeout(timeout);
          // Join as receiver (id2)
          receiverWs.send(JSON.stringify({ type: 'join', userId: 7 }));
          resolve();
        };
        
        receiverWs.onerror = reject;
      });
      
      // Listen for incoming messages
      receiverWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          messageReceived = true;
          console.log(`✅ Real-time message received: "${data.message.content}"`);
          testStatus.realtime = true;
          passedTests++;
        }
      };
      
      // Send test message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const testMessage = `Deployment Check ${Date.now()}`;
      const messageResponse = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: 3,
          senderId: 6,
          receiverId: 7,
          content: testMessage,
          messageType: 'text'
        })
      });
      
      if (messageResponse.ok) {
        console.log(`📤 Test message sent: "${testMessage}"`);
        
        // Wait for real-time delivery
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (!messageReceived) {
          console.log("❌ Real-time message delivery failed");
        }
      } else {
        console.log("❌ Failed to send test message");
      }
      
      receiverWs.close();
      
    } catch (error) {
      console.log(`❌ Real-time test failed: ${error.message}`);
    }

    // Test 5: Badge System
    totalTests++;
    console.log("\n📊 TEST 5: Unread Badge System");
    try {
      const chatsResponse = await fetch('http://localhost:5000/api/chats/7');
      if (chatsResponse.ok) {
        const chats = await chatsResponse.json();
        const chat = chats.find(c => c.id === 3);
        
        if (chat) {
          const unreadCount = chat.unreadCount;
          console.log(`📋 Found chat with unreadCount: ${unreadCount}`);
          
          if (unreadCount > 0) {
            console.log(`✅ Badge system works: ${unreadCount} unread messages`);
            testStatus.badges = true;
            passedTests++;
          } else {
            console.log("⚠️ No unread messages - badge system may need verification");
          }
        } else {
          console.log("❌ Test chat not found");
        }
      } else {
        console.log("❌ Failed to get chat list");
      }
    } catch (error) {
      console.log(`❌ Badge test failed: ${error.message}`);
    }

    // Test 6: Database Persistence
    totalTests++;
    console.log("\n💾 TEST 6: Database Persistence");
    try {
      const messagesResponse = await fetch('http://localhost:5000/api/chats/3/messages?userId=7');
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        console.log(`✅ Database persistence works: ${messages.length} messages stored`);
        testStatus.database = true;
        passedTests++;
      } else {
        console.log("❌ Failed to retrieve messages from database");
      }
    } catch (error) {
      console.log(`❌ Database test failed: ${error.message}`);
    }

    // Test 7: Frontend Access
    totalTests++;
    console.log("\n🎨 TEST 7: Frontend Accessibility");
    try {
      const frontendResponse = await fetch('http://localhost:5000/');
      if (frontendResponse.ok) {
        const content = await frontendResponse.text();
        if (content.includes('Whispergram') || content.includes('vite')) {
          console.log("✅ Frontend is accessible and serving content");
          testStatus.frontend = true;
          passedTests++;
        } else {
          console.log("⚠️ Frontend accessible but content unexpected");
        }
      } else {
        console.log(`❌ Frontend access failed: HTTP ${frontendResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Frontend test failed: ${error.message}`);
    }

    // Final Results
    console.log("\n" + "=".repeat(70));
    console.log("🎯 FINAL DEPLOYMENT CHECK RESULTS");
    console.log("=".repeat(70));
    
    const successRate = Math.round((passedTests / totalTests) * 100);
    console.log(`Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`);
    
    console.log("\n📋 Component Status:");
    Object.entries(testStatus).forEach(([component, status]) => {
      const icon = status ? "✅" : "❌";
      const statusText = status ? "WORKING" : "FAILED";
      console.log(`${icon} ${component.toUpperCase()}: ${statusText}`);
    });
    
    if (passedTests === totalTests) {
      console.log("\n🎉 🎉 🎉 DEPLOYMENT APPROVED! 🎉 🎉 🎉");
      console.log("");
      console.log("✅ All systems operational");
      console.log("✅ Backend API functional");
      console.log("✅ WebSocket real-time working");
      console.log("✅ Badge system functional");
      console.log("✅ Database persistence confirmed");
      console.log("✅ Frontend accessible");
      console.log("");
      console.log("🚀 SYSTEM IS READY FOR PRODUCTION DEPLOYMENT!");
      console.log("🚀 You can safely click DEPLOY now!");
      
    } else {
      console.log("\n❌ ❌ ❌ DEPLOYMENT NOT RECOMMENDED ❌ ❌ ❌");
      console.log("");
      console.log(`⚠️ ${totalTests - passedTests} critical issues detected`);
      console.log("🔧 Please resolve failed tests before deployment");
      console.log("");
      console.log("Critical issues:");
      Object.entries(testStatus).forEach(([component, status]) => {
        if (!status) {
          console.log(`- ${component.toUpperCase()} not working properly`);
        }
      });
    }
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT CHECK FAILED:", error.message);
    console.log("\n🚫 CRITICAL ERROR - DO NOT DEPLOY");
  }
}

finalDeploymentCheck().catch(console.error);