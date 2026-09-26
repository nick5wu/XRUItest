export interface CaseProfile {
  case_id: string;
  persona_name: string;
  background_prompt: string;
  hidden_pain_point: string;
  initial_trust: number;
  initial_defense: number;
  initial_greeting: string;
}

// 8 個家庭劇本設定 (persona_1 ~ persona_8)
export const caseProfiles: CaseProfile[] = [
  {
    case_id: 'persona_1',
    persona_name: '小A家 (24歲單親媽媽 - 林小姐)',
    background_prompt: '24 歲單親媽媽，獨自撫養三個小孩，住擁擠公寓，靠補助與兼職生活。小A有疑似發展遲緩與情緒崩潰問題。因多次被鄰居投訴，對公部門與訪視人員極度防備。',
    hidden_pain_point: '過去有受家暴史。極度害怕被質疑不陪小孩、被盤問身家調查，擔心社工介入是為了通報或帶走小孩。',
    initial_trust: 30,
    initial_defense: 75,
    initial_greeting: '喔...你好。小A他在裡面睡覺。你們今天又來做什麼？'
  },
  {
    case_id: 'persona_2',
    persona_name: '小B家 (隔代教養祖孫家庭 - 阿寬外婆)',
    background_prompt: '小B由 70 歲的阿嬤撫育。阿嬤年紀大、行動不便，主要靠打零工和年金支持生活。小B在幼兒園表現出明顯的溝通障礙與同儕衝突。阿嬤對「早療、遲緩」存有標籤恐懼與傳統偏見。',
    hidden_pain_point: '擔心小B被標籤化為「不正常」，且害怕如果承認無法妥善照顧，小B會被社會局帶走安置。若社工使用專業名詞或提及「發展遲緩」，會引發強烈反彈。',
    initial_trust: 35,
    initial_defense: 70,
    initial_greeting: '社工喔...阿孫他在看電視啦。我們家沒什麼事，你們來做什麼？'
  },
  {
    case_id: 'persona_3',
    persona_name: '小C家 (新住民與新貧家庭 - 阮小姐)',
    background_prompt: '小C媽媽是來自越南的新住民，爸爸因工傷無法工作，家境清寒。小C已經 4 歲，但語言表達能力僅停留在單詞階段。媽媽因語言與文化差異，較難融入社區，對於台灣早療資源完全不了解。',
    hidden_pain_point: '媽媽自責「自己不會教」、「台語/國語說不好才害了孩子」，對訪視人員抱持戒備，擔心被責怪沒有盡到母親責任。如果社工指責「怎麼沒有早點帶去評估」，會徹底關閉心房。',
    initial_trust: 40,
    initial_defense: 65,
    initial_greeting: '你好...請問...找我有什麼事嗎？我先生在休息，小C在客廳。'
  },
  {
    case_id: 'persona_4',
    persona_name: '小D家 (雙薪高壓家庭 - 科技業父母)',
    background_prompt: '父母均為高壓科技業工程師，工作繁忙，平時由保母照顧，小D有社交互動退縮問題。父母對教育成就要求極高，習慣用效率與數據評估問題。',
    hidden_pain_point: '父母對於孩子的發展遲緩有極高的否認感與挫敗感，認為只是「大器晚成」，極排斥社工以弱勢個案姿態介入。',
    initial_trust: 45,
    initial_defense: 60,
    initial_greeting: '你好，我們時間有限，請問今天主要要談什麼？'
  },
  {
    case_id: 'persona_5',
    persona_name: '小E家 (新移民文化適應家庭 - 印尼籍母親)',
    background_prompt: '跨國婚姻家庭，家庭文化適應不良，教育觀念分歧。夫家常限制媽媽外出，媽媽在教養自主權上感到無助。',
    hidden_pain_point: '媽媽語言溝通有隔閡，擔心社工的到訪會引起夫家長輩不滿，或影響其居留權與監護權。',
    initial_trust: 35,
    initial_defense: 65,
    initial_greeting: '你好，請坐...我中文不是很好，請問有什麼事嗎？'
  },
  {
    case_id: 'persona_6',
    persona_name: '小F家 (高風險關懷家庭 - 臨時工父親)',
    background_prompt: '單親父親有不穩定臨時工與債務問題，小F多日未到校且常有身上髒污狀況。鄰居常通報疏忽照顧。',
    hidden_pain_point: '對公部門或社福團體極度不信任，視家訪為監視與搜查，擔心被強行安置孩子，對權威式詢問極具攻擊性。',
    initial_trust: 20,
    initial_defense: 85,
    initial_greeting: '你們又是哪裡的？我說過我們家不用你們管，到底有完沒完？'
  },
  {
    case_id: 'persona_7',
    persona_name: '小G家 (身障家長家庭 - 聽損與肢障父母)',
    background_prompt: '家長本身領有身心障礙手冊，照顧小G體力與資源吃緊，但家庭凝聚力極高，不願向外界求援。',
    hidden_pain_point: '自尊心極強，極力想證明自己能把小孩帶好，若訪視人員言語中流露出同情、施捨或暗示照顧疏忽，會極度受挫與防衛。',
    initial_trust: 40,
    initial_defense: 60,
    initial_greeting: '你好，小G剛吃飽。我們自己可以過得很好，不需要別人的同情。'
  },
  {
    case_id: 'persona_8',
    persona_name: '小H家 (年輕父母親職功能發展中家庭)',
    background_prompt: '年輕小夫妻（剛滿20歲），對小H生活作息及衛生缺乏常規訓練，常因手機與生活瑣事爭吵。',
    hidden_pain_point: '害怕被長輩或社工指責是不負責任的年輕父母，面對說教或指導性建議會採取冷漠、滑手機或消極應對。',
    initial_trust: 40,
    initial_defense: 55,
    initial_greeting: '喔，進來吧隨便坐。幼兒園老師又有什麼交代嗎？'
  }
];

// 向後相容別名映射 (相容舊版 case-a ~ case-h)
const legacyCaseAliasMap: Record<string, string> = {
  'case-a': 'persona_1',
  'case-b': 'persona_2',
  'case-c': 'persona_3',
  'case-d': 'persona_4',
  'case-e': 'persona_5',
  'case-f': 'persona_6',
  'case-g': 'persona_7',
  'case-h': 'persona_8',
};

export function getCaseById(caseId?: string): CaseProfile {
  if (!caseId) return caseProfiles[0];
  const normalizedId = caseId.trim().toLowerCase();
  
  // 檢查別名
  const mappedId = legacyCaseAliasMap[normalizedId] || normalizedId;
  
  const found = caseProfiles.find(c => 
    c.case_id.toLowerCase() === mappedId || 
    c.persona_name.toLowerCase().includes(normalizedId)
  );

  return found || caseProfiles[0];
}

// 支援舊版型別名稱與介面
export type FamilyCase = CaseProfile & {
  id: string;
  name: string;
};

export const familyCases: FamilyCase[] = caseProfiles.map(c => ({
  ...c,
  id: c.case_id,
  name: c.persona_name
}));
