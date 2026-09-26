Ran command: `python -c "
import os

assets_dir = r'd:\中教大XR\VR家庭訪談-整合\Assets'
cs_files = []
for root, dirs, files in os.walk(assets_dir):
    # 排除外部套件
    if any(p in root for p in ['TextMesh Pro', 'Samples', 'TutorialInfo', 'XR Interaction Toolkit']):
        continue
    for f in files:
        if f.endswith('.cs'):
            cs_files.append(os.path.join(root, f))

print(f'找到 {len(cs_files)} 個自訂 C# 腳本：')
for f in cs_files:
    print(f.replace(assets_dir, 'Assets'))
"`
Created scan_scripts_and_ui.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\scan_scripts_and_ui.py`
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\script_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for guid, s in data.items():
    print('='*60)
    print(f'腳本名稱: {s[\"name\"]} (GUID: {guid})')
    print(f'檔案路徑: {s[\"rel_path\"]}')
    print(f'宣告變數 ({len(s[\"fields\"])} 個):')
    for fld in s['fields']:
        print(f'  - {fld[\"type\"]} {fld[\"name\"]}')
    print(f'掛載位置 ({len(s[\"mounts\"])} 處):')
    for m in s['mounts']:
        print(f'  - 場景/Prefab: {m[\"file\"]} | 物件: {m[\"gameobject\"]} ({m[\"hierarchy_path\"]})')
"`
Viewed DialogueManager.cs:1-57
Viewed InterviewMenuManager.cs:1-119
Viewed MyChatManager.cs:1-71
Viewed MyInputFieldManager.cs:1-85
Viewed ClickToInput.cs:1-67
Viewed SceneController.cs:1-20
Viewed SceneInitializer.cs:1-46
Viewed CameraController.cs:1-65
Viewed VRPersonaData.cs:1-12
Viewed VRSceneConfigData.cs:1-10
Ran command: `python -c "
import json

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\script_scan_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for guid, s in data.items():
    print(f'腳本: {s[\"name\"]} (GUID: {guid})')
    print('  掛載數量:', len(s['mounts']))
    for m in s['mounts']:
        print(f'    - 檔案: {m[\"file\"]} | 物件: {m[\"gameobject\"]} | 階層: {m[\"hierarchy_path\"]}')
"`
Created print_mounts.py
Ran command: `python C:\Users\user\.gemini\antigravity-ide\brain\ccc0f38b-c568-44bb-8cdb-61f5ec5f0d27\scratch\print_mounts.py`
Ran command: `python -c "
import os

assets_dir = r'd:\中教大XR\VR家庭訪談-整合\Assets'
asset_files = []
for root, dirs, files in os.walk(assets_dir):
    for f in files:
        if f.endswith('.asset') and not any(p in root for p in ['TextMesh Pro', 'Samples', 'TutorialInfo', 'XR Interaction Toolkit']):
            asset_files.append(os.path.relpath(os.path.join(root, f), assets_dir))

print(f'找到 {len(asset_files)} 個自訂 .asset 檔案：')
for a in asset_files:
    print(' ', a)
"`

已為您完整掃描 `Assets` 資料夾下的所有自訂 C# 腳本、對應的 `.meta` GUID，以及比對各個 `.unity` 場景與 `.prefab` 預製體中的掛載位置。

以下是為您整理的 **「自訂 C# 腳本與 UI 掛載關聯報告」**：

---

# 📋 自訂 C# 腳本與 UI 掛載總覽表

