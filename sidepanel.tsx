import { useState, useRef, useEffect } from "react"
import html2canvas from "html2canvas"
import WORKFLOW_JSON from "./workflow.json";

// 1. 重要：这个工作流来自 demo.json

// Runpod API 配置
const RUNPOD_API_BASE_URL = "https://api.runpod.ai/v2/v27y22sccjt0kf"; // 端点基础URL
const RUNPOD_API_KEY = process.env.PLASMO_PUBLIC_RUNPOD_API_KEY;

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

// 新增：将File对象转换为Base64字符串的辅助函数
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result); // a data URL: "data:image/png;base64,iVBOR..."
    reader.onerror = error => reject(error);
  });
}

function IndexSidePanel() {
  const [personImage, setPersonImage] = useState(null);
  const [clothImage, setClothImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ready to generate!");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [screenshotTarget, setScreenshotTarget] = useState(null);
  const [jobId, setJobId] = useState(null);
  const pollIntervalRef = useRef(null);
  
  // Helper to stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Process the final result of a job
  const handleJobCompletion = (result) => {
    stopPolling();
    setJobId(null);
    setLoading(false);

    if (result.status === "COMPLETED") {
      const outputImages = result.output?.images;
      if (outputImages && outputImages.length > 0) {
        const urls = outputImages
          .filter(img => img.type === "base64" && img.data)
          .map(img => `data:image/png;base64,${img.data}`);
        
        if (urls.length > 0) {
          setImageUrls(urls);
          setMessage(`Job completed! Displaying ${urls.length} image(s).`);
        } else {
          setMessage("Job completed, but the workflow produced no displayable images.");
        }
      } else {
        setMessage("Job completed, but the workflow produced no images.");
      }
    } else { // FAILED or CANCELLED
      const errorTitle = result.error || "Job failed or was cancelled";
      let errorDetails = `Status: ${result.status}.`;
      if (result.output?.details) {
        errorDetails = result.output.details.join('\\n');
      }
      setMessage(`${errorTitle}\\n\\n${errorDetails}`);
    }
  };

  // Check the status of a running job
  const checkStatus = async (id) => {
    try {
      const response = await fetch(`${RUNPOD_API_BASE_URL}/status/${id}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${RUNPOD_API_KEY}` }
      });

      if (!response.ok) {
        console.error("Polling failed, will retry.", await response.text());
        return; // Don't stop polling on a single failed check
      }

      const result = await response.json();
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(result.status)) {
        handleJobCompletion(result);
      } else if (result.status === "IN_PROGRESS") {
        setMessage(`Job in progress... (Execution time: ${result.executionTime}ms)`);
      } else if (result.status === "IN_QUEUE") {
        setMessage("Job is in queue, waiting for a worker...");
      }
    } catch (error) {
      console.error("Error checking status:", error);
      setMessage(`Error polling status: ${error.message}`);
      stopPolling();
      setLoading(false);
    }
  };

  // Start polling for a job ID
  const startPolling = (id) => {
    stopPolling(); // Ensure no multiple polls are running
    pollIntervalRef.current = setInterval(() => checkStatus(id), 3000);
  };

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

    // Cleanup on component unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      stopPolling();
    };
  }, [screenshotTarget]);

  const handleStartScreenshot = (target) => {
    setScreenshotTarget(target);
    chrome.runtime.sendMessage({ type: "start_screenshot" });
  };

  // 点击生成按钮的处理函数 - 已更新为Runpod /runsync 逻辑
  const handleGenerate = async () => {
    if (!personImage || !clothImage) {
      setMessage("Please upload both a person and a clothing image.");
      return;
    }
    // API密钥已设置，移除此处的检查
    /*
    if (RUNPOD_API_KEY === "PLEASE_REPLACE_WITH_YOUR_RUNPOD_API_KEY") {
      setMessage("错误：请在代码中设置您的 Runpod API 密钥!");
      return;
    }
    */

    setLoading(true);
    setImageUrls([]);
    setJobId(null);
    setMessage("Preparing images and workflow...");

    try {
      // 1. 将图片文件转换为Base64
      const personImageBase64 = await fileToBase64(personImage);
      const clothImageBase64 = await fileToBase64(clothImage);

      // 2. 准备工作流和输入
      // 深拷贝一份工作流以安全地修改
      const workflow = JSON.parse(JSON.stringify(WORKFLOW_JSON));
      
      // 定义图片在工作流中的引用名称
      const personImageFilename = "person_image.png";
      const clothImageFilename = "cloth_image.png";

      // 关键：将工作流中的LoadImage节点的输入指向我们即将上传的图片文件名
      // 节点 "74" 对应人物图片, "75" 对应服装图片
      // workflow["74"].inputs.image = personImageFilename;
      // workflow["75"].inputs.image = clothImageFilename;

      // 3. 构建符合Runpod API规范的请求体
      const body = {
        input: {
          workflow: workflow,
          images: [
            { name: personImageFilename, image: personImageBase64 },
            { name: clothImageFilename, image: clothImageBase64 },
          ]
        }
      };

      setMessage("Sending job to Runpod... This may take a while.");

      // 4. 发送同步请求到 /runsync
      const response = await fetch(`${RUNPOD_API_BASE_URL}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RUNPOD_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      // runsync can fail immediately for bad inputs
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      
      // 5. 处理返回结果
      switch (result.status) {
        case "COMPLETED":
        case "FAILED":
        case "CANCELLED":
          handleJobCompletion(result);
          break;
        case "IN_QUEUE":
          setMessage("Job is in queue, waiting for a worker...");
          setJobId(result.id);
          startPolling(result.id);
          break;
        case "IN_PROGRESS":
          setMessage("Job in progress, starting to poll status...");
          setJobId(result.id);
          startPolling(result.id);
          break;
        default:
          throw new Error(`Unhandled status: ${result.status}. Full response: ${JSON.stringify(result, null, 2)}`);
      }

    } catch (error) {
      console.error("Generation failed:", error);
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  // handleStop to cancel a job
  const handleStop = async () => {
    if (!jobId) return;
    setMessage("Attempting to cancel job...");
    stopPolling(); // Stop polling immediately
    try {
      const response = await fetch(`${RUNPOD_API_BASE_URL}/cancel/${jobId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${RUNPOD_API_KEY}` }
      });
      const result = await response.json();
      // Directly handle the cancellation result
      handleJobCompletion(result);
    } catch(error) {
      console.error("Failed to send cancel request:", error);
      setMessage(`Error cancelling job: ${error.message}`);
      setLoading(false); // Also stop loading on cancel failure
    }
    setJobId(null);
  };

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
          {loading ? "Generating..." : "Generate"}
        </button>
        {loading && jobId && (
          <button onClick={handleStop} style={{flex: 1, backgroundColor: "#6c757d", color: "white", border: "none"}}>
            Stop
          </button>
        )}
      </div>

      {loading && (
        <div style={{width: "100%"}}>
          <p style={{margin: 0, fontSize: "12px"}}>{message}</p>
          <div style={{width: "100%", backgroundColor: "#eee", borderRadius: 4, overflow: "hidden"}}>
            {/* 轮询时，我们可以用一个不确定的动画来表示加载 */}
            <div style={{width: `100%`, height: "10px", backgroundColor: "#007bff", animation: "pulse 2s infinite ease-in-out"}}></div>
          </div>
        </div>
      )}

      {!loading && imageUrls.length > 0 && (
        <div>
          <p>Result:</p>
          {imageUrls.map((url, index) => (
            <img key={index} src={url} alt={`Generated result ${index + 1}`} style={{ width: "100%", height: "auto", borderRadius: "4px", marginBottom: "8px" }} />
          ))}
        </div>
      )}

      {/* 新增：当没有在加载且没有图片时，显示状态或错误信息 */}
      {!loading && imageUrls.length === 0 && (
        <div style={{width: "100%"}}>
          <p style={{margin: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word"}}>{message}</p>
        </div>
      )}
    </div>
  );
}

export default IndexSidePanel
