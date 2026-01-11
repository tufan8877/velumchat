// Debug and repair functions for encryption issues

export async function debugEncryptionKeys() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    console.error("No user data found");
    return;
  }

  const user = JSON.parse(userData);
  console.log("🔑 User encryption keys debug:");
  console.log("User ID:", user.id);
  console.log("Username:", user.username);
  console.log("Has private key:", !!user.privateKey);
  console.log("Has public key:", !!user.publicKey);
  
  if (user.privateKey) {
    console.log("Private key length:", user.privateKey.length);
    console.log("Private key starts with:", user.privateKey.substring(0, 50));
  }
  
  if (user.publicKey) {
    console.log("Public key length:", user.publicKey.length);
    console.log("Public key starts with:", user.publicKey.substring(0, 50));
  }
}

export async function testEncryptionRoundtrip() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    console.error("No user data found");
    return;
  }

  const user = JSON.parse(userData);
  
  try {
    // Test message
    const testMessage = "Hello, this is a test message!";
    console.log("🧪 Testing encryption roundtrip with message:", testMessage);
    
    // Import encrypt/decrypt functions
    const { encryptMessage, decryptMessage } = await import('./crypto');
    
    // Encrypt with public key
    const encrypted = await encryptMessage(testMessage, user.publicKey);
    console.log("✅ Encryption successful, encrypted length:", encrypted.length);
    
    // Decrypt with private key
    const decrypted = await decryptMessage(encrypted, user.privateKey);
    console.log("✅ Decryption result:", decrypted);
    
    if (decrypted === testMessage) {
      console.log("🎉 Encryption roundtrip successful!");
      return true;
    } else {
      console.error("❌ Decryption mismatch!");
      return false;
    }
  } catch (error) {
    console.error("❌ Encryption test failed:", error);
    return false;
  }
}

export async function regenerateUserKeys() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    console.error("No user data found");
    return;
  }

  const user = JSON.parse(userData);
  
  try {
    console.log("🔄 Regenerating keys for user:", user.username);
    
    // Generate new key pair
    const { generateKeyPair } = await import('./crypto');
    const { publicKey, privateKey } = await generateKeyPair();
    
    // Update user object
    const updatedUser = {
      ...user,
      publicKey,
      privateKey
    };
    
    // Save to localStorage
    localStorage.setItem("user", JSON.stringify(updatedUser));
    
    // Update on server
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: publicKey
      })
    });
    
    if (response.ok) {
      console.log("✅ Keys regenerated and updated successfully");
      return true;
    } else {
      console.error("❌ Failed to update keys on server");
      return false;
    }
  } catch (error) {
    console.error("❌ Key regeneration failed:", error);
    return false;
  }
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugEncryption = debugEncryptionKeys;
  (window as any).testEncryption = testEncryptionRoundtrip;
  (window as any).regenerateKeys = regenerateUserKeys;
}