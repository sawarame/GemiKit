const checkbox = document.getElementById('enter-for-newline') as HTMLInputElement;

if (checkbox) {
    // Load saved settings and set the initial state of the checkbox.
    // Default to 'true' (feature enabled) if no setting is found.
    chrome.storage.sync.get({ enterForNewline: true }, (data) => {
        checkbox.checked = data.enterForNewline;
    });

    // When the checkbox is changed, save the new setting.
    checkbox.addEventListener('change', () => {
        chrome.storage.sync.set({ enterForNewline: checkbox.checked });
    });
}
