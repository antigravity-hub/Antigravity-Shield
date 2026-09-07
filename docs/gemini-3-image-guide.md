# Gemini 3 Pro Image 模型调用指南

本文档详细说明了在 **Antigravity** 项目中调用 Google `gemini-3-pro-image` (Imagen 3) 模型的方法。本项目已对该模型进行了 OpenAI 协议的完全兼容封装，并扩展支持了原生的摄影宽高比、人物生成安全策略，以及**图生图 (Image-to-Image)** 功能。

## 1. 基础信息

*   **模型 ID**: `gemini-3-pro-image` (支持别名 `gemini-3-pro-image-preview`)
*   **接口路径**:
    *   `/v1/images/generations` (文生图 Text-to-Image)
    *   `/v1/images/edits` (图生图 Image-to-Image / 编辑)
    *   `/v1/chat/completions` (兼容模式)
*   **底层模型**: Google Imagen 3 (Gemini Native)

---

## 2. 文生图 (Text-to-Image)

调用 `/v1/images/generations`，支持以下参数：

### 2.1 画幅与宽高比 (Size / Aspect Ratio)

`size` 参数支持两种输入格式，系统会自动解析并映射到 Gemini 支持的标准比例：

1.  **直接输入比例 (推荐)**：如 `"16:9"`, `"4:3"`, `"1:1"`。这种方式最直观，且 100% 准确映射。
2.  **输入分辨率 (兼容)**：如 `"1920x1080"`, `"1024x1024"`。系统会自动计算其宽高比（例如 1920/1080 ≈ 1.77），并将其归一化为最接近的标准比例（16:9）。

**⚠️ 重要说明**：Gemini (Imagen 3) **不支持自定义任意像素大小**。
无论您在 `size` 中输入 `"1920x1080"` 还是 `"16:9"`，最终生成的**实际物理分辨率**仅由以下两个因素决定：
1.  **宽高比**（由 `size` 解析得出）
2.  **画质等级**（由 `quality` 参数决定：`1k`/`2k`/`4k`）

*示例：输入 `size: "1920x1080"` (16:9) 且 `quality: "standard"` (1k)，实际生成的图片尺寸为 **1376x768** (16:9 下的 1K 分辨率)，而不是 1920x1080。*

| 目标比例 | 适用场景 | `size` 参数示例 (分辨率) | 备注 |
| :--- | :--- | :--- | :--- |
| **16:9** | 宽屏、电影感 | `1920x1080`, `1280x720` | 标准宽屏 |
| **9:16** | 手机壁纸、Stories | `1080x1920`, `720x1280` | 竖屏全屏 |
| **1:1** | 头像、Instagram | `1024x1024` | 默认比例 |
| **4:3** | 传统摄影、显示器 | `1024x768`, `800x600` | |
| **3:4** | 纵向摄影 | `768x1024`, `600x800` | |
| **21:9** | 超宽屏、电影 | `2560x1080` | 电影银幕 |
| **3:2** | **[新增]** 全画幅单反 | `1500x1000` | 经典摄影比例 |
| **2:3** | **[新增]** 竖构图摄影 | `1000x1500` | 海报、立绘 |
| **5:4** | **[新增]** 大画幅 | `1280x1024` | 艺术摄影 |
| **4:5** | **[新增]** 社交媒体竖图 | `1024x1280` | Ins 最佳展示比例 |

> **提示**: 您不需要精确匹配像素值，只需宽高比接近上述比例（容差 0.05）即可自动识别。

### 2.2 画质与分辨率 (Quality)

通过 `quality` 参数控制生成的精细度。

| 参数值 (`quality`) | 对应 Gemini 设置 | 说明 |
| :--- | :--- | :--- |
| `standard` / `1k` | Image Size: `1K` | 生成速度快，适合快速验证 (默认) |
| `medium` / `2k` | Image Size: `2K` | 平衡质量与速度 |
| `hd` / `4k` | Image Size: `4K` | **极高画质**，细节最丰富，耗时稍长 |

#### 分辨率对照表 (Gemini 3 Pro Image)

