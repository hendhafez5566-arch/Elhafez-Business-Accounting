# Legacy Parity Matrix

Frozen reference: `Elhafez-Tourism-Offline v32.5.66 @ e97fa6d9cb52acb22b676e1b975c1b2332bc9a13`.

Coverage: navigation 46/46; Hajj/Umrah controls 86/86; document/report catalog 44/44; master gaps 17/17; high-risk fields 35/35.

## Navigation

| ID | Capability | Status | Target | Decision / acceptance |
|---|---|---|---|---|
| LEG-NAV-001 | لوحة التحكم | NEW_BETTER | `/` | الرئيسية + الإدارة والتحكم; route and permission tests. |
| LEG-NAV-002 | نظام الحج والعمرة | PARITY | `/hajj-umrah/program-workspace` | موزع بين برامج الحج والعمرة، مساحة عمل البرنامج، الجاهزية والتشغيل; route and permission tests. |
| LEG-NAV-003 | التعاقدات والمخزون | PARITY | `/hajj-umrah/contracts-inventory` | التعاقدات والمخزون موجودة; route and permission tests. |
| LEG-NAV-004 | إدارة الحج والعمرة | NEW_BETTER | `/hajj-umrah/readiness` | مركز الجاهزية والتشغيل + صفحات تشغيل مستقلة; route and permission tests. |
| LEG-NAV-005 | العملاء المحتملون والمتابعة | PARITY | `/crm/leads + /crm/followups` | العملاء المحتملون والمتابعات منفصلان; route and permission tests. |
| LEG-NAV-006 | العملاء | PARITY | `/crm/customers + /crm/customer-360` | العميل موجود لكن 360 أقل عمقًا من القديم; route and permission tests. |
| LEG-NAV-007 | المندوبون | PARITY | `/crm/agents + /crm/agent-360` | الوكيل موجود لكن يحتاج عمقًا تشغيليًا وماليًا; route and permission tests. |
| LEG-NAV-008 | عروض الأسعار | NEW_BETTER | `/crm/quotations` | Lifecycle والمراجعات والموافقات أقوى; route and permission tests. |
| LEG-NAV-009 | الخدمات السياحية | PARITY | `/tourism/services` | الخدمات موجودة؛ بعض العلاقات ما زالت تقنية; route and permission tests. |
| LEG-NAV-010 | الموردون | NEW_BETTER | `/procurement/suppliers` | إدارة وتقييم ومتابعة أوسع; route and permission tests. |
| LEG-NAV-011 | أوامر الشراء | NEW_BETTER | `/procurement/purchase-orders + /procurement/sourcing` | أوامر الشراء والتوريد أقوى; route and permission tests. |
| LEG-NAV-012 | الفواتير | PARITY | `/accounting` | موجودة داخل Workspace; route and permission tests. |
| LEG-NAV-013 | سندات القبض | PARITY | `/accounting` | موجودة ضمن الخزينة/التسوية والوصول أقل مباشرة; route and permission tests. |
| LEG-NAV-014 | سندات الصرف | PARITY | `/accounting` | موجودة ضمن الخزينة/التسوية والوصول أقل مباشرة; route and permission tests. |
| LEG-NAV-015 | المصروفات | PARITY | `/accounting` | موجودة داخل المحاسبة; route and permission tests. |
| LEG-NAV-016 | التسويات والإلغاءات | PARITY | `/accounting` | موجودة لكن بعض UX تقني; route and permission tests. |
| LEG-NAV-017 | الاستحقاقات والإيراد المؤجل | PARITY | `/accounting` | موجودة لكن بعض التدفقات تقنية; route and permission tests. |
| LEG-NAV-018 | الأصول الثابتة | PARITY | `/accounting` | موجودة داخل Workspace; route and permission tests. |
| LEG-NAV-019 | القروض والمخصصات | PARITY | `/accounting` | موجودة داخل Workspace; route and permission tests. |
| LEG-NAV-020 | الموازنات | PARITY | `/accounting` | موجودة داخل Workspace; route and permission tests. |
| LEG-NAV-021 | الشيكات | PARITY | `/accounting` | منطق الشيكات موجود لكن واجهة كاملة تحتاج إغلاق; route and permission tests. |
| LEG-NAV-022 | الخزن والبنوك | PARITY | `/accounting` | الخزن والبنوك موجودة؛ التحويل والجرد والمطابقة تحتاج UI مكتملة; route and permission tests. |
| LEG-NAV-023 | القيود اليومية | PARITY | `/accounting` | القيود موجودة; route and permission tests. |
| LEG-NAV-024 | دليل الحسابات | PARITY | `/accounting` | دليل الحسابات موجود; route and permission tests. |
| LEG-NAV-025 | ميزان المراجعة | PARITY | `/management/reports + /accounting` | ميزان المراجعة والتقارير موجودان; route and permission tests. |
| LEG-NAV-026 | مراكز التكلفة | PARITY | `/accounting` | مراكز التكلفة موجودة; route and permission tests. |
| LEG-NAV-027 | العملات وأسعار الصرف | PARITY | `/accounting` | العملات وFX موجودة; route and permission tests. |
| LEG-NAV-028 | الضرائب | PARITY | `/accounting + /management/reports` | الضرائب موجودة; route and permission tests. |
| LEG-NAV-029 | الفترات المالية | PARITY | `/accounting` | الفترات والإقفال موجودان; route and permission tests. |
| LEG-NAV-030 | مركز العمل اليومي | NEW_BETTER | `/management/exceptions` | مركز العمل والاستثناءات أقوى; route and permission tests. |
| LEG-NAV-031 | لوحة الإدارة | NEW_BETTER | `/management/*` | لوحات الإدارة والتحكم أوسع; route and permission tests. |
| LEG-NAV-032 | التقارير | NEW_BETTER | `/management/reports` | Reporting Center أوسع; route and permission tests. |
| LEG-NAV-033 | الاعتمادات | NEW_BETTER | `/management/approvals` | مركز موافقات مستقل; route and permission tests. |
| LEG-NAV-034 | الرقابة المالية | PARITY | `/accounting + /system-administration` | الرقابة موجودة وتحتاج direct UX مماثل; route and permission tests. |
| LEG-NAV-035 | سجل النشاط | PARITY | `/system-administration` | Audit/activity موجود; route and permission tests. |
| LEG-NAV-036 | جاهزية البيع والتشغيل | PARITY | `—` | لا يوجد route مخصص مكافئ في baseline; route and permission tests. |
| LEG-NAV-037 | دليل البدء السريع | PARITY | `—` | لا يوجد route مخصص مكافئ في baseline; route and permission tests. |
| LEG-NAV-038 | المستخدمون والصلاحيات | PARITY | `/system-administration` | المستخدمون والصلاحيات موجودة; route and permission tests. |
| LEG-NAV-039 | الفروع | PARITY | `/system-administration` | الفروع والوصول موجودان; route and permission tests. |
| LEG-NAV-040 | مركز المستندات | PARITY | `/system-administration` | Files موجودة لكن الربط داخل 360 وصفحات الأعمال أقل; route and permission tests. |
| LEG-NAV-041 | الجلسات والأجهزة | PARITY | `/system-administration` | إدارة الجلسات موجودة; route and permission tests. |
| LEG-NAV-042 | استيراد وتصدير | NEW_BETTER | `/system-administration` | استيراد/تصدير وإدارة Jobs; route and permission tests. |
| LEG-NAV-043 | الدعم وحالة النظام | NEW_BETTER | `/system-administration` | Diagnostics/operations أقوى; route and permission tests. |
| LEG-NAV-044 | الإعدادات | PARITY | `/system-administration + /settings/*` | هوية الشركة والطباعة تحتاج توحيدًا; route and permission tests. |
| LEG-NAV-045 | النسخ الاحتياطي والاستعادة | NEW_BETTER | `Owner Control` | Backup/Restore/diagnostics أقوى ومركزي; route and permission tests. |
| LEG-NAV-046 | الأرشفة الذكية | INTENTIONALLY_RETIRED | `/accounting` | Closed-period immutable views replace a duplicate archive.; route and permission tests. |