| 腳本名稱 (`Script Name`) | 腳本 GUID | 主要功能分類 | 實際掛載的 GameObject (`m_Name`) 與場景/Prefab |
| :--- | :--- | :--- | :--- |
| **`InterviewMenuManager.cs`** | `dea2d31fdff8da6428a5881b4da5a89f` | 主選單/登入/選擇家庭與場景 | • `SampleScene.unity` ➔ **`[InterviewMenuManager]`**<br>• `_Recovery/0 (2).unity` ➔ **`[InterviewMenuManager]`** |
| **`DialogueManager.cs`** | `061cdb63d74c71e4fafcaa19e2c5996f` | 對話送出與氣泡生成 | • `coffee1.unity` ➔ **`Canvas`**<br>• `home2.unity` ➔ **`Canvas`**<br>• `_Recovery/0 (1).unity` ➔ **`Canvas`** |
| **`MyChatManager.cs`** | `e82af686f531a482f8f29e92d0f77f4a` | 聊天視窗管理與 Enter 發送 | • `_Recovery/0.unity` ➔ **`ChatPanel`** |
| **`MyInputFieldManager.cs`** | `324affd0cc7f1e947b3fef0baa253c7f` | 輸入框事件/老師與家長發話 | • `MyBrain.prefab` ➔ **`MyBrain`**<br>• `coffee2.unity` ➔ **`MyBrain`** |
| **`SceneInitializer.cs`** | `29c0dec38829a314ebd9e9a2ec648451` | 場景初始化 / 依選取資料生成 NPC | • `coffee1.unity` ➔ **`[SceneManager]`**<br>• `coffee2.unity` ➔ **`[SceneManager]`**<br>• `home2.unity` ➔ **`[SceneManager]`**<br>• `_Recovery/0 (1).unity` ➔ **`[SceneManager]`** |
| **`CameraController.cs`** | `1a00f6a9ab69a440da08862bf6e06f68` | 鍵盤上下左右移動與滑鼠右鍵視角 | • `_Recovery/0 (2).unity` ➔ **`Main Camera`** |
| **`ClickToInput.cs`** | `59f223728dd5849fc8fa6f515ee1683c` | 射線點擊 3D 物件彈出輸入框 | *（程式庫備用，尚未掛載於目前場景）* |
| **`SceneController.cs`** | `fdb40712dc665ee44b0a43172f93f3e1` | 快速切換場景工具（按空白鍵去 coffee1）| *（程式庫備用，尚未掛載於目前場景）* |
| **`VRPersonaData.cs`** | `2bcc373e5fab9414ca2d82132cf7977a` | ScriptableObject：訪談人物設定資料 | *（資料設定檔，實例於 `Assets/ScriptableObjects/persona_1.asset`）* |
| **`VRSceneConfigData.cs`**| `e6ace0b2c8477d549af36081252e0b6c` | ScriptableObject：訪談場景配置資料 | *（資料設定檔，實例於 `Assets/ScriptableObjects/Coffee1_SceneConfig.asset` 等）* |

---

# 🔍 各腳本詳細資訊與 UI 變數宣告預覽

### 1. `InterviewMenuManager.cs`（主選單與登入系統）
- **GUID**：`dea2d31fdff8da6428a5881b4da5a89f`
- **掛載位置**：
  - `Assets/Scenes/SampleScene.unity` ➔ `[InterviewMenuManager]`
  - `Assets/_Recovery/0 (2).unity` ➔ `[InterviewMenuManager]`
- **宣告的 UI / 序列化變數**：
  ```csharp
  [Header("頁面設定")]
  public GameObject page0Login;         // 登入頁面 (Page0_Login)
  public GameObject page1Family;        // 家庭選擇頁 (Page1_Family)
  public GameObject page2Scene;         // 場景選擇頁 (Page2_Scene)

  [Header("登入 UI 元素")]
  public TMP_InputField accountInput;   // 帳號輸入框
  public TMP_InputField passwordInput;  // 密碼輸入框
  public TMP_Text errorMsgText;         // 錯誤提示訊息 TextMeshPro

  [Header("多組帳號密碼清單")]
  public List<UserAccount> userAccountList; // 儲存多組帳密資料結構

  [Header("暫存選取的資料")]
  public ScriptableObject selectedVRPersona; // 使用者選定的訪談人物
  ```

---

### 2. `DialogueManager.cs`（對話歷史與發送控制）
- **GUID**：`061cdb63d74c71e4fafcaa19e2c5996f`
- **掛載位置**：
  - `Assets/Scenes/coffee1.unity` ➔ `Canvas`
  - `Assets/Scenes/home2.unity` ➔ `Canvas`
  - `Assets/_Recovery/0 (1).unity` ➔ `Canvas`
