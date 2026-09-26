Listed directory VR%E5%AE%B6%E5%BA%AD%E8%A8%AA%E8%AB%87-%E6%95%B4%E5%90%88
Ran command: `python -c "
import os, glob

assets_path = r'd:\中教大XR\VR家庭訪談-整合\Assets'
files = []
for root, dirs, filenames in os.walk(assets_path):
    for f in filenames:
        if f.endswith('.unity') or f.endswith('.prefab'):
            files.append(os.path.join(root, f))

print(f'Total unity/prefab files: {len(files)}')
for f in files[:20]:
    print(f[len(assets_path):])
"`
Ran command: `python -c "
import os, re

assets_path = r'd:\中教大XR\VR家庭訪談-整合\Assets'

# 1. Collect all guid -> filename / classname
guid_to_name = {}
for root, dirs, files in os.walk(r'd:\中教大XR\VR家庭訪談-整合'):
    for f in files:
        if f.endswith('.meta'):
            meta_path = os.path.join(root, f)
            try:
                with open(meta_path, 'r', encoding='utf-8', errors='ignore') as mf:
                    content = mf.read()
                    m = re.search(r'guid:\s*([a-f0-9]{32})', content)
                    if m:
                        guid = m.group(1)
                        target_name = f[:-5] # remove .meta
                        guid_to_name[guid] = target_name
            except:
                pass

print(f'Collected {len(guid_to_name)} GUID mappings')

# Built-in Unity / TextMeshPro GUIDs or known IDs
# e.g., f4688fdb7df04437aeb418b961361dc5 -> TextMeshProUGUI, fe87c0e1cc204ed48ad3b37840f39efc -> Image, etc.
# But often m_EditorClassIdentifier is also present in newer Unity YAML or class types
"`
Used tool: manage_task
Used tool: manage_task
Created parse_ui.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\parse_ui.py`
Created parse_ui_detail.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\parse_ui_detail.py`
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\ui_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Group by category: Core Project vs Samples/ThirdParty
project_files = {}
sample_files = {}

for path, items in data.items():
    if 'Samples' in path or 'TextMesh Pro\\Examples' in path:
        sample_files[path] = items
    else:
        project_files[path] = items

print(f'=== 專案核心 UI 檔案 ({len(project_files)}) ===')
for path, items in project_files.items():
    print(f'[{path}] - {len(items)} 個 UI 物件')
    for item in items:
        print(f'  - 名稱: {item[\"name\"]}')
        print(f'    類型: {\", \".join(item[\"components\"])}')
        print(f'    路徑: {item[\"path\"]}')

print(f'\n=== 範例與套件 UI 檔案 ({len(sample_files)}) ===')
for path, items in sample_files.items():
    print(f'[{path}] - {len(items)} 個 UI 物件')
"`
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\ui_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

project_files = {}
sample_files = {}

for path, items in data.items():
    if 'Samples' in path or 'TextMesh Pro' in path or 'TutorialInfo' in path:
        sample_files[path] = items
    else:
        project_files[path] = items