## Hajj/Umrah major controls

| ID | Type | Control | Status | Owner decision / acceptance |
|---|---|---|---|---|
| LEG-HU-MAJOR-001 | FIELD | اسم الموسم | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-002 | FIELD | السنة الهجرية | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-003 | FIELD | بداية الموسم | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-004 | FIELD | نهاية الموسم | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-005 | FIELD | بداية البيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-006 | FIELD | نهاية البيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-007 | FIELD | الفندق | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-008 | FIELD | المدينة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-009 | FIELD | المورد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-010 | FIELD | الإعاشة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-011 | FIELD | سياسة الإلغاء | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-012 | FIELD | شركة الطيران | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-013 | FIELD | رحلة الذهاب | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-014 | FIELD | رحلة العودة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-015 | FIELD | إجمالي المقاعد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-016 | FIELD | تكلفة المقعد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-017 | FIELD | آخر موعد إصدار | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-018 | FIELD | درجة الحجز | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-019 | FIELD | الأمتعة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-020 | FIELD | شركة النقل | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-021 | FIELD | المسار | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-022 | FIELD | نوع المركبة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-023 | FIELD | عدد المركبات | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-024 | FIELD | سعة المركبة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-025 | FIELD | التكلفة الإجمالية | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-026 | FIELD | حصة التأشيرات | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-027 | FIELD | نوع البرنامج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-028 | FIELD | اسم البرنامج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-029 | FIELD | رقم المجموعة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-030 | FIELD | وصف المجموعة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-031 | FIELD | الموسم | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-032 | FIELD | السعة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-033 | FIELD | السفر | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-034 | FIELD | العودة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-035 | FIELD | مدة البرنامج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-036 | FIELD | عملة البيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-037 | FIELD | سعر الصرف | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-038 | FIELD | خزنة/بنك التحصيل | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical Treasury selector in financial setup; IDs internal. |
| LEG-HU-MAJOR-039 | FIELD | مدة الحجز المؤقت — ساعة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-040 | FIELD | الحد الأدنى للعربون | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-041 | FIELD | طريقة الربح المستهدف | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-042 | FIELD | نسبة من سعر البيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-043 | FIELD | مبلغ ثابت لكل فرد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-044 | FIELD | سعر الفردي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-045 | FIELD | سعر الثنائي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-046 | FIELD | سعر الثلاثي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-047 | FIELD | سعر الرباعي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-048 | FIELD | سعر الخماسي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-049 | FIELD | طفل بسرير | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-050 | FIELD | طفل بدون سرير | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-051 | FIELD | رضيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-052 | FIELD | مصدر الإقامة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-053 | FIELD | العقود المناسبة المتاحة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-054 | ACTION | إنشاء برنامج حج/عمرة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-055 | ACTION | إنشاء حجز حج/عمرة | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-056 | ACTION | استكمال حجز موجود | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-057 | ACTION | تجهيز وتشغيل فوج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-058 | ACTION | تخصيص | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-059 | ACTION | تعديل العقد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-060 | ACTION | ملحق تعاقدي | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-061 | ACTION | تأكيد العقد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-062 | ACTION | عقد فندق | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-063 | ACTION | بلوك طيران | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-064 | ACTION | عقد نقل | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-065 | ACTION | اتفاقية تأشيرات | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-066 | ACTION | خدمة تعاقدية | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-067 | ACTION | المشتريات | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-068 | ACTION | تعديل الكمية | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-069 | ACTION | تحرير كامل | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-070 | ACTION | سداد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-071 | ACTION | طباعة ملخص البرنامج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical owner data rendered by the central catalog. |
| LEG-HU-MAJOR-072 | ACTION | فتح للبيع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-073 | ACTION | مركز الجاهزية | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-074 | ACTION | فتح سجل المسافرين | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-075 | ACTION | مرفقات الحجز | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Platform Files attachment and activity composition. |
| LEG-HU-MAJOR-076 | ACTION | توزيع الغرف | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-077 | ACTION | تأكيد الحجز | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-078 | ACTION | جاهز للسفر | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-079 | ACTION | تم التجمع | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-080 | ACTION | مسافر | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-081 | ACTION | عاد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-082 | ACTION | إغلاق الحجز | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-083 | ACTION | إضافة المسافرين الجدد | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-084 | ACTION | طباعة كشف التأشيرات | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical owner data rendered by the central catalog. |
| LEG-HU-MAJOR-085 | ACTION | إصدار | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |
| LEG-HU-MAJOR-086 | ACTION | إلغاء البرنامج | PARITY | `hajj-umrah / tourism-contract-inventory / traveler-management` — Canonical routed owner and operational API; behavioral tests. |

