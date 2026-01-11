/**
 * SESSION PERSISTENCE SYSTEM
 * Ensures user profiles survive even Vite hot reloads and React strict mode
 */

interface UserProfile {
  id: number;
  username: string;
  publicKey: string;
  privateKey: string;
}

class SessionPersistence {
  private static instance: SessionPersistence;
  private profiles: Map<string, UserProfile> = new Map();
  private isInitialized = false;
  
  static getInstance(): SessionPersistence {
    if (!SessionPersistence.instance) {
      SessionPersistence.instance = new SessionPersistence();
    }
    return SessionPersistence.instance;
  }
  
  initialize() {
    if (this.isInitialized) return;
    
    console.log("🔧 Initializing session persistence system...");
    
    // Install global protection immediately
    this.installGlobalProtection();
    
    // Load any existing profiles from all sources
    this.loadExistingProfiles();
    
    // Set up periodic verification
    this.startPeriodicVerification();
    
    this.isInitialized = true;
    console.log("✅ Session persistence system initialized");
  }
  
  private installGlobalProtection() {
    // Protect against all forms of localStorage manipulation
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalGetItem = localStorage.getItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    const originalClear = localStorage.clear.bind(localStorage);
    
    // Enhanced setItem that creates backups
    localStorage.setItem = (key: string, value: string) => {
      if (key === 'user') {
        try {
          const profile = JSON.parse(value);
          console.log(`🛡️ PROTECTION: Storing profile with backups: ${profile.username}`);
          
          // Store in memory
          this.profiles.set(profile.username, profile);
          
          // Store in sessionStorage
          sessionStorage.setItem('user_backup', value);
          
          // Store in cookie with long expiration
          const encoded = btoa(value);
          document.cookie = `whispergram_user=${encoded}; path=/; expires=Fri, 31 Dec 2099 23:59:59 GMT`;
          
          // Store in indexedDB if available
          this.storeInIndexedDB(profile);
          
        } catch (error) {
          console.log("⚠️ Failed to parse user profile for backup");
        }
      }
      return originalSetItem(key, value);
    };
    
    // Enhanced getItem that recovers from backups
    localStorage.getItem = (key: string) => {
      const result = originalGetItem(key);
      
      if (key === 'user' && !result) {
        console.log("🔍 RECOVERY: Profile missing from localStorage, attempting recovery...");
        const recovered = this.recoverProfile();
        if (recovered) {
          console.log(`✅ RECOVERY: Profile recovered: ${recovered.username}`);
          originalSetItem('user', JSON.stringify(recovered));
          return JSON.stringify(recovered);
        }
      }
      
      return result;
    };
    
    // Block removeItem for user profiles
    localStorage.removeItem = (key: string) => {
      if (key === 'user') {
        console.log("🚫 BLOCKED: Attempt to remove user profile");
        return;
      }
      return originalRemoveItem(key);
    };
    
    // Enhanced clear that preserves user profiles
    localStorage.clear = () => {
      console.log("🛡️ PROTECTION: localStorage.clear() called, preserving user profile");
      const userData = originalGetItem('user');
      originalClear();
      if (userData) {
        originalSetItem('user', userData);
        console.log("✅ User profile preserved during clear");
      }
    };
    
    console.log("🛡️ Global localStorage protection installed");
  }
  
  private loadExistingProfiles() {
    // Try to load from localStorage
    const localData = localStorage.getItem('user');
    if (localData) {
      try {
        const profile = JSON.parse(localData);
        this.profiles.set(profile.username, profile);
        console.log(`📋 Loaded existing profile: ${profile.username}`);
      } catch (error) {
        console.log("⚠️ Corrupted localStorage profile");
      }
    }
    
    // Try to load from sessionStorage
    const sessionData = sessionStorage.getItem('user_backup');
    if (sessionData && !localData) {
      try {
        const profile = JSON.parse(sessionData);
        this.profiles.set(profile.username, profile);
        localStorage.setItem('user', sessionData);
        console.log(`📋 Recovered profile from sessionStorage: ${profile.username}`);
      } catch (error) {
        console.log("⚠️ Corrupted sessionStorage profile");
      }
    }
  }
  
  private recoverProfile(): UserProfile | null {
    // Try memory first
    if (this.profiles.size > 0) {
      const profile = Array.from(this.profiles.values())[0];
      console.log(`🔄 Recovered from memory: ${profile.username}`);
      return profile;
    }
    
    // Try sessionStorage
    const sessionData = sessionStorage.getItem('user_backup');
    if (sessionData) {
      try {
        const profile = JSON.parse(sessionData);
        console.log(`🔄 Recovered from sessionStorage: ${profile.username}`);
        return profile;
      } catch (error) {
        console.log("⚠️ sessionStorage recovery failed");
      }
    }
    
    // Try cookies
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith('whispergram_user=')) {
        try {
          const encoded = cookie.substring('whispergram_user='.length);
          const profileData = atob(encoded);
          const profile = JSON.parse(profileData);
          console.log(`🔄 Recovered from cookie: ${profile.username}`);
          return profile;
        } catch (error) {
          console.log("⚠️ Cookie recovery failed");
        }
      }
    }
    
    console.log("❌ No profile recovery source available");
    return null;
  }
  
  private storeInIndexedDB(profile: UserProfile) {
    if (!window.indexedDB) return;
    
    try {
      const request = indexedDB.open('WhispergramProfiles', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'username' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['profiles'], 'readwrite');
        const store = transaction.objectStore('profiles');
        store.put(profile);
        console.log(`💾 Profile stored in IndexedDB: ${profile.username}`);
      };
    } catch (error) {
      console.log("⚠️ IndexedDB storage failed");
    }
  }
  
  private startPeriodicVerification() {
    setInterval(() => {
      const currentProfile = localStorage.getItem('user');
      if (!currentProfile && this.profiles.size > 0) {
        console.log("🚨 Profile disappeared, attempting recovery...");
        const recovered = this.recoverProfile();
        if (recovered) {
          localStorage.setItem('user', JSON.stringify(recovered));
          console.log(`✅ Profile automatically recovered: ${recovered.username}`);
        }
      }
    }, 1000); // Check every second
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  const sessionPersistence = SessionPersistence.getInstance();
  sessionPersistence.initialize();
}

export { SessionPersistence };