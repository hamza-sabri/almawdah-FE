"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  agentPrint,
  agentStatus,
  testSlipEscPos,
  type AgentStatus,
} from "@/lib/print/agent"
import { toBase64 } from "@/lib/print/escpos"
import { cn } from "@/lib/utils"

/**
 * Install-and-verify panel for the local print agent.
 *
 * This is the whole manual. The person reading it is a shopkeeper, or a
 * freelancer on a remote-desktop session at midnight — anything they have to
 * be TOLD, out of band, is a step that will not happen. So every step for both
 * platforms lives here, including the two scary OS dialogs quoted in the words
 * they actually say, and what each status line means.
 *
 * It re-checks every two seconds while open, so nobody has to guess when to
 * press anything: install the file, look back at the screen, it is green.
 */

type Os = "windows" | "mac-arm" | "mac-intel"

const FILES: Record<Os, { file: string; label: string; short: string }> = {
  windows: { file: "mawadda-print.exe", label: "ويندوز", short: "Windows" },
  "mac-arm": {
    file: "mawadda-print-mac-arm64.zip",
    label: "ماك — Apple Silicon (M1/M2/M3/M4)",
    short: "macOS",
  },
  "mac-intel": {
    file: "mawadda-print-mac-intel.zip",
    label: "ماك — Intel",
    short: "macOS",
  },
}

/** Best guess at the machine this browser is on; the person can override it. */
function guessOs(): Os {
  if (typeof navigator === "undefined") return "windows"
  if (!/Mac/i.test(navigator.userAgent)) return "windows"
  // Apple Silicon does not announce itself in the user agent; the GPU renderer
  // string does. Guessing wrong costs one wrong download — the other button is
  // right there.
  try {
    const gl = document
      .createElement("canvas")
      .getContext("webgl") as WebGLRenderingContext | null
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info")
    const r = dbg ? String(gl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ""
    if (/Apple/i.test(r)) return "mac-arm"
    if (/Intel/i.test(r)) return "mac-intel"
  } catch {
    /* blocked by a privacy setting — fall through */
  }
  return "mac-arm"
}

/**
 * Last resort on macOS. The bundle is ad-hoc signed, so the normal path is
 * Privacy & Security → Open Anyway; this only matters if a particular macOS
 * build still refuses. Windows never needs it.
 */
const MAC_RESCUE =
  "xattr -dr com.apple.quarantine ~/Downloads/MawaddaPrint.app && open ~/Downloads/MawaddaPrint.app"

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex items-stretch gap-1.5">
      <code
        dir="ltr"
        className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-muted px-2 py-1.5 text-[10px] leading-5"
      >
        {text}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }}
        title="نسخ"
        className="shrink-0 rounded-lg border px-2 transition hover:bg-muted"
      >
        {done ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {n}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-s-2 border-primary/40 bg-primary/5 px-2.5 py-1.5">
      {children}
    </div>
  )
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border bg-muted/30 px-2.5 py-2">
      <summary className="cursor-pointer text-[11px] font-semibold">{title}</summary>
      <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  )
}

function WindowsSteps() {
  return (
    <ol className="space-y-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Step n="١">
        <b className="text-foreground">اضبط الطابعة الافتراضية.</b>
        <br />
        Settings ← Bluetooth &amp; devices ← Printers &amp; scanners ← اختر
        الطابعة ← <b>Set as default</b>. واطبع منها Test Page للتأكد أن ويندوز
        نفسه يطبع — إن لم يطبع من هنا فلن يصلحه أي تطبيق.
      </Step>
      <Step n="٢">
        <b className="text-foreground">نزّل الملف</b> من الزر أعلاه على جهاز
        الكاشير.
      </Step>
      <Step n="٣">
        <b className="text-foreground">افتحه بضغطتين.</b> لا يحتاج صلاحيات مدير،
        ولا إعادة تشغيل، ولا يثبّت أي تعريف.
      </Step>
      <Step n="٤">
        ستظهر شاشة زرقاء:{" "}
        <i className="text-foreground">«Windows protected your PC»</i>. اضغط{" "}
        <b className="text-foreground">More info</b> ثم{" "}
        <b className="text-foreground">Run anyway</b>.
        <br />
        تظهر لأن الملف غير موقّع رقمياً — التوقيع يتطلب شهادة سنوية مدفوعة.
      </Step>
      <Step n="٥">
        ستظهر رسالة <b className="text-foreground">«تم التثبيت»</b> مع اسم
        الطابعة. اضغط حسناً.
      </Step>
      <Step n="٦">
        <b className="text-foreground">ارجع إلى هذه الصفحة.</b> إن سأل المتصفح عن
        السماح بالوصول إلى الشبكة المحلية اضغط{" "}
        <b className="text-foreground">Allow</b> (مرة واحدة فقط). سيتحوّل السطر
        أعلاه إلى <b className="text-success">متصل ✅</b> وحده خلال ثانيتين.
      </Step>
      <Step n="٧">
        اضغط <b className="text-foreground">«طباعة ورقة اختبار»</b> — يجب أن تخرج
        ورقة مكتوب عليها <span dir="ltr">TEST OK</span>. هذه هي اللحظة التي
        تعرف فيها أن كل شيء يعمل.
      </Step>
    </ol>
  )
}

