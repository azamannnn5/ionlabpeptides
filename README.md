# ionlabpeptides.com static copy

Static copy (plain HTML, CSS and JS) of https://ionlabpeptides.com made on 2026-10-14 and 2026-10-15.
Open index.html through any static web server (for example: python3 -m http.server).

Original branding, text and photos are kept as on the source site and must be replaced before a real launch.

## Folders and files
- *.html, product/*.html, peptide-information/*.html: pages. Text and structure were copied from the rendered live pages.
- assets/css: style sheets from the live site (vendor/ holds the plugin and theme sheets).
- assets/uploads, assets/fonts, assets/vendor: images, fonts and plugin files downloaded from the live site.
- assets/js/main.js: hand written script (cart in localStorage, shop filter and load more, variation buttons, local stand-in for the store product and cart endpoints).
- assets/js/ion-header.js, ion-promo.js, ion-a11y.js, ion-lazy-bg.js, page-*.js: scripts copied from the live inline scripts.
- assets/js/ion-product-page.js and the shop layout helper: scripts copied from the live site.
- assets/js/vendor/jquery.min.js: jQuery 3.7.1 from the npm registry.
- data/store-products.json: product list as returned by the live store product endpoint (59 products).
- data/catalog.json, catalog.csv, catalog.js: same products reduced to the main fields.
- data/categories.json: product categories from the live store category endpoint.
- data/captured-pages.json: title, description and visible text of each captured page.
- data/runtime.js: data used by main.js. Built from the pages in this folder (variations, quantity tiers, shop cards).
- data/site-info.json: list of pages and counts.
- tools/: generator that builds this folder from the captured data (Node).

## Merging the zip files
Unzip every ionpeptide-*.zip into the same empty folder and choose to merge folders if asked. The code zip holds pages, scripts, styles, data and tools. The image zips only add files under assets/uploads. All paths inside the zips are relative to the site root.

## Not copied or not available
See the final report from the build. Cart and checkout pages are empty shells. Forms have no backend.

## Admin panel
- admin/index.html is the admin. Open it at your-site/admin/.
- SETUP-ADMIN.md has the one time setup (database file, first login, two lines in data/cms-config.js).
- supabase/schema.sql creates the database tables and security rules.
- assets/js/cms.js applies saved admin changes to the live pages. data/cms-defaults.json lists everything that can be edited.