| 宽高比 | 1K 分辨率 (Standard) | 2K 分辨率 (Medium) | 4K 分辨率 (HD) |
| :--- | :--- | :--- | :--- |
| **1:1** | 1024x1024 | 2048x2048 | 4096x4096 |
| **2:3** | 848x1264 | 1696x2528 | 3392x5056 |
| **3:2** | 1264x848 | 2528x1696 | 5056x3392 |
| **3:4** | 896x1200 | 1792x2400 | 3584x4800 |
| **4:3** | 1200x896 | 2400x1792 | 4800x3584 |
| **4:5** | 928x1152 | 1856x2304 | 3712x4608 |
| **5:4** | 1152x928 | 2304x1856 | 4608x3712 |
| **9:16** | 768x1376 | 1536x2752 | 3072x5504 |
| **16:9** | 1376x768 | 2752x1536 | 5504x3072 |
| **21:9** | 1584x672 | 3168x1344 | 6336x2688 |

### 调用示例 (Python)

```python
import requests

url = "http://localhost:8045/v1/images/generations"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <token>"
}
data = {
    "model": "gemini-3-pro-image",
    "prompt": "A futuristic city with flying cars, cinematic lighting, 8k",
    "size": "16:9",
    "quality": "hd",
    "n": 1
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## 3. 图生图 (Image-to-Image / Edits) 🔥 [新增]

调用 `/v1/images/edits` 接口，支持通过参考图生成。

*   **Content-Type**: `multipart/form-data`
*   **支持多图**: 可同时上传多张参考图。

### 表单字段说明

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `prompt` | String | 是 | 文本提示词 |
| `image1`...`imageN` | File | 是 | **参考图文件**。支持 `image1`, `image2` 等任意名称的文件字段 (非 standard `image` 或 `mask`)。 |
| `image` | File | 否 | (兼容 OpenAI 标准) 主图像 |
| `mask` | File | 否 | (兼容 OpenAI 标准) 遮罩图像 |
| `aspect_ratio` | String | 否 | 显式指定比例，如 `"16:9"` (优先级高于 `size`) |
| `image_size` | String | 否 | 显式指定分辨率，如 `"2K"`, `"4K"` (优先级高于 `quality`) |
| `style` | String | 否 | 风格描述，会自动追加到 Prompt 中 |
| `n` | Integer | 否 | 生成数量 (默认 1) |
| `model` | String | 否 | 模型名称 (默认 `gemini-3.1-flash-image`) |

### 调用示例 (Python)

```python
import requests

url = "http://localhost:8045/v1/images/edits"
headers = {
    "Authorization": "Bearer <token>"
}
# 支持多张参考图 (image1, image2, ...)
files = {
    "image1": open("/path/to/reference_1.jpg", "rb"),
    "image2": open("/path/to/reference_2.jpg", "rb")
}
data = {
    "prompt": "A cyberpunk city street based on this layout",
    "aspect_ratio": "16:9",
    "image_size": "4K",
    "style": "watercolor"
}

response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())
```

---

## 4. 后缀魔法 (Magic Suffix)

除了标准的 JSON 参数外，本项目还支持在 **模型名称** 中直接指定参数（方便在不支持自定义参数的客户端中使用）。

**格式**: `gemini-3-pro-image-{比例}-{画质}`

*   **比例后缀**: `-16x9`, `-9x16`, `-4x3`, `-3x4`, `-3x2`, `-2x3` 等。
*   **画质后缀**: `-4k` (对应 hd), `-2k` (对应 medium)。

**示例**:
使用模型名 `gemini-3-pro-image-16x9-4k` 等同于：
*   `size`: "1920x1080" (16:9)
*   `quality`: "hd"

> **注意**: 如果 JSON Body 中显式传递了 `size` 或 `quality`，Body 中的参数优先级 **高于** 模型名后缀。

---

## 5. 常见问题

1.  **Q: 为什么我设置了 `size: "1234x5678"` 但生成的图片比例不对？**
    *   **A**: 系统会将您输入的尺寸归一化为 Gemini 支持的 10 种标准比例（见 2.1 节）。如果您的比例非常特殊且不匹配任何标准比例（容差 > 0.05），系统将回退到默认的 **1:1**。建议直接使用示例中的分辨率。

2.  **Q: 支持一次生成多张图片吗？**
    *   **A**: 支持。虽然 Gemini 上游单次请求限制生成 1 张，但 Antigravity 代理层会自动并发处理 `n` 参数。例如设置 `n: 4`，系统会并行发起 4 个请求并合并结果返回。

3.  **Q: `person_generation` 参数报错？**
    *   **A**: 请确保该参数位于 JSON 的**根层级**（与 `prompt`, `model` 同级），而不是嵌套在其他字段中。支持 `snake_case` (`person_generation`) 和 `camelCase` (`personGeneration`)。
