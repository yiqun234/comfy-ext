FROM runpod/worker-comfyui:5.1.0-flux1-schnell

# ------------------------------------------------------------------
# 2. 安装编译环境 (Fix for "Failed to find C compiler" error)
# ------------------------------------------------------------------
# 某些自定义节点（如 teacache）的依赖（如 triton）需要在运行时编译C代码，
# 因此我们必须安装 build-essential 包，它包含了 gcc 等编译器。
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc g++ git
ENV CC=/usr/bin/gcc

# ------------------------------------------------------------------
# 3. 安装所有自定义节点 (优化结构：每个节点独立一行)
# ------------------------------------------------------------------
# 这种写法可以最大化利用Docker的构建缓存，并使排错更容易。
RUN comfy-node-install comfyui-manager
RUN comfy-node-install comfyui_layerstyle

RUN comfy-node-install comfyui-in-context-lora-utils \
    comfyui-kjnodes \
    comfyui-logicutils \
    comfyui-get-meta \
    teacachehunyuanvideo \
    comfy-mtb \
    teacache \
    ComfyUI_EmAySee_CustomNodes \
    was-node-suite-comfyui \
    comfyui_essentials \
    comfyui_custom_nodes_alekpet

# RUN comfy model download --url https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth --relative-path models/sams --filename sam_vit_h_4b8939.pth

