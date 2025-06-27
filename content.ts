import html2canvas from "html2canvas";

// This is a reconstructed file based on conversation history.
// I apologize for losing the original file due to my own error.

console.log("ComfyUI Ext Content Script Loaded");

let overlay: HTMLDivElement | null = null;

function createOverlay() {
  if (overlay) return;
  
  overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  overlay.style.zIndex = "999999";
  overlay.style.cursor = "crosshair";
  document.body.appendChild(overlay);

  let startX: number, startY: number, selectionBox: HTMLDivElement;

  overlay.onmousedown = (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;

    selectionBox = document.createElement("div");
    selectionBox.style.position = "fixed";
    selectionBox.style.border = "2px dashed #fff";
    selectionBox.style.zIndex = "1000000";
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    document.body.appendChild(selectionBox);

    overlay.onmousemove = (ev) => {
      const x = Math.min(ev.clientX, startX);
      const y = Math.min(ev.clientY, startY);
      const width = Math.abs(ev.clientX - startX);
      const height = Math.abs(ev.clientY - startY);
      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;
    };

    overlay.onmouseup = async () => {
      overlay.onmousemove = null;
      overlay.onmouseup = null;

      const rect = selectionBox.getBoundingClientRect();
      document.body.removeChild(selectionBox);
      removeOverlay();
      
      // A small delay to ensure the overlay is gone before taking the screenshot
      setTimeout(async () => {
        try {
          const canvas = await html2canvas(document.body, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            useCORS: true, // Important for external images
          });
          const dataUrl = canvas.toDataURL("image/png");
          // Send the data URL back to the background script
          chrome.runtime.sendMessage({ type: "screenshot_ready", dataUrl: dataUrl });
        } catch (error) {
          console.error("Error taking screenshot:", error);
        }
      }, 100);
    };
  };
}

function removeOverlay() {
  if (overlay) {
    overlay.onmousedown = null;
    overlay.onmousemove = null;
    overlay.onmouseup = null;
    document.body.removeChild(overlay);
    overlay = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'start_screenshot_from_bg') {
        createOverlay();
    }
});