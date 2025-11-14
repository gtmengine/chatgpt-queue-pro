// ChatGPT Task Queue - Content Script
// Queues prompts when ChatGPT is responding, auto-sends when ready

console.log('🚀 ChatGPT Queue loaded');

(function() {
  'use strict';

  // ===== STATE =====
  const promptQueue = [];
  let isProcessing = false;
  let queueBadge = null;

  // ===== DOM DETECTION =====

  function isChatGPTResponding() {
    // Enhanced detection for when ChatGPT is actively responding

    // Method 1: Check for "Stop generating" button (most reliable)
    const stopButton = document.querySelector('button[aria-label="Stop generating"]') ||
                      document.querySelector('button[aria-label*="Stop"]') ||
                      document.querySelector('button[aria-label*="stop"]');

    if (stopButton && stopButton.offsetParent !== null) { // Make sure it's visible
      console.log('[QUEUE] ChatGPT responding: Stop button found and visible');
      return true;
    }

    // Method 2: Check button content/text for stop indicators
    const formButtons = document.querySelectorAll('form button:not([disabled])');
    for (const btn of formButtons) {
      const text = (btn.textContent + btn.innerText).toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();

      if (text.includes('stop') || aria.includes('stop') || aria.includes('generating')) {
        console.log('[QUEUE] ChatGPT responding: Stop text found in button');
        return true;
      }

      // Method 3: Check if button has specific SVG that indicates "stop" state
      // When ChatGPT is responding, button might have different SVG than when idle
      const svg = btn.querySelector('svg');
      if (svg) {
        const path = svg.querySelector('path');
        if (path) {
          const pathData = path.getAttribute('d') || '';
          // The "stop" SVG has specific path characteristics
          // Look for the upward arrow path that indicates "stop generating"
          if (pathData.includes('M8.99992 16V6.41407') &&
              pathData.includes('L5.70696 9.70704') &&
              pathData.includes('L15.707 8.29298')) {
            console.log('[QUEUE] ChatGPT responding: Stop SVG detected');
            return true;
          }
        }
      }
    }

    console.log('[QUEUE] ChatGPT idle: No stop indicators found');
    return false;
  }

  function getInputEl() {
    // Try multiple selectors for ChatGPT input field (textarea or contenteditable)
    return (
      // Textarea selectors (legacy)
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('#prompt-textarea') ||
      document.querySelector('form textarea') ||
      document.querySelector('textarea[placeholder*="Message"]') ||
      document.querySelector('textarea[placeholder*="Ask"]') ||
      document.querySelector('textarea') ||
      // Contenteditable selectors (new UI)
      document.querySelector('[contenteditable="true"][data-id="root"]') ||
      document.querySelector('form [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"][placeholder*="Message"]') ||
      document.querySelector('[contenteditable="true"][placeholder*="Ask"]') ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function getSendButton() {
    // 1) Самый надежный вариант - по data-testid
    let btn = document.querySelector('button[data-testid="send-button"]:not([disabled])');
    if (btn && btn.offsetParent !== null) return btn;

    // 2) Фоллбек по aria-label
    const buttons = Array.from(document.querySelectorAll('button'));
    btn = buttons.find(b => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (!aria) return false;
      if (!aria.includes('send') && !aria.includes('отправить')) return false;
      if (b.disabled) return false;
      if (b.offsetParent === null) return false; // скрыта
      return true;
    });

    return btn || null;
  }

  function submitViaForm() {
    const input = getInputEl();
    if (!input) return false;
    const form = input.closest('form');
    if (!form) return false;

    const ev = new Event('submit', { bubbles: true, cancelable: true });
    const result = form.dispatchEvent(ev);
    return result;
  }

  function getInputValue(el) {
    if (!el) return '';
    return el.tagName === 'TEXTAREA' ? el.value : el.textContent;
  }

  function setInputValue(el, value) {
    if (!el) return;

    if (el.tagName === 'TEXTAREA') {
      // Handle textarea elements
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(el, value);
      } else {
        el.value = value;
      }
    } else if (el.contentEditable === 'true') {
      // Handle contenteditable elements
      el.textContent = value;
    } else {
      // Fallback
      el.value = value;
      el.textContent = value;
    }

    // Trigger React's onChange for both types
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('keydown', { bubbles: true, key: 'a' })); // Additional trigger
  }

  // ===== QUEUE SYSTEM =====

  let queuePill = null;
  let queueCard = null;

  function createQueueUI() {
    if (queuePill) return;

    // Find the ChatGPT composer bar to attach the pill
    const composerBar = findComposerBar();
    if (composerBar) {
      createQueuePill(composerBar);
    } else {
      // Fallback: create floating badge like before
      createFallbackBadge();
    }

    createQueueCard();
  }

  function findComposerBar() {
    // Look for the composer container (where the input and buttons are)
    return (
      document.querySelector('[data-testid="composer-container"]') ||
      document.querySelector('.composer-container') ||
      document.querySelector('form') ||
      document.querySelector('.flex.items-end') ||
      document.querySelector('[class*="composer"]') ||
      document.querySelector('[class*="input"]')
    );
  }

  function createQueuePill(container) {
    queuePill = document.createElement('div');
    queuePill.id = 'chatgpt-queue-pill';
    queuePill.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 4px 6px;
      background: rgba(255,255,255,0.95);
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,0.1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 1000;
      display: none;
      backdrop-filter: blur(8px);
    `;

    // Red circular badge with count (like in video)
    const badge = document.createElement('div');
    badge.id = 'queue-badge';
    badge.style.cssText = `
      width: 18px;
      height: 18px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      border: 2px solid white;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    `;

    // Blue checkmark/worker indicator (like in video)
    const checkIcon = document.createElement('div');
    checkIcon.innerHTML = '●'; // Small dot like in video
    checkIcon.style.cssText = `
      color: #3b82f6;
      font-size: 8px;
      font-weight: bold;
      opacity: 0.8;
    `;

    queuePill.appendChild(badge);
    queuePill.appendChild(checkIcon);
    container.style.position = 'relative';
    container.appendChild(queuePill);

    updateQueueUI();
  }

  function createFallbackBadge() {
    // Fallback floating badge (original implementation)
    queuePill = document.createElement('div');
    queuePill.id = 'chatgpt-queue-badge';
    queuePill.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 24px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      background: rgba(0,0,0,0.8);
      border: 1px solid rgba(255,255,255,0.15);
      color: #fff;
      z-index: 999999;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      backdrop-filter: blur(8px);
      display: none;
    `;

    document.body.appendChild(queuePill);
  }

  function createQueueCard() {
    queueCard = document.createElement('div');
    queueCard.id = 'chatgpt-queue-card';
    queueCard.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      background: white;
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      padding: 20px;
      max-width: 320px;
      max-height: 500px;
      overflow-y: auto;
      z-index: 100000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      display: none;
      backdrop-filter: blur(12px);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f0f0f0;
    `;

    const icon = document.createElement('div');
    icon.innerHTML = '📋';
    icon.style.cssText = 'font-size: 16px;';

    const title = document.createElement('div');
    title.textContent = 'Prompt Queue';
    title.style.cssText = `
      font-size: 15px;
      font-weight: 600;
      color: #000000;
    `;

    header.appendChild(icon);
    header.appendChild(title);

    const list = document.createElement('div');
    list.id = 'queue-list';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    queueCard.appendChild(header);
    queueCard.appendChild(list);
    document.body.appendChild(queueCard);
  }

  function updateQueueUI() {
    if (!queuePill) return;

    const count = promptQueue.length;

    if (count === 0) {
      queuePill.style.display = 'none';
      if (queueCard) queueCard.style.display = 'none';
    } else {
      queuePill.style.display = 'flex';
      if (queueCard) queueCard.style.display = 'block';

      // Update badge count
      const badge = queuePill.querySelector('#queue-badge');
      if (badge) {
        badge.textContent = count;
      }

      // Check if user is currently typing
      const input = getInputEl();
      const isUserTyping = input ? getInputValue(input).trim() : false;

      // Update card list with processing status
      if (queueCard) {
        const list = queueCard.querySelector('#queue-list');
        if (list) {
          list.innerHTML = promptQueue.map((prompt, index) => {
            const isProcessingThis = isProcessing && index === 0;
            // Only show "waiting for typing" when ChatGPT is idle and user is actually typing
            // Don't block queue processing with this status
            const isWaitingForTyping = !isProcessing && index === 0 && isUserTyping && !isChatGPTResponding();

            let statusIcon, statusColor, statusBg, statusBorder, statusText;

            if (isWaitingForTyping) {
              statusIcon = '⌨️';
              statusColor = '#3b82f6'; // Blue for typing
              statusBg = '#eff6ff';
              statusBorder = '#3b82f6';
              statusText = 'Waiting for user to finish typing...';
            } else if (isProcessingThis) {
              statusIcon = '⚡';
              statusColor = '#f59e0b'; // Yellow for processing
              statusBg = '#fef3c7';
              statusBorder = '#f59e0b';
              statusText = 'Processing...';
            } else {
              statusIcon = '⏳';
              statusColor = '#6b7280'; // Gray for waiting
              statusBg = '#f8fafc';
              statusBorder = '#e1e5e9';
              statusText = 'Queued';
            }

            return `
              <div class="${isProcessingThis ? 'processing-item' : ''}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: ${statusBg};
                border-radius: 8px;
                border: 1px solid ${statusBorder};
                font-size: 14px;
                color: #000000;
                line-height: 1.4;
                transition: all 0.2s ease;
              ">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: ${statusColor};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 10px;
                  font-weight: 600;
                  flex-shrink: 0;
                ">${index + 1}</div>
                <div style="
                  flex: 1;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  color: #000000 !important;
                  font-weight: 500;
                ">
                  ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}
                </div>
                <div style="
                  color: ${statusColor};
                  font-size: 12px;
                  opacity: 0.8;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                ">
                  <span>${statusIcon}</span>
                  <span style="font-size: 10px;">${statusText}</span>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 48px;
      right: 24px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      background: rgba(0,0,0,0.9);
      color: #fff;
      z-index: 1000000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      backdrop-filter: blur(8px);
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  // ===== QUEUE PROCESSOR =====

  function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  async function processNextPrompt() {
    if (isProcessing) return;
    if (promptQueue.length === 0) return;
    if (isChatGPTResponding()) return;

    // NOTE: Removed user typing check - queue auto-send should work regardless
    // of what's currently in the input field. The queue takes priority.

    isProcessing = true;

    try {
      const next = promptQueue.shift();
      updateQueueUI();
      console.log('[QUEUE] sending from queue:', next);

      const input = getInputEl();
      if (!input) {
        console.warn('[QUEUE] no input, requeue');
        promptQueue.unshift(next);
        updateQueueUI();
        return;
      }

      // 1) Сначала вставляем текст и триггерим input
      setInputValue(input, next);

      // 2) Ждем, пока UI успеет показать кнопку Send
      await sleep(150);

      // 3) Теперь ищем кнопку
      let sendBtn = getSendButton();
      if (!sendBtn || sendBtn.disabled || sendBtn.offsetParent === null) {
        console.warn('[QUEUE] send button not ready, trying form submit');
        if (!submitViaForm()) {
          console.warn('[QUEUE] form submit failed, requeue');
          promptQueue.unshift(next);
          updateQueueUI();
          return;
        }
      } else {
        console.log('[QUEUE] Clicking send button...');
        sendBtn.click();
      }

      // 4) Ждем, пока ChatGPT закончит ответ
      await waitForResponseFinish();

    } catch (err) {
      console.error('[QUEUE] error in processNextPrompt', err);
    } finally {
      isProcessing = false;
      // если в очереди ещё что-то есть и чат свободен - шлем дальше
      if (promptQueue.length && !isChatGPTResponding()) {
        processNextPrompt();
      }
    }
  }

  function waitForResponseFinish(timeoutMs = 300000) { // Increased to 5 minutes
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let consecutiveIdleChecks = 0;
      let checkCount = 0;

      console.log('[QUEUE] Starting to wait for ChatGPT response to finish...');

      function tick() {
        checkCount++;
        const isResponding = isChatGPTResponding();
        const elapsed = Date.now() - start;

        console.log(`[QUEUE] Response check #${checkCount}: isResponding=${isResponding}, elapsed=${Math.round(elapsed/1000)}s`);

        if (!isResponding) {
          consecutiveIdleChecks++;
          console.log(`[QUEUE] ChatGPT appears idle (${consecutiveIdleChecks}/3 consecutive checks)`);

          // Require 3 consecutive idle checks for stability
          if (consecutiveIdleChecks >= 3) {
            console.log('[QUEUE] ChatGPT confirmed idle after 3 consecutive checks - proceeding');
            setTimeout(resolve, 1000); // 1 second grace period
            return;
          }
        } else {
          consecutiveIdleChecks = 0; // Reset if responding again
        }

        if (elapsed > timeoutMs) {
          console.error(`[QUEUE] Timeout waiting for response after ${timeoutMs / 1000} seconds`);
          reject(new Error('Timeout waiting for response'));
          return;
        }

        setTimeout(tick, 1000); // Check every 1 second instead of 500ms
      }

      tick();
    });
  }

  // ===== INPUT INTERCEPTION =====

  function attachInputHandler() {
    const input = getInputEl();
    if (!input) {
      console.log('[QUEUE] No input element found - handler not attached');
      return;
    }

    if (input.dataset.queueAttached === '1') return;

    input.dataset.queueAttached = '1';
    createQueueUI();

    console.log('[QUEUE] Input handler attached to:', input.tagName, input.contentEditable ? '[contenteditable]' : '[textarea]');

    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

      // Get value from textarea or contenteditable
      const value = getInputValue(input).trim();
      if (!value) return;

      // ALWAYS intercept Enter and add to queue
      e.preventDefault(); // Always block native send

      promptQueue.push(value);

      // Clear input field completely and trigger events
      setInputValue(input, '');
      input.value = ''; // Extra clear for textarea
      input.textContent = ''; // Extra clear for contenteditable
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      updateQueueUI();

      const reason = isChatGPTResponding() ? 'busy' : 'idle';
      if (reason === 'busy') {
        showNotification(`✓ Queued (${promptQueue.length}) - ChatGPT is busy`);
      } else {
        showNotification(`✓ Queued (${promptQueue.length})`);
      }

      console.log('[QUEUE] Queued prompt:', value);

      // Try to process the queue immediately if ChatGPT is idle
      if (!isChatGPTResponding() && !isProcessing) {
        setTimeout(processNextPrompt, 100);
      }
    });

    // Listen for input changes - but queue processing now works regardless of input content
    // This listener is mainly for UI updates and potential manual triggers
    input.addEventListener('input', () => {
      updateQueueUI(); // Update UI to reflect any state changes
    });

    console.log('[QUEUE] Input handler attached');
  }

  // ===== OBSERVER =====

  function observeChat() {
    const observer = new MutationObserver(() => {
      attachInputHandler();

      // When ChatGPT becomes idle and there are queued prompts, start processing
      if (!isChatGPTResponding() && promptQueue.length && !isProcessing) {
        setTimeout(processNextPrompt, 500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[QUEUE] Observer started');
  }

  // ===== MESSAGE HANDLING =====

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[QUEUE] Received message:', request);

    if (request.action === 'getStatus') {
      sendResponse({
        queue: promptQueue.slice(), // Copy of queue
        isResponding: isChatGPTResponding(),
        isProcessing: isProcessing
      });

    } else if (request.action === 'clearQueue') {
      promptQueue.length = 0; // Clear queue
      updateQueueUI();
      showNotification('🗑️ Queue cleared');
      sendResponse({ success: true });

    } else if (request.action === 'runPromptChain') {
      if (request.chain && request.chain.trim()) {
        const prompts = request.chain.split('~').map(p => p.trim()).filter(p => p.length > 0);

        if (prompts.length === 0) {
          sendResponse({ success: false, error: 'Empty chain' });
          return;
        }

        // Add all prompts to queue
        promptQueue.push(...prompts);
        updateQueueUI();
        showNotification(`✓ Queued ${prompts.length} prompts`);

        // Try to start processing if ChatGPT is idle
        if (!isChatGPTResponding() && !isProcessing) {
          setTimeout(processNextPrompt, 500);
        }

        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Empty chain' });
      }

    } else if (request.action === 'enqueuePrompt') {
      if (request.prompt && request.prompt.trim()) {
        promptQueue.push(request.prompt.trim());
        updateQueueUI();
        showNotification(`✓ Queued (${promptQueue.length})`);
        // Try to process if ChatGPT is idle
        if (!isChatGPTResponding() && !isProcessing) {
          setTimeout(processNextPrompt, 500);
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Empty prompt' });
      }
    }

    return true; // Keep channel open for async response
  });

  // ===== INITIALIZATION =====

  function init() {
    console.log('[QUEUE] Initializing ChatGPT Queue...');

    // Wait for page to be ready
    setTimeout(() => {
      attachInputHandler();
      observeChat();
      console.log('[QUEUE] ChatGPT Queue ready!');
    }, 1500);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== CSS ANIMATIONS =====
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

})();