## Exact 44-item document/report catalog

| ID | Output | Status | Canonical source and real output path |
|---|---|---|---|
| LEG-PRINT-001 | فاتورة مبيعات | PARITY | `billing-subledgers` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-002 | فاتورة مورد | PARITY | `billing-subledgers` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-003 | إشعار دائن | PARITY | `billing-subledgers` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-004 | إشعار مدين | PARITY | `billing-subledgers` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-005 | سند قبض | PARITY | `treasury-settlement` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-006 | سند صرف | PARITY | `treasury-settlement` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-007 | قيد يومية | PARITY | `general-ledger` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-008 | مستند مصروف | PARITY | `expense-commission-recognition` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-009 | عرض سعر | PARITY | `quotations` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-010 | أمر شراء | PARITY | `procurement-finance` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-011 | تحويل بين الخزن | PARITY | `treasury-settlement` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-012 | كشف حساب عميل | PARITY | `party-accounting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-013 | كشف حساب مورد | PARITY | `party-accounting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-014 | كشف حساب مندوب | PARITY | `party-accounting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-015 | كشف حساب شامل للطرف | PARITY | `party-accounting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-016 | كشف حركة خزنة / بنك | PARITY | `treasury-settlement` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-017 | كشف حساب أستاذ | PARITY | `general-ledger` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-018 | قائمة الدخل | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-019 | الميزانية العمومية | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-020 | تقرير الضرائب | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-021 | قائمة التدفقات النقدية | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-022 | ربحية برنامج عمرة | PARITY | `hajj-umrah-programs` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-023 | كشف توزيع الغرف | PARITY | `hajj-umrah-rooming` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-024 | أعمار مديونية العملاء | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-025 | أعمار مديونية الموردين | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-026 | ربحية الخدمات | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-027 | تقرير العمولات | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-028 | تحليل المصروفات | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-029 | أرباح وخسائر فروق العملة | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-030 | التعرض للعملات الأجنبية | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-031 | تقرير التحصيلات | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-032 | تقرير المدفوعات | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-033 | قائمة المسافرين | PARITY | `hajj-umrah-bookings` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-034 | حالات الحجوزات | PARITY | `hajj-umrah-bookings` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-035 | تقرير القيود | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-036 | دفتر الأستاذ العام | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-037 | تفاصيل الضرائب | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-038 | المبيعات حسب العميل | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-039 | المبيعات على المندوبين | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-040 | تكاليف الموردين | PARITY | `financial-reporting` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-041 | الحركة اليومية للخزن والبنوك | PARITY | `treasury-settlement` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-042 | انتهاء الجوازات | PARITY | `traveler-management` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-043 | حالات التأشيرات | PARITY | `hajj-umrah-visa-operations` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |
| LEG-PRINT-044 | إشغال برامج العمرة | PARITY | `hajj-umrah-programs` authorized data → `financial-reporting.renderCanonicalDocument`; deterministic scoped RTL print/PDF path. |

