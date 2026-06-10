import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

let enterForNewline = true; // Default value
let enableGemikit = true;

const updateGemikitState = () => {
  const container = document.getElementById('gemikit-floating-container');
  if (container) {
    container.style.display = enableGemikit ? '' : 'none';
  }
};

// Function to load the setting from storage
const loadSetting = () => {
  // Default to 'true' (feature enabled) if no setting is found.
  chrome.storage.sync.get({ enterForNewline: true, enableGemikit: true }, (data) => {
    enterForNewline = data.enterForNewline;
    enableGemikit = data.enableGemikit;
    updateGemikitState();
  });
};

// Load the setting when the script is first injected
loadSetting();

// Listen for changes in settings and update the variable
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enterForNewline !== undefined) {
      enterForNewline = changes.enterForNewline.newValue;
    }
    if (changes.enableGemikit !== undefined) {
      enableGemikit = changes.enableGemikit.newValue;
      updateGemikitState();
    }
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
  if (!enableGemikit || !enterForNewline) {
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

/**
 * 📝 Markdownダウンロード機能（Turndownを使用）
 * チャット履歴を一番上まで全件自動読み込みしてからMarkdownとしてダウンロードします。
 */

// 一番上まで自動スクロールして全履歴を読み込む関数
const autoScrollToTop = async (): Promise<void> => {
  // スクロール可能なコンテナを探す
  const getScrollContainer = (): Element => {
    // 1. チャットメッセージの要素を探す
    const message = document.querySelector('message-content, .message-content, [data-message-id], .model-response-text');
    if (message) {
      // 2. 親要素を辿ってスクロール可能なコンテナを見つける
      let parent = message.parentElement;
      while (parent && parent !== document.body) {
        if (parent.scrollHeight > parent.clientHeight) {
          const style = window.getComputedStyle(parent);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') {
            return parent;
          }
        }
        parent = parent.parentElement;
      }
    }
    
    // 3. 見つからなければ documentElement（ページ全体）を返す
    return document.documentElement;
  };

  const container = getScrollContainer();
  const isWindow = container === document.documentElement;

  let lastScrollHeight = container.scrollHeight;
  let scrollAttempts = 0;

  // ローディングオーバーレイの作成
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '99999', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: 'white',
    fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif'
  });
  const loadingHistoryMsg = chrome.i18n.getMessage("loadingHistory") || "過去の履歴を読み込んでいます...";
  const loadingHistorySubMsg = chrome.i18n.getMessage("loadingHistorySub") || "（画面が自動でスクロールされます。このままお待ちください）";
  overlay.innerHTML = `<div style="text-align:center;">${loadingHistoryMsg}<br><span style="font-size:16px;font-weight:normal;opacity:0.8;margin-top:8px;display:block;">${loadingHistorySubMsg}</span></div>`;
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    const scrollInterval = setInterval(() => {
      // 一番上へスクロール
      if (isWindow) {
        window.scrollTo(0, 0);
      } else {
        container.scrollTop = 0;
      }

      // スクロール後のDOM更新を待つ
      setTimeout(() => {
        const newScrollHeight = container.scrollHeight;
        if (newScrollHeight === lastScrollHeight) {
          scrollAttempts++;
          // 4回連続（約4秒）高さが変わらなければ一番上（全件読み込み完了）とみなす
          if (scrollAttempts >= 4) {
            clearInterval(scrollInterval);
            document.body.removeChild(overlay);
            resolve();
          }
        } else {
          // 高さが変わった（追加読み込みされて既存のチャットが下に押し出された）
          lastScrollHeight = newScrollHeight;
          scrollAttempts = 0;
        }
      }, 800); // ネットワーク待機時間を少し長めに
    }, 1500); // スクロール間隔も少し長めに
  });
};

