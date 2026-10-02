import { Icon } from './ui/icons.js';
import { WORKSPACES } from './workspace-catalog.js';

export function PortalHomePage() {
  return (
    <section className="portal-home" dir="rtl" aria-label="مساحات العمل">
      <header className="portal-home__banner">
        <div className="portal-home__brand">
          <strong>Elhafez</strong>
          <span>ELHAFEZ TECHNOLOGY</span>
          <p>نظام السياحة والحج والعمرة وإدارة الأعمال</p>
        </div>
        <Icon name="tourism" size={34} />
      </header>

      <div className="portal-home__grid">
        {WORKSPACES.map(workspace => (
          <a className="portal-workspace-card" href={workspace.landingPath} key={workspace.id}>
            <span className="portal-workspace-card__icon" aria-hidden="true">
              <Icon name={workspace.icon} size={28} />
            </span>
            <h2>{workspace.label}</h2>
            <p>{workspace.description}</p>
            <span className="portal-workspace-card__enter">دخول ←</span>
          </a>
        ))}
      </div>
    </section>
  );
}