## Master gaps

| Gap | Area | Status | Decision |
|---|---|---|---|
| GLOBAL-01 | Raw internal IDs / UUIDs | PARITY | Canonical business selectors backed by owner read models. |
| GLOBAL-02 | JSON/manual technical inputs | PARITY | Structured forms; no employee JSON input. |
| GLOBAL-03 | Browser prompts | PARITY | Canonical Dialog/Form confirmation. |
| CRM-360 | Customer/Supplier/Agent 360 depth | PARITY | Owner read-model 360 with Files/activity. |
| DOC-01 | Central branded document renderer | PARITY | Exact catalog and centralized renderer. |
| TREASURY-01 | Cheques lifecycle UI | PARITY | Full cheque transition chain. |
| TREASURY-02 | Bank reconciliation UI | PARITY | Branch-scoped statement/matching. |
| TREASURY-03 | Cash count / transfers | PARITY | Branch-scoped transfers and count variance. |
| HU-01 | Program composition | PARITY | Structured program composition. |
| HU-02 | Booking/rooming/visa/ticket/transport selectors | PARITY | Human-readable operational selectors. |
| HU-03 | Print/output parity | PARITY | Owner-backed program/visa output. |
| SYS-01 | Market readiness | PARITY | Read-only canonical readiness. |
| SYS-02 | Quick guide | PARITY | Read-only onboarding guide. |
| SYS-03 | Company legal/print identity | PARITY | Structured legal/print identity. |
| ACC-UX | Advanced accounting IDs | PARITY | Selected-row/picker actions. |
| REPORT-01 | Exact legacy report catalog parity | PARITY | Exact 44-ID registry. |
| ATTACH-01 | Attachments inside business 360 | PARITY | Files/activity embedded in 360. |

