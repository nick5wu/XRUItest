import { db, isFirebaseAdminInitialized, admin } from '../config/firebase';
import { caseProfiles, CaseProfile } from '../constants/cases';

// =========================================================================
// 1. 各核心 Collection 資料結構定義
// =========================================================================

export interface UserRecord {
  user_id: string;
  name: string;
  role: 'trainee' | 'supervisor' | 'admin';
  group: string;
  experience_years: number;
  created_at?: any;
}

export interface TrainingSessionRecord {
  session_id: string;
  user_id: string;
  case_id: string;
  selected_duration: '30' | '60' | '90';
  status: 'active' | 'completed' | 'terminated';
  created_at: any;
  help_count: number;
  inventory_count: number;
  final_score?: number;
  actual_duration?: number;
  supervisor_reviewed?: boolean;
  require_repetition?: boolean;
  supervisor_total_score?: number;
}

export interface UtteranceRecord {
  id?: string;
  session_id: string;
  utterance_id: string;
  speaker: 'user' | 'npc';
  text: string;
  timestamp: any;
  speech_duration: number;
  input_mode: 'text' | 'voice';
  rapport_score: number;
}

export interface SkillAnnotationRecord {
  id?: string;
  session_id: string;
  utterance_id: string;
  question_type: 'open' | 'closed' | 'routine_based' | 'none';
  empathy_level: 0 | 1 | 2 | 3;
  risk_tag: 'judgment' | 'blame' | 'premature_advice' | null;
  domain_tag: 'child_function' | 'daily_routine' | 'family_needs' | 'strengths_resources' | 'rapport' | 'other';
  timestamp: any;
}

export interface InformationChecklistRecord {
  session_id: string;
  child_function_score: number;       // 0~100 (百分比)
  daily_routine_score: number;        // 0~100
  family_needs_score: number;         // 0~100
  strengths_resources_score: number;  // 0~100
  last_updated: any;
}

export interface NPCStateLogRecord {
  id?: string;
  session_id: string;
  timestamp: any;
  trust_score: number;       // 0~100
  defense_score: number;     // 0~100
  rapport_score: number;
  emotion_tag: 'relaxed' | 'defensive' | 'neutral';
  sensitive_triggered: boolean;
}

export interface AIScoreRecord {
  session_id: string;
  dimension_1_rapport: number;        // 0~15
  dimension_2_questioning: number;    // 0~25
  dimension_3_empathy: number;        // 0~20
  dimension_4_family_centered: number;// 0~15
  dimension_5_ifsp_info: number;      // 0~20
  dimension_6_time_mgmt: number;      // 0~5
  total_score: number;                // 0~100
  feedback_comments: string;
  strengths?: string[];
  suggestions?: string[];
  best_question?: string;
  best_question_reason?: string;
  suboptimal_question?: string;
  suggested_alternative?: string;
  created_at: any;
}

export interface SupervisorScoreRecord {
  session_id: string;
  supervisor_id: string;
  dimension_1_rapport: number;        // 0~15
  dimension_2_questioning: number;    // 0~25
  dimension_3_empathy: number;        // 0~20
  dimension_4_family_centered: number;// 0~15
  dimension_5_ifsp_info: number;      // 0~20
  dimension_6_time_mgmt: number;      // 0~5
  total_score: number;                // 0~100
  feedback_comments: string;
  require_repetition: boolean;
  created_at: any;
}

export interface SelfReflectionRecord {
  session_id: string;
  reflection_text: string;
  key_learnings: string;
  created_at: any;
}

// =========================================================================
// 記憶體備援快取（用於無 Firestore 憑證時之流暢模擬）
// =========================================================================
const memoryUsers = new Map<string, UserRecord>();
const memoryCaseProfiles = new Map<string, CaseProfile>();
const memorySessions = new Map<string, TrainingSessionRecord>();
const memoryUtterances = new Map<string, UtteranceRecord[]>();
const memoryAnnotations = new Map<string, SkillAnnotationRecord[]>();
const memoryChecklists = new Map<string, InformationChecklistRecord>();
const memoryNPCLogs = new Map<string, NPCStateLogRecord[]>();
const memoryAIScores = new Map<string, AIScoreRecord>();
const memorySupervisorScores = new Map<string, SupervisorScoreRecord>();
const memoryReflections = new Map<string, SelfReflectionRecord>();

export class FirestoreService {
  constructor() {
    this.seedDefaultCaseProfiles();
    this.seedDefaultUsers();
  }

  /**
   * 初始化預設 8 個個案設定至 case_profiles
   */
  public async seedDefaultCaseProfiles(): Promise<void> {
    for (const cp of caseProfiles) {
      memoryCaseProfiles.set(cp.case_id, cp);
      if (isFirebaseAdminInitialized && db) {
        try {
          await db.collection('case_profiles').doc(cp.case_id).set(cp, { merge: true });
        } catch (e) {
          // ignore seed warnings
        }
      }
    }
  }

