export interface FamilyCase {
  id: string;
  name: string;
  background_prompt: string;
  hidden_pain_point: string;
}

export const familyCases: FamilyCase[] = [
  {
    id: 'case-a',
    name: '小A家 (24歲單親媽媽)',
    background_prompt: '24 歲單親媽媽，獨自撫養三個小孩，住擁擠公寓，靠補助生活。小A有疑似發展遲緩與情緒崩潰問題。對社工的調查極度防衛。',
    hidden_pain_point: '過去有受家暴史。若被質疑不陪小孩、被盤問身家調查，會極度防衛。'
  },
  {
    id: 'case-b',
    name: '小B家 (隔代教養祖孫家庭)',
    background_prompt: '小B由 70 歲的阿嬤撫育。阿嬤年紀大、行動不便，主要靠打零工和年金支持生活。小B在幼兒園表現出明顯的溝通障礙與同儕衝突。阿嬤對「早療、遲緩」的標籤存有傳統偏見，極度排斥外界介入。',
    hidden_pain_point: '擔心小B被標籤化為「不正常」，且害怕如果承認無法妥善照顧，小B會被社會局帶走安置。若社工使用專業名詞或提及「發展遲緩」，會引發反彈。'
  },
  {
    id: 'case-c',
    name: '小C家 (新住民與新貧家庭)',
    background_prompt: '小C媽媽是來自越南的新住民，爸爸因工傷無法工作，家境清寒。小C已經 4 歲，但語言表達能力僅停留在單詞階段。媽媽因語言與文化差異，較難融入社區，對於台灣早療資源完全不了解。',
    hidden_pain_point: '媽媽自責「自己不會教」、「台語/國語說不好才害了孩子」，對社工抱持戒備，擔心被責怪沒有盡到母親責任。如果社工用指責「怎麼沒有帶去評估」或以高傲姿態溝通，會徹底關閉心房。'
  },
  {
    id: 'case-d',
    name: '小D家 (雙薪高壓家庭 - 預留案例 4)',
    background_prompt: '預留背景設定：父母均為高壓科技業工程師，工作繁忙，平時由保母照顧，小D有社交互動退縮問題。',
    hidden_pain_point: '父母對於孩子的發展遲緩有極高的否認感，認為只是「大器晚成」，極排斥社工關心。'
  },
  {
    id: 'case-e',
    name: '小E家 (新移民家庭 - 預留案例 5)',
    background_prompt: '預留背景設定：跨國婚姻家庭，家庭文化適應不良，教育觀念分歧。',
    hidden_pain_point: '媽媽語言溝通有隔閡，擔心社工的到訪會影響其居留權或被貼上弱勢標籤。'
  },
  {
    id: 'case-f',
    name: '小F家 (高風險關懷家庭 - 預留案例 6)',
    background_prompt: '預留背景設定：家長有不穩定工作與債務問題，小F多日未到校。',
    hidden_pain_point: '對公部門或社福團體極度不信任，視社工拜訪為監視，擔心被強行安置孩子。'
  },
  {
    id: 'case-g',
    name: '小G家 (身障家長家庭 - 預留案例 7)',
    background_prompt: '預留背景設定：家長本身領有身心障礙手冊，照顧小G體力與資源吃緊。',
    hidden_pain_point: '自尊心強，極力想證明自己能把小孩帶好，若提及照顧疏忽會極度難過與防衛。'
  },
  {
    id: 'case-h',
    name: '小H家 (親職功能低落家庭 - 預留案例 8)',
    background_prompt: '預留背景設定：年輕父母，沉迷娛樂，對小H生活作息及衛生缺乏常規訓練。',
    hidden_pain_point: '害怕被指責是不稱職的父母，面對社工指導會採取迴避或消極應對態度。'
  }
];
