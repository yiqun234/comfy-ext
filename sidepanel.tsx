import { useState, useRef, useEffect } from "react"
import html2canvas from "html2canvas"

// 1. 重要：请将这里的示例JSON替换为您自己导出的 workflow_api.json 的内容
const WORKFLOW_JSON = {
  "3": {
    "inputs": {
      "seed": 870674015733204,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": [
        "4",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "4": {
    "inputs": {
      "ckpt_name": "v1-5-pruned-emaonly-fp16.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Checkpoint加载器（简易）"
    }
  },
  "5": {
    "inputs": {
      "width": 512,
      "height": 512,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "空Latent图像"
    }
  },
  "6": {
    "inputs": {
      "text": "masterpiece, best quality, a vision of paradise. unreal engine",
      "clip": [
        "4",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  },
  "7": {
    "inputs": {
      "text": "text, watermark",
      "clip": [
        "4",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "4",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI_Plugin",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  }
};

// ComfyUI服务器地址
const SERVER_ADDRESS = "127.0.0.1:8188";

// 一个简单的图片上传组件，现在增加了截图按钮
function ImageUpload({ title, onImageSelect, selectedImage, onScreenshot }) {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImageSelect(file);
    }
  };

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "4px", padding: "8px", textAlign: "center" }}>
      <p style={{ margin: 0, fontWeight: "bold" }}>{title}</p>
      {selectedImage ? (
        <img src={typeof selectedImage === 'string' ? selectedImage : URL.createObjectURL(selectedImage)} alt="Preview" style={{ width: "100%", height: "auto", marginTop: "8px" }} />
      ) : (
        <p style={{ color: "#888", marginTop: "8px" }}>Upload or Screenshot</p>
      )}
      <div style={{display: "flex", gap: "8px", marginTop: "8px"}}>
        <label htmlFor={`file-upload-${title}`} style={{ cursor: "pointer", display: "block", flex: 1, padding: "8px", border: "1px solid #007bff", color: "#007bff", borderRadius: "4px" }}>
          {selectedImage ? "Change" : "Upload"}
        </label>
        <button onClick={onScreenshot} style={{flex: 1, border: "1px solid #17a2b8", background: "transparent", color: "#17a2b8", borderRadius: "4px"}}>
          Screenshot
        </button>
      </div>
      <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} id={`file-upload-${title}`} />
    </div>
  );
}

// Helper to convert data URL to File object
function dataURLtoFile(dataurl, filename) {
  let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

function IndexSidePanel() {
  const [personImage, setPersonImage] = useState(null);
  const [clothImage, setClothImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ready to generate!");
  const [imageUrl, setImageUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [screenshotTarget, setScreenshotTarget] = useState(null); // 'person' or 'cloth'

  const ws = useRef(null);

  useEffect(() => {
    const messageListener = (message) => {
      if (message.type === "screenshot_ready" && screenshotTarget) {
        console.log("Sidepanel received screenshot data.");
        const file = dataURLtoFile(message.dataUrl, "screenshot.png");
        if (screenshotTarget === 'person') {
          setPersonImage(file);
        } else if (screenshotTarget === 'cloth') {
          setClothImage(file);
        }
        setScreenshotTarget(null); // Reset target
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [screenshotTarget]);

  const handleStartScreenshot = (target) => {
    setScreenshotTarget(target);
    chrome.runtime.sendMessage({ type: "start_screenshot" });
  };

  // 获取图片函数
  const getImage = async (filename, subfolder, folderType) => {
    try {
      const response = await fetch(
        `http://${SERVER_ADDRESS}/view?filename=${encodeURIComponent(
          filename
        )}&subfolder=${encodeURIComponent(
          subfolder
        )}&type=${encodeURIComponent(folderType)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Error fetching image:", error);
      setMessage(`Error fetching image: ${error.message}`);
      return null;
    }
  };

  const listenForImage = (promptId, clientId) => {
    ws.current = new WebSocket(`ws://${SERVER_ADDRESS}/ws?clientId=${clientId}`);

    ws.current.onopen = () => {
      console.log("WebSocket connection established with server.");
      setMessage("Connection open. Waiting for task updates...");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setMessage("Error connecting to server. See console for details.");
      setLoading(false);
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket connection closed:", event.code, event.reason);
      // Only set loading to false on error or success, so we don't prematurely stop.
    };

    ws.current.onmessage = async (event) => {
      console.log("Received WebSocket message:", event.data);
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "status":
          setMessage(`Queue: ${data.data.status.exec_info.queue_remaining}`);
          break;
        
        case "progress":
          const { value, max } = data.data;
          const percentage = Math.round((value / max) * 100);
          setProgress(percentage);
          setMessage(`Processing... ${percentage}%`);
          break;

        case "executed":
          // --- DEBUGGING START ---
          // 检查收到的"executed"消息是否符合我们的预期
          console.log(`Node ${data.data.node} executed. Output exists:`, 'output' in data.data, data.data.output ? 'images' in data.data.output : 'N/A');
          // --- DEBUGGING END ---

          if (data.data.node === "9" && data.data.output.images) {
            setMessage("Image generated! Fetching...");
            const imageData = data.data.output.images[0];
            const url = await getImage(
              imageData.filename,
              imageData.subfolder,
              imageData.type
            );
            if (url) {
              setImageUrl(url);
              setMessage("Done!");
            }
            setLoading(false);
            ws.current.close();
          }
          break;
        
        case "executing":
          // 这个信号是任务完成的最终信号，无论成功与否
          if (data.data.node === null && data.data.prompt_id === promptId) {
            // 检查此时是否已经成功生成了图片。如果没有，说明流程结束但未产出图片。
            if (!imageUrl) {
              setMessage("Task finished, but no image was generated.");
            }
            setLoading(false);
            ws.current.close();
          }
          break;

        default:
          break;
      }
    };
  };

  // 点击生成按钮的处理函数
  const handleGenerate = async () => {
    if (!personImage || !clothImage) {
      setMessage("Please upload both a person and a clothing image.");
      return;
    }
    // The logic for uploading images and modifying the workflow will go here.
    // For now, we'll just log a message.
    console.log("Generate clicked with two images:", personImage.name, clothImage.name);
    setMessage("Image upload and new workflow logic is not implemented yet.");
  };

  async function handleStop() {
    console.log("Sending interrupt request...");
    try {
      const response = await fetch(`http://${SERVER_ADDRESS}/interrupt`, {
        method: "POST"
      });
      if (response.ok) {
        setMessage("Interruption requested.");
        console.log("Interrupt request successful.");
      } else {
        throw new Error(`Failed to interrupt: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Interrupt error:", error);
      setMessage(`Interrupt error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 16,
        width: "100%",
        boxSizing: "border-box",
        gap: "16px",
      }}>
      <h2>Virtual Try-On</h2>
      
      <ImageUpload title="Person Image" onImageSelect={setPersonImage} selectedImage={personImage} onScreenshot={() => handleStartScreenshot('person')} />
      <ImageUpload title="Clothing Image" onImageSelect={setClothImage} selectedImage={clothImage} onScreenshot={() => handleStartScreenshot('cloth')} />

      <div style={{display: "flex", gap: "8px"}}>
        <button onClick={handleGenerate} disabled={loading || !personImage || !clothImage} style={{flex: 1}}>
          Generate
        </button>
        {loading && (
          <button onClick={handleStop} style={{flex: 1, backgroundColor: "#6c757d", color: "white", border: "none"}}>
            Stop
          </button>
        )}
      </div>

      {loading && (
        <div style={{width: "100%"}}>
          <p style={{margin: 0, fontSize: "12px"}}>{message}</p>
          <div style={{backgroundColor: "#eee", borderRadius: 4, overflow: "hidden"}}>
            <div style={{width: `${progress}%`, height: "10px", backgroundColor: "#007bff", transition: "width 0.2s"}}></div>
          </div>
        </div>
      )}

      {!loading && imageUrl && (
        <div>
          <p>Result:</p>
          <img src={imageUrl} alt="Generated result" style={{ width: "100%", height: "auto", borderRadius: "4px" }} />
        </div>
      )}
    </div>
  );
}

export default IndexSidePanel