  /**
   * 初始化預設學員與督導帳號
   */
  public async seedDefaultUsers(): Promise<void> {
    const defaultUsers: UserRecord[] = [
      {
        user_id: 'trainee_001',
        name: '王小芬 (實習社工)',
        role: 'trainee',
        group: '早療組-A班',
        experience_years: 1,
        created_at: new Date()
      },
      {
        user_id: 'trainee_002',
        name: '陳建宏 (特教教保員)',
        role: 'trainee',
        group: '早療組-A班',
        experience_years: 2,
        created_at: new Date()
      },
      {
        user_id: 'supervisor_demo',
        name: '張淑真 督導教授',
        role: 'supervisor',
        group: '國科會指導組',
        experience_years: 15,
        created_at: new Date()
      }
    ];

    for (const u of defaultUsers) {
      memoryUsers.set(u.user_id, u);
      if (isFirebaseAdminInitialized && db) {
        try {
          await db.collection('users').doc(u.user_id).set(u, { merge: true });
        } catch (e) {
          // ignore
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 1. users
  // -----------------------------------------------------------------------
  public async saveUser(user: UserRecord): Promise<void> {
    const data: UserRecord = {
      ...user,
      created_at: admin?.firestore?.FieldValue?.serverTimestamp() || new Date()
    };
    if (isFirebaseAdminInitialized && db) {
      await db.collection('users').doc(user.user_id).set(data, { merge: true });
    } else {
      memoryUsers.set(user.user_id, data);
    }
  }

  public async getUser(userId: string): Promise<UserRecord | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('users').doc(userId).get();
      if (snap.exists) return snap.data() as UserRecord;
    }
    return memoryUsers.get(userId) || null;
  }

  // -----------------------------------------------------------------------
  // 2. case_profiles
  // -----------------------------------------------------------------------
  public async getCaseProfiles(): Promise<CaseProfile[]> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('case_profiles').get();
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as CaseProfile);
      }
    }
    return Array.from(memoryCaseProfiles.values());
  }

  public async getCaseProfile(caseId: string): Promise<CaseProfile | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('case_profiles').doc(caseId).get();
      if (snap.exists) return snap.data() as CaseProfile;
    }
    return memoryCaseProfiles.get(caseId) || null;
  }

  // -----------------------------------------------------------------------
  // 3. training_sessions
  // -----------------------------------------------------------------------
  public async createSession(
    userId: string,
    caseId: string,
    selectedDuration: '30' | '60' | '90' = '30'
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();

    const record: TrainingSessionRecord = {
      session_id: sessionId,
      user_id: userId,
      case_id: caseId,
      selected_duration: selectedDuration,
      status: 'active',
      created_at: now,
      help_count: 0,
      inventory_count: 0
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('training_sessions').doc(sessionId).set(record);
    } else {
      memorySessions.set(sessionId, record);
    }

    return sessionId;
  }

  public async getSession(sessionId: string): Promise<TrainingSessionRecord | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('training_sessions').doc(sessionId).get();
      if (snap.exists) return snap.data() as TrainingSessionRecord;
    }
    return memorySessions.get(sessionId) || null;
  }

  public async getAllSessions(): Promise<TrainingSessionRecord[]> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('training_sessions').get();
      return snap.docs.map(d => {
        const data = d.data();
        return {
          session_id: data.session_id || data.sessionId || d.id,
          user_id: data.user_id || data.userId || 'anonymous',
          case_id: data.case_id || data.selectedFamilyCase || 'persona_1',
          selected_duration: data.selected_duration || '30',
          status: data.status || (data.isCompleted ? 'completed' : 'active'),
          created_at: data.created_at || data.startTime || new Date(),
          help_count: data.help_count || 0,
          inventory_count: data.inventory_count || 0,
          final_score: data.final_score ?? data.finalRapportScore,
          supervisor_reviewed: data.supervisor_reviewed ?? false,
          require_repetition: data.require_repetition ?? false,
          supervisor_total_score: data.supervisor_total_score
        } as TrainingSessionRecord;
      }).sort((a, b) => {
        const tA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at || 0).getTime();
        const tB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at || 0).getTime();
        return tB - tA;
      });
    }
    return Array.from(memorySessions.values()).sort((a, b) => {
      const tA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime();
      const tB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime();
      return tB - tA;
    });
  }

  public async updateSession(sessionId: string, updates: Partial<TrainingSessionRecord>): Promise<void> {
    if (isFirebaseAdminInitialized && db) {
      await db.collection('training_sessions').doc(sessionId).set(updates, { merge: true });
    } else {
      const existing = memorySessions.get(sessionId);
      if (existing) {
        memorySessions.set(sessionId, { ...existing, ...updates });
      }
    }
  }

  public async incrementSessionCounter(sessionId: string, type: 'help' | 'inventory'): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    const updates: Partial<TrainingSessionRecord> = {};
    if (type === 'help') {
      updates.help_count = (session.help_count || 0) + 1;
    } else {
      updates.inventory_count = (session.inventory_count || 0) + 1;
    }
    await this.updateSession(sessionId, updates);
  }

  // -----------------------------------------------------------------------
  // 4. utterances
  // -----------------------------------------------------------------------
  public async addUtterance(data: Omit<UtteranceRecord, 'timestamp'>): Promise<string> {
    const id = data.utterance_id || `utt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const record: UtteranceRecord = {
      ...data,
      utterance_id: id,
      timestamp: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('utterances').doc(id).set(record);
    } else {
      const list = memoryUtterances.get(data.session_id) || [];
      list.push({ ...record, timestamp: new Date() });
      memoryUtterances.set(data.session_id, list);
    }
    return id;
  }

  public async getSessionUtterances(sessionId: string): Promise<UtteranceRecord[]> {
    if (!sessionId) return [];
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('utterances')
        .where('session_id', '==', sessionId)
        .get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UtteranceRecord));
      return list.sort((a, b) => {
        const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return tA - tB;
      });
    }
    const list = memoryUtterances.get(sessionId) || [];
    return [...list];
  }

  // -----------------------------------------------------------------------
  // 5. skill_annotations
  // -----------------------------------------------------------------------
  public async addSkillAnnotation(data: Omit<SkillAnnotationRecord, 'timestamp'>): Promise<void> {
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const record: SkillAnnotationRecord = {
      ...data,
      timestamp: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('skill_annotations').add(record);
    } else {
      const list = memoryAnnotations.get(data.session_id) || [];
      list.push({ ...record, timestamp: new Date() });
      memoryAnnotations.set(data.session_id, list);
    }
  }

  public async getSessionSkillAnnotations(sessionId: string): Promise<SkillAnnotationRecord[]> {
    if (!sessionId) return [];
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('skill_annotations')
        .where('session_id', '==', sessionId)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SkillAnnotationRecord));
    }
    return memoryAnnotations.get(sessionId) || [];
  }

  // -----------------------------------------------------------------------
  // 6. information_checklists
  // -----------------------------------------------------------------------
  public async initInformationChecklist(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const record: InformationChecklistRecord = {
      session_id: sessionId,
      child_function_score: 10,
      daily_routine_score: 5,
      family_needs_score: 5,
      strengths_resources_score: 5,
      last_updated: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('information_checklists').doc(sessionId).set(record);
    } else {
      memoryChecklists.set(sessionId, record);
    }
  }

  public async updateInformationChecklist(
    sessionId: string,
    delta: { child_function?: number; daily_routine?: number; family_needs?: number; strengths_resources?: number }
  ): Promise<InformationChecklistRecord> {
    let current = await this.getInformationChecklist(sessionId);
    if (!current) {
      await this.initInformationChecklist(sessionId);
      current = (await this.getInformationChecklist(sessionId))!;
    }

    const updated: InformationChecklistRecord = {
      session_id: sessionId,
      child_function_score: Math.min(100, Math.max(0, (current?.child_function_score || 0) + (delta.child_function || 0))),
      daily_routine_score: Math.min(100, Math.max(0, (current?.daily_routine_score || 0) + (delta.daily_routine || 0))),
      family_needs_score: Math.min(100, Math.max(0, (current?.family_needs_score || 0) + (delta.family_needs || 0))),
      strengths_resources_score: Math.min(100, Math.max(0, (current?.strengths_resources_score || 0) + (delta.strengths_resources || 0))),
      last_updated: admin?.firestore?.FieldValue?.serverTimestamp() || new Date()
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('information_checklists').doc(sessionId).set(updated, { merge: true });
    } else {
      memoryChecklists.set(sessionId, updated);
    }

    return updated;
  }

  public async getInformationChecklist(sessionId: string): Promise<InformationChecklistRecord | null> {
    if (!sessionId) return null;
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('information_checklists').doc(sessionId).get();
      if (snap.exists) return snap.data() as InformationChecklistRecord;
    }
    return memoryChecklists.get(sessionId) || null;
  }

  // -----------------------------------------------------------------------
  // 7. npc_state_logs
  // -----------------------------------------------------------------------
  public async addNPCStateLog(
    sessionId: string,
    trustScore: number,
    defenseScore: number,
    rapportScore: number,
    emotionTag: 'relaxed' | 'defensive' | 'neutral',
    sensitiveTriggered: boolean
  ): Promise<void> {
    if (!sessionId) return;
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const record: NPCStateLogRecord = {
      session_id: sessionId,
      trust_score: trustScore,
      defense_score: defenseScore,
      rapport_score: rapportScore,
      emotion_tag: emotionTag,
      sensitive_triggered: sensitiveTriggered,
      timestamp: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('npc_state_logs').add(record);
    } else {
      const list = memoryNPCLogs.get(sessionId) || [];
      list.push({ ...record, timestamp: new Date() });
      memoryNPCLogs.set(sessionId, list);
    }
  }

  public async getSessionNPCStateLogs(sessionId: string): Promise<NPCStateLogRecord[]> {
    if (!sessionId) return [];
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('npc_state_logs')
        .where('session_id', '==', sessionId)
        .get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NPCStateLogRecord));
      return list.sort((a, b) => {
        const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return tA - tB;
      });
    }
    return memoryNPCLogs.get(sessionId) || [];
  }

  // -----------------------------------------------------------------------
  // 8. ai_scores & supervisor_scores
  // -----------------------------------------------------------------------
  public async saveAIScores(
    sessionId: string, 
    report: Omit<AIScoreRecord, 'session_id' | 'created_at'> | AIScoreRecord
  ): Promise<void> {
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const data: AIScoreRecord = {
      ...report,
      session_id: sessionId,
      created_at: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('ai_scores').doc(sessionId).set(data);
    } else {
      memoryAIScores.set(sessionId, data);
    }
  }

  public async getAIScores(sessionId: string): Promise<AIScoreRecord | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('ai_scores').doc(sessionId).get();
      if (snap.exists) return snap.data() as AIScoreRecord;
    }
    return memoryAIScores.get(sessionId) || null;
  }

  public async saveSupervisorScores(sessionId: string, review: SupervisorScoreRecord): Promise<void> {
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const data: SupervisorScoreRecord = {
      ...review,
      session_id: sessionId,
      created_at: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('supervisor_scores').doc(sessionId).set(data);
    } else {
      memorySupervisorScores.set(sessionId, data);
    }

    // 更新 training_sessions 標記
    await this.updateSession(sessionId, {
      supervisor_reviewed: true,
      require_repetition: review.require_repetition,
      supervisor_total_score: review.total_score
    });
  }

  public async getSupervisorScores(sessionId: string): Promise<SupervisorScoreRecord | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('supervisor_scores').doc(sessionId).get();
      if (snap.exists) return snap.data() as SupervisorScoreRecord;
    }
    return memorySupervisorScores.get(sessionId) || null;
  }

  // -----------------------------------------------------------------------
  // 9. self_reflections
  // -----------------------------------------------------------------------
  public async saveSelfReflection(sessionId: string, reflection: SelfReflectionRecord): Promise<void> {
    const now = admin?.firestore?.FieldValue?.serverTimestamp() || new Date();
    const data: SelfReflectionRecord = {
      ...reflection,
      session_id: sessionId,
      created_at: now
    };

    if (isFirebaseAdminInitialized && db) {
      await db.collection('self_reflections').doc(sessionId).set(data);
    } else {
      memoryReflections.set(sessionId, data);
    }
  }

  public async getSelfReflection(sessionId: string): Promise<SelfReflectionRecord | null> {
    if (isFirebaseAdminInitialized && db) {
      const snap = await db.collection('self_reflections').doc(sessionId).get();
      if (snap.exists) return snap.data() as SelfReflectionRecord;
    }
    return memoryReflections.get(sessionId) || null;
  }

  // -----------------------------------------------------------------------
  // 取得完整場次明細 (儀表板深度報告使用)
  // -----------------------------------------------------------------------
  public async getSessionFullDetails(sessionId: string) {
    const session = await this.getSession(sessionId);
    const caseProfile = session ? await this.getCaseProfile(session.case_id) : null;
    const user = session ? await this.getUser(session.user_id) : null;
    const utterances = await this.getSessionUtterances(sessionId);
    const annotations = await this.getSessionSkillAnnotations(sessionId);
    const npcLogs = await this.getSessionNPCStateLogs(sessionId);
    const checklist = await this.getInformationChecklist(sessionId);
    const aiScores = await this.getAIScores(sessionId);
    const supervisorScores = await this.getSupervisorScores(sessionId);
    const selfReflection = await this.getSelfReflection(sessionId);

    return {
      session,
      caseProfile,
      user,
      utterances,
      annotations,
      npcLogs,
      checklist,
      aiScores,
      supervisorScores,
      selfReflection
    };
  }
}

export const firestoreService = new FirestoreService();
