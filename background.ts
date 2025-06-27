// This is a reconstructed file based on conversation history.
// I apologize for losing the original file due to my own error.

// This script runs in the background and manages the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// This is for the screenshot functionality, to pass messages between
// the sidepanel and the content script.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "start_screenshot") {
    // Forward the message to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "start_screenshot_from_bg" });
      }
    });
  } else if (message.type === "screenshot_ready") {
    // Forward the screenshot data from the content script to the sidepanel
    chrome.runtime.sendMessage({ type: "screenshot_ready", dataUrl: message.dataUrl });
  }
  return true; // Keep the message channel open for async response
}); 