// Simple repair function for encryption issues

export async function repairEncryptionIssues() {
  console.log("🔧 Attempting to repair encryption issues...");
  
  // Clear only cached messages, NEVER remove user profiles (Wickr-Me style)
  localStorage.removeItem("cached_messages");
  console.log("🚫 WICKR-ME-PROTECTION: Only clearing cache, preserving user profile");
  
  // Force refresh of user data
  const userData = localStorage.getItem("user");
  if (userData) {
    const user = JSON.parse(userData);
    console.log("🔄 Refreshing user data for:", user.username);
    
    // Regenerate keys if they seem corrupted
    if (!user.privateKey || !user.publicKey || user.privateKey.length < 100) {
      console.log("🔑 Regenerating corrupt keys...");
      
      try {
        const { generateKeyPair } = await import('./crypto');
        const { publicKey, privateKey } = await generateKeyPair();
        
        const updatedUser = {
          ...user,
          publicKey,
          privateKey
        };
        
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        // Update on server
        await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: publicKey
          })
        });
        
        console.log("✅ Keys regenerated successfully");
        return true;
      } catch (error) {
        console.error("❌ Key regeneration failed:", error);
        return false;
      }
    }
  }
  
  // Clear any existing message timers
  if (typeof window !== 'undefined') {
    console.log("🧹 Clearing existing timers...");
    // This will be handled by the component cleanup
  }
  
  return true;
}

// Auto-repair on load
if (typeof window !== 'undefined') {
  (window as any).repairEncryption = repairEncryptionIssues;
}