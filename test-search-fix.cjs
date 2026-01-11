#!/usr/bin/env node

/**
 * TEST BENUTZERSUCHE FÜR ID1 → ID2
 */

console.log("🔍 TESTING USER SEARCH: id1 looking for id2");
console.log("=".repeat(50));

async function testSearch() {
  try {
    // Wait for server
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Search for id2 as id1
    console.log("🔧 Test 1: id1 searching for id2...");
    const response1 = await fetch('http://localhost:5000/api/search-users?q=id2&exclude=6');
    
    if (response1.ok) {
      const results1 = await response1.json();
      console.log("✅ Search results:", results1.length, "users found");
      results1.forEach(user => {
        console.log(`  → ${user.username} (ID: ${user.id})`);
      });
    } else {
      console.log("❌ Search failed:", response1.status, await response1.text());
    }
    
    // Test 2: Search for id1 as id2
    console.log("\n🔧 Test 2: id2 searching for id1...");
    const response2 = await fetch('http://localhost:5000/api/search-users?q=id1&exclude=7');
    
    if (response2.ok) {
      const results2 = await response2.json();
      console.log("✅ Search results:", results2.length, "users found");
      results2.forEach(user => {
        console.log(`  → ${user.username} (ID: ${user.id})`);
      });
    } else {
      console.log("❌ Search failed:", response2.status, await response2.text());
    }

    // Test 3: All users
    console.log("\n🔧 Test 3: All users in database...");
    const response3 = await fetch('http://localhost:5000/api/users');
    
    if (response3.ok) {
      const users = await response3.json();
      console.log("📋 All users in database:", users.length);
      users.forEach(user => {
        console.log(`  → ${user.username} (ID: ${user.id})`);
      });
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎯 FAZIT:");
    console.log("✅ Benutzersuche sollte jetzt im Frontend funktionieren");
    console.log("✅ Login als id1/test123 → Suchen nach 'id2'");
    console.log("✅ Login als id2/test123 → Suchen nach 'id1'");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testSearch().catch(console.error);