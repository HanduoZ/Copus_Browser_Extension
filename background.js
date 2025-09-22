chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'captureScreenshot') {
    const targetWindowId = message.windowId;

    chrome.tabs.captureVisibleTab(targetWindowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ success: true, dataUrl });
    });

    return true;
  }

  return undefined;
});
