// i18n support
const localize = (id: string, messageName: string) => {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = chrome.i18n.getMessage(messageName);
    }
};

localize('options-title', 'optionsTitle');
localize('label-enable', 'enableGemikit');

const checkbox = document.getElementById('enable-gemikit') as HTMLInputElement;

if (checkbox) {
    // Load saved settings and set the initial state of the checkbox.
    // Default to 'true' (feature enabled) if no setting is found.
    chrome.storage.sync.get({ enableGemikit: true }, (data) => {
        checkbox.checked = data.enableGemikit;
    });

    // When the checkbox is changed, save the new setting.
    checkbox.addEventListener('change', () => {
        chrome.storage.sync.set({ enableGemikit: checkbox.checked });
    });
}