## High-risk fields

| Field | Status | Owner / decision |
|---|---|---|
| supplier → عملة التعامل | PARITY | `supplier-management` structured canonical field/read model; no duplicate truth. |
| supplier → IBAN | PARITY | `supplier-management` structured canonical field/read model; no duplicate truth. |
| agent → طريقة العمولة | PARITY | `agent-management` structured canonical field/read model; no duplicate truth. |
| agent → عملة العمولة | PARITY | `agent-management` structured canonical field/read model; no duplicate truth. |
| program → غرف ثلاثي | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → غرف رباعي | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → سعر رباعي للفرد | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → سعر ثلاثي للفرد | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → سعر ثنائي للفرد | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → سعر فردي للفرد | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → سعر طفل | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → ليالي مكة | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → ليالي المدينة | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → رحلة الذهاب | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| program → خط سير / برنامج الرحلة | PARITY | `hajj-umrah-programs / tourism-programs` structured canonical field/read model; no duplicate truth. |
| receipt → طريقة الدفع | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| payment → طريقة الدفع | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| expense → طريقة الدفع | PARITY | `expense-commission` structured canonical field/read model; no duplicate truth. |
| commissionRule → نطاق القاعدة | PARITY | `expense-commission` structured canonical field/read model; no duplicate truth. |
| commissionRule → طريقة العمولة | PARITY | `expense-commission` structured canonical field/read model; no duplicate truth. |
| commissionPay → طريقة الدفع | PARITY | `expense-commission` structured canonical field/read model; no duplicate truth. |
| treasury → الرصيد الافتتاحي | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| treasury → IBAN | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| treasury → حد تنبيه الرصيد | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| cashCount → الرصيد الفعلي | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| cashCount → معالجة فرق الجرد | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |
| currency → الكسور العشرية | PARITY | `currency-fx` structured canonical field/read model; no duplicate truth. |
| costcenter → الموازنة التقديرية | PARITY | `cost-centers-budgeting` structured canonical field/read model; no duplicate truth. |
| user → أقصى خصم مسموح % | PARITY | `platform-core / auth` structured canonical field/read model; no duplicate truth. |
| revenueDeferral → أول تاريخ اعتراف | PARITY | `recognition-accrual` structured canonical field/read model; no duplicate truth. |
| revenueDeferral → عدد دفعات الاعتراف | PARITY | `recognition-accrual` structured canonical field/read model; no duplicate truth. |
| costDeferral → أول تاريخ تحميل للتكلفة | PARITY | `recognition-accrual` structured canonical field/read model; no duplicate truth. |
| costDeferral → عدد دفعات التحميل | PARITY | `recognition-accrual` structured canonical field/read model; no duplicate truth. |
| loan → عدد الأقساط الشهرية | PARITY | `assets-financing` structured canonical field/read model; no duplicate truth. |
| bankStatement → حركات الكشف | PARITY | `treasury-settlement` structured canonical field/read model; no duplicate truth. |

## Intentional retirement and external dependencies

- `LEG-NAV-046`: parallel archival storage is retired; immutable economic history and closed-period read views are canonical.
- No external Egyptian Umrah provider protocol or barcode format was evidenced. The persisted internal assignment/activation/use/cancellation lifecycle is complete; external submission remains a separately contracted integration.
- No fabricated PDF bytes or delivery receipts: deterministic print-safe output uses the supported print/PDF channel and records only real delivery evidence.
