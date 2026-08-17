// Landing markup ("Dark Academy" edition — copy refactored for conversion).
// Structure, ids and classes are load-bearing: landing.tsx's GSAP choreography
// and iframe-fitting target them. Change text freely; change hooks carefully.
/* eslint-disable */
export const LANDING_MARKUP = `<div id="prog"></div>
<span class="glow g1"></span><span class="glow g2"></span>

<nav id="nav"><div class="nin">
  <div class="brand"><img src="/icons/icon-192.png" alt="فارما" class="logo"/> فارما</div>
  <div class="nlinks">
    <a href="#features">المميزات</a><a href="#numbers">الإحصائيات</a><a href="#pricing">الأسعار</a><a href="/pos?demo=1">النسخة التجريبية</a>
  </div>
  <div class="nbtns"><a class="btn btn-ghost" href="/login">دخول</a><a class="btn btn-lime" href="/pos?demo=1">▶ جرّب</a></div>
</div></nav>

<!-- HERO -->
<section class="hero">
  <div>
    <span class="eye" id="eye"><span class="d"></span> نظام صيدليات عربي — يشتغل حتى بدون إنترنت</span>
    <h1 id="h1"><span class="w">سكّر</span> <span class="w">الدفتر.</span> <span class="w hi">فارما</span> <span class="w">بيحسب،</span> <span class="w">بيطبع،</span> <span class="w">وبيتذكّر</span> <span class="w hi">عنك.</span><span class="cur"></span></h1>
    <p class="sub" id="sub">نقطة بيع بالباركود، مخزون كامل، ودفتر ديون لكل زبون — بيشتغل حتى لو راح النت وبيزامن لحاله لما يرجع. عربي بالكامل، وجاهز من أول ضغطة.</p>
    <div class="cta" id="cta"><a class="btn btn-lime btn-big" href="/pos?demo=1">▶ جرّبه هلّق — مجاناً</a><a class="btn btn-ghost" href="#pricing">الأسعار والباقات</a></div>
    <p class="note" id="note">بدون تسجيل · بدون بطاقة · بيانات تجريبية جاهزة خلال ثواني</p>
  </div>
  <div class="stage">
    <div class="mac" id="mac">
      <div class="mac-scr"><span class="notch"></span>
        <div class="disp"><div class="shot" id="shot-mac"><iframe src="/snap-dashboard.html" scrolling="no" loading="eager"></iframe></div></div>
      </div>
      <div class="mac-base"></div>
    </div>
    <div class="iph" id="iph"><span class="island"></span>
      <div class="disp2"><div class="shot" id="shot-iph"><iframe src="/snap-pos-mobile.html" scrolling="no" loading="eager"></iframe></div></div>
    </div>
    <div class="fcard fc1" id="f1">🖨️ طُبع الإيصال</div>
    <div class="fcard fc2" id="f2">📶 يعمل بدون نت</div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marq"><div class="mtrack" id="mtrack">
  <span><b>📶</b> يشتغل بدون إنترنت</span><span><b>⚡</b> باركود بالكاميرا أو USB</span><span><b>🖨️</b> إيصالات وملصقات حرارية</span><span><b>📒</b> دفتر ديون لكل زبون</span><span><b>⬆️</b> نقل بياناتك القديمة مجاناً</span><span><b>🇵🇸</b> عربي بالكامل</span><span><b>🔄</b> مزامنة تلقائية</span>
</div></div>

<!-- STATS -->
<section class="stats" id="numbers"><div class="wrap">
  <div class="sgrid">
    <div class="stat rv"><b><span class="cnt" data-to="48696">0</span></b><span>عملية بيع حقيقية</span><small>سجّلتها صيدليات تشتغل على فارما</small></div>

    <div class="stat rv"><b><span class="cnt" data-to="21343">0</span></b><span>صنف دواء ومنتج</span><small>جاهزين بالباركود من أول يوم</small></div>
    <div class="stat rv"><b><span class="cnt" data-to="99">0</span>٪</b><span>من المبيعات نقدي</span><small>والباقي دين مضبوط باسم صاحبه</small></div>
  </div>
</div></section>

<!-- FEATURES BENTO -->
<section class="sec" id="features"><div class="wrap">
  <div class="shead rv">
    <span class="lp-pill">💊 المميزات</span>
    <h2>كل شغل الصيدلية… بدون وجع راس</h2>
    <p>هاي مش صور تسويقية — هاي شاشات النظام الحقيقية، بالبيانات الحقيقية.</p>
  </div>
  <div class="bento">
    <div class="bx big rv">
      <span class="ic">💊</span>
      <h3>٢١,٣٤٣ صنف تحت السيطرة</h3>
      <p>مخزون وأسعار وتصنيفات وتنبيه نفاد — بتلاقي أي صنف بثانية، بالاسم أو بمسحة باركود.</p>
      <div class="bframe" id="bf-meds"><iframe src="/snap-products.html" scrolling="no" loading="lazy"></iframe><span class="bfade"></span></div>
    </div>
    <div class="bx tall rv">
      <span class="ic">🏷️</span>
      <h3>الزبون بيشوف السعر لحاله</h3>
      <p>شاشة استعلام مستقلة: الزبون بوجّه الكاميرا على الباركود والسعر بيطلع فوراً — وإنت متفرّغ للبيع.</p>
      <div class="bframe" id="bf-price"><iframe src="/snap-price.html" scrolling="no" loading="lazy"></iframe><span class="bfade"></span></div>
    </div>
    <div class="bx rv">
      <span class="ic">🛒</span>
      <h3>نقطة بيع أسرع من الطابور</h3>
      <p>امسح، بيع، اطبع — نقدي أو دين بضغطة وحدة. الموظف الجديد بيتعلمها بخمس دقايق.</p>
      <span class="chip">🔍 بحث فوري</span><span class="chip">🖨️ إيصال حراري</span>
    </div>
    <div class="bx rv">
      <span class="ic">📒</span>
      <h3>الديون بدفاتر، مش على الذاكرة</h3>
      <div class="deb">
        <div class="row c"><span>نقدي</span><span class="bar"><i data-w="99%"></i></span><span>99٪</span></div>
        <div class="row d"><span>دين</span><span class="bar"><i data-w="8%"></i></span><span>1٪</span></div>
      </div>
      <p style="margin-top:14px">كل زبون وله دفتر: سداد جزئي، تاريخ كامل — وما في دين بينتسى.</p>
    </div>
    <div class="bx rv">
      <span class="ic">⬆️</span>
      <h3>بياناتك القديمة بتنتقل بضغطة</h3>
      <p>ملف إكسل من حساباتي أو أي نظام قديم؟ اسحبه وأفلته — الأصناف والأسعار والمخزون بتتعبّى لحالها. النقل علينا، مجاناً.</p>
    </div>
    <div class="bx ink rv">
      <span class="ic">📶</span>
      <div>
        <h3>راح النت؟ البيع ما بيوقف</h3>
        <p>فارما بيشتغل أوفلاين بالكامل وبيزامن لحاله أول ما يرجع الاتصال — ولا عملية بتضيع. جرّب تلاقي هاي الميزة عند غيرنا.</p>
      </div>
    </div>
  </div>
</div></section>

<!-- CATEGORIES -->
<section class="sec" style="padding-top:10px"><div class="wrap">
  <div class="shead rv">
    <span class="lp-pill lm">📊 أرقام حية</span>
    <h2>شو انباع آخر ٣٠ يوم؟</h2>
    <p>تقارير حسب التصنيف، جاهزة بدون ما تعمل إشي — هاي أرقام حقيقية من صيدلية شغّالة على فارما هلّق.</p>
  </div>
  <div class="cat rv">
    <div id="cats">
      <div class="crow"><span class="nm">أدوية</span><span class="tr"><i data-w="100%"></i></span><span class="v">٪100</span></div>
      <div class="crow"><span class="nm">كوزمتكس</span><span class="tr"><i data-w="44%"></i></span><span class="v">٪44</span></div>
      <div class="crow"><span class="nm">متنوّع</span><span class="tr"><i data-w="11.3%"></i></span><span class="v">٪11</span></div>
      <div class="crow"><span class="nm">نثريات</span><span class="tr"><i data-w="4.8%"></i></span><span class="v">٪5</span></div>
      <div class="crow"><span class="nm">حليب أطفال</span><span class="tr"><i data-w="4.1%"></i></span><span class="v">٪4</span></div>
      <div class="crow"><span class="nm">فوط أطفال</span><span class="tr"><i data-w="3.8%"></i></span><span class="v">٪4</span></div>
      <div class="crow"><span class="nm">عطور</span><span class="tr"><i data-w="3.8%"></i></span><span class="v">٪4</span></div>
      <div class="crow" style="margin-bottom:0"><span class="nm">لوازم أطفال</span><span class="tr"><i data-w="1.7%"></i></span><span class="v">٪2</span></div>
    </div>
    <div class="donutbox">
      <svg class="donut" viewBox="0 0 210 210">
        <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e9e73"/><stop offset="1" stop-color="#14C38E"/></linearGradient></defs>
        <circle class="dbg" cx="105" cy="105" r="86"/>
        <circle class="dcash" id="dcash" cx="105" cy="105" r="86" stroke-dasharray="0 540.35"/>
      </svg>
      <div class="dcenter">99٪<small>مبيعات نقدية</small></div>
      <div class="dlegend">
        <span class="k"><span class="dot" style="background:#14C38E"></span> نقدي</span>
        <span class="k"><span class="dot" style="background:#2a2438;border:1px solid rgba(255,255,255,.25)"></span> دين</span>
      </div>
    </div>
  </div>
</div></section>

<!-- PRICING -->
<section class="sec" id="pricing" style="padding-top:20px"><div class="wrap">
  <div class="shead rv">
    <span class="lp-pill">💳 الأسعار</span>
    <h2>أسعار واضحة، بدون مفاجآت</h2>
    <p>باقات شهرية بالشيكل، بتلغي متى بدك — ومعها نقل مجاني لبياناتك وشهر تجربة كامل.</p>
  </div>
  <div class="found rv">👑 <b>أول ١٠–١٥ صيدلية:</b> سعر مؤسِّس ثابت مدى الحياة.</div>
  <div class="tiers">
    <div class="tier">
      <div class="tn">العدّة</div><div class="tg">للبيع اليومي السريع</div>
      <div class="pr"><b>₪50</b><span>/ شهرياً</span></div>
      <div class="setup">+ تأسيس ₪300 مرة واحدة</div>
      <ul class="feat">
        <li>نقطة بيع بالباركود (كاميرا أو USB)</li>
        <li>إدارة المخزون والأدوية بالكامل</li>
        <li>استعلام أسعار للزبائن</li>
        <li>طباعة إيصالات وملصقات</li>

      </ul>
      <a class="btn btn-ghost" style="justify-content:center" href="/pos?demo=1">ابدأ التجربة</a>
    </div>
    <div class="tier hot">
      <span class="hotb">الأكثر طلباً</span>
      <div class="tn">احترافي</div><div class="tg">النظام الكامل</div>
      <div class="pr"><b>₪100</b><span>/ شهرياً</span></div>
      <div class="setup">+ تأسيس ₪400 مرة واحدة</div>
      <ul class="feat">
        <li>كل ما في باقة العدّة</li><li>عدد غير محدود من المتاجر شهرياً</li>
        <li>ديون ودفاتر الزبائن الكاملة</li>
        <li>ملفات الزبائن والتاريخ الشرائي</li>
        <li>استيراد من حساباتي بضغطة</li>
        <li>تقارير ومبيعات وتحليلات</li>
        <li>أولوية في الدعم</li><li>يعمل بدون إنترنت + مزامنة تلقائية <b style="color:#A78BFA">(حصري)</b></li>
      </ul>
      <a class="btn btn-lime" style="justify-content:center" href="/pos?demo=1">▶ ابدأ التجربة</a>
    </div>
    <div class="tier">
      <div class="tn">سلسلة</div><div class="tg">لأكثر من فرع</div>
      <div class="pr"><b>₪70</b><span>/ شهرياً للفرع</span></div>
      <div class="setup">+ تأسيس ₪500 مرة واحدة</div>
      <ul class="feat">
        <li>باقة احترافي لكل فرع</li>
        <li>تقارير موحّدة عبر الفروع (قريباً)</li>
        <li>صلاحيات موظفين لكل فرع</li>
        <li>إعداد ودعم مخصّص</li>
      </ul>
      <a class="btn btn-ghost" style="justify-content:center" href="/pos?demo=1">تواصل معنا</a>
    </div>
  </div>
  <div class="paych rv"><span>💵 نقداً</span><span>🏦 تحويل بنكي</span><span>💳 PalPay</span><span>📱 JawwalPay</span></div>
</div></section>

<!-- CTA -->
<section class="sec" id="demo" style="padding-top:10px"><div class="wrap">
  <div class="ctaband rv">
    <h2>افتح النظام الحقيقي — دقيقتين وبتعرف إذا إلك</h2>
    <p>بيع، اطبع إيصال، سجّل دين — على بيانات تجريبية جاهزة. إذا ما ناسبك، بتسكّر الصفحة وخلص. إذا ناسبك — خلّينا نحكي.</p>
    <a class="btn btn-lime btn-big" href="/pos?demo=1">▶ ابدأ التجربة الآن</a>
  </div>
</div></section>

<footer><div class="fin">
  <div class="brand" style="font-size:19px"><img src="/icons/icon-192.png" alt="فارما" class="logo" style="width:32px;height:32px"/> فارما</div>
  <div class="flinks"><a href="#features">المميزات</a><a href="#pricing">الأسعار</a><a href="/pos?demo=1">النسخة التجريبية</a><a href="#">تواصل معنا</a></div>
  <div class="fnote">© 2026 فارما — نظام إدارة الصيدلية العربي</div>
</div></footer>`;
