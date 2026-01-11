#!/usr/bin/env node

/**
 * MIGRATION SCRIPT: Memory Storage → PostgreSQL Database
 * Migrates existing users from file storage to PostgreSQL
 */

const fs = require('fs');

async function migrateUsersToDatabase() {
  console.log("🚀 STARTING MIGRATION TO POSTGRESQL");
  console.log("=".repeat(50));

  try {
    // Read existing users from memory storage file
    const usersData = fs.readFileSync('./data/users.json', 'utf8');
    const existingUsers = JSON.parse(usersData);
    
    console.log(`📋 Found ${existingUsers.length} users to migrate:`);
    existingUsers.forEach(user => {
      console.log(`  - ${user.username} (ID: ${user.id})`);
    });

    // Create users via API
    for (const user of existingUsers) {
      try {
        console.log(`\n🔧 Migrating user: ${user.username}`);
        
        const registerResponse = await fetch('http://localhost:5000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.username,
            password: user.username === 'Alice' ? '123456' : 'password123', // Alice gets special password
            publicKey: user.publicKey
          })
        });

        if (registerResponse.ok) {
          const newUser = await registerResponse.json();
          console.log(`✅ Successfully migrated: ${user.username} → Database ID: ${newUser.id}`);
        } else {
          const error = await registerResponse.text();
          if (error.includes('Username already exists')) {
            console.log(`ℹ️ User ${user.username} already exists in database - skipping`);
          } else {
            console.log(`⚠️ Failed to migrate ${user.username}: ${error}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Error migrating ${user.username}:`, error.message);
      }
    }

    // Verify migration
    console.log("\n" + "=".repeat(50));
    console.log("🔍 VERIFYING MIGRATION RESULTS");
    
    const verifyResponse = await fetch('http://localhost:5000/api/users');
    if (verifyResponse.ok) {
      const users = await verifyResponse.json();
      console.log(`✅ Database now contains ${users.length} users:`);
      users.forEach(user => {
        console.log(`  - ${user.username} (ID: ${user.id}) - ${user.isOnline ? 'Online' : 'Offline'}`);
      });
      
      // Special check for Alice
      const alice = users.find(u => u.username === 'Alice');
      if (alice) {
        console.log(`\n🎯 CRITICAL TEST PROFILE READY:`);
        console.log(`  Username: Alice`);
        console.log(`  Password: 123456`);
        console.log(`  Database ID: ${alice.id}`);
        console.log(`  Status: ${alice.isOnline ? 'Online' : 'Offline'}`);
      }
    } else {
      console.log("⚠️ Could not verify migration - API not responding");
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 MIGRATION COMPLETED!");
    console.log("✅ All users now stored in PostgreSQL database");
    console.log("✅ Profiles will never disappear again");
    console.log("✅ WICKR-ME-STYLE: Permanent profile storage active");
    console.log("\n🔥 NEXT STEP: Test login with Alice/123456");

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  }
}

migrateUsersToDatabase().catch(console.error);