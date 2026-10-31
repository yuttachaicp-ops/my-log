/** แหล่งข้อมูลบนคลาวด์ด้วย Supabase — ใช้เมื่ออยากให้มือถือกับคอมเห็นข้อมูลชุดเดียวกัน
 *
 *  ออกแบบไว้สองข้อที่สำคัญที่สุด
 *
 *  1. ไม่แตะข้อมูลในเครื่องเลย โหมดคลาวด์เป็นคนละชุดกับโหมด "ข้อมูลของฉัน"
 *     ถ้าต่อคลาวด์แล้วไม่ชอบ สลับกลับมาก็เจอของเดิมครบ ย้ายข้อมูลด้วย export/import
 *
 *  2. คลาวด์เป็นเจ้าของความจริง ทุกการเขียนยิงขึ้นเซิร์ฟเวอร์แล้วโหลดกลับ
 *     จงใจไม่ทำ merge สองทาง เพราะการ merge ข้อมูลการเงินผิดพลาดแล้วเงินหาย
 *     อันตรายกว่าการรอเน็ตนิดหน่อย
 *
 *  ไม่ใช้ SDK ของ Supabase เพื่อไม่ต้องเพิ่ม dependency ยิง REST ตรง ๆ พอ
 *  ทุกตารางเปิด Row Level Security และผูกกับ user_id ของคนที่ล็อกอิน
 *  คนอื่นที่รู้ anon key ก็อ่านข้อมูลของคุณไม่ได้ (ดู supabase-schema.sql)
 */

import type {
  Account, Category, Dataset, RecurringItem, SavingsGoal, Transaction,
} from '../types';
import { AppError, newId, type DataSource, type NewTransaction, type TxPatch } from './source';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults';
import { round2 } from '../lib/money';
import { isValidDateISO } from '../lib/date';
import { buildImportedDataset, type ImportMode } from './portable';

const CFG_KEY = 'mylog.cloud.config';
const SESSION_KEY = 'mylog.cloud.session';

export interface CloudConfig {
  /** เช่น https://xxxx.supabase.co */
  url: string;
  /** anon public key — ปลอดภัยที่จะอยู่ในหน้าเว็บ เพราะ RLS เป็นตัวกั้นจริง */
  anonKey: string;
}

interface Session {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
}

export function readCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CloudConfig;
    return c.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

export function writeCloudConfig(c: CloudConfig | null): void {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch { /* โหมดส่วนตัวอาจเขียนไม่ได้ */ }
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ไม่เป็นไร */ }
}

export function isCloudReady(): boolean {
  return !!readCloudConfig() && !!readSession();
}

/** ---------------------------------------------------------------- Auth */

async function authCall(
  cfg: CloudConfig, path: string, body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${cfg.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (json.msg as string) || (json.error_description as string) ||
      (json.message as string) || 'เชื่อมต่อคลาวด์ไม่สำเร็จ';
    throw new AppError(msg);
  }
  return json;
}

function storeSession(j: Record<string, unknown>): Session {
  const user = j.user as { id?: string; email?: string } | undefined;
  const s: Session = {
    access_token: String(j.access_token || ''),
    refresh_token: String(j.refresh_token || ''),
    user_id: String(user?.id || ''),
    email: String(user?.email || ''),
  };
  if (!s.access_token || !s.user_id) throw new AppError('ไม่ได้รับสิทธิ์เข้าใช้จากคลาวด์');
  writeSession(s);
  return s;
}

export async function cloudSignUp(cfg: CloudConfig, email: string, password: string) {
  const j = await authCall(cfg, 'signup', { email, password });
  // ถ้าโปรเจกต์เปิดยืนยันอีเมลไว้ จะยังไม่ได้ token กลับมา
  if (!j.access_token) {
    throw new AppError('สมัครแล้ว กรุณายืนยันอีเมลก่อน แล้วค่อยกดเข้าสู่ระบบ');
  }
  return storeSession(j);
}

export async function cloudSignIn(cfg: CloudConfig, email: string, password: string) {
  const j = await authCall(cfg, 'token?grant_type=password', { email, password });
  return storeSession(j);
}

export function cloudSignOut(): void {
  writeSession(null);
}

/** ------------------------------------------------------------ PostgREST */

const TABLES = ['accounts', 'categories', 'transactions', 'recurring', 'goals'] as const;

