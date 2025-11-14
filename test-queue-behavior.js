// Test the new queue behavior - Enter should ALWAYS queue
// Run this in browser console (F12) on https://chatgpt.com

console.log('🧪 TESTING: Enter ALWAYS Queues');
console.log('================================');

// Test 1: Check extension is loaded
console.log('1️⃣ Extension loaded:', !!window.chrome?.runtime?.onMessage);

// Test 2: Check queue UI exists
console.log('2️⃣ Queue UI elements:');
console.log('   Pill:', !!document.getElementById('chatgpt-queue-pill'));
console.log('   Card:', !!document.getElementById('chatgpt-queue-card'));

// Test 3: Simulate Enter key press
function simulateEnter() {
  const input = document.querySelector('[contenteditable="true"]') ||
                document.querySelector('textarea');

  if (!input) {
    console.log('❌ No input found to test');
    return;
  }

  console.log('3️⃣ Simulating Enter press...');

  // Set test value
  if (input.tagName === 'TEXTAREA') {
    input.value = 'Test prompt from debug script';
  } else {
    input.textContent = 'Test prompt from debug script';
  }

  // Trigger input event
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Simulate Enter key
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    bubbles: true
  });

  input.dispatchEvent(enterEvent);

  console.log('✅ Enter key simulated');
  console.log('   Check if prompt was queued and input cleared!');
}

console.log('4️⃣ To test: Run simulateEnter() in console');
console.log('   Or manually type something and press Enter');

window.simulateEnter = simulateEnter;

console.log('================================');
console.log('🎯 EXPECTED BEHAVIOR:');
console.log('- Enter should queue prompt (not send)');
console.log('- Input should clear immediately');
console.log('- Queue count should increase');
console.log('- Notification should appear');
console.log('- If ChatGPT idle, should send immediately');
