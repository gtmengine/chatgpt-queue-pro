# 🚀 ChatGPT Queue Extension

**Queue prompts while ChatGPT is responding. Press Enter to queue, auto-send when ready.**

Based on the ChatGPT conversation analysis, this extension implements the exact queue behavior you described.

---

## 🎯 What It Does

### Core Behavior
- **Enter ALWAYS queues**: Press Enter → prompt goes to queue (input clears)
- **Auto-processing**: Queued prompts send automatically when ChatGPT is ready
- **Sequential execution**: One prompt at a time, waiting for each response

### User Experience
1. Type any prompt → Press Enter
2. Prompt goes to queue (input clears immediately)
3. **Pill appears** in composer bar with red badge count
4. **Side card** shows all queued prompts with status
5. **First item** highlights yellow when processing
6. Extension automatically sends when ChatGPT is ready

---

## 📁 Files Structure

```
chatgpt-queue-extension/
├── manifest.json       # Extension configuration
├── content.js          # Main queue logic (270+ lines)
├── popup.html          # Extension popup UI
├── popup.js            # Popup functionality
├── styles.css          # Visual styles
├── icon16.png         # Extension icons (you need to create)
├── icon48.png
└── icon128.png
```

---

## 🛠️ Installation

### 1. Prepare Icons
You need to create 3 icon files (16x16, 48x48, 128x128 PNGs). You can:
- Use any icon generator online
- Copy from another extension
- Use simple colored squares for testing

### 2. Load Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chatgpt-queue-extension` folder
5. ✅ Extension loaded!

### 3. Test It
1. Go to https://chatgpt.com
2. Type "Hello" → Press Enter (queues immediately)
3. Should see: "✓ Queued (1)" and pill/card appear
4. Extension auto-sends immediately (ChatGPT idle)
5. While ChatGPT responds: Type "How are you?" → Press Enter
6. Should see: "✓ Queued (2) - ChatGPT is busy"
7. Wait for response → "How are you?" auto-sends

---

## 🔧 How It Works (Technical)

### Core Components

#### 1. State Detection
```javascript
function isChatGPTResponding() {
  return !!document.querySelector('button[aria-label="Stop generating"]');
}
```

#### 2. DOM Element Finding
```javascript
function getInputEl() {
  return document.querySelector('textarea[data-id="root"]') ||
         document.querySelector('#prompt-textarea') ||
         document.querySelector('textarea');
}

function getSendButton() {
  const buttons = Array.from(document.querySelectorAll('button'));
  return buttons.find(btn =>
    btn.getAttribute('aria-label')?.includes('send') ||
    btn.querySelector('svg')
  );
}
```

#### 3. Queue System
```javascript
const promptQueue = [];
let isProcessing = false;

// Add to queue
if (isChatGPTResponding()) {
  promptQueue.push(prompt);
  setInputValue(input, ''); // Clear input
}

// Process queue
async function processNextPrompt() {
  if (isProcessing || promptQueue.length === 0) return;
  if (isChatGPTResponding()) return;

  isProcessing = true;
  const next = promptQueue.shift();
  setInputValue(input, next);
  sendBtn.click();

  await waitForResponseFinish(); // Wait for completion
  isProcessing = false;

  // Chain next prompt
  if (promptQueue.length) processNextPrompt();
}
```

#### 4. Input Interception
```javascript
input.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey) return;

  const value = getInputValue(input).trim();
  if (!value) return;

  // ALWAYS intercept Enter and queue
  e.preventDefault(); // Always block native send
  enqueuePrompt(value);
  setInputValue(input, ''); // Clear input

  // Try to send immediately if ChatGPT is idle
  if (!isChatGPTResponding() && !isProcessing) {
    processNextPrompt();
  }
});
```

---

## 🎨 UI Features

### Queue Pill (in Composer Bar)
- **Red circular badge** with number count
- **Blue status dot** below (worker ready)
- Positioned in ChatGPT's input area
- Pulsing animations