function MacSteps() {
  return (
    <ol className="space-y-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Step n="١">
        <b className="text-foreground">اضبط الطابعة الافتراضية.</b>
        <br />
        System Settings ← Printers &amp; Scanners ← <b>Default printer</b>.
      </Step>
      <Step n="٢">
        <b className="text-foreground">نزّل الملف</b> من الزر أعلاه، ثم افتح ملف
        الـ zip بضغطتين — سيظهر تطبيق باسم{" "}
        <b className="text-foreground">MawaddaPrint</b>.
        <br />
        إن كنت جرّبت قبل الآن، احذف النسخ القديمة من Downloads أولاً حتى لا تفتح
        نسخة قديمة بالخطأ.
      </Step>
      <Step n="٣">
        <b className="text-foreground">افتح MawaddaPrint بضغطتين.</b> سيرفضه
        الماك في أول مرة برسالة{" "}
        <i className="text-foreground">
          «Apple cannot check it for malicious software»
        </i>{" "}
        — اضغط <b className="text-foreground">OK</b>.
        <br />
        هذا متوقّع ولا يعني أن الملف تالف؛ الخطوة التالية هي الحل.
      </Step>
      <Step n="٤">
        افتح{" "}
        <b className="text-foreground">System Settings ← Privacy &amp; Security</b>
        ، انزل إلى قسم <b className="text-foreground">Security</b>، وستجد سطراً
        عن MawaddaPrint فيه زر <b className="text-foreground">Open Anyway</b> —
        اضغطه، ثم <b className="text-foreground">Open</b> في التأكيد.
        <Note>
          <span className="text-foreground">
            يظهر زر Open Anyway بعد المحاولة في الخطوة ٣ فقط
          </span>{" "}
          — لا تقلب الترتيب. والضغط بالزر الأيمن لم يعد يكفي في نسخ الماك
          الحديثة.
        </Note>
      </Step>
      <Step n="٥">
        ستظهر رسالة <b className="text-foreground">«تم التثبيت»</b> مع اسم
        الطابعة. اضغط حسناً.
      </Step>
      <Step n="٦">
        <b className="text-foreground">ارجع إلى هذه الصفحة.</b> إن سأل المتصفح عن
        السماح بالوصول إلى الشبكة المحلية اضغط{" "}
        <b className="text-foreground">Allow</b> (مرة واحدة فقط). سيتحوّل السطر
        أعلاه إلى <b className="text-success">متصل ✅</b> وحده خلال ثانيتين.
      </Step>
      <Step n="٧">
        اضغط <b className="text-foreground">«طباعة ورقة اختبار»</b> — يجب أن تخرج
        ورقة مكتوب عليها <span dir="ltr">TEST OK</span>.
      </Step>
    </ol>
  )
}

