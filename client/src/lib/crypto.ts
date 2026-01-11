// Real end-to-end encryption using Web Crypto API
export async function generateKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
    };
  } catch (error) {
    console.error("Key generation failed:", error);
    throw new Error("Failed to generate encryption keys");
  }
}

export async function encryptMessage(message: string, publicKeyBase64: string): Promise<string> {
  try {
    console.log("🔒 Encrypting message with public key");
    console.log("📝 Message length:", message.length);
    console.log("🔑 Public key length:", publicKeyBase64.length);
    
    // Validate inputs
    if (!message || !publicKeyBase64) {
      throw new Error("Message and public key are required");
    }
    
    // Clean up public key format - remove whitespace and newlines
    const cleanPublicKey = publicKeyBase64.replace(/\s+/g, '').replace(/\n/g, '');
    
    const publicKeyBuffer = base64ToArrayBuffer(cleanPublicKey);
    const publicKey = await crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["encrypt"]
    );

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const encrypted = await crypto.subtle.encrypt("RSA-OAEP", publicKey, data);
    
    const encryptedBase64 = arrayBufferToBase64(encrypted);
    console.log("✅ Message encrypted successfully");
    
    return encryptedBase64;
  } catch (error) {
    console.error("❌ Encryption failed:", error);
    throw new Error("Failed to encrypt message");
  }
}

export async function decryptMessage(encryptedMessage: string, privateKeyBase64: string): Promise<string> {
  try {
    console.log("🔓 Attempting to decrypt message...");
    console.log("🔍 Encrypted message length:", encryptedMessage.length);
    console.log("🔍 Private key length:", privateKeyBase64.length);
    
    // Validate inputs
    if (!encryptedMessage || !privateKeyBase64) {
      console.error("❌ Missing encrypted message or private key");
      return encryptedMessage; // Return original message instead of error
    }

    // Check if message looks encrypted (base64 format)
    const isEncrypted = encryptedMessage.length > 100 && /^[A-Za-z0-9+/=]+$/.test(encryptedMessage);
    
    if (!isEncrypted) {
      console.log("📝 Message appears to be plain text, returning as-is");
      return encryptedMessage;
    }
    
    console.log("🔓 Processing encrypted message for decryption...");
    
    // Clean up private key format
    const cleanPrivateKey = privateKeyBase64.replace(/\s+/g, '').replace(/\n/g, '');

    const privateKeyBuffer = base64ToArrayBuffer(cleanPrivateKey);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["decrypt"]
    );

    console.log("🔑 Private key imported successfully");

    const encryptedBuffer = base64ToArrayBuffer(encryptedMessage);
    console.log("📥 Encrypted buffer length:", encryptedBuffer.byteLength);
    
    const decrypted = await crypto.subtle.decrypt("RSA-OAEP", privateKey, encryptedBuffer);
    
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decrypted);
    console.log("✅ Message successfully decrypted");
    
    return decryptedText;
  } catch (error) {
    console.error("❌ Decryption failed:", error);
    console.log("⚠️ Returning original message as fallback");
    return encryptedMessage; // Return original message instead of error
  }
}

// Helper functions for base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSecurityFingerprint(publicKey1: string, publicKey2: string): string {
  // Generate a mock security fingerprint for key verification
  const combined = publicKey1 + publicKey2;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Format as groups of 5 digits
  const fingerprint = Math.abs(hash).toString().padStart(10, '0');
  return fingerprint.match(/.{1,5}/g)?.join(' ') || fingerprint;
}