export class SupabaseDataSource implements DataSource {
  readonly label = 'ข้อมูลบนคลาวด์ (ซิงค์ทุกเครื่อง)';
  readonly isSample = false;
  readonly readOnly = false;

  private cfg: CloudConfig;

  constructor(cfg: CloudConfig) {
    this.cfg = cfg;
  }

  private session(): Session {
    const s = readSession();
    if (!s) throw new AppError('ยังไม่ได้เข้าสู่ระบบคลาวด์');
    return s;
  }

  private async rest(
    path: string, init: RequestInit = {}, retry = true,
  ): Promise<unknown> {
    const s = this.session();
    const res = await fetch(`${this.cfg.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.cfg.anonKey,
        Authorization: `Bearer ${s.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    });

    // token หมดอายุ ลองต่ออายุให้เองหนึ่งครั้ง ผู้ใช้จะไม่รู้สึกว่าหลุด
    if (res.status === 401 && retry && s.refresh_token) {
      try {
        const j = await authCall(this.cfg, 'token?grant_type=refresh_token', {
          refresh_token: s.refresh_token,
        });
        storeSession(j);
        return this.rest(path, init, false);
      } catch {
        writeSession(null);
        throw new AppError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบคลาวด์ใหม่');
      }
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new AppError(`คลาวด์ตอบกลับผิดพลาด (${res.status}) ${txt.slice(0, 180)}`);
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  private uid(): string {
    return this.session().user_id;
  }

  async load(): Promise<Dataset> {
    const [accounts, categories, transactions, recurring, goals, settingsRows] =
      (await Promise.all([
        ...TABLES.map((t) => this.rest(`${t}?select=*`)),
        this.rest('settings?select=*&limit=1'),
      ])) as [
        Account[], Category[], Transaction[], RecurringItem[], SavingsGoal[],
        { opening_balance: number }[],
      ];

    // บัญชีแรกเข้ามาใช้ ยังไม่มีอะไรเลย — ใส่ค่าตั้งต้นขึ้นคลาวด์ให้ครั้งเดียว
    if (!accounts.length && !categories.length && !transactions.length) {
      await this.seed();
      return this.load();
    }

    return {
      accounts, categories, transactions, recurring, goals,
      settings: {
        ...DEFAULT_SETTINGS,
        openingBalance: round2(settingsRows?.[0]?.opening_balance ?? 0),
      },
    };
  }

  private async seed(): Promise<void> {
    const user_id = this.uid();
    await this.rest('categories', {
      method: 'POST',
      body: JSON.stringify(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id }))),
    });
    await this.rest('accounts', {
      method: 'POST',
      body: JSON.stringify(DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id }))),
    });
    await this.rest('settings', {
      method: 'POST',
      body: JSON.stringify([{ user_id, opening_balance: 0 }]),
    });
  }

  private validateTx(t: Partial<Transaction>): void {
    if (!t.name || !String(t.name).trim()) throw new AppError('กรุณาใส่ชื่อรายการ');
    if (!isFinite(Number(t.amount)) || Number(t.amount) <= 0) {
      throw new AppError('จำนวนเงินต้องมากกว่า 0');
    }
    if (!isValidDateISO(String(t.date))) throw new AppError('วันที่ไม่ถูกต้อง');
    if (t.type === 'transfer') {
      if (!t.accountId || !t.toAccountId) throw new AppError('การโอนต้องเลือกทั้งสองบัญชี');
      if (t.accountId === t.toAccountId) throw new AppError('บัญชีต้นทางกับปลายทางต้องคนละบัญชี');
      return;
    }
    if (!t.categoryId) throw new AppError('กรุณาเลือกหมวดหมู่');
  }

  async createTransaction(input: NewTransaction): Promise<Transaction> {
    this.validateTx(input);
    const now = new Date().toISOString();
    const row: Transaction & { user_id: string } = {
      ...input,
      amount: round2(input.amount),
      name: input.name.trim(),
      id: newId('tx'),
      createdAt: now,
      updatedAt: now,
      user_id: this.uid(),
    };
    const out = (await this.rest('transactions', {
      method: 'POST', body: JSON.stringify([row]),
    })) as Transaction[];
    return out[0];
  }

  async updateTransaction(id: string, patch: TxPatch): Promise<Transaction> {
    const body = { ...patch, updatedAt: new Date().toISOString() };
    if (patch.amount !== undefined) body.amount = round2(patch.amount);
    const out = (await this.rest(`transactions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(body),
    })) as Transaction[];
    if (!out?.length) throw new AppError('ไม่พบรายการที่ต้องการแก้ไข');
    return out[0];
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.rest(`transactions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  private async upsert<T extends { id: string }>(table: string, row: T, prefix: string): Promise<T> {
    const withId = { ...row, id: row.id || newId(prefix), user_id: this.uid() };
    const out = (await this.rest(table, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([withId]),
    })) as T[];
    return out[0];
  }

  async saveCategory(c: Category): Promise<Category> {
    if (!c.name.trim()) throw new AppError('กรุณาใส่ชื่อหมวดหมู่');
    return this.upsert('categories', { ...c, name: c.name.trim() }, 'cat');
  }

  async deleteCategory(id: string): Promise<void> {
    await this.rest(`categories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async saveAccount(a: Account): Promise<Account> {
    if (!a.name.trim()) throw new AppError('กรุณาใส่ชื่อบัญชี');
    return this.upsert('accounts', {
      ...a, name: a.name.trim(), openingBalance: round2(a.openingBalance || 0),
    }, 'acc');
  }

  async deleteAccount(id: string): Promise<void> {
    await this.rest(`accounts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async saveRecurring(r: RecurringItem): Promise<RecurringItem> {
    if (!r.name.trim()) throw new AppError('กรุณาใส่ชื่อรายการ');
    const now = new Date().toISOString();
    return this.upsert('recurring', {
      ...r, name: r.name.trim(), amount: round2(r.amount),
      createdAt: r.createdAt || now, updatedAt: now,
    }, 'rec');
  }

  async deleteRecurring(id: string): Promise<void> {
    await this.rest(`recurring?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async saveGoal(g: SavingsGoal): Promise<SavingsGoal> {
    if (!g.name.trim()) throw new AppError('กรุณาใส่ชื่อเป้าหมาย');
    if (!isFinite(g.targetAmount) || g.targetAmount <= 0) {
      throw new AppError('ยอดเป้าหมายต้องมากกว่า 0');
    }
    return this.upsert('goals', {
      ...g, name: g.name.trim(),
      targetAmount: round2(g.targetAmount),
      savedAmount: round2(Math.max(0, g.savedAmount || 0)),
    }, 'goal');
  }

  async deleteGoal(id: string): Promise<void> {
    await this.rest(`goals?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async setOpeningBalance(amount: number): Promise<void> {
    await this.rest('settings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ user_id: this.uid(), opening_balance: round2(amount) }]),
    });
  }

  /** นำเข้าชุดข้อมูลทั้งก้อนขึ้นคลาวด์ ใช้ตอนย้ายจากเครื่องมาครั้งแรก */
  async importDataset(d: Dataset, replace: boolean): Promise<number> {
    const user_id = this.uid();
    if (replace) {
      for (const t of TABLES) {
        await this.rest(`${t}?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE' });
      }
    }
    const put = async (table: string, rows: unknown[]) => {
      if (!rows.length) return;
      await this.rest(table, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows.map((r) => ({ ...(r as object), user_id }))),
      });
    };
    await put('categories', d.categories);
    await put('accounts', d.accounts);
    await put('recurring', d.recurring);
    await put('goals', d.goals);
    await put('transactions', d.transactions);
    await this.setOpeningBalance(d.settings.openingBalance);
    return d.transactions.length;
  }

  /** ส่งออกชุดข้อมูลบนคลาวด์เป็นไฟล์ JSON ไว้สำรอง
   *  รูปแบบเดียวกับโหมดในเครื่อง ไฟล์จึงย้ายข้ามโหมดได้ */
  async exportJSON(): Promise<string> {
    return JSON.stringify(await this.load(), null, 2);
  }

  /** นำเข้าไฟล์ JSON ขึ้นคลาวด์โดยตรง ไม่ต้องอ้อมผ่านโหมดในเครื่องอีกต่อไป
   *  ประกอบชุดใหม่ให้เสร็จและตรวจครบทุกแถวก่อน แล้วค่อยเขียนทับทีเดียว */
  async importJSON(text: string, mode: ImportMode = 'replace'): Promise<number> {
    const current = await this.load();
    const { next, added } = buildImportedDataset(text, current, mode, (t) => this.validateTx(t));
    await this.importDataset(next, true);
    return added;
  }
}
