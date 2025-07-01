// Background script for ComfyUI Extension
// This script manages the side panel behavior.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error)); 