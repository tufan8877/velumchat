// Emergency WebSocket fix - run this in browser console
console.log('🚨 EMERGENCY WEBSOCKET FIX');

// Test 1: Basic connection
const testUrl = `ws://${window.location.hostname}:5000/ws`;
console.log('Testing URL:', testUrl);

const ws = new WebSocket(testUrl);

let connected = false;
let hasErrors = false;

ws.onopen = function() {
    connected = true;
    console.log('✅ CONNECTION SUCCESS');
    
    // Send join immediately
    ws.send(JSON.stringify({ type: 'join', userId: 1 }));
    console.log('📤 Join sent');
    
    // Send test message
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'message',
            chatId: 1,
            senderId: 1,
            receiverId: 2,
            content: 'Emergency test message',
            messageType: 'text',
            destructTimer: 10
        }));
        console.log('📤 Test message sent');
    }, 500);
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('📥 RECEIVED:', data.type, data.message?.content || '');
};

ws.onerror = function(error) {
    hasErrors = true;
    console.error('❌ ERROR:', error);
    console.error('Error type:', error.type);
    console.error('Error target:', error.target);
};

ws.onclose = function(event) {
    console.log('🔌 CLOSED:', event.code, event.reason);
};

// Result after 3 seconds
setTimeout(() => {
    if (connected && !hasErrors) {
        console.log('✅ WEBSOCKET WORKS - Problem is in React app');
    } else {
        console.log('❌ WEBSOCKET BROKEN - Server problem');
    }
    ws.close();
}, 3000);