print(f'=== 專案自訂/核心檔案 ({len(project_files)}) ===')
for path, items in project_files.items():
    print(f'\n檔案: {path} ({len(items)} 個 UI 物件)')
    for item in items:
        comps = ', '.join(item['components'])
        print(f\"  - 物件名稱 (m_Name): {item['name']}\")
        print(f\"    類型 (Components): {comps}\")
        print(f\"    階層位置: {item['path']}\")
"`
Created print_summary.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\print_summary.py`
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\ui_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for path, items in data.items():
    if not ('Samples' in path or 'TextMesh Pro' in path or 'TutorialInfo' in path):
        print('='*50)
        print(f'檔案: {path}')
        print('='*50)
        for it in items:
            print(f'  • 物件名稱: {it[\"name\"]}')
            print(f'    階層路徑: {it[\"path\"]}')
            print(f'    UI 類型 : {\", \".join(it[\"components\"])}')
"`
Created print_core.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\print_core.py`
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\ui_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for path, items in data.items():
    if 'Prefabs' in path and 'Samples' not in path:
        print(f'=== {path} ===')
        for it in items:
            print(f'  • {it[\"name\"]} ({it[\"path\"]}) -> {it[\"components\"]}')
"`
Created format_table.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\format_table.py`
Created generate_markdown.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\generate_markdown.py`
Viewed ui_inventory.md:1-250
Created generate_clean_md.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\generate_clean_md.py`
Viewed ui_inventory_clean.md:1-200

已為您完整掃描 `Assets/` 資料夾下所有 `.unity` (場景) 與 `.prefab` (預製體) 檔案。

以下將為您整理 **專案核心自訂 UI 元件** 與 **套件/範例 UI 元件** 的「UI 點名表」：

---

## 📌 一、 專案核心 UI 點名表 (Custom Prefabs & Scenes)

### 1. 預製體 (Prefabs)
#### 📄 `Assets\Prefabs\DialogueSystem_UI.prefab`（對話視窗系統）
| 物件名稱 (`m_Name`) | UI 元件類型 | 階層路徑 (Hierarchy) | 說明 / 預設文字 |
| :--- | :--- | :--- | :--- |
| **HistoryScrollView** | `Image`, `ScrollRect` | `DialogueSystem_UI / HistoryScrollView` | 歷史對話滾動區域 |
| **InputField (TMP)** | `Image`, `TMP_InputField` | `DialogueSystem_UI / ChatInputGroup / InputField (TMP)` | 文字輸入框 |
| **Placeholder** | `TextMeshProUGUI` | `... / InputField (TMP) / Text Area / Placeholder` | 預設提示文字: *"Enter text..."* |
| **Text** | `TextMeshProUGUI` | `... / InputField (TMP) / Text Area / Text` | 使用者輸入文字內容顯示區 |
| **Button** | `Image`, `Button` | `DialogueSystem_UI / ChatInputGroup / Button` | 發送 / 送出按鈕 |
| **Text (TMP)** | `TextMeshProUGUI` | `... / Button / Text (TMP)` | 按鈕文字: *"輸入"* |
| **ChatInputGroup** | `Image` | `DialogueSystem_UI / ChatInputGroup` | 輸入框容器底板 |
| **Scrollbar Horizontal** | `Image`, `Scrollbar` | `... / HistoryScrollView / Scrollbar Horizontal` | 水平滾動條 |
| **Scrollbar Vertical** | `Image`, `Scrollbar` | `... / HistoryScrollView / Scrollbar Vertical` | 垂直滾動條 |
| **Viewport** | `Image` | `... / HistoryScrollView / Viewport` | 滾動視窗遮罩 |
| **Handle** (x2) | `Image` | `... / Scrollbar / Sliding Area / Handle` | 滾動條拖曳按鈕 |

#### 📄 `Assets\Prefabs\DialogueItem.prefab`（對話單筆氣泡）
| 物件名稱 (`m_Name`) | UI 元件類型 | 階層路徑 (Hierarchy) | 說明 / 預設文字 |
| :--- | :--- | :--- | :--- |
| **DialogueItem** | `TextMeshProUGUI` | `DialogueItem` | 對話文字項目 (預設: *"New Text"*) |

---

### 2. 核心場景 (Scenes)

#### 📄 `Assets\Scenes\SampleScene.unity` / `Assets\_Recovery\0 (2).unity`（主選單/登入/訪談選擇介面）
*註：場景內包含 3 個分頁 (`Page0_Login`, `Page1_Family`, `Page2_Scene`)*

| 物件名稱 (`m_Name`) | UI 元件類型 | 階層路徑 (Hierarchy) | 說明 / 預設文字 |
| :--- | :--- | :--- | :--- |
| **MenuCanvas** | `Canvas`, `CanvasScaler`, `GraphicRaycaster`, `TrackedDeviceGraphicRaycaster` | `MenuCanvas` | 主選單 UI 畫布 (支援 XR 射線) |
| **BackgroundPanel** | `Image` | `MenuCanvas / BackgroundPanel` | 背景面板 |
| **EventSystem** | `EventSystem`, `XRUIInputModule` | `EventSystem` | UI 事件輸入系統 |
| **Page0 - 登入介面** | | | |
| ↳ **Input_Account** | `Image`, `TMP_InputField` | `... / Page0_Login / Input_Account` | 帳號輸入框 |
| ↳ **Input_Password** | `Image`, `TMP_InputField` | `... / Page0_Login / Input_Password` | 密碼輸入框 |
| ↳ **Placeholder** | `TextMeshProUGUI` | `... / Input_Account / Text Area / Placeholder` | 提示: *"請輸入帳號"* |
| ↳ **Placeholder** | `TextMeshProUGUI` | `... / Input_Password / Text Area / Placeholder` | 提示: *"請輸入密碼"* |
| ↳ **Btn_Login** | `Image`, `Button` | `... / Page0_Login / Btn_Login` | 登入按鈕 |
| ↳ **Text (TMP)** | `TextMeshProUGUI` | `... / Btn_Login / Text (TMP)` | 按鈕文字: *"登入"* |
| ↳ **Text_ErrorMsg** | `TextMeshProUGUI` | `... / Page0_Login / Text_ErrorMsg` | 錯誤提示文字 |
| **Page1 - 家庭選擇介面** | | | |
| ↳ **Text (TMP)-2** | `TextMeshProUGUI` | `... / Page1_Family / Text (TMP)-2` | 標題: *"請選擇家庭"* |
| ↳ **Btn_PersonaA** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaA` | 角色 A 按鈕 (文字: *"小芳家"*) |
| ↳ **Btn_PersonaB** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaB` | 角色 B 按鈕 (文字: *"小成家 / 外婆"*) |
| ↳ **Btn_PersonaC** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaC` | 角色 C 按鈕 (文字: *"小東家"*) |
| ↳ **Btn_PersonaD** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaD` | 角色 D 按鈕 (文字: *"小光家"*) |
| ↳ **Btn_PersonaE** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaE` | 角色 E 按鈕 (文字: *"小成家"*) |
| ↳ **Btn_PersonaF** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaF` | 角色 F 按鈕 (文字: *"小乖家"*) |
| ↳ **Btn_PersonaG** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaG` | 角色 G 按鈕 (文字: *"小宇家"*) |
| ↳ **Btn_PersonaH** | `Image`, `Button` | `... / Page1_Family / Btn_PersonaH` | 角色 H 按鈕 (文字: *"小杰家"*) |
| **Page2 - 場景選擇介面** | | | |
| ↳ **Text (TMP)-1** | `TextMeshProUGUI` | `... / Page2_Scene / Text (TMP)-1` | 標題: *"請選擇訪談場景"* |
| ↳ **Btn_home1** | `Image`, `Button` | `... / Page2_Scene / Btn_home1` | 場景按鈕 (文字: *"客廳 1"*) |
| ↳ **Btn_home2** | `Image`, `Button` | `... / Page2_Scene / Btn_home2` | 場景按鈕 (文字: *"客廳 2"*) |
| ↳ **Btn_Coffee1** | `Image`, `Button` | `... / Page2_Scene / Btn_Coffee1` | 場景按鈕 (文字: *"咖啡廳 1"*) |
| ↳ **Btn_Coffee2** | `Image`, `Button` | `... / Page2_Scene / Btn_Coffee2` | 場景按鈕 (文字: *"咖啡廳 2"*) |
| ↳ **Btn_convenience store** | `Image`, `Button` | `... / Page2_Scene / Btn_convenience store` | 場景按鈕 (文字: *"超商 1"*) |
| ↳ **Btn_A** | `Image`, `Button` | `... / Page2_Scene / Btn_A` | 返回按鈕 (文字: *"返回上一步"*) |

#### 📄 `Assets\_Recovery\0.unity`（聊天視窗測試場景）
| 物件名稱 (`m_Name`) | UI 元件類型 | 階層路徑 (Hierarchy) | 說明 / 預設文字 |
| :--- | :--- | :--- | :--- |
| **Canvas** | `Canvas`, `CanvasScaler`, `GraphicRaycaster` | `Canvas` | 畫布 |
| **OpenButton** | `Image`, `Button` | `Canvas / OpenButton` | 開啟按鈕 (文字: *"open"*) |
| **ChatPanel** | `Image` | `Canvas / ChatPanel` | 聊天主面板 |
| **CloseButton** | `Image`, `Button` | `Canvas / ChatPanel / CloseButton` | 關閉按鈕 (文字: *"close"*) |
| **ChatInputField** | `Image`, `TMP_InputField` | `Canvas / ChatPanel / ChatInputField` | 聊天輸入框 |
| **SendButton** | `Image`, `Button` | `Canvas / ChatPanel / SendButton` | 發送按鈕 (文字: *"send"*) |
| **ChatScrollView** | `Image`, `ScrollRect` | `Canvas / ChatPanel / ChatScrollView` | 滾動聊天歷史區域 |
| **Scrollbar Vertical / Horizontal** | `Image`, `Scrollbar` | `... / ChatScrollView / Scrollbar` | 捲軸組件 |

#### 📄 `Assets\Scenes\coffee1.unity`、`coffee2.unity`、`home2.unity`（訪談環境場景）
- **Canvas**：`Canvas`, `CanvasScaler`, `GraphicRaycaster`, `TrackedDeviceGraphicRaycaster`, `DialogueManager`（掛載對話管理模組與 XR 射線支援）
- **EventSystem**：`EventSystem`, `XRUIInputModule`
- （在 `coffee2.unity` 中亦包含實例化的 `DialogueSystem_UI` 聊天輸入與滾動介面）。

---

## 📦 二、 XR Interaction Toolkit & 範例庫 UI (Samples & Framework)

此部分為 Unity XR Toolkit 與 TextMesh Pro 的內建模組與範例：

| 檔案路徑 | 物件名稱 (`m_Name`) | UI 元件類型 |
| :--- | :--- | :--- |
| `.../Starter Assets/DemoScene.unity` | **Far Grab Interactable Info**, **Climb Interactable Info**, **Poke Interactions Info** 等 | `Canvas` (XR 3D 懸浮提示看板) |
| `.../DemoAssets/Prefabs/UI/Icon Button.prefab` | **Icon Button** | `Button` |
| `.../DemoAssets/Prefabs/UI/TextButton.prefab` | **TextButton** | `Button` |
| `.../DemoAssets/Prefabs/UI/MinMaxSlider.prefab` | **MinMaxSlider** | `Slider` |
| `.../DemoAssets/Prefabs/UI/ModalSingleButton.prefab`| **ModalSingleButton** | `Canvas` |
| `.../XR Interaction Simulator UI.prefab` | **XR Interaction Simulator UI**, **Button**, 各類 **Panel** | `Canvas`, `Button` (模擬器操作面板) |

---

### 💡 總結分析
1. **主要客製 UI 集中在**：
   - **`DialogueSystem_UI.prefab`**（對話/聊天框發送與顯示）
   - **`SampleScene.unity`**（登入畫面 `Page0_Login`、家庭選擇 `Page1_Family`、場景選擇 `Page2_Scene`）
2. **主要採用的 UI 技術**：
   - 文字全面採用 **`TextMeshProUGUI`**。
   - 輸入框採用 **`TMP_InputField`**。
   - 支援 VR/XR 互動射線（採用 **`XRUIInputModule`** + **`TrackedDeviceGraphicRaycaster`**）。