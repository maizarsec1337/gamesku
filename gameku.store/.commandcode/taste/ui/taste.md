# Taste — UI & Frontend Quality

- Every page must have proper loading, empty, error, and success-feedback states — no blank pages, broken components, cut-off layouts, or persistent error views left unaddressed. Confidence: 0.8
- UI must be fully responsive across desktop, laptop, tablet, and smartphone, with consistent fonts, heading hierarchy, spacing, alignment, colors, borders, and components across pages (no pages that look like they came from a different system). Confidence: 0.8
- Interactive elements (buttons, links, forms, filters, search, pagination) must actually function — no decorative buttons with no action. Confidence: 0.75
- Don't replace an already-correct design wholesale; fix specific deficiencies found during a review instead. Confidence: 0.7
- Wants a modern, premium, clean, and professional look that matches the product identity, but with restraint — avoid excessive glow, distracting decorative elements, overdone effects, and generic-template-looking designs. Confidence: 0.75
- Scope CSS changes to the target page/component; don't broadly modify the global stylesheet just to restyle one page. Confidence: 0.75
- Forms must be accessible: explicit labels, clear keyboard focus (`:focus-visible`), proper aria attributes, and Enter key submits the form. Confidence: 0.7
- Prevent double-submit / concurrent submissions by locking the submit action with an in-flight state flag and disabling the button until the request resolves; do not mark the action successful until the backend/DB confirms it. Confidence: 0.85
- A request detail/status page should switch between the form view and the status view (pending/approved/rejected) driven by backend state rather than defining a separate route or page per state. Confidence: 0.75
