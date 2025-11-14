// ChatGPT Queue - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');

  // Initialize popup
  updateStatus();
  setupEventListeners();

  // Refresh status on popup open
  setTimeout(updateStatus, 100);
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('run-chain').addEventListener('click', runChain);
  document.getElementById('save-chain').addEventListener('click', saveChain);
  document.getElementById('clear-queue').addEventListener('click', clearQueue);
  document.getElementById('refresh').addEventListener('click', updateStatus);
}

// Update status and queue display
function updateStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    const tab = tabs[0];

    // Check if we're on ChatGPT
    const isChatGPT = tab.url?.includes('chatgpt.com') || tab.url?.includes('chat.openai.com');

    if (!isChatGPT) {
      showStatus('Not on ChatGPT', 'idle');
      return;
    }

    // Send message to content script to get status
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Extension not loaded', 'idle');
        return;
      }

      if (response) {
        updateQueueDisplay(response.queue || []);
        showStatus(response.isResponding ? 'ChatGPT is responding' : 'ChatGPT is idle',
                  response.isResponding ? 'busy' : 'idle');
      } else {
        showStatus('Unable to connect', 'idle');
      }
    });
  });
}

// Show status in UI
function showStatus(text, type) {
  const statusEl = document.getElementById('status');
  const iconEl = document.getElementById('status-icon');
  const textEl = document.getElementById('status-text');

  statusEl.className = `status ${type}`;
  textEl.textContent = text;

  if (type === 'busy') {
    iconEl.textContent = '🔴';
  } else if (type === 'idle') {
    iconEl.textContent = '🟢';
  } else {
    iconEl.textContent = '⚪';
  }
}

// Update queue display
function updateQueueDisplay(queue) {
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const clearButton = document.getElementById('clear-queue');

  queueCount.textContent = queue.length;

  if (queue.length === 0) {
    queueList.innerHTML = '<div class="queue-empty">Queue is empty</div>';
    clearButton.disabled = true;
  } else {
    const items = queue.map((item, index) =>
      `<div class="queue-item">${index + 1}. ${item.substring(0, 60)}${item.length > 60 ? '...' : ''}</div>`
    ).join('');
    queueList.innerHTML = items;
    clearButton.disabled = false;
  }
}

// Clear queue
function clearQueue() {
  if (!confirm('Clear all queued prompts?')) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, { action: 'clearQueue' }, (response) => {
      if (response && response.success) {
        updateStatus();
      }
    });
  });
}

// Run prompt chain
function runChain() {
  const chainText = document.getElementById('prompt-chain').value.trim();

  if (!chainText) {
    alert('Please enter a prompt chain');
    return;
  }

  // Validate chain format
  if (!chainText.includes('~')) {
    const proceed = confirm('No ~ separator found. Do you want to send this as a single prompt?');
    if (!proceed) return;
  }

  // Send to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'runPromptChain',
      chain: chainText
    }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Failed to send chain. Make sure you are on ChatGPT.');
        return;
      }

      if (response && response.success) {
        // Clear the textarea after successful send
        document.getElementById('prompt-chain').value = '';
        // Refresh status to show updated queue
        setTimeout(updateStatus, 500);
      }
    });
  });
}

// Save prompt chain
function saveChain() {
  const chainText = document.getElementById('prompt-chain').value.trim();

  if (!chainText) {
    alert('Please enter a chain to save');
    return;
  }

  const name = prompt('Enter a name for this chain:');
  if (!name || name.trim() === '') return;

  // Load existing chains
  chrome.storage.sync.get(['savedChains'], (result) => {
    const chains = result.savedChains || [];

    // Add new chain
    chains.push({
      name: name.trim(),
      chain: chainText,
      created: new Date().toISOString()
    });

    // Save back
    chrome.storage.sync.set({ savedChains: chains }, () => {
      alert('Chain saved!');
      document.getElementById('prompt-chain').value = '';
    });
  });
}

// Listen for updates from content script
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === 'queueUpdated') {
    updateQueueDisplay(request.queue || []);
  } else if (request.action === 'statusChanged') {
    showStatus(request.isResponding ? 'ChatGPT is responding' : 'ChatGPT is idle',
              request.isResponding ? 'busy' : 'idle');
  }
});
