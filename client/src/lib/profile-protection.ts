/**
 * WICKR-ME-STYLE PROFILE PROTECTION
 * Prevents localStorage from being cleared and ensures profile persistence
 */

interface UserProfile {
  id: number;
  username: string;
  publicKey: string;
  privateKey: string;
}

class ProfileProtection {
  private static instance: ProfileProtection;
  private profiles: Map<string, UserProfile> = new Map();
  
  static getInstance(): ProfileProtection {
    if (!ProfileProtection.instance) {
      ProfileProtection.instance = new ProfileProtection();
    }
    return ProfileProtection.instance;
  }
  
  // Store profile in multiple locations for maximum persistence
  storeProfile(profile: UserProfile): void {
    console.log("🛡️ WICKR-ME-PROTECTION: Storing profile permanently:", profile.username);
    
    // Store in localStorage
    localStorage.setItem("user", JSON.stringify(profile));
    
    // Store in memory backup
    this.profiles.set(profile.username, profile);
    
    // Store in sessionStorage as backup
    sessionStorage.setItem("user_backup", JSON.stringify(profile));
    
    // Store in cookie as last resort
    document.cookie = `user_profile_${profile.username}=${btoa(JSON.stringify(profile))}; path=/; expires=Fri, 31 Dec 2099 23:59:59 GMT`;
    
    console.log("✅ Profile stored in 4 locations for maximum persistence");
  }
  
  // Retrieve profile from any available source
  retrieveProfile(username?: string): UserProfile | null {
    console.log("🔍 WICKR-ME-RETRIEVAL: Searching for profile...");
    
    // Try localStorage first
    const localData = localStorage.getItem("user");
    if (localData) {
      try {
        const profile = JSON.parse(localData);
        console.log("✅ Found profile in localStorage:", profile.username);
        return profile;
      } catch (error) {
        console.log("⚠️ localStorage profile corrupted");
      }
    }
    
    // Try memory backup
    if (username && this.profiles.has(username)) {
      const profile = this.profiles.get(username)!;
      console.log("✅ Found profile in memory backup:", profile.username);
      // Restore to localStorage
      localStorage.setItem("user", JSON.stringify(profile));
      return profile;
    }
    
    // Try sessionStorage backup
    const sessionData = sessionStorage.getItem("user_backup");
    if (sessionData) {
      try {
        const profile = JSON.parse(sessionData);
        console.log("✅ Found profile in sessionStorage backup:", profile.username);
        // Restore to localStorage
        localStorage.setItem("user", JSON.stringify(profile));
        return profile;
      } catch (error) {
        console.log("⚠️ sessionStorage backup corrupted");
      }
    }
    
    // Try cookie backup
    if (username) {
      const cookieName = `user_profile_${username}=`;
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(cookieName) === 0) {
          try {
            const profileData = cookie.substring(cookieName.length);
            const profile = JSON.parse(atob(profileData));
            console.log("✅ Found profile in cookie backup:", profile.username);
            // Restore to localStorage
            localStorage.setItem("user", JSON.stringify(profile));
            return profile;
          } catch (error) {
            console.log("⚠️ Cookie backup corrupted");
          }
        }
      }
    }
    
    console.log("❌ No profile found in any storage location");
    return null;
  }
  
  // Install protection against localStorage clearing
  installProtection(): void {
    console.log("🛡️ Installing Wickr-Me-style localStorage protection...");
    
    // Override localStorage methods to protect user profiles
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);
    
    localStorage.removeItem = function(key: string) {
      if (key === 'user') {
        console.log("🚫 WICKR-ME-PROTECTION: Blocked attempt to remove user profile");
        return;
      }
      return originalRemoveItem(key);
    };
    
    localStorage.clear = function() {
      console.log("🚫 WICKR-ME-PROTECTION: Blocked localStorage.clear(), preserving profiles");
      // Clear everything except user profile
      const userData = localStorage.getItem('user');
      originalClear();
      if (userData) {
        localStorage.setItem('user', userData);
        console.log("✅ User profile restored after clear attempt");
      }
    };
    
    console.log("✅ localStorage protection installed successfully");
  }
}

export const profileProtection = ProfileProtection.getInstance();

// Auto-install protection when module loads
if (typeof window !== 'undefined') {
  profileProtection.installProtection();
}