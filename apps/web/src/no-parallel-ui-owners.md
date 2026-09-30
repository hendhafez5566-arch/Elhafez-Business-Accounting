# Canonical UI ownership rule

A functional route has one canonical UI owner.

Structural redesigns must replace the page structure in-place while reusing the existing application/domain/API ownership. Keeping an obsolete page behind a hidden `/manage` route, a theme-specific route, or another parallel route is forbidden because it creates two UI owners for one function and encourages patch-on-patch maintenance.

Allowed separation is by real business responsibility only (for example a distinct documents route or a real 360 detail route), not by old-vs-new presentation.