- **宣告的 UI / 序列化變數**：
  ```csharp
  [Header("UI 連結")]
  public TMP_InputField inputField;     // 輸入框 InputField (TMP)
  public Transform historyContent;      // 歷史對話容器 (Scroll View -> Viewport -> Content)
  public Button submitButton;           // 送出按鈕

  [Header("Prefab")]
  public GameObject dialogueItemPrefab; // 單筆對話文字預製體 (DialogueItem.prefab)
  ```

---

### 3. `MyChatManager.cs`（聊天面板與 Enter 發送監聽）
- **GUID**：`e82af686f531a482f8f29e92d0f77f4a`
- **掛載位置**：
  - `Assets/_Recovery/0.unity` ➔ `Canvas / ChatPanel`
- **宣告的 UI / 序列化變數**：
  ```csharp
  [Header("UI 元件綁定")]
  public TMP_InputField inputField;   // 文字輸入框
  public Transform messageContent;    // 訊息清單 Content
  public GameObject messagePrefab;    // 訊息 Prefab
  public ScrollRect scrollRect;       // 歷史訊息捲軸（自動置底用）
  ```

---

### 4. `MyInputFieldManager.cs`（對話身分著色與發話管理）
- **GUID**：`324affd0cc7f1e947b3fef0baa253c7f`
- **掛載位置**：
  - `Assets/Prefabs/MyBrain.prefab` ➔ `MyBrain`
  - `Assets/Scenes/coffee2.unity` ➔ `MyBrain`
- **宣告的 UI / 序列化變數**：
  ```csharp
  [Header("UI 欄位")]
  public TMP_InputField inputField;       // 輸入框
  
  [Header("對話紀錄設定")]
  public GameObject contentPrefabParent;  // Scroll View 的 Content 物件
  public GameObject textPrefab;           // 對話氣泡 Prefab (支援區分【老師】藍字與【家長】橘字)
  ```

---

### 5. `SceneInitializer.cs`（訪談場景 NPC 生成器）
- **GUID**：`29c0dec38829a314ebd9e9a2ec648451`
- **掛載位置**：
  - `Assets/Scenes/coffee1.unity` ➔ `[SceneManager]`
  - `Assets/Scenes/coffee2.unity` ➔ `[SceneManager]`
  - `Assets/Scenes/home2.unity` ➔ `[SceneManager]`
  - `Assets/_Recovery/0 (1).unity` ➔ `[SceneManager]`
- **宣告的 UI / 序列化變數**：
  ```csharp
  [Header("角色生成點")]
  public Transform spawnPoint; // 生成 NPC 3D 角色的位置點
  // 透過 InterviewMenuManager.Instance.selectedVRPersona 讀取人物資料並 Instantiate 其 avatar3DPrefab
  ```

---

### 6. `ClickToInput.cs`（點擊 3D 物件開啟輸入框）
- **GUID**：`59f223728dd5849fc8fa6f515ee1683c`
- **宣告的 UI 變數**：
  ```csharp
  public GameObject inputFieldObject; // 輸入框 UI 容器
  public TMP_InputField mainInputField; // 輸入框組件
  ```

---

### 7. 資料配置 ScriptableObject 腳本
- **`VRPersonaData.cs`** (`2bcc373e5fab9414ca2d82132cf7977a`)
  - 欄位：`personaId`, `personaName`, `hiddenPainPoint`, `avatarPortrait (Sprite)`, `avatar3DPrefab (GameObject)`
- **`VRSceneConfigData.cs`** (`e6ace0b2c8477d549af36081252e0b6c`)
  - 欄位：`sceneId`, `sceneDisplayName`, `previewSprite (Sprite)`, `unitySceneName`

---

### 💡 前端架構總結
1. **選單與流程跳轉**：由 `InterviewMenuManager.cs` 控制，採 Single Canvas 多頁面切換模式（`Page0_Login` ➔ `Page1_Family` ➔ `Page2_Scene`）。
2. **對話與聊天**：`DialogueManager` / `MyInputFieldManager` 負責接收玩家輸入、在 `ScrollRect` 的 `Content` 底下動態生成 `DialogueItem.prefab`，並將捲軸自動置底。
3. **場景銜接**：選定人物後跳轉至訪談場景（如 `coffee1`、`coffee2`、`home2`），由場景中的 `SceneInitializer.cs` 讀取選取的人物設定檔並在 `spawnPoint` 自動生成對應的 3D 虛擬角色。