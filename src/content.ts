

let enterForNewline = true; // Default value

// Function to load the setting from storage
const loadSetting = () => {
  // Default to 'true' (feature enabled) if no setting is found.
  chrome.storage.sync.get({ enterForNewline: true }, (data) => {
    enterForNewline = data.enterForNewline;
  });
};

// Load the setting when the script is first injected
loadSetting();

// Listen for changes in settings and update the variable
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.enterForNewline) {
    enterForNewline = changes.enterForNewline.newValue;
  }
});

let isComposing = false;

document.addEventListener('compositionstart', () => {
    isComposing = true;
});

document.addEventListener('compositionend', () => {
    isComposing = false;
});

window.addEventListener('keydown', (event) => {
  // Skip if this is an event dispatched by our own script to avoid recursion
  if ((event as any)._isGeminiSparkEvent) {
    return;
  }

  // Only apply custom behavior if the setting is enabled
  if (!enterForNewline) {
    return;
  }

  // Get the active element, traversing shadow DOM if necessary
  let activeElement = document.activeElement;
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }

  if (!activeElement) return;

  const isTextArea = activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT';
  const isContentEditable = activeElement.getAttribute('contenteditable') === 'true' || 
                             (activeElement as HTMLElement).isContentEditable;

  if (isTextArea || isContentEditable) {
    // Send message with Cmd/Ctrl + Enter
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      
      // Helper function to find an element piercing through shadow DOMs
      const findSendButton = (root: Document | ShadowRoot | Element): HTMLElement | null => {
        // Use exact matches or specific attributes to avoid matching buttons that contain user text in aria-label
        const selector = [
          'button.send-button',
          'button.submit-button',
          'button[aria-label="Send message"]',
          'button[aria-label="メッセージを送信"]',
          'button[mattooltip="Send message"]',
          'button[mattooltip="メッセージを送信"]',
          'button[data-testid="send-button"]',
          'button[aria-label="Send"]',
          'button[aria-label="送信"]'
        ].map(sel => sel + ':not([data-test-id="actions-menu-button"])').join(', ');

        let found = root.querySelector(selector) as HTMLElement | null;
        if (found) return found;

        // Iterate over all elements to check their shadow roots
        const allElements = root.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          if (allElements[i].shadowRoot) {
            found = findSendButton(allElements[i].shadowRoot!);
            if (found) return found;
          }
        }
        return null;
      };
      
      const sendButton = findSendButton(document);
      
      if (sendButton && !(sendButton as HTMLButtonElement).disabled) {
        sendButton.click();
      } else {
        // 2. Fallback: Dispatch a PLAIN Enter key event (without Ctrl/Cmd)
        // This tricks the site into thinking a normal Enter was pressed, triggering its native send logic.
        const plainEnterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        (plainEnterEvent as any)._isGeminiSparkEvent = true; // Mark to ignore in our listener
        activeElement.dispatchEvent(plainEnterEvent);
      }
    }
    // Insert a newline with Enter, only when not composing
    else if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      
      if (isTextArea) {
        // For standard TEXTAREA, we manually insert a newline
        const textarea = activeElement as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        textarea.value = value.substring(0, start) + "\n" + value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        
        // Trigger input and change events to let the site know the value changed
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // For rich text area, we dispatch Shift+Enter
        const shiftEnterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true,
            cancelable: true
        });
        (shiftEnterEvent as any)._isGeminiSparkEvent = true;
        activeElement.dispatchEvent(shiftEnterEvent);
      }
    }
  }
}, true);