// MD生成・ダウンロード処理
const downloadMD = async () => {
  // 1. まず全件読み込み
  await autoScrollToTop();

  // 2. コンテナの取得
  const element = document.querySelector('chat-window') || 
                  document.querySelector('main') || 
                  document.querySelector('.chat-history') ||
                  document.body;

  // 3. DOMのクローンとサニタイズ（不要なUI要素の除去）
  const clone = element.cloneNode(true) as HTMLElement;
  
  // 「Gemini との会話」「Gemini の回答」という不要な見出し要素や、フッターの注意書きを削除
  clone.querySelectorAll('*').forEach(child => {
      if (child.textContent) {
          const text = child.textContent.trim();
          // 短い完全一致の要素
          if (child.childNodes.length === 1 && (
              text === 'Gemini との会話' || text === 'Gemini の回答' ||
              text === 'Conversation with Gemini' || text === 'Gemini response'
          )) {
              child.remove();
          }
          // 注意書きを含む最下層の要素
          if (child.children.length === 0 && (
              text.includes('Gemini は AI であり、間違えることがあります') || 
              text.includes('Gemini may display inaccurate info')
          )) {
              child.remove();
          }
      }
  });

  // ユーザープロンプトとGeminiの回答を見やすく装飾する
  const userNodes = Array.from(clone.querySelectorAll('user-query, [class*="user-query"], [class*="query-content"], [class*="query-text"], [data-message-author="user"], [data-is-user="true"]'));

  
  // セレクタが複数ヒットして何重にもネストされるのを防ぐため、一番外側の要素だけを抽出
  const topLevelUserNodes = userNodes.filter(node => {
      let parent = node.parentElement;
      while (parent && parent !== clone) {
          if (userNodes.includes(parent)) return false;
          parent = parent.parentElement;
      }
      return true;
  });

  topLevelUserNodes.forEach(node => {
      // 既存の「あなたのプロンプト」という見出し（不可視要素など）があれば削除
      const allChildren = node.querySelectorAll('*');
      allChildren.forEach(child => {
          if (child.childNodes.length === 1 && child.textContent && 
             (child.textContent.trim() === 'あなたのプロンプト' || child.textContent.trim() === 'Your prompt')) {
              child.remove();
          }
      });

      const heading = document.createElement('h2');
      heading.textContent = chrome.i18n.getMessage("yourHeading") || '👤 あなた';
      node.insertBefore(heading, node.firstChild);
      
      // テキストをブロッククオート(引用)で囲んで見やすくする（1階層のみ）
      const blockquote = document.createElement('blockquote');
      // heading以外の要素をすべてblockquoteに移動
      while (node.childNodes.length > 1) {
          blockquote.appendChild(node.childNodes[1]);
      }
      node.appendChild(blockquote);
  });

  const modelNodes = Array.from(clone.querySelectorAll('model-response, [class*="model-response"], [class*="response-content"], [class*="response-text"], [data-message-author="model"], [data-is-model="true"]'));
  const topLevelModelNodes = modelNodes.filter(node => {
      let parent = node.parentElement;
      while (parent && parent !== clone) {
          if (modelNodes.includes(parent)) return false;
          parent = parent.parentElement;
      }
      return true;
  });

  topLevelModelNodes.forEach(node => {
      const heading = document.createElement('h2');
      heading.textContent = chrome.i18n.getMessage("geminiHeading") || '✨ Gemini の回答';
      node.insertBefore(heading, node.firstChild);
  });

  // コピーボタン、音声読み上げ、メニュー、SVGアイコンなどを削除
  // 加えて、プロフィール画像、プロンプト入力エリアも削除
  clone.querySelectorAll(`
    button, svg, nav, header, footer, 
    .hidden, [style*="display: none"], .mat-mdc-menu-panel,
    user-avatar, model-avatar, img[alt*="プロフィール"], img[alt*="Profile"], img.avatar, .avatar-container,
    chat-input, .chat-input, textarea, [contenteditable="true"], rich-textarea
  `).forEach(el => el.remove());

  // 4. TurndownによるMarkdown変換
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  turndownService.use(tables);

  let mdText = turndownService.turndown(clone.innerHTML);

  // タイトルの取得 (ドキュメントタイトルから " - Gemini" などを削除)
  let chatTitle = document.title.replace(/\s*-\s*Gemini.*$/, '');
  if (!chatTitle || chatTitle === 'Gemini' || chatTitle === 'Google Gemini') {
    chatTitle = 'Gemini Chat History';
  }
  
  // 先頭にタイトル（H1）を追加
  mdText = `# ${chatTitle}\n\n` + mdText;

  // 5. ダウンロード実行
  const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // ファイル名に使用できない文字をアンダースコアに置換
  const safeFileName = chatTitle.replace(/[\\/:*?"<>|]/g, '_');
  a.download = `${safeFileName}_${new Date().toISOString().slice(0,10)}.md`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 固定ボタンの注入処理
const injectFloatingButton = () => {
  if (document.getElementById('gemikit-floating-container')) return;

  const style = document.createElement('style');
  style.textContent = `
    #gemikit-floating-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 56px;
      height: 56px;
      background-color: var(--gem-sys-color--surface, #ffffff);
      color: var(--gem-sys-color--on-surface, #1f1f1f);
      border: 1px solid var(--gem-sys-color--outline-variant, #dadce0);
      border-radius: 28px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-sizing: border-box;
      font-family: "Google Sans", Roboto, Arial, sans-serif;
    }
    #gemikit-floating-container:hover {
      width: 280px;
      height: 164px;
      border-radius: 16px;
      background-color: var(--gem-sys-color--surface-container-high, #f8f9fa);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
      transform: translateY(-2px);
    }
    #gemikit-brand-name {
      position: absolute;
      bottom: 18px;
      left: 16px;
      font-size: 16px;
      font-weight: 600;
      color: inherit;
      opacity: 0;
      visibility: hidden;
      transform: translateX(10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    #gemikit-floating-container:hover #gemikit-brand-name {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
      transition-delay: 0.1s; /* メニューの表示タイミングと合わせる */
    }
    #gemikit-fab-icon {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 54px;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #gemikit-fab-icon img {
      width: 28px;
      height: 28px;
      border-radius: 4px;
    }
    #gemikit-menu-panel {
      position: absolute;
      bottom: 54px;
      left: 0;
      width: 100%;
      padding: 12px 0 8px 0;
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px);
      transition: all 0.2s ease;
    }
    #gemikit-floating-container:hover #gemikit-menu-panel {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition-delay: 0.1s;
    }
    .gemikit-menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      background: transparent;
      border: none;
      color: inherit;
      font-family: inherit;
      transition: background-color 0.2s;
      box-sizing: border-box;
      text-align: left;
    }
    .gemikit-menu-item:hover {
      background-color: var(--mat-menu-item-hover-state-layer-color, rgba(0,0,0,0.04));
    }
    .gemikit-menu-item.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .gemikit-menu-item.disabled:hover {
      background-color: transparent;
    }
    .gemikit-menu-item svg {
      margin-right: 12px;
      flex-shrink: 0;
    }
    .gemikit-menu-item input[type="checkbox"] {
      margin-right: 10px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      flex-shrink: 0;
    }
    @media (prefers-color-scheme: dark) {
      #gemikit-floating-container {
        background-color: var(--gem-sys-color--surface, #1e1e1e);
        color: var(--gem-sys-color--on-surface, #e3e3e3);
        border-color: var(--gem-sys-color--outline-variant, #444746);
      }
      #gemikit-floating-container:hover {
        background-color: var(--gem-sys-color--surface-container-high, #2d2f31);
      }
      .gemikit-menu-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      .gemikit-menu-item.disabled:hover {
        background-color: transparent;
      }
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'gemikit-floating-container';

  const iconUrl = chrome.runtime.getURL('images/icon48.png');

  // i18n対応: messages.jsonから各言語の文字列を取得
  const textDownloadMarkdown = chrome.i18n.getMessage("downloadMarkdown") || "Markdown形式でダウンロード";
  const textDisableEnterToSubmit = chrome.i18n.getMessage("disableEnterToSubmit") || "Enterで改行";

  container.innerHTML = `
    <div id="gemikit-menu-panel">
      <button id="gemikit-md-btn" class="gemikit-menu-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
        ${textDownloadMarkdown}
      </button>
      <label class="gemikit-menu-item">
        <input type="checkbox" id="gemikit-enter-checkbox">
        <span>${textDisableEnterToSubmit}</span>
      </label>
    </div>
    <span id="gemikit-brand-name">GemiKit</span>
    <div id="gemikit-fab-icon">
      <img src="${iconUrl}" alt="GemiKit">
    </div>
  `;

  document.body.appendChild(container);

  // MD Download event
  const mdBtn = container.querySelector('#gemikit-md-btn') as HTMLButtonElement;
  mdBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (mdBtn.disabled) return;
    downloadMD().catch(err => {
      console.error('MD Download failed:', err);
      const textDownloadError = chrome.i18n.getMessage("downloadError") || "Markdownの生成中にエラーが発生しました。";
      alert(textDownloadError);
    });
  });

  // MDボタンの活性/非活性状態を更新する関数
  const updateMdButtonState = () => {
    const isNewChat = window.location.pathname === '/app' || window.location.pathname === '/app/';
    const hasChatHistory = document.querySelector('user-query, [class*="user-query"], model-response, [class*="model-response"]') !== null;
    
    if (isNewChat && !hasChatHistory) {
      mdBtn.classList.add('disabled');
      mdBtn.disabled = true;
      mdBtn.title = chrome.i18n.getMessage("disabledInNewChat") || "新規チャット画面では使用できません";
    } else {
      mdBtn.classList.remove('disabled');
      mdBtn.disabled = false;
      mdBtn.title = "";
    }
  };

  // 初期状態の設定
  updateMdButtonState();

  // SPAでの画面遷移やチャット開始を検知してボタンの状態を更新
  let lastPathname = window.location.pathname;
  let lastHistoryCount = 0;
  setInterval(() => {
    const currentPathname = window.location.pathname;
    const currentHistoryCount = document.querySelectorAll('user-query, [class*="user-query"], model-response, [class*="model-response"]').length;
    
    if (currentPathname !== lastPathname || currentHistoryCount !== lastHistoryCount) {
      lastPathname = currentPathname;
      lastHistoryCount = currentHistoryCount;
      updateMdButtonState();
    }
  }, 1000);

  // Checkbox state management
  const checkbox = container.querySelector('#gemikit-enter-checkbox') as HTMLInputElement;
  checkbox.checked = enterForNewline;
  
  checkbox.addEventListener('change', () => {
    enterForNewline = checkbox.checked;
    chrome.storage.sync.set({ enterForNewline: checkbox.checked });
  });

  // Listen for storage changes from the options page
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.enterForNewline !== undefined) {
      checkbox.checked = changes.enterForNewline.newValue;
    }
  });

  // Initial state check for the floating button display
  updateGemikitState();
};

// body要素が構築されるのを待ってからボタンを追加する
const init = () => {
  if (document.body) {
    injectFloatingButton();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectFloatingButton();
    });
  }
};

init();
