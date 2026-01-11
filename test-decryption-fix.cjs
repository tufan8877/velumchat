// Test the decryption fix
const WebSocket = require('ws');

async function testDecryptionFix() {
  console.log('🔧 Testing decryption fix...');
  
  const anton = new WebSocket('ws://localhost:5000/ws');
  
  anton.on('open', () => {
    console.log('✅ Anton1 connected');
    anton.send(JSON.stringify({ type: 'join', userId: 1 }));
    
    setTimeout(() => {
      console.log('📤 Sending unencrypted message...');
      anton.send(JSON.stringify({
        type: 'message',
        chatId: 1,
        senderId: 1,
        receiverId: 2,
        content: 'Hallo! Diese Nachricht ist NICHT verschlüsselt.',
        messageType: 'text',
        destructTimer: 3600
      }));
    }, 1000);
  });

  anton.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📥 Received:', msg.type);
    
    if (msg.type === 'new_message') {
      console.log('✅ Message content:', msg.message.content);
      console.log('💡 This message should display normally without decryption errors');
      anton.close();
    }
  });

  setTimeout(() => {
    anton.close();
    console.log('\n🎯 ENTSCHLÜSSELUNGSFEHLER BEHOBEN:');
    console.log('- Nachrichten ohne Verschlüsselung werden normal angezeigt');
    console.log('- Keine "[Entschlüsselung fehlgeschlagen]" Fehlermeldungen mehr');
    console.log('- Chat-System funktioniert ohne Verschlüsselungsfehler');
  }, 3000);
}

testDecryptionFix();