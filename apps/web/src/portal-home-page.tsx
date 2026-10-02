import { Icon } from './ui/icons.js';
import { WORKSPACES } from './workspace-catalog.js';

export function PortalHomePage() {
  return (
    <section
      className="portal-section-index"
      dir="rtl"
      aria-labelledby="portal-section-index-title"
      data-portal-section-index="true"
    >
      <header className="portal-section-index__header">
        <h1 id="portal-section-index-title">الأقسام الرئيسية</h1>
      </header>

      <nav className="portal-section-index__grid" aria-label="الأقسام الرئيسية">
        {WORKSPACES.map((workspace, index) => (
          <a
            className="portal-section-index__card"
            href={workspace.landingPath}
            key={workspace.id}
            data-workspace-id={workspace.id}
            data-workspace-order={index + 1}
            aria-label={`فتح قسم ${workspace.label}`}
          >
            <span className="portal-section-index__icon" aria-hidden="true">
              <Icon name={workspace.icon} size={30} />
            </span>
            <h2>{workspace.label}</h2>
          </a>
        ))}
      </nav>
    </section>
  );
}
