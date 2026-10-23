/* What the admin contains: menu tree, settings forms, help texts. Edit this file to add or move things. */
(function () {
  'use strict';
  const A = window.ADM;

  /* ---------- page groups (which site page lives in which folder of the Pages section) ---------- */
  A.PAGE_GROUPS = [
    { id: 'main', label: 'Main pages', help: 'The pages visitors see first: home, shop page, about, contact and FAQ.', files: ['index.html', 'shop.html', 'about-us.html', 'our-mission.html', 'contact.html', 'faq.html', 'lab-results.html', 'rebate.html', 'wholesale.html', 'stats.html'] },
    { id: 'info', label: 'Peptide information', help: 'The peptide information hub and each article page.', match: (f) => f === 'peptide-information.html' || f.startsWith('peptide-information/') },
    { id: 'legal', label: 'Policies and legal', help: 'Privacy, shipping, refund and other policy pages.', files: ['policies.html', 'privacy-policy.html', 'shipping-policy.html', 'refund-policy.html', 'returns.html', 'compliance-legal-overview.html', 'community-guidelines.html', 'affiliate-agreement.html', 'terms-of-service.html'] },
    { id: 'account', label: 'Account and cart pages', help: 'Login, register, account, affiliate, cart and checkout pages.', files: ['login.html', 'register.html', 'my-account.html', 'account.html', 'affiliate-application.html', 'affiliate-dashboard.html', 'cart.html', 'checkout.html'] }
  ];
  A.PAGE_GROUPS.push({ id: 'other', label: 'Other pages', help: 'Any other page of the site.', match: (f) => !A.PAGE_GROUPS.slice(0, -1).some((g) => (g.files && g.files.includes(f)) || (g.match && g.match(f))) });
  A.PAGE_NAMES = { 'index.html': 'Home', 'shop.html': 'Shop', 'about-us.html': 'About us', 'our-mission.html': 'Our mission', 'contact.html': 'Contact', 'faq.html': 'FAQ', 'lab-results.html': 'Lab results', 'rebate.html': 'Rebate program' };
  A.pageName = (f, title) => A.PAGE_NAMES[f] || (title ? title.replace(/\s*[–|\-]\s*Ion Peptide.*$/i, '') : f.replace(/\.html$/, '').replace(/[-/]/g, ' '));
  A.groupOfPage = (f) => (A.PAGE_GROUPS.find((g) => (g.files && g.files.includes(f)) || (g.match && g.match(f))) || { id: 'other', label: 'Other pages' });

  /* ---------- settings forms ----------
     Each group is saved as one record and read by the live site. type: toggle, text, textarea, number, color, image, link, select, list (rows) */
  const S = A.SETTINGS = {
    topbar: {
      title: 'Top banner', nav: 'Promotions', tag: 'Setting',
      help: ['This is the thin message bar at the very top of every page (for example: "Please allow 2 extra days for order processing!").', 'Turn it off to hide it. Changes appear on the live site right after you press Save.'],
      fields: [
        { k: 'enabled', t: 'toggle', label: 'Show the top banner', def: true, help: 'Switch off to hide the banner on every page.' },
        { k: 'html', t: 'textarea', label: 'Banner message', def: 'Please allow 2 extra days for order processing!', help: 'Keep it short. Simple formatting is allowed, for example <strong>bold</strong> or a link: <a href="shop.html">Shop now</a>.' },
        { k: 'bg', t: 'color', label: 'Background colour', help: 'Leave empty to keep the original colour.' },
        { k: 'color', t: 'color', label: 'Text colour', help: 'Leave empty to keep the original colour.' }
      ]
    },
    popup: {
      title: 'Pop-up message', nav: 'Promotions', tag: 'Setting',
      help: ['A small window that opens in the middle of the screen, for sales or announcements.', 'It is off by default. Each visitor sees it once, then it stays hidden for the number of hours you choose.', 'To preview it yourself, open your site with ?popup=1 at the end of the address.'],
      fields: [
        { k: 'enabled', t: 'toggle', label: 'Show the pop-up', def: false },
        { k: 'title', t: 'text', label: 'Title', def: '', help: 'The large heading, for example "Free shipping this week".' },
        { k: 'text', t: 'textarea', label: 'Message', def: '' },
        { k: 'image', t: 'image', label: 'Picture (optional)', help: 'Shown above the title.' },
        { k: 'buttonText', t: 'text', label: 'Button text', def: '', help: 'Leave empty for no button.' },
        { k: 'buttonLink', t: 'link', label: 'Button link', help: 'Where the button goes, for example shop.html.' },
        { k: 'delay', t: 'number', label: 'Show after (milliseconds)', def: 1200, help: '1000 = 1 second.' },
        { k: 'cooldownHours', t: 'number', label: 'Do not show again for (hours)', def: 24 },
        { k: 'pages', t: 'select', label: 'Show on', def: 'all', options: [['all', 'Every page'], ['home', 'Home page only'], ['shop', 'Shop page only']] }
      ]
    },
    checkout: {
      title: 'Shipping and cart', nav: 'Shop', tag: 'Price',
      help: ['Controls the extra fee that is added in the cart.', 'Prices of products are changed under Shop > Products.'],
      fields: [
        { k: 'shippingFee', t: 'number', step: '0.01', label: 'Shipping protection fee (USD)', def: 3, help: 'Added once to every cart that has items. Set 0 to remove the fee.' }
      ]
    },
    discounts: {
      title: 'Bulk discounts', nav: 'Shop', tag: 'Price',
      help: ['Visitors get a lower unit price when they buy more of the same product.', 'These steps apply to every product. A single product can have its own steps under Shop > Products > Bulk discounts.'],
      fields: [
        { k: 'enabled', t: 'toggle', label: 'Bulk discounts are on', def: true, help: 'Switch off to remove quantity discounts everywhere.' },
        { k: 'tiers', t: 'tiers', label: 'Discount steps', def: [{ min: 4, max: 5, pct: 10 }, { min: 6, max: 9, pct: 16 }, { min: 10, max: 0, pct: 25 }], help: 'Each row: from how many, up to how many (leave "up to" empty for no limit), and the percent taken off the price.' }
      ]
    },
    contact: {
      title: 'Contact form', nav: 'Customers', tag: 'Text',
      help: ['The messages shown after someone sends the contact form. New messages arrive in Messages.', 'The form text itself (labels, intro) is edited under Pages > Main pages > Contact.'],
      fields: [
        { k: 'successMessage', t: 'textarea', label: 'Message after sending', def: 'Thank you. Your message has been sent. We will reply as soon as we can.' },
        { k: 'errorMessage', t: 'textarea', label: 'Message when something is missing or fails', def: 'Please fill in your name, email and message, then try again.' }
      ]
    },
    seo: {
      title: 'Search and sharing defaults', nav: 'Site', tag: 'SEO',
      help: ['What Google and social media show for your site.', 'Each page can have its own title and description under Site > Page titles (SEO).'],
      fields: [
        { k: 'siteName', t: 'text', label: 'Site name', def: 'Ion Peptide' },
        { k: 'defaultDescription', t: 'textarea', label: 'Default description', help: 'Used on pages that do not have their own description. Around 150 characters works best.' },
        { k: 'ogImage', t: 'image', label: 'Sharing picture', help: 'Shown when a link to your site is shared on social media. Best size 1200 by 630 pixels.' },
        { k: 'favicon', t: 'image', label: 'Browser tab icon (favicon)', help: 'A small square image.' },
        { k: 'noindexAll', t: 'toggle', label: 'Ask search engines NOT to list the site', def: false, help: 'Turn on while the site is in testing. Turn off before launch.' }
      ]
    },
    appearance_colours: {
      group: 'appearance', title: 'Brand colours', nav: 'Site', tag: 'Look',
      help: ['Change the main colours used across the site. Leave a colour empty to keep the original.', 'These apply to areas that use the shared brand colours (buttons, headings, highlights). Some small details have their own colour and can be changed in Custom styles.'],
      fields: [
        { k: 'blue', t: 'color', label: 'Accent blue (buttons, links)', def: '#007eff' },
        { k: 'navy', t: 'color', label: 'Navy (headings, dark areas)', def: '#0d0d67' },
        { k: 'deep', t: 'color', label: 'Deep navy (footer, dark backgrounds)', def: '#050539' },
        { k: 'soft', t: 'color', label: 'Soft background', def: '#f7f9ff' },
        { k: 'text', t: 'color', label: 'Body text', def: '#424242' }
      ]
    },
    appearance_fonts: {
      group: 'appearance', title: 'Font', nav: 'Site', tag: 'Look',
      help: ['Choose the font used on the whole site.', 'Use a font that is already on visitors devices, for example: Georgia, serif. Leave empty to keep the original.'],
      fields: [{ k: 'fontFamily', t: 'text', label: 'Font family', placeholder: 'Georgia, serif' }]
    },
    appearance_css: {
      group: 'appearance', title: 'Custom styles (advanced)', nav: 'Site', tag: 'Code',
      help: ['For people who know CSS. Anything you write here is added to every page.', 'If you are not sure, leave this empty.'],
      fields: [{ k: 'customCss', t: 'code', label: 'Custom CSS', placeholder: '.ion-product-btn { border-radius: 4px; }' }]
    },
    scripts: {
      title: 'Tracking and code', nav: 'Site', tag: 'Code',
      help: ['Add Google Analytics, Meta Pixel or your own code snippets without touching files.', 'Only paste code from sources you trust. It runs on every page of your live site.'],
      fields: [
        { k: 'gaId', t: 'text', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX', help: 'Looks like G-ABC123XYZ. Leave empty to turn off.' },
        { k: 'metaPixelId', t: 'text', label: 'Meta (Facebook) Pixel ID', placeholder: '1234567890', help: 'Numbers only. Leave empty to turn off.' },
        { k: 'headCode', t: 'code', label: 'Extra code for the head of every page', help: 'For example site verification tags.' },
        { k: 'bodyCode', t: 'code', label: 'Extra code at the end of every page', help: 'For example a chat widget script.' }
      ]
    },
    maintenance: {
      title: 'Maintenance mode', nav: 'Site', tag: 'Setting',
      help: ['Shows a simple "we will be right back" page to all visitors.', 'You can still view the site: open any page with ?preview=1 at the end of the address and it will stay open for that browser session. The admin is never blocked.'],
      fields: [
        { k: 'enabled', t: 'toggle', label: 'Turn maintenance mode on', def: false },
        { k: 'title', t: 'text', label: 'Title', def: 'We will be right back' },
        { k: 'message', t: 'textarea', label: 'Message', def: 'The site is being updated. Please check back soon.' }
      ]
    }
  };

  /* ---------- menu tree ---------- */
  // t: type of screen, handled in views.js
  A.NAV = [
    { id: 'dashboard', label: 'Dashboard', route: 'dashboard', keywords: 'home overview start status' },
    { group: 'Content' },
    {
      id: 'pages', label: 'Pages', route: 'pages', keywords: 'text edit words headings images links page content',
      children: () => A.PAGE_GROUPS.map((g) => ({ label: g.label, route: 'pages/group/' + g.id }))
    },
    {
      id: 'global', label: 'Header, menu and footer', route: 'global', keywords: 'menu navigation logo footer header links social product finder float panel',
      children: [{ label: 'Header and menu', route: 'global/header' }, { label: 'Footer', route: 'global/footer' }, { label: 'Product finder tab', route: 'global/floatpanel' }]
    },
    { id: 'media', label: 'Images and files', route: 'media', keywords: 'media library upload photos pictures logo' },
    { group: 'Shop' },
    {
      id: 'products', label: 'Products', route: 'products', keywords: 'price stock name image description variants sku peptides',
      children: [{ label: 'All products', route: 'products' }, { label: 'Quick price and stock list', route: 'products/quick' }, { label: 'Text on all product pages', route: 'products/shared' }]
    },
    { id: 'home', label: 'Home page products', route: 'home', keywords: 'featured homepage best sellers' },
    { id: 'discounts', label: 'Bulk discounts', route: 'settings/discounts', keywords: 'quantity tiers percent off volume' },
    { id: 'checkout', label: 'Shipping and cart', route: 'settings/checkout', keywords: 'shipping protection fee cart' },
    { id: 'coupons', label: 'Promo codes', route: 'coupons', keywords: 'coupon discount code voucher' },
    { group: 'Promotions' },
    { id: 'topbar', label: 'Top banner', route: 'settings/topbar', keywords: 'announcement bar notice' },
    { id: 'popup', label: 'Pop-up message', route: 'settings/popup', keywords: 'modal announcement offer' },
    { group: 'Customers' },
    { id: 'messages', label: 'Messages', route: 'messages', keywords: 'inbox contact form enquiries support', badge: 'newMessages' },
    { id: 'contact', label: 'Contact form texts', route: 'settings/contact', keywords: 'thank you message success' },
    { group: 'Site' },
    {
      id: 'seo', label: 'Search and sharing', route: 'settings/seo', keywords: 'seo google meta description social og favicon noindex',
      children: [{ label: 'Defaults', route: 'settings/seo' }, { label: 'Page titles (SEO)', route: 'seo-pages' }]
    },
    {
      id: 'appearance', label: 'Look and feel', route: 'settings/appearance_colours', keywords: 'colours colors fonts css style theme brand',
      children: [{ label: 'Brand colours', route: 'settings/appearance_colours' }, { label: 'Font', route: 'settings/appearance_fonts' }, { label: 'Custom styles', route: 'settings/appearance_css' }]
    },
    { id: 'scripts', label: 'Tracking and code', route: 'settings/scripts', keywords: 'analytics google pixel facebook script snippet head' },
    { id: 'redirects', label: 'Redirects', route: 'redirects', keywords: 'moved page url forward 301 hide page remove' },
    { id: 'maintenance', label: 'Maintenance mode', route: 'settings/maintenance', keywords: 'offline closed coming soon' },
    { group: 'Admin' },
    { id: 'history', label: 'Activity and undo', route: 'history', keywords: 'log changes restore revert versions who changed' },
    { id: 'backup', label: 'Backup and restore', route: 'backup', keywords: 'export import download json' },
    { id: 'team', label: 'Team', route: 'team', keywords: 'users roles invite permissions owner editor admin', min: 'owner' },
    { id: 'help', label: 'Help and guide', route: 'help', keywords: 'how to instructions support guide' }
  ];

  /* ---------- original site data (read from the files that ship with the site) ---------- */
  A.defaults = { fields: {}, pages: [] };
  A.loadDefaults = async function () {
    const r = await fetch('../data/cms-defaults.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load ../data/cms-defaults.json');
    A.defaults = await r.json();
    // index fields by page / region
    A.byPage = {}; A.byRegion = { header: [], footer: [], floatpanel: [], productpage: [] };
    Object.entries(A.defaults.fields).forEach(([k, f]) => {
      f.key = k;
      if (f.scope === 'global') (A.byRegion[f.region] = A.byRegion[f.region] || []).push(f);
      else (A.byPage[f.page] = A.byPage[f.page] || []).push(f);
    });
    // text-search index for the global search
    A.fieldIndex = Object.values(A.defaults.fields).filter((f) => f.kind !== 'alt').map((f) => ({ f, text: (f.label + ' ' + A.strip(f.value)).toLowerCase() }));
  };

  /* ---------- original products ---------- */
  A.products = function () {
    const D = window.IONDATA || { products: {}, cards: [] };
    const cards = {}; (D.cards || []).forEach((c) => { cards[c.id] = c; });
    return Object.values(D.products).map((p) => {
      const card = cards[p.id];
      let badge = '', desc = '';
      if (card) { const t = document.createElement('template'); t.innerHTML = card.html; const b = t.content.querySelector('.ion-shop-card-badge'); const d = t.content.querySelector('.ion-shop-card-description'); badge = b ? b.textContent.trim() : ''; desc = d ? d.textContent.trim() : ''; }
      return Object.assign({}, p, { origBadge: badge, origDesc: desc, cats: card ? card.cats : [] });
    }).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  };
})();
