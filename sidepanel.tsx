import { useState, useRef, useEffect } from "react"
import WORKFLOW_JSON from "./workflow.json";
import {
  auth,
  db,
  doc,
  setDoc,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "./firebase";
import type { User } from "firebase/auth";
import { Storage } from "@plasmohq/storage";

// 1. 重要：这个工作流来自 demo.json

// Runpod API 配置
const RUNPOD_API_BASE_URL = "https://api.runpod.ai/v2/v27y22sccjt0kf"; // 端点基础URL
const RUNPOD_API_KEY = process.env.PLASMO_PUBLIC_RUNPOD_API_KEY;

// 一个简单的图片上传组件，现在支持粘贴和拖拽功能
function ImageUpload({ title, onImageSelect, selectedImage }) {
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0); // Ref to count drag enter/leave events

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Necessary to allow drop
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0; // Reset counter on drop

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelect(file);
      } else {
        alert("Please drop an image file.");
      }
      e.dataTransfer.clearData();
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], `pasted-image.${type.split('/')[1]}`, { type });
            onImageSelect(file);

            // Show paste success message
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 2000);
            return;
          }
        }
      }
      // If no image is found
      alert('No image found in the clipboard. Please copy an image first.');
    } catch (error) {
      console.error('Paste failed:', error);
      alert('Paste failed. Please make sure an image is copied to the clipboard.');
    }
  };

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${isDragging ? '#28a745' : '#ccc'}`, // Highlight border on drag
    borderRadius: "4px",
    padding: "8px",
    textAlign: "center",
    position: "relative",
    transition: 'border-color 0.2s ease-in-out' // Smooth transition for border color
  };

  return (
    <div
      style={dropZoneStyle}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <p style={{ margin: 0, fontWeight: "bold" }}>{title}</p>
      {selectedImage ? (
        <div style={{ width: "100%", height: "200px", marginTop: "8px", border: "1px solid #ddd", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <img
            src={typeof selectedImage === 'string' ? selectedImage : URL.createObjectURL(selectedImage)}
            alt="Preview"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      ) : (
        <div style={{ width: "100%", height: "200px", marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#888", pointerEvents: "none" }}>Upload, Paste or Drag & Drop Image</p>
        </div>
      )}

      {/* 粘贴成功提示 */}
      {pasteSuccess && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#28a745",
          color: "white",
          padding: "8px 16px",
          borderRadius: "4px",
          fontSize: "14px",
          zIndex: 1000,
          animation: "fadeInOut 2s ease-in-out"
        }}>
          ✓ Pasted!
        </div>
      )}

      <div style={{display: "flex", gap: "8px", marginTop: "8px"}}>
        <label htmlFor={`file-upload-${title}`} style={{ cursor: "pointer", display: "block", flex: 1, padding: "8px", border: "1px solid #007bff", color: "#007bff", borderRadius: "4px" }}>
          {selectedImage ? "Change" : "Upload"}
        </label>
        <button onClick={handlePaste} style={{flex: 1, border: "1px solid #28a745", background: "transparent", color: "#28a745", borderRadius: "4px"}}>
          Paste
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        id={`file-upload-${title}`}
      />
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
  const [user, setUser] = useState<User | null>(null); // To hold user auth state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [personImage, setPersonImage] = useState(null);
  const [clothImage, setClothImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [jobId, setJobId] = useState(null);
  const pollIntervalRef = useRef(null);

  // Listen for auth state changes from Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // 新增: 处理邮箱/密码注册
  const handleRegister = async () => {
    if (!email || !password) {
      setMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // 在 Firestore 中为新用户创建文档
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: userCredential.user.email,
        createdAt: new Date()
      });
      // onAuthStateChanged 会自动处理登录状态
    } catch (error) {
      console.error("Registration failed:", error);
      setMessage(error.message); // 显示Firebase返回的错误信息
    }
    setLoading(false);
  };

  // 新增: 处理邮箱/密码登录
  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged 会自动处理登录状态
    } catch (error) {
      console.error("Sign in failed:", error);
      setMessage(error.message); // 显示Firebase返回的错误信息
    }
    setLoading(false);
  };

  // Handle Google Sign-in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage("Signing in with Google...");

    try {
      // Use chrome.identity API to get access token
      chrome.identity.getAuthToken({
        interactive: true,
        scopes: ['profile', 'email']
      }, async (token) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to get access token:", chrome.runtime.lastError);
          setMessage("Google sign-in failed, please try again");
          setLoading(false);
          return;
        }

        if (!token) {
          setMessage("Unable to get Google access token");
          setLoading(false);
          return;
        }

        try {
          // Create Firebase credential using access token
          const credential = GoogleAuthProvider.credential(null, token);

          // Sign in to Firebase with credential
          const userCredential = await signInWithCredential(auth, credential);

          // Create/update user document in Firestore
          await setDoc(doc(db, "users", userCredential.user.uid), {
            email: userCredential.user.email,
            displayName: userCredential.user.displayName,
            photoURL: userCredential.user.photoURL,
            provider: "google",
            lastLogin: new Date()
          }, { merge: true }); // Use merge to avoid overwriting existing data

          setMessage("Google sign-in successful!");
        } catch (error) {
          console.error("Firebase sign-in failed:", error);
          setMessage(`Sign-in failed: ${error.message}`);
        }

        setLoading(false);
      });
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      setMessage(`Sign-in failed: ${error.message}`);
      setLoading(false);
    }
  };

  // Handle Sign-Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

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
    // Cleanup on component unmount
    return () => {
      stopPolling();
    };
  }, []);

  // 点击生成按钮的处理函数 - 已更新为Runpod /runsync 逻辑
  const handleGenerate = async () => {
    if (!personImage || !clothImage) {
      setMessage("Please upload both a person and a clothing image.");
      return;
    }

    setLoading(true);
    setImageUrls([]);
    setJobId(null);
    setMessage("Preparing images and workflow...");

    try {
      // 1. to Base64
      const personImageBase64 = await fileToBase64(personImage);
      const clothImageBase64 = await fileToBase64(clothImage);

      const workflow = JSON.parse(JSON.stringify(WORKFLOW_JSON));

      const personImageFilename = "person_image.png";
      const clothImageFilename = "cloth_image.png";

      const body = {
        input: {
          workflow: workflow,
          images: [
            { name: personImageFilename, image: personImageBase64 },
            { name: clothImageFilename, image: clothImageBase64 },
          ]
        }
      };

      setMessage("Sending job to Runpod... This may take 10-30 minutes.");

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
          setMessage("Job is in queue, waiting for a worker, This may take 10-30 minutes...");
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

  const handleSaveImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
        .auth-container { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #eee; }
        .user-info { display: flex; align-items: center; gap: 8px; }
        .user-info img { width: 32px; height: 32px; border-radius: 50%; }
        .auth-button { padding: 8px 12px; border: none; border-radius: 4px; color: white; cursor: pointer; }
        .signin-button { background-color: #4285F4; }
        .signout-button { background-color: #6c757d; }
        .form-container { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .form-container input { padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        .form-container button { background-color: #007bff; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; }
        .form-container button:disabled { background-color: #6c757d; }
        .toggle-auth-button { 
          background: none; 
          border: none; 
          color: #007bff; 
          cursor: pointer; 
          margin-top: 8px; 
          text-align: center; 
          padding: 4px;
          font-size: 14px;
        }

        .user-menu-container { position: relative; }
        .user-avatar { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid #ddd; }
        .user-dropdown {
          position: absolute;
          top: 50px;
          right: 0;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 100;
          width: 200px;
          padding: 8px;
        }
        .dropdown-email {
          font-size: 14px;
          color: #333;
          margin: 0;
          padding: 8px;
          border-bottom: 1px solid #eee;
          word-break: break-all;
        }
        .dropdown-signout-button {
          background-color: transparent;
          border: none;
          color: #dc3545;
          padding: 10px 8px;
          width: 100%;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
        }
        .dropdown-signout-button:hover { background-color: #f8f9fa; }
      `}</style>

      <div className="auth-container">
        <h2>Virtual Try-On</h2>
        {user && (
          <div className="user-menu-container" ref={dropdownRef}>
            <img
              src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`}
              alt="User Avatar"
              className="user-avatar"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            />
            {isDropdownOpen && (
              <div className="user-dropdown">
                <p className="dropdown-email">{user.email}</p>
                <button onClick={handleSignOut} className="dropdown-signout-button">Sign Out</button>
              </div>
            )}
          </div>
        )}
      </div>

      {user ? (
        <>
          <ImageUpload title="Person Image" onImageSelect={setPersonImage} selectedImage={personImage} />
          <ImageUpload title="Clothing Image" onImageSelect={setClothImage} selectedImage={clothImage} />

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
                <div style={{width: `100%`, height: "10px", backgroundColor: "#007bff", animation: "pulse 2s infinite ease-in-out"}}></div>
          </div>
        </div>
      )}

          {!loading && imageUrls.length > 0 && (
        <div>
          <p>Result:</p>
              {imageUrls.map((url, index) => (
                <div key={index} style={{ marginBottom: "16px", textAlign: "center" }}>
                  <img src={url} alt={`Generated result ${index + 1}`} style={{ width: "100%", height: "auto", borderRadius: "4px", marginBottom: "8px" }} />
                  <button
                    onClick={() => handleSaveImage(url, `result-${index + 1}.png`)}
                    style={{padding: "8px 16px", border: "1px solid #007bff", color: "#007bff", borderRadius: "4px", background: "transparent", cursor: "pointer"}}
                  >
                    Save Image
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && imageUrls.length === 0 && (
            <div style={{width: "100%"}}>
              <p style={{margin: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word"}}>{message}</p>
            </div>
          )}
        </>
      ) : (
        <div className="form-container">
          <h3>{isRegistering ? "Register New Account" : "Sign In"}</h3>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isRegistering ? "new-password" : "current-password"}
          />
          <button onClick={isRegistering ? handleRegister : handleEmailSignIn} disabled={loading}>
            {loading ? "..." : (isRegistering ? "Register" : "Sign In")}
          </button>

          <div style={{
            display: "flex",
            alignItems: "center",
            margin: "16px 0",
            textAlign: "center"
          }}>
            <div style={{flex: 1, height: "1px", backgroundColor: "#ddd"}}></div>
            <span style={{margin: "0 16px", color: "#666", fontSize: "14px"}}>or</span>
            <div style={{flex: 1, height: "1px", backgroundColor: "#ddd"}}></div>
          </div>

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              backgroundColor: "#4285F4",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" style={{fill: "white"}}>
              <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.53H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path d="M4.5 10.49a4.8 4.8 0 0 1 0-3.07V5.35H1.83a8 8 0 0 0 0 7.28l2.67-2.14z"/>
              <path d="M8.98 4.72c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.35L4.5 7.42a4.77 4.77 0 0 1 4.48-2.7z"/>
            </svg>
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>
          <button onClick={() => setIsRegistering(!isRegistering)} className="toggle-auth-button">
            {isRegistering ? "Already have an account? Sign In" : "Need an account? Register"}
          </button>
          {message && <p style={{color: 'red', fontSize: '12px', textAlign: 'center'}}>{message}</p>}
        </div>
      )}
    </div>
  );
}

export default IndexSidePanel
