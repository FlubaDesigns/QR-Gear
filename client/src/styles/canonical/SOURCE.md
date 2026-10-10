# Canonical page system

The master.css, fonts.css, buttons.css, forms.css and skeleton.html files are
unchanged copies from FlubaDesigns/fluba-designs/templates/websites/canonical-v1.
That upstream directory owns them; do not independently edit these copies.

PageSkeleton expresses skeleton.html's semantic stage, header, main, page slot,
footer and skip-link structure in React. It loads Master, Fonts, Buttons, Forms,
Theme, Site in the canonical order. CSS scope confines the masters to this page;
only document-root token selectors are rebound to the component root at runtime.
Existing shared navigation and footer retain their existing styles and behavior.

Page package: /p/:id, member product detail. Existing product media, title,
description, variant controls, saved pricing, checkout and creator link retain
their data and order. The approved layout is a full-width percentage stage and
row containing layout__split-3-2. Master container queries stack narrow rows.
QR Gear's existing appearance tokens supply the theme. Site extensions only
size product media and controls; they do not define grids or breakpoints.

Upstream blob versions:
- master.css: 18a6aeb4e0bde8a88df0b46af9f8f871c06cd336
- fonts.css: 7ad8edc34e72b631bd726aeb8e493c7bb7856686
- buttons.css: 2dc7b2d3ec139365cb82494e894a053ccea848bd
- forms.css: 785b8a19648e04860a94e98bcc4e0f955271dc7c
- skeleton.html: 287dcecec771a62dbd3448014a785533663bff1f
