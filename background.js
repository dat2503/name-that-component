// Background service worker: injects the content script on demand and
// toggles picker mode. Nothing here ever makes a network request.

async function activateOnTab(tabId) {
  if (!tabId) return;
  try {
    // Ping first — if the content script is already there, just toggle it.
    const [{ result: alreadyInjected } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.__ntcInjected)
    });

    if (!alreadyInjected) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    }

    await chrome.tabs.sendMessage(tabId, { type: "NTC_TOGGLE_PICKER" });
  } catch (err) {
    // Common cause: chrome:// pages, the Web Store, or other pages
    // extensions are not allowed to run on.
    console.warn("Name That Component: could not activate on this page.", err);
  }
}

chrome.action.onClicked.addListener((tab) => activateOnTab(tab.id));

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-picker") activateOnTab(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "NTC_ACTIVATE_FROM_POPUP") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      activateOnTab(tabs[0]?.id);
    });
    sendResponse({ ok: true });
  }
  return true;
});
