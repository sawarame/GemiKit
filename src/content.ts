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

document.addEventListener('keydown', (event) => {
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

  const isTextArea = activeElement.tagName === 'TEXTAREA';
  const isContentEditable = activeElement.getAttribute('contenteditable') === 'true' || 
                             (activeElement as HTMLElement).isContentEditable;

  // Check if we are in a relevant input area
  const isNotebookLMInput = isTextArea && activeElement.classList.contains('query-box-input');
  const isGeminiInput = isContentEditable && activeElement.closest('rich-textarea') !== null;
  
  // Generic check for other potential inputs on these domains
  const isOtherInput = isContentEditable || (isTextArea && (
    activeElement.closest('.textarea') !== null || 
    activeElement.closest('notebook-textarea') !== null
  ));

  if (isNotebookLMInput || isGeminiInput || isOtherInput) {
    // Send message with Cmd/Ctrl + Enter
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      
      // 1. Try to find and click the send button
      const sendButton = document.querySelector('button.send-button, button.submit-button, button[aria-label*="Send"], button[aria-label*="送信"]');
      
      if (sendButton && !(sendButton as HTMLButtonElement).disabled) {
        (sendButton as HTMLElement).click();
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
      event.stopPropagation();
      
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
