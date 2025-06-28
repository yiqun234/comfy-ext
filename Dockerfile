FROM runpod/worker-comfyui:5.1.0-flux1-schnell

# ------------------------------------------------------------------
# 2. 安装所有自定义节点 (使用官方推荐的 comfy-node-install)
# ------------------------------------------------------------------
RUN comfy-node-install comfyui-manager comfyui_layerstyle comfyui_essentials comfyui-in-context-lora-utils comfyui-kjnodes comfyui_custom_nodes_alekpet comfyui-logicutils comfyui-get-meta teacachehunyuanvideo comfy-mtb teacache ComfyUI_EmAySee_CustomNodes was-node-suite-comfyui