export function PrintAgentCard() {
  const [os, setOs] = useState<Os>("windows")
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const alive = useRef(true)

  const check = useCallback(async (manual = false) => {
    if (manual) setChecking(true)
    const s = await agentStatus()
    if (!alive.current) return
    setStatus(s)
    setChecking(false)
  }, [])

  useEffect(() => {
    alive.current = true
    setOs(guessOs())
    void check()
    const id = setInterval(() => void check(), 2000)
    return () => {
      alive.current = false
      clearInterval(id)
    }
  }, [check])

  /**
   * Print a short slip on demand.
   *
   * It separates "is it wired up" from "does this printer like our bytes" —
   * two failures that look identical from a sale, and only one of which is
   * ours. Ten seconds over a remote session, no fake sale in the books.
   */
  async function testPrint() {
    setTesting(true)
    try {
      const res = await agentPrint(toBase64(testSlipEscPos()), "اختبار الطباعة")
      if (res.ok)
        toast.success("أُرسلت الورقة التجريبية — تحقّق من الطابعة", {
          id: "print-test",
          duration: 4000,
        })
      else
        toast.error("لم تُطبع الورقة التجريبية", {
          id: "print-test",
          description: res.detail || "الطابعة رفضت المهمة",
          duration: 8000,
        })
    } finally {
      setTesting(false)
    }
  }

  const ok = status?.available === true
  const noPrinter = status?.available === false && status.reason === "no-printer"
  const isMac = os !== "windows"

  return (
    <div className="space-y-3 rounded-2xl border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-bold">الطباعة المباشرة (بدون نافذة طباعة)</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          برنامج صغير يعمل على جهاز الكاشير ويطبع مباشرة على الطابعة. بدونه يفتح
          المتصفح نافذة الطباعة عند كل عملية بيع — وهذه نافذة المتصفح نفسه، لا
          يستطيع أي تطبيق داخل الصفحة إخفاءها.{" "}
          <b className="text-foreground">لا يثبّت أي تعريف</b>؛ يستخدم تعريف
          الطابعة الموجود على الجهاز أصلاً.
        </p>
      </div>

      {/* The answer to "did it work" — the reason this card exists. */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold",
          ok
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/50 bg-warning/10 text-foreground",
        )}
      >
        {status === null ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : ok ? (
          <CheckCircle2 className="size-4 shrink-0" />
        ) : (
          <XCircle className="size-4 shrink-0" />
        )}
        <span className="flex-1">
          {status === null
            ? "جارٍ الفحص…"
            : ok
              ? `متصل ✅ — سيُطبع على: ${status.printer || "الطابعة الافتراضية"}`
              : noPrinter
                ? "البرنامج مثبّت ويعمل ✅ — لكن لا توجد طابعة افتراضية على هذا الجهاز"
                : "غير مثبّت على هذا الجهاز — اتبع الخطوات بالأسفل"}
        </span>
        <button
          type="button"
          onClick={() => void check(true)}
          disabled={checking}
          title="إعادة الفحص"
          className="shrink-0 rounded-lg p-1 transition hover:bg-foreground/10 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
        </button>
      </div>

      {/* Half-success: the risky half (install + connection) is already proven. */}
      {noPrinter && (
        <p className="rounded-xl border border-dashed p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          هذا يعني أن التثبيت والاتصال بالتطبيق نجحا — الجزء الصعب — ولم يبقَ إلا
          طابعة. اضبط طابعة افتراضية في إعدادات النظام وسيتحوّل السطر إلى{" "}
          <b className="text-success">متصل</b> وحده.
        </p>
      )}

      {ok && (
        <button
          type="button"
          onClick={() => void testPrint()}
          disabled={testing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50"
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          طباعة ورقة اختبار
        </button>
      )}

      {/* Nothing below this line is needed once it is connected. */}
      {!ok && (
        <>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold">١. اختر جهاز الكاشير:</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FILES) as Os[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOs(k)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px] font-semibold transition",
                    os === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {FILES[k].label}
                </button>
              ))}
            </div>
            <a
              href={`/agent/${FILES[os].file}`}
              download
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              <Download className="size-4" />
              تنزيل برنامج الطباعة — {FILES[os].short}
            </a>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold">
              ٢. الخطوات على {isMac ? "الماك" : "ويندوز"}:
            </p>
            {isMac ? <MacSteps /> : <WindowsSteps />}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold">إن واجهت مشكلة:</p>

            <Fold title="السطر أعلاه بقي أحمر بعد التثبيت">
              <p>
                غالباً المتصفح منع الوصول إلى الشبكة المحلية. اضغط على أيقونة
                القفل/الإعدادات بجانب عنوان الموقع في المتصفح ← Site settings ←
                ابحث عن <b>Local network</b> أو <b>Insecure content</b> واجعلها{" "}
                <b>Allow</b>، ثم حدّث الصفحة.
              </p>
              <p>
                إن بقيت حمراء: افتح <code dir="ltr">http://127.0.0.1:9110</code>{" "}
                في تبويب جديد. إن ظهرت صفحة «خادم الطباعة يعمل» فالبرنامج شغّال
                والمشكلة في إذن المتصفح فقط؛ وإن لم تظهر فالبرنامج لم يبدأ — أعد
                فتحه بضغطتين.
              </p>
            </Fold>

            <Fold title="ورقة الاختبار لم تخرج">
              <p>
                اقرأ نص الخطأ في التنبيه الأحمر وأرسله لي — يحدّد بدقة أين توقّف.
                وتأكّد أولاً أن الطابعة تطبع Test Page من إعدادات النظام نفسه.
              </p>
            </Fold>

            {isMac && (
              <Fold title="الماك يقول «MawaddaPrint is damaged»">
                <p>
                  رسالة <i>damaged</i> تعني أن الماك رفض الملف، لا أنه تالف
                  فعلاً. احذف النسخ القديمة من Downloads ونزّل من جديد أولاً. إن
                  تكرّرت، انسخ هذا السطر والصقه في Terminal مرة واحدة:
                </p>
                <CopyLine text={MAC_RESCUE} />
                <p>(لا يحدث هذا على ويندوز إطلاقاً.)</p>
              </Fold>
            )}

            <Fold title="كيف أوقفه أو أحذفه">
              <p>
                <b>ويندوز:</b> Task Manager ← Startup apps ← عطّل MawaddaPrint،
                واحذف المجلد <code dir="ltr">%APPDATA%\MawaddaPrint</code>.
              </p>
              <p>
                <b>ماك:</b> احذف{" "}
                <code dir="ltr">~/Library/LaunchAgents/com.mawadda.print.plist</code>{" "}
                وأعد تشغيل الجهاز.
              </p>
            </Fold>
          </div>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        يبدأ البرنامج تلقائياً مع تشغيل الجهاز. إن توقّف يوماً، يعود التطبيق إلى
        تنزيل الفاتورة كملف — ولا تتعطّل عملية البيع أبداً.
      </p>
    </div>
  )
}
