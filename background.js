// Background service worker: injects the MAIN-world bridge + content script
// on demand and toggles picker mode. Nothing here ever makes a network request.

async function ensureScripts(tabId) {
  // Bridge must run in the page's JS world so it can read React fiber / Vue /
  // Angular internals. Content scripts run in an isolated world and cannot.
  const NTC_VERSION = "1.0.0";

  const [{ result: bridgeOk } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (ver) => window.__ntcBridge === ver,
    args: [NTC_VERSION]
  });
  if (!bridgeOk) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["bridge.js"],
      world: "MAIN"
    });
  }

  const [{ result: contentOk } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (ver) => window.__ntcInjected === ver,
    args: [NTC_VERSION]
  });
  if (!contentOk) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

async function activateOnTab(tabId) {
  if (!tabId) return { ok: false, error: "No active tab" };
  try {
    await ensureScripts(tabId);
    await chrome.tabs.sendMessage(tabId, { type: "NTC_TOGGLE_PICKER" });
    return { ok: true };
  } catch (err) {
    // Common cause: chrome:// pages, the Web Store, PDFs, or other pages
    // extensions are not allowed to run on.
    console.warn("Name That Component: could not activate on this page.", err);
    return {
      ok: false,
      error: "Can't run on this page (chrome://, Web Store, and similar pages are blocked)."
    };
  }
}

// Note: chrome.action.onClicked does not fire when default_popup is set.
// Activation goes through the popup message or the keyboard command.

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-picker") activateOnTab(tab?.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "NTC_ACTIVATE_FROM_POPUP") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const result = await activateOnTab(tabs[0]?.id);
      sendResponse(result);
    });
    return true; // async sendResponse
  }
  return false;
});
