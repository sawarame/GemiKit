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
  // Only apply custom behavior if the setting is enabled
  if (!enterForNewline) {
    return;
  }

  const richTextArea = document.querySelector('rich-textarea > div[contenteditable="true"]');

  if (richTextArea && richTextArea.contains(document.activeElement)) {
    // Send message with Cmd/Ctrl + Enter
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      
      const sendButton = document.querySelector('button.send-button');
      if (sendButton) {
        (sendButton as HTMLElement).click();
      }
    }
    // Insert a newline with Enter, only when not composing
    else if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      event.stopPropagation();
      
      const shiftEnterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          shiftKey: true,
          bubbles: true,
          cancelable: true
      });
      if (event.target) {
        (event.target as HTMLElement).dispatchEvent(shiftEnterEvent);
      }
    }
  }
}, true);