### Side Queue Card
- **Floating panel** on right side
- **📋 icon + "Prompt Queue"** header
- **Numbered items** with status indicators
- **Yellow highlight** for currently processing item
- **⏳ waiting** and **⚡ processing** icons

### Status Indicators
- **Red badge**: Queue count
- **Green circles**: Waiting items
- **Yellow/orange**: Currently processing
- **Smooth animations** and transitions

---

## 🔍 Debugging

### Console Logs
Open F12 Console to see:
```
🚀 ChatGPT Queue loaded
[QUEUE] Input handler attached
[QUEUE] Observer started
[QUEUE] Queued prompt: "your prompt"
[QUEUE] Sending from queue: "your prompt"
[QUEUE] Received message: {action: "getStatus"}
```

### Test Commands
In Console:
```javascript
// Check if extension is loaded
!!window.chrome?.runtime?.onMessage

// Check queue status
// (Extension adds global functions for debugging)
```

---

## 🐛 Troubleshooting

### "Extension not loaded"
- Check chrome://extensions/ - is it enabled?
- Reload the extension (click refresh icon)
- Refresh the ChatGPT tab

### "Button not appearing"
- Check Console for errors
- Try: Ctrl+Shift+R (hard refresh)
- Wait 3-5 seconds after page load

### "Queue not working"
- Are you on https://chatgpt.com?
- Is ChatGPT actually responding? (Stop button visible?)
- Check Console for "[QUEUE]" messages

### "Selectors outdated"
ChatGPT changes their UI frequently. If it stops working:

1. Open F12 → Elements tab
2. Find the textarea and send button
3. Update selectors in `getInputEl()` and `getSendButton()`
4. Reload extension

---

## 🎯 Usage Examples

### Basic Queue
1. Type "Explain AI" → Enter (queues immediately)
2. Type "Give examples" → Enter (queues second)
3. Type "Show applications" → Enter (queues third)
4. Extension auto-processes all 3 prompts sequentially

### Research Workflow
```
Research quantum computing~List applications~Compare approaches~Recommend learning path
```

### Content Creation
```
Outline article on [topic]~Write introduction~Develop main points~Create conclusion
```

### Customer Analysis
```
Analyze feedback~Identify pain points~Rate by severity~Suggest solutions
```

---

## 🔧 Customization

### Change Selectors
If ChatGPT UI changes, update these functions in `content.js`:

```javascript
function getInputEl() {
  // Add new selectors here
  return document.querySelector('your-new-selector') ||
         document.querySelector('fallback-selector');
}
```

### Modify Behavior
```javascript
// Change queue limit
if (promptQueue.length > 10) {
  showNotification('Queue full!');
  return;
}

// Always queue (never send immediately)
if (e.key === 'Enter') {
  e.preventDefault();
  enqueuePrompt(value);
}
```

### Add Features
```javascript
// Auto-save queue to storage
chrome.storage.local.set({ queue: promptQueue });

// Keyboard shortcuts
if (e.ctrlKey && e.key === 'q') {
  // Quick queue action
}
```

---

## 📊 Performance

- **Memory**: Minimal (queue stored in memory)
- **CPU**: Low (only watches for DOM changes)
- **Network**: None (all local)
- **Storage**: None (unless you add persistence)

---

## 🔐 Privacy

- ✅ **No data collection**
- ✅ **No external requests**
- ✅ **All processing local**
- ✅ **No analytics**
- ✅ **Open source**

---

## 🎉 Success!

This extension implements the exact queue behavior from your ChatGPT conversation:

- **Enter while busy** → Queues prompt
- **Auto-sends** when ChatGPT finishes
- **Visual feedback** with badges and notifications
- **Popup interface** for monitoring
- **Robust detection** of ChatGPT state

**Time to queue some prompts!** 🚀

---

## 📞 Need Help?

1. **Check Console** (F12) - Look for `[QUEUE]` messages
2. **Test manually** - Try the debug script above
3. **Update selectors** - If UI changed, find new element selectors
4. **Reload extension** - After any code changes

The extension is designed to be resilient to ChatGPT UI changes - the core logic should work even if you need to update the DOM selectors occasionally.
