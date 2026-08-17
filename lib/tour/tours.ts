/**
 * Interactive guided-tour definitions. Each tour is a sequence of steps that
 * spotlight a real element on the real screen (by its `data-tour` anchor) and
 * explain it. Steps with a `route` navigate there first. Steps with no anchor
 * (or whose anchor isn't on the page) render as a centered card, so a tour is
 * always coherent even if a specific control isn't tagged.
 *
 * Tours run inside the safe tour-demo sandbox (see lib/tour/demo.ts): every API
 * call is served by the in-browser mock backend, so nothing is ever written to
 * the real store while the user practises.
 */

export type TourPlacement = "top" | "bottom" | "start" | "end" | "auto"

export type TourStep = {
  /** `data-tour` value (preferred) or a CSS selector to spotlight. */
  anchor?: string
  /** Client route to visit before showing this step. */
  route?: string
  title: string
  body: string
  placement?: TourPlacement
  /**
   * CSS selector — when the user actually performs the action (clicks a
   * matching element, e.g. a product tile or the checkout button) the tour
   * advances to the next step on its own.
   */
  advanceOn?: string
  /** Enter/Return also advances this step (used on the "complete sale" step). */
  advanceOnEnter?: boolean
}

export type Tour = {
  id: string
  title: string
  subtitle: string
  /** lucide-react icon name, resolved in the guide hub. */
  icon: string
  steps: TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: "new-sale",
    title: "بيع جديد",
    subtitle: "من مسح الباركود حتى طباعة الفاتورة",
    icon: "ShoppingBag",
    steps: [
      {
        route: "/pos",
        anchor: "nav-pos",
        title: "نقطة البيع",
        body: "كل عملية بيع تبدأ من هنا. لنقم ببيعٍ تجريبي معاً — اضغط «التالي».",
      },
      {
        anchor: "pos-search",
        title: "أضِف دواءً",
        body: "امسح الباركود، أو اضغط على أي دواء من القائمة لإضافته إلى السلة. جرّب الآن — اضغط على أي صنف.",
        advanceOn: ".pos-tile",
      },
      {
        anchor: "pos-cart",
        title: "السلة والكمية",
        body: "يظهر الصنف هنا، ويقفز المؤشر إلى حقل الكمية مباشرةً — اكتب الرقم لتعديلها. المسح المتواصل يبقى يعمل كالمعتاد.",
      },
      {
        anchor: "pos-checkout",
        title: "إتمام البيع",
        body: "اضغط «إتمام البيع» — أو Enter — لإنهاء العملية. جرّبها الآن.",
        advanceOn: '[data-tour="pos-checkout"]',
        advanceOnEnter: true,
      },
    ],
  },
  {
    id: "returns",
    title: "الإرجاع (استرجاع)",
    subtitle: "إعادة صنف وإرجاع المبلغ",
    icon: "Undo2",
    steps: [
      {
        route: "/pos",
        anchor: "pos-return",
        title: "فعّل وضع الإرجاع",
        body: "اضغط مفتاح «إرجاع». في هذا الوضع يعود المخزون إلى الرف ويُخصَم المبلغ من مبيعاتك.",
        advanceOn: '[data-tour="pos-return"]',
      },
      {
        anchor: "pos-search",
        title: "اختر الصنف المُرتجَع",
        body: "اضغط على الصنف الذي يريد الزبون إرجاعه.",
        advanceOn: ".pos-tile",
      },
      {
        anchor: "pos-checkout",
        title: "إتمام الإرجاع",
        body: "اضغط «إتمام الإرجاع» لإنهاء العملية — سهل تماماً كالبيع.",
        advanceOn: '[data-tour="pos-checkout"]',
        advanceOnEnter: true,
      },
    ],
  },
  {
    id: "new-cart",
    title: "سلة جديدة",
    subtitle: "خدمة أكثر من زبون في آنٍ واحد",
    icon: "Plus",
    steps: [
      {
        route: "/pos",
        anchor: "pos-new-cart",
        title: "عدة سلال معاً",
        body: "دخل زبون في منتصف عملية؟ اضغط هنا لفتح سلة جديدة وترك الأولى محفوظة.",
        advanceOn: '[data-tour="pos-new-cart"]',
      },
      {
        anchor: "pos-cart",
        title: "التبديل بين السلال",
        body: "كل سلة مستقلة بأصنافها وزبونها. أنجز أيّها شئت أولاً — لا شيء يضيع.",
      },
    ],
  },
  {
    id: "create-debt",
    title: "تسجيل دين",
    subtitle: "بيع بالدين وإدارة دفتر الديون",
    icon: "ReceiptText",
    steps: [
      {
        route: "/pos",
        anchor: "pos-cart",
        title: "بيع بالدين",
        body: "أضف الأصناف، ثم اختر طريقة الدفع «دين» واختر الزبون. عند الإتمام يُسجَّل المبلغ ديناً على هذا الزبون.",
      },
      {
        route: "/debts",
        anchor: "nav-debts",
        title: "دفتر الديون",
        body: "كل ديون زبائنك تُدار من هنا: من يدين لك، وكم، ومتى — مع إمكانية تسجيل دين جديد يدوياً أيضاً.",
      },
    ],
  },
  {
    id: "record-payment",
    title: "تسديد دفعة",
    subtitle: "استلام دفعة من دين زبون",
    icon: "HandCoins",
    steps: [
      {
        route: "/debts",
        anchor: "nav-debts",
        title: "افتح دفتر الديون",
        body: "اختر الزبون الذي يريد أن يسدّد.",
      },
      {
        title: "سجّل المبلغ المدفوع",
        body: "من صفحة الزبون سجّل الدفعة — جزئية أو كاملة — ويُحدَّث الرصيد المتبقي فوراً، مع سجلٍّ بكل دفعة.",
      },
    ],
  },
  {
    id: "reports",
    title: "التقارير",
    subtitle: "المبيعات والأرباح وأكثر الأصناف مبيعاً",
    icon: "ChartPie",
    steps: [
      {
        route: "/reports",
        anchor: "nav-reports",
        title: "لوحة التقارير",
        body: "تابع مبيعاتك وأرباحك، وأكثر الأصناف مبيعاً، وحركة المخزون — كلها محدَّثة لحظياً.",
      },
      {
        title: "اختر الفترة",
        body: "بدّل بين اليوم والأسبوع والشهر لمقارنة الأداء واتخاذ قرارات الشراء.",
      },
    ],
  },
  {
    id: "add-product",
    title: "إضافة دواء",
    subtitle: "إدخال صنف جديد إلى المخزون",
    icon: "Pill",
    steps: [
      {
        route: "/inventory",
        anchor: "nav-inventory",
        title: "مخزون الأدوية",
        body: "كل أدويتك وكمياتها هنا.",
      },
      {
        anchor: "page-add",
        title: "أضِف دواءً",
        body: "اضغط «إضافة» لإدخال دواء جديد: الاسم، الباركود، السعر، الكمية — وصورة وأنواع إن أردت.",
        advanceOn: '[data-tour="page-add"]',
      },
    ],
  },
  {
    id: "edit-product",
    title: "تعديل صنف",
    subtitle: "تحديث السعر أو الكمية أو إضافة أنواع",
    icon: "Pencil",
    steps: [
      {
        route: "/inventory",
        anchor: "nav-inventory",
        title: "افتح الأدوية",
        body: "لنعدّل صنفاً موجوداً.",
      },
      {
        title: "اضغط على الصنف",
        body: "اضغط على أي دواء لتعديل سعره أو كميته، أو إضافة صورة وأنواع (ألوان/أحجام) لها باركود وسعر مستقل.",
      },
    ],
  },
  {
    id: "customers",
    title: "إضافة زبون",
    subtitle: "بناء قائمة زبائنك",
    icon: "Users",
    steps: [
      {
        route: "/customers",
        anchor: "nav-customers",
        title: "الزبائن",
        body: "سجّل زبائنك لتسهيل البيع بالدين وإدارة حساباتهم.",
      },
      {
        anchor: "page-add",
        title: "أضِف زبوناً",
        body: "اضغط «إضافة» وأدخل الاسم ورقم الهاتف — ويصبح جاهزاً للبيع بالدين.",
        advanceOn: '[data-tour="page-add"]',
      },
    ],
  },
  {
    id: "import",
    title: "استيراد البيانات",
    subtitle: "نقل منتجاتك ومبيعاتك من «حسابات»",
    icon: "FileUp",
    steps: [
      {
        route: "/import",
        anchor: "nav-import",
        title: "استيراد من حسابات",
        body: "انقل قائمة أصنافك وتاريخ مبيعاتك دفعةً واحدة من نظام «حسابات».",
      },
      {
        title: "فحص ثم استيراد",
        body: "يُفحص كل سطر قبل أي تغيير، والاستيراد ذرّي: إمّا أن تدخل البيانات كاملة أو لا يتغيّر شيء.",
      },
    ],
  },
  {
    id: "purchases",
    title: "المشتريات",
    subtitle: "طلبية شراء من الأصناف الناقصة، بالمسح والبحث",
    icon: "ShoppingCart",
    steps: [
      {
        route: "/purchases",
        anchor: "nav-purchases",
        title: "صفحة المشتريات",
        body: "من هنا تبني طلبية شراء لتعويض النواقص. لنستعرضها معاً — اضغط «التالي».",
      },
      {
        anchor: "purchases-generate",
        title: "توليد الطلبية تلقائياً",
        body: "اضغط «توليد الطلبية» ليقترح النظام ما يجب شراؤه بناءً على المخزون المنخفض وسرعة البيع، مع الكمية والتكلفة التقريبية والربح المتوقع.",
      },
      {
        anchor: "purchases-search",
        title: "أضِف يدوياً بالبحث",
        body: "ابحث عن أي صنف بالاسم أو الباركود وأضِفه إلى الطلبية بضغطة.",
      },
      {
        anchor: "purchases-scan",
        title: "أضِف بالمسح",
        body: "شغّل الكاميرا وامسح باركود المنتج مباشرةً لإضافته — تماماً كنقطة البيع.",
      },
      {
        anchor: "purchases-cart",
        title: "راجِع، عدّل، اطبع",
        body: "عدّل الكميات، تابِع إجمالي التكلفة والربح المتوقع، ثم اطبع الطلبية لتأخذها إلى المورّد.",
      },
    ],
  },
]

export function getTour(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id)
}
