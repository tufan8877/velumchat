// Direct browser WebSocket test - paste this in browser console
console.log('🧪 DIRECT BROWSER WEBSOCKET TEST');

const ws = new WebSocket('ws://localhost:5000/ws');
let connected = false;

ws.onopen = function() {
    connected = true;
    console.log('✅ BROWSER: WebSocket connected successfully');
    
    // Test join
    ws.send(JSON.stringify({ type: 'join', userId: 999 }));
    console.log('📤 BROWSER: Sent join message');
    
    // Test message after 1 second
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'message',
            chatId: 1,
            senderId: 999,
            receiverId: 1,
            content: 'Direct browser test message',
            messageType: 'text',
            destructTimer: 10
        }));
        console.log('📤 BROWSER: Sent chat message');
    }, 1000);
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('📥 BROWSER RECEIVED:', data.type, data.message || '');
};

ws.onerror = function(error) {
    console.error('❌ BROWSER ERROR:', error);
};

ws.onclose = function(event) {
    console.log('🔌 BROWSER CLOSED:', event.code, event.reason);
};

// Auto-close after 5 seconds
setTimeout(() => {
    if (connected) {
        console.log('✅ BROWSER TEST: SUCCESS - WebSocket works in browser');
    } else {
        console.log('❌ BROWSER TEST: FAILED - WebSocket does not work in browser');
    }
    ws.close();
}, 5000);