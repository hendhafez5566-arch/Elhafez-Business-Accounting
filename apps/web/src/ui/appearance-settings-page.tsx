import { Button, Card, FormField, PageHeader, Select } from './primitives.js';
import { useUiPreferences } from './preferences.js';

const sidebarLabels = {
  fixed: 'ثابت',
  compact: 'مصغّر بالأيقونات',
  auto: 'تلقائي عند المرور بالماوس',
} as const;

const fontScaleLabels = {
  small: 'صغير',
  normal: 'عادي',
  large: 'كبير',
  xlarge: 'كبير جدًا',
} as const;

const fontFamilyLabels = {
  tahoma: 'Tahoma',
  system: 'خط النظام',
  arial: 'Arial',
} as const;

const densityLabels = {
  comfortable: 'مريحة',
  balanced: 'متوسطة',
  compact: 'مضغوطة',
} as const;

export function AppearanceSettingsPage() {
  const { preferences, updatePreferences, resetPreferences } = useUiPreferences();

  return (
    <main className="ui-settings-page" aria-labelledby="appearance-title">
      <PageHeader
        eyebrow="الإعدادات الشخصية"
        title="المظهر والتنقل"
        description="اضبط طريقة عرض النظام بما يناسبك. التغييرات تُطبّق على الواجهة كلها من مصدر مركزي واحد."
        actions={<Button variant="secondary" onClick={resetPreferences}>استعادة الافتراضي</Button>}
      />

      <div className="ui-settings-grid">
        <Card title="القائمة الجانبية">
          <FormField
            label="طريقة عمل القائمة"
            hint="الوضع التلقائي يتوسع عند مرور الماوس أو انتقال التركيز إليه ثم يعود للأيقونات."
          >
            <Select
              value={preferences.sidebarMode}
              onChange={(event) => updatePreferences({ sidebarMode: event.target.value as typeof preferences.sidebarMode })}
            >
              {Object.entries(sidebarLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormField>
        </Card>

        <Card title="الخط">
          <div className="ui-form-grid">
            <FormField label="نوع الخط">
              <Select
                value={preferences.fontFamily}
                onChange={(event) => updatePreferences({ fontFamily: event.target.value as typeof preferences.fontFamily })}
              >
                {Object.entries(fontFamilyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="حجم الخط">
              <Select
                value={preferences.fontScale}
                onChange={(event) => updatePreferences({ fontScale: event.target.value as typeof preferences.fontScale })}
              >
                {Object.entries(fontScaleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card title="كثافة الواجهة">
          <FormField
            label="المسافات وحجم عناصر التحكم"
            hint="اختيار مريح للشاشات اليومية أو مضغوط للجداول كثيفة البيانات."
          >
            <Select
              value={preferences.density}
              onChange={(event) => updatePreferences({ density: event.target.value as typeof preferences.density })}
            >
              {Object.entries(densityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormField>
        </Card>

        <Card title="معاينة الإعداد الحالي">
          <dl className="ui-definition-list">
            <div><dt>القائمة</dt><dd>{sidebarLabels[preferences.sidebarMode]}</dd></div>
            <div><dt>الخط</dt><dd>{fontFamilyLabels[preferences.fontFamily]}</dd></div>
            <div><dt>الحجم</dt><dd>{fontScaleLabels[preferences.fontScale]}</dd></div>
            <div><dt>الكثافة</dt><dd>{densityLabels[preferences.density]}</dd></div>
          </dl>
        </Card>
      </div>
    </main>
  );
}
