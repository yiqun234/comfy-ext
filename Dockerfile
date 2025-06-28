FROM runpod/worker-comfyui:5.1.0-flux1-schnell

# ------------------------------------------------------------------
# 2. 安装编译环境 (Fix for "Failed to find C compiler" error)
# ------------------------------------------------------------------
# 某些自定义节点（如 teacache）的依赖（如 triton）需要在运行时编译C代码，
# 因此我们必须安装 build-essential 包，它包含了 gcc 等编译器。
RUN apt-get update && apt-get install -y --no-install-recommends build-essential

# ------------------------------------------------------------------
# 3. 安装所有自定义节点 (优化结构：每个节点独立一行)
# ------------------------------------------------------------------
# 这种写法可以最大化利用Docker的构建缓存，并使排错更容易。
RUN comfy-node-install comfyui-manager
RUN comfy-node-install comfyui_layerstyle
RUN comfy-node-install comfyui_essentials
RUN comfy-node-install comfyui-in-context-lora-utils
RUN comfy-node-install comfyui-kjnodes
RUN comfy-node-install comfyui_custom_nodes_alekpet
RUN comfy-node-install comfyui-logicutils
RUN comfy-node-install comfyui-get-meta
RUN comfy-node-install teacachehunyuanvideo
RUN comfy-node-install comfy-mtb
RUN comfy-node-install teacache
RUN comfy-node-install ComfyUI_EmAySee_CustomNodes
RUN comfy-node-install was-node-suite-comfyui

# ------------------------------------------------------------------
# 4. 下载【额外】的模型文件
# ------------------------------------------------------------------
# SAM (Segment Anything Model) - 由某些自定义节点依赖
RUN comfy model download --url https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth --relative-path models/sams --filename sam_vit_h_4b8939.pth

# 【待定】GroundingDINO 模型 - 用于高级分割
# 请将 <GROUNDING_DINO_DOWNLOAD_URL> 替换为真实的下载链接
# RUN comfy model download --url <GROUNDING_DINO_DOWNLOAD_URL> --relative-path models/grounding-dino --filename groundingdino_swint_ogc.pth

# 【待定】虚拟试衣 LoRA 模型
# 请将 <VTON_LORA_DOWNLOAD_URL> 替换为真实的下载链接
# RUN comfy model download --url <VTON_LORA_DOWNLOAD_URL> --relative-path models/loras --filename catvton-flux-lora.safetensors

# ------------------------------------------------------------------
# 5. (可选) 复制静态输入文件
# ------------------------------------------------------------------
# COPY input/ /comfyui/input/
