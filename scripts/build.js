// Builds the MOHINI documentation site from hand-written pages and the theme's own schemas.
// Usage: node scripts/build.js <path to the theme folder>
const fs = require('fs');
const path = require('path');

const THEME = path.resolve(process.argv[2] || '../shadow-theme');
const OUT = path.resolve(__dirname, '..');
const SITE_URL = 'https://lalit7704.github.io/mohini-theme-docs/';
const SUPPORT_EMAIL = 'lalit979932@gmail.com';
const VERSION = '1.0.0';

/* ---------- Read the theme ---------- */

const strip = (s) => s.replace(/^﻿/, '').replace(/^\s*\/\*[\s\S]*?\*\//, '');
const readTheme = (file) => fs.readFileSync(path.join(THEME, file), 'utf8');
const schemaLocale = JSON.parse(strip(readTheme('locales/en.default.schema.json')));
const t = (value) => {
  if (typeof value !== 'string' || !value.startsWith('t:')) return value;
  return value.slice(2).split('.').reduce((o, k) => (o ? o[k] : undefined), schemaLocale) ?? value;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const schemaOf = (src) => {
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  return m ? JSON.parse(m[1]) : null;
};
const leadComment = (src) => {
  const m = src.match(/^\s*(?:\{%-?\s*liquid[\s\S]*?-?%\}\s*)?\{%-?\s*(?:comment|doc)\s*-?%\}([\s\S]*?)\{%-?\s*end(?:comment|doc)\s*-?%\}/);
  if (!m) return '';
  return m[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('@') && !l.startsWith('https://') && !l.startsWith('{%')).join(' ').replace(/\s+/g, ' ').trim();
};

// Descriptions written for merchants where the code comment is a note for developers
const DESCRIPTIONS = {
  header: 'The store header: logo, menu (dropdowns or mega menus), search, account and cart, with an optional announcement bar, top bar, country and language pickers and category shortcuts. Ten styles, each with its own layout, type and menu design.',
  footer: 'The footer: menus, text, contact details, a promo image and store promises, an optional newsletter signup, a very large store name and a bottom bar with payment icons and policy links. Ten styles.',
  'hero-slider': 'A full-width slideshow with liquid, wipe or zoom transitions (or a simple fade), optional autoplay that starts once the visitor interacts, slide controls and an optional feature bar below it. Each slide has its own image (and mobile image), text and buttons.',
  hero: 'A single full-width image banner with a subheading, heading, text and up to two buttons. Choose the height, the content position and the overlay strength.',
  'custom-section': 'An empty section you build with theme blocks: text, groups (rows and columns) and app blocks.',
  product: 'The product page: a media gallery (images, video and 3D models, with zoom) beside a column of product blocks in any order, and a sticky add to cart bar.',
  collection: 'The collection page grid: filters, sorting, product cards and pagination, with an optional menu of collections above it.',
  cart: 'The cart page: line items with quantity controls, the free shipping bar, gift wrap, order notes, totals and checkout.',
  'cart-drawer': 'The slide-out cart used when "Cart type" is set to Drawer.',
  page: 'Shows the content of a page you write in Shopify admin.',
  blog: 'The blog page: featured post, topic filters, post search and the posts as a grid, list, masonry or mosaic.',
  article: 'A blog post: title area, content, table of contents, sharing, author and related posts.',
  '404': 'The page shown when a link is broken.',
  password: 'The page customers see while your store is password protected.',
};

const CATEGORIES = [
  ['Banners and video', ['hero-slider', 'hero', 'zoom-reveal', 'video', 'image-with-text', 'collection-banner']],
  ['Products and collections', ['featured-collection', 'featured-product', 'collection-spotlight', 'collections', 'runway', 'image-hotspots', 'lookbook', 'recently-viewed', 'product-recommendations', 'quick-order-list']],
  ['Brand and storytelling', ['featured-blog', 'rich-text', 'story', 'statement', 'showcase', 'timeline', 'features', 'multicolumn', 'steps', 'stats', 'comparison', 'before-after', 'marquee', 'team']],
  ['Reviews and trust', ['testimonials', 'press', 'logo-list']],
  ['Engagement', ['newsletter', 'faq', 'collapsible-content', 'contact', 'promo-popup', 'age-verifier']],
  ['Custom content', ['custom-liquid', 'custom-section']],
  ['Page sections (part of their templates)', ['product', 'collection', 'search', 'cart', 'blog', 'article', 'page', '404', 'password']],
];

const TYPE_LABELS = {
  checkbox: 'On / off', range: 'Slider', select: 'Choice', radio: 'Choice', text: 'Text', textarea: 'Text', richtext: 'Rich text',
  inline_richtext: 'Text', html: 'HTML', liquid: 'Liquid', image_picker: 'Image', url: 'Link', color: 'Color',
  color_background: 'Gradient', color_scheme: 'Color scheme', color_scheme_group: 'Color schemes', product: 'Product',
  product_list: 'Products', collection: 'Collection', collection_list: 'Collections', link_list: 'Menu', video: 'Video',
  video_url: 'Video link', page: 'Page', blog: 'Blog', article: 'Article', font_picker: 'Font', number: 'Number',
  text_alignment: 'Alignment', metaobject: 'Metaobject',
};

function settingsTable(settings = []) {
  const rows = [];
  let group = null;
  for (const s of settings) {
    if (s.type === 'header') { group = t(s.content); continue; }
    if (s.type === 'paragraph' || !s.label) continue;
    const opts = s.options ? s.options.map((o) => t(o.label)).join(', ') : '';
    const help = [opts && `Options: ${opts}`, s.info && t(s.info)].filter(Boolean).join(' · ');
    rows.push(`<tr><td>${group ? `<span class="setting-help">${esc(group)}</span>` : ''}${esc(t(s.label))}${help ? `<span class="setting-help">${esc(help)}</span>` : ''}</td><td class="setting-type">${esc(TYPE_LABELS[s.type] || s.type)}</td></tr>`);
  }
  if (!rows.length) return '<p class="desc">No settings of its own.</p>';
  return `<table><thead><tr><th>Setting</th><th>Type</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

const sections = {};
for (const file of fs.readdirSync(path.join(THEME, 'sections')).filter((f) => f.endsWith('.liquid'))) {
  const src = readTheme(`sections/${file}`);
  const schema = schemaOf(src);
  if (schema) sections[file.replace('.liquid', '')] = { schema, src };
}
const themeBlocks = {};
for (const file of fs.readdirSync(path.join(THEME, 'blocks')).filter((f) => f.endsWith('.liquid'))) {
  const src = readTheme(`blocks/${file}`);
  const schema = schemaOf(src);
  if (schema) themeBlocks[file.replace('.liquid', '')] = { schema, src };
}
const settingsSchema = JSON.parse(readTheme('config/settings_schema.json'));

function sectionReference(key) {
  const entry = sections[key];
  if (!entry) return '';
  const { schema, src } = entry;
  const name = t(schema.name);
  const description = DESCRIPTIONS[key] || leadComment(src);
  const blocks = (schema.blocks || []).filter((b) => b.name);
  const usesThemeBlocks = (schema.blocks || []).some((b) => b.type === '@theme' || (!b.name && b.type !== '@app'));
  const acceptsApps = (schema.blocks || []).some((b) => b.type === '@app');
  const tags = [
    schema.presets?.length ? '' : '<span class="tag">Template section</span>',
    schema.max_blocks ? `<span class="tag">Up to ${schema.max_blocks} blocks</span>` : '',
    acceptsApps ? '<span class="tag">App blocks</span>' : '',
  ].join('');
  const blockHtml = blocks
    .map((b) => `<details><summary>Block: ${esc(t(b.name))}${b.limit ? ` (up to ${b.limit})` : ''}</summary><div>${settingsTable(b.settings)}</div></details>`)
    .join('');
  return `<div class="ref" id="${esc(key)}">
  <h3>${esc(name)}${tags}</h3>
  <p class="desc">${esc(description)}</p>
  <details><summary>Settings</summary><div>${settingsTable(schema.settings)}</div></details>
  ${blockHtml}
  ${usesThemeBlocks ? '<p class="desc">Also takes the theme\'s blocks (see <a href="product-page.html#blocks">Product page blocks</a>).</p>' : ''}
</div>`;
}

/* ---------- Page layout ---------- */

const NAV = [
  ['Start here', [['index.html', 'Getting started'], ['presets.html', 'Presets'], ['theme-settings.html', 'Theme settings']]],
  ['Building pages', [['header-footer.html', 'Header and footer'], ['sections.html', 'Sections'], ['product-page.html', 'Product page'], ['collections-search.html', 'Collections and search'], ['cart.html', 'Cart']]],
  ['Good to know', [['animations.html', 'Animations and speed'], ['languages.html', 'Languages'], ['faq.html', 'FAQ']]],
  ['Help', [['support.html', 'Support'], ['changelog.html', 'Release notes']]],
];

function page(file, title, description, body) {
  const nav = NAV.map(([heading, links]) => `<h4>${heading}</h4>${links.map(([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`).join('')}`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · MOHINI theme docs</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${file === 'index.html' ? '' : file}">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="index.html">MOHINI<span>Theme docs · v${VERSION}</span></a>
  <span class="spacer"></span>
  <a class="cta" href="support.html">Contact support</a>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="sidebar">Menu</button>
</header>
<div class="layout">
  <nav class="sidebar" id="sidebar" aria-label="Documentation">${nav}</nav>
  <main><div class="content">
${body}
  <footer class="site">MOHINI Themes · Theme version ${VERSION} · <a href="support.html">Support</a> · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></footer>
  </div></main>
</div>
<script>
  (function () {
    var button = document.querySelector('.menu-toggle');
    var sidebar = document.getElementById('sidebar');
    button.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  })();
</script>
</body>
</html>
`;
}

const pages = {};

/* ---------- Getting started ---------- */

pages['index.html'] = page('index.html', 'Getting started', 'Install MOHINI, pick a preset and set up your store.', `
<h1>MOHINI theme documentation</h1>
<p class="lead">MOHINI is a Shopify theme for fashion, tech and beauty brands, with ten header and footer styles, scroll-driven sections and fast product pages. This guide covers setup, every setting and section, and how to get help.</p>

<div class="warning">
  <p><strong>Before you edit the theme's code, duplicate the theme.</strong> In Shopify admin, go to <strong>Online Store › Themes</strong>, open the <strong>…</strong> menu next to MOHINI and choose <strong>Duplicate</strong>. Work on the copy. Theme updates can't carry over changes made to the code, and support doesn't cover edited code.</p>
</div>

<div class="cards">
  <a class="card" href="presets.html"><strong>Presets</strong><span>Three ready-made looks: MOHINI, Dark and Soft.</span></a>
  <a class="card" href="theme-settings.html"><strong>Theme settings</strong><span>Colors, fonts, layout, animations and more.</span></a>
  <a class="card" href="sections.html"><strong>Sections</strong><span>Every section, its settings and blocks.</span></a>
  <a class="card" href="faq.html"><strong>FAQ</strong><span>Quick answers to common questions.</span></a>
</div>

<h2 id="install">Install the theme</h2>
<ol class="steps">
  <li>In the Shopify Theme Store, open MOHINI and choose <strong>Try theme</strong> (or buy it). It's added to your theme library without replacing your current theme.</li>
  <li>Pick the preset closest to your brand. You can change every color, font and section later.</li>
  <li>Open <strong>Customize</strong> to edit it in the theme editor. Your live store doesn't change until you publish.</li>
  <li>When you're happy, choose <strong>Publish</strong>.</li>
</ol>

<h2 id="checklist">Setup checklist</h2>
<ol class="steps">
  <li><strong>Logo and favicon.</strong> Header › Logo, and Theme settings › Favicon.</li>
  <li><strong>Colors and fonts.</strong> Theme settings › Colors (color schemes) and Typography. See <a href="theme-settings.html">Theme settings</a>.</li>
  <li><strong>Menus.</strong> Build your main and footer menus in <strong>Online Store › Navigation</strong>, then pick them in the header and footer. For mega menus, see <a href="header-footer.html#mega-menu">Mega menus</a>.</li>
  <li><strong>Home page.</strong> Add, remove and reorder sections. Replace every placeholder image and text with your own.</li>
  <li><strong>Product page.</strong> Arrange the product blocks (price, variant picker, buy buttons, tabs…). See <a href="product-page.html">Product page</a>.</li>
  <li><strong>Collections, search and cart.</strong> Turn on filters in Search & Discovery, and choose a cart type. See <a href="collections-search.html">Collections and search</a> and <a href="cart.html">Cart</a>.</li>
  <li><strong>Check on a phone.</strong> Use the device toggle at the top of the theme editor.</li>
</ol>

<h2 id="images">Images</h2>
<ul>
  <li>Use large, sharp images: 2400 px wide for full-width banners, 1600 px for half-width images, 1200 px for product photos. Shopify serves the right size to each device.</li>
  <li>Set a <strong>focal point</strong> on an image (in the image picker, choose <strong>Edit</strong>) so the important part stays in view when the image is cropped, especially on phones.</li>
  <li>Many banners have a separate <strong>Mobile image</strong> setting for a portrait version.</li>
  <li>Add alt text to images in Shopify admin so screen readers can describe them.</li>
</ul>

<h2 id="help">Getting help</h2>
<p>Most answers are in this guide and the <a href="faq.html">FAQ</a>. If you're stuck, <a href="support.html">contact support</a>: we reply within 2 business days.</p>
`);

/* ---------- Presets ---------- */

pages['presets.html'] = page('presets.html', 'Presets', 'MOHINI, Dark and Soft presets.', `
<h1>Presets</h1>
<p class="lead">A preset is a starting point: a set of colors, fonts, header and footer styles and home page sections. All presets share the same features.</p>

<table>
  <thead><tr><th>Preset</th><th>Made for</th><th>Header and footer</th><th>Fonts</th></tr></thead>
  <tbody>
    <tr><td><strong>MOHINI</strong></td><td>Fashion and clothing</td><td>Clothing style</td><td>Work Sans</td></tr>
    <tr><td><strong>Dark</strong></td><td>Electronics and tech</td><td>Electronics style</td><td>Space Grotesk, Inter</td></tr>
    <tr><td><strong>Soft</strong></td><td>Beauty and skincare</td><td>Beauty style</td><td>Cormorant, Jost</td></tr>
  </tbody>
</table>

<h2>Switching presets</h2>
<p>Presets are chosen when you add the theme. To try another one, add MOHINI again from the Theme Store with the other preset; your current copy stays in the theme library.</p>
<div class="note"><p>You can get any preset's look by hand too: the header and footer each have ten styles (Header › Style and Footer › Style), and colors and fonts are in Theme settings.</p></div>
`);

/* ---------- Theme settings ---------- */

const themeSettingIntro = {
  Colors: 'Color schemes are sets of background, text, button and accent colors. Every section has a "Color scheme" setting that picks one, so changing a scheme updates every section using it.',
  Typography: 'Heading and body fonts from Shopify\'s font library, the base font size and line height, a size scale for headings and an optional text case for headings.',
  Layout: 'Page width, the side margin on phones, space between sections, grid spacing and the corner radius of cards, media and inputs.',
  Animations: 'Scroll reveals, hover effects and the fly-to-cart effect. See Animations and speed.',
  Swatches: 'How color and image swatches look, on product pages and (optionally) on product cards.',
  Product: 'Product cards (style, image ratio, second image on hover, quick add, quick view, badges) and the product page variant picker and image zoom.',
  Cart: 'Cart type (drawer, page or popup notification), order notes, gift wrap and the free shipping bar.',
};
pages['theme-settings.html'] = page('theme-settings.html', 'Theme settings', 'Every theme setting in MOHINI.', `
<h1>Theme settings</h1>
<p class="lead">Theme settings apply to the whole store. In the theme editor, open them with the gear icon at the bottom of the left sidebar.</p>
${settingsSchema
  .filter((g) => g.name !== 'theme_info')
  .map((g) => {
    const name = t(g.name);
    return `<h2 id="${esc(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${esc(name)}</h2>${themeSettingIntro[name] ? `<p>${esc(themeSettingIntro[name])}</p>` : ''}${settingsTable(g.settings)}`;
  })
  .join('\n')}
`);

/* ---------- Header and footer ---------- */

pages['header-footer.html'] = page('header-footer.html', 'Header and footer', 'Header styles, menus, mega menus and footer.', `
<h1>Header and footer</h1>
<p class="lead">The header and footer appear on every page. Each has ten styles, and each style has its own layout, type and decoration.</p>

<h2 id="header-styles">Header styles</h2>
<p><strong>Header › Style</strong> sets the layout: Beauty and Jewelry center the logo with search on the left; Clothing centers it with the menu on the left; Electronics, Food and drink, Pets and Toys put a wide search beside the logo; Kids, Services and Sports put the menu beside the logo.</p>
<p>Other header settings: logo and mobile logo, colors (by color scheme or your own), menu type (dropdown or mega menu), search style, which icons and labels show, announcement bar, top bar, country and language pickers, category shortcuts, sticky header (always, on scroll up, or off) and a transparent header over the first section of the home page.</p>

<h2 id="menus">Menus</h2>
<p>Build menus in <strong>Online Store › Navigation</strong>. A top-level link with child links opens a dropdown; with <strong>Menu type: Mega menu</strong>, it opens a full-width panel instead. Child links with their own children become columns with headings.</p>

<h2 id="mega-menu">Mega menus and promos</h2>
<p>Add a <strong>Mega menu promo</strong> block to the header and type the menu link's title in <strong>Menu item</strong> (for example <code>Catalog</code>). That link then opens a mega menu with promo cards beside its columns.</p>
<ul>
  <li>Each block has two promos (image, heading, text, link) and a button label. Leave promo 2's image and heading empty to show one promo.</li>
  <li><strong>More than two promos:</strong> add another Mega menu promo block with the same menu item. Promos from every matching block show in a row, in block order.</li>
  <li><strong>Text position:</strong> below the image, or on the image over a dark overlay (good for offers like "50% off"). Set the overlay strength with <strong>Image overlay opacity</strong>.</li>
  <li><strong>Image ratio:</strong> the header style's default, portrait, square, landscape or wide. Landscape and wide promos are also wider.</li>
  <li>Without an image, a promo shows a tinted frame (the placeholder art only shows in the theme editor).</li>
</ul>
<div class="note"><p><strong>Example: four link columns and one wide offer image.</strong> Give the menu link four child links, each with its own links. Add a Mega menu promo block for that link with promo 1 only, Text position "On the image", Image ratio "Wide" and the heading "50% OFF".</p></div>

<h2 id="menu-labels">Menu labels</h2>
<p>A <strong>Menu label</strong> block adds a small badge (like "Hot" or "New") next to a menu link. Type the link's title in <strong>Menu item</strong> and choose the badge text and colors.</p>

<h2 id="announcement">Announcement bar</h2>
<p>Add <strong>Announcement</strong> blocks for messages that rotate above the header. Each can have an icon, a link and a countdown to a date and time.</p>

<h2 id="footer">Footer</h2>
<p><strong>Footer › Style</strong> sets the colors, type, decoration and where the newsletter signup sits. Add blocks for menus, text, contact details, a promo image and store promises (like free shipping). Other settings: brand logo and text, newsletter signup, a very large store name across the bottom and the bottom bar (payment icons, policies, country and language pickers, copyright).</p>
${sectionReference('header')}
${sectionReference('footer')}
`);

/* ---------- Sections ---------- */

const listed = new Set(CATEGORIES.flatMap(([, keys]) => keys));
const others = Object.keys(sections).filter((k) => !listed.has(k) && sections[k].schema.presets?.length && !['header', 'footer'].includes(k));
pages['sections.html'] = page('sections.html', 'Sections', 'Every MOHINI section, its settings and blocks.', `
<h1>Sections</h1>
<p class="lead">Sections are the building blocks of each page. In the theme editor, choose <strong>Add section</strong> on any page to add one, drag to reorder, and use the eye icon to hide one without deleting it.</p>
<div class="note"><p>Sections marked <em>Template section</em> belong to a page type (like the product page) and can't be added elsewhere.</p></div>
${CATEGORIES.map(([title, keys]) => `<h2 id="${esc(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${esc(title)}</h2>${keys.map(sectionReference).join('\n')}`).join('\n')}
${others.length ? `<h2>More sections</h2>${others.map(sectionReference).join('\n')}` : ''}
`);

/* ---------- Product page ---------- */

const productBlocks = (sections.product?.schema.blocks || []).filter((b) => !b.name && b.type !== '@app').map((b) => b.type);
pages['product-page.html'] = page('product-page.html', 'Product page', 'Product page layout, media and blocks.', `
<h1>Product page</h1>
<p class="lead">The product page has a media gallery and a column of blocks. Add, remove and reorder blocks in the theme editor; each block has its own settings.</p>

<h2 id="media">Media</h2>
<p>Product media can be images, videos and 3D models. In the section's Media settings, choose the desktop layout: a grid, thumbnails on the left, a slider with thumbnails or stacked images. Phones always get a swipeable slider. Theme settings › Product › Enable image zoom opens images full screen. Variant images switch automatically when a customer picks a variant.</p>

<h2 id="blocks">Product page blocks</h2>
${productBlocks.map((type) => {
  const b = themeBlocks[type];
  if (!b) return '';
  return `<div class="ref" id="block-${esc(type)}"><h3>${esc(t(b.schema.name))}</h3>${leadComment(b.src) ? `<p class="desc">${esc(leadComment(b.src))}</p>` : ''}<details><summary>Settings</summary><div>${settingsTable(b.schema.settings)}</div></details></div>`;
}).join('\n')}

<h2 id="gift-cards">Gift cards</h2>
<p>Gift card products show a form so customers can send the card to someone else by email, with a message and a delivery date. The gift card page customers receive uses the theme's colors and fonts.</p>

<h2 id="quick-view">Quick view and quick add</h2>
<p>Turn these on in Theme settings › Product. Quick add adds a product to the cart from its card (or opens a variant picker); quick view opens the product in a drawer with its gallery, variant picker and buy buttons.</p>
${sectionReference('product')}
`);

/* ---------- Collections and search ---------- */

pages['collections-search.html'] = page('collections-search.html', 'Collections and search', 'Collection pages, filters, sorting and search.', `
<h1>Collections and search</h1>

<h2 id="filters">Filters</h2>
<p>Filters come from Shopify's <strong>Search & Discovery</strong> app: install it, then choose which filters to show (availability, price, product type, vendor, variant options, metafields). In the collection and search sections, turn on <strong>Enable filtering</strong> and choose the filter layout: vertical (a sidebar that can start open, or a drawer opened from the Filter button) or horizontal (a bar of dropdowns). On phones, filters always open in a drawer, and results update without reloading the page.</p>

<h2 id="collection-page">Collection page</h2>
<p>The collection template has a collection banner (title, description and image) and the product grid. Choose columns on desktop and phones, products per page, pagination (numbers, a "Load more" button or infinite scroll) and an optional menu of collections above the grid.</p>

<h2 id="collections-list">Collections list page</h2>
<p>The <strong>Collections list</strong> section shows the collections you pick, or all of them in the order you choose. Layouts: editorial (first card large), grid, carousel, hover list or circles; cards can show the text on the image, below it or in a framed card.</p>

<h2 id="search">Search</h2>
<p>Predictive search shows products, collections, pages and articles as customers type (Theme settings › Search). The search results page has tabs for result types, filters, sorting, trending and recent searches, and suggestions when nothing matches.</p>
${sectionReference('collection')}
${sectionReference('search')}
`);

/* ---------- Cart ---------- */

pages['cart.html'] = page('cart.html', 'Cart', 'Cart drawer, cart page, gift wrap and free shipping bar.', `
<h1>Cart</h1>
<p class="lead">Choose how the cart opens in Theme settings › Cart › Cart type.</p>
<table>
  <thead><tr><th>Cart type</th><th>What happens on "Add to cart"</th></tr></thead>
  <tbody>
    <tr><td>Drawer</td><td>The cart slides in from the side, with line items, the free shipping bar and checkout.</td></tr>
    <tr><td>Page</td><td>Customers go to the cart page.</td></tr>
    <tr><td>Popup notification</td><td>A small confirmation appears with links to the cart and checkout.</td></tr>
  </tbody>
</table>

<h2 id="free-shipping">Free shipping bar</h2>
<p>Turn on <strong>Show free shipping bar</strong> and set <strong>Free shipping minimum</strong> in your store's currency. The bar shows how much more customers need to spend, then tells them when they've unlocked free shipping. Set up the matching free shipping rate in Shopify admin › Settings › Shipping.</p>

<h2 id="gift-wrap">Gift wrap</h2>
<p>Create a product for gift wrapping (for example "Gift wrap", with its price), then choose it in <strong>Gift wrap product</strong>. Customers can add it from the cart with one click, and leave a gift message if <strong>Let customers add a gift message</strong> is on.</p>

<h2 id="notes">Order notes and checkout buttons</h2>
<p><strong>Enable order notes</strong> adds a note field to the cart. Accelerated checkout buttons (Shop Pay, Apple Pay, Google Pay…) appear on the cart page when they're turned on in Shopify admin › Settings › Payments.</p>
`);

/* ---------- Animations and speed ---------- */

pages['animations.html'] = page('animations.html', 'Animations and speed', 'How MOHINI animates and stays fast.', `
<h1>Animations and speed</h1>
<p class="lead">MOHINI animates with GSAP: content reveals as it scrolls into view, product cards react on hover, products fly to the cart, and some sections are driven by scrolling.</p>

<h2 id="settings">Animation settings</h2>
<p>Theme settings › Animations:</p>
<ul>
  <li><strong>Enable animations</strong> turns all of them on or off.</li>
  <li><strong>Reveal content on load and scroll</strong>: headings, text and cards fade or slide in as they come into view.</li>
  <li><strong>Product card hover effect</strong>: images zoom and quick actions slide in on hover.</li>
  <li><strong>Fly product image to the cart on add</strong>.</li>
  <li><strong>Animation speed</strong>: slow, normal or fast.</li>
</ul>

<h2 id="speed">Built for speed</h2>
<ul>
  <li>The animation scripts load on the visitor's first scroll, tap, key press or mouse movement, not with the page, so the first screen appears without waiting for them. What's already on screen stays as it is; everything below animates in as the visitor scrolls.</li>
  <li>Each section loads only its own styles, and only on pages that use it.</li>
  <li>Images load at the size each device needs, and images below the first screen load as the visitor scrolls.</li>
  <li>The hero slider's transitions and autoplay start once the visitor interacts, so the first slide is what loads first.</li>
</ul>

<h2 id="scroll-sections">Scroll-driven sections</h2>
<p><strong>Zoom reveal</strong>, <strong>Runway</strong> and <strong>Showcase</strong> pin to the screen while the customer scrolls. They need animations on; with animations off, they show as regular layouts that work with swiping. Each one adds a few screens of scrolling, so use them where you want to slow visitors down, like a new collection.</p>

<h2 id="reduced-motion">Reduced motion</h2>
<p>Customers who turn on "reduce motion" on their device don't see animations: content simply shows, and scroll-driven sections use their static layouts.</p>

<h2 id="tips">Tips for a fast store</h2>
<ul>
  <li>Upload images no larger than about 2500 px on the long side, compressed (JPG or WebP).</li>
  <li>Keep apps you don't use uninstalled: many add scripts to every page.</li>
  <li>Use one hero (slider or banner) at the top of the home page, and not more than one or two scroll-driven sections per page.</li>
</ul>
`);

/* ---------- Languages ---------- */

pages['languages.html'] = page('languages.html', 'Languages', 'Translations and right-to-left languages.', `
<h1>Languages</h1>
<p class="lead">The storefront text built into MOHINI (buttons, labels, messages) comes in English, French, German, Italian and Spanish.</p>
<ul>
  <li>Add languages in Shopify admin › Settings › Languages. Your own content (products, pages, section text) is translated with the <strong>Translate & Adapt</strong> app.</li>
  <li>To change any built-in text, go to <strong>Online Store › Themes › … › Edit default theme content</strong>.</li>
  <li><strong>Right-to-left languages</strong> (Arabic, Hebrew, Persian, Urdu and others) are supported: the layout, menus, sliders and arrows mirror automatically. Translate the theme's text with Translate & Adapt.</li>
  <li>Customers switch language and currency with the pickers in the header and footer (turn them on in the header's "Country and language" settings and the footer's bottom bar).</li>
</ul>
`);

/* ---------- FAQ ---------- */

const faqs = [
  ['How do I change the look without changing presets?', 'Theme settings › Colors and Typography set colors and fonts, and Header › Style and Footer › Style each offer ten styles. Between them you can match any preset.'],
  ['How do I make a mega menu?', 'Set Header › Menu type to "Mega menu" and give a top-level menu link child links (and grandchild links for columns). To add promo images, add a "Mega menu promo" block and type the link\'s title in "Menu item". See <a href="header-footer.html#mega-menu">Mega menus and promos</a>.'],
  ['Can a mega menu show more than two promos?', 'Yes: add another Mega menu promo block with the same menu item. Promos from every matching block show in a row.'],
  ['Why don\'t animations play right when the page opens?', 'To keep pages fast, the animation scripts load on the visitor\'s first scroll, tap or mouse movement. Whatever is on screen at that point stays as it is, and everything below animates in as they scroll. If nothing animates at all, check Theme settings › Animations and whether your device has "reduce motion" turned on.'],
  ['How do I add a size chart or care instructions?', 'Write the content as a page in Shopify admin › Online Store › Pages, then add a "Collapsible tab" or "Tabs" block to the product page and choose that page.'],
  ['How do I show a countdown for a sale?', 'Add a "Countdown timer" block to the product page, or a countdown to an Announcement block in the header, and set the end date and time.'],
  ['Where do filters come from?', 'From Shopify\'s free Search & Discovery app. Install it, choose your filters there, then turn on "Enable filtering" in the collection and search sections.'],
  ['How do I offer gift wrapping?', 'Create a gift wrap product and choose it in Theme settings › Cart › Gift wrap product. See <a href="cart.html#gift-wrap">Gift wrap</a>.'],
  ['My banner image is cropped badly on phones. What can I do?', 'Set a focal point on the image (image picker › Edit), or add a separate mobile image where the section offers one.'],
  ['How do I use Zoom reveal and Runway?', 'Add them from Add section on the home page. Zoom reveal cuts a word out of the section\'s color to show your image through its letters; Runway pairs model images with products. Both need animations on. See <a href="sections.html#zoom-reveal">Zoom reveal</a> and <a href="sections.html#runway">Runway</a>.'],
  ['Can I edit the theme\'s code?', 'Yes, but duplicate the theme first and edit the copy. Edited code can\'t receive theme updates automatically, and support doesn\'t cover changes to the code.'],
  ['How do I update MOHINI?', 'When an update is out, Shopify shows it in Online Store › Themes. Adding the update creates a new copy with your settings and content carried over; review it and publish it. Changes you made to the code aren\'t carried over.'],
  ['Does MOHINI work with apps?', 'Yes. Sections and the product page accept app blocks, and apps that add their own sections or embeds work as usual. We can\'t support the apps themselves; contact the app\'s developer for help with an app.'],
];
pages['faq.html'] = page('faq.html', 'FAQ', 'Frequently asked questions about MOHINI.', `
<h1>Frequently asked questions</h1>
<div class="faq">
${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><div><p>${a}</p></div></details>`).join('\n')}
</div>
<p>Didn't find your answer? <a href="support.html">Contact support</a>.</p>
`);

/* ---------- Support ---------- */

pages['support.html'] = page('support.html', 'Support', 'How to get help with MOHINI.', `
<h1>Support</h1>
<p class="lead">We're here to help with setting up and using MOHINI. We reply to every request within <strong>2 business days</strong> (Monday to Friday).</p>

<h2 id="contact">Contact us</h2>
<form class="support" action="https://formsubmit.co/${SUPPORT_EMAIL}" method="POST" enctype="multipart/form-data">
  <input type="hidden" name="_subject" value="MOHINI theme support request">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_next" value="${SITE_URL}thanks.html">
  <input type="hidden" name="_autoresponse" value="Thanks for contacting MOHINI Themes support. We've received your request and will reply within 2 business days (Monday to Friday). If you have more details or screenshots, reply to this email. — MOHINI Themes">
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
  <label>Your name
    <input type="text" name="name" required autocomplete="name">
  </label>
  <label>Email
    <input type="email" name="email" required autocomplete="email">
  </label>
  <label>Store URL
    <span class="hint">For example: your-store.myshopify.com</span>
    <input type="text" name="store_url" required placeholder="your-store.myshopify.com">
  </label>
  <label>Topic
    <select name="topic" required>
      <option value="Setup question">Setting up the theme</option>
      <option value="Something isn't working">Something isn't working</option>
      <option value="Feature question">A question about a feature</option>
      <option value="Other">Something else</option>
    </select>
  </label>
  <label>Describe your question or the problem
    <span class="hint">Tell us which page and section, what you expected and what happened.</span>
    <textarea name="message" required></textarea>
  </label>
  <label>Screenshot or file (optional)
    <input type="file" name="attachment" accept="image/*,.pdf,.zip">
  </label>
  <button type="submit">Send request</button>
</form>
<p>You can also email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

<h2 id="policy">Support policy</h2>
<h3>What's included</h3>
<ul>
  <li>Help with installing MOHINI and using its settings, sections and blocks.</li>
  <li>Fixing bugs in the theme, at no cost.</li>
  <li>Guidance on images, presets and Shopify features the theme uses.</li>
</ul>
<h3>What's not included</h3>
<ul>
  <li>Changes to the theme's code, or problems caused by code that's been edited.</li>
  <li>Problems with third-party apps; please contact the app's developer.</li>
  <li>Design work, store setup services or custom features.</li>
</ul>
<h3>To help us help you</h3>
<ul>
  <li>Include your store URL and, if possible, a link to a preview of the theme.</li>
  <li>If we need to look at your store, we'll ask for collaborator access; we never ask for your password.</li>
</ul>
<div class="warning"><p>Duplicate the theme before editing its code, and keep a copy you haven't edited. Support can't cover edited code.</p></div>
`);

pages['thanks.html'] = page('thanks.html', 'Request received', 'Your support request was sent.', `
<h1>Thanks, we've got your request</h1>
<p class="lead">We'll reply within 2 business days (Monday to Friday). A confirmation is on its way to your inbox.</p>
<p><a href="index.html">Back to the documentation</a></p>
`);

/* ---------- Release notes ---------- */

pages['changelog.html'] = page('changelog.html', 'Release notes', 'What\'s new in each MOHINI version.', `
<h1>Release notes</h1>
<h2 id="v1-0-0">Version ${VERSION}</h2>
<p>First release.</p>
<ul>
  <li>Three presets: MOHINI (fashion), Dark (tech) and Soft (beauty).</li>
  <li>Ten header styles and ten footer styles, mega menus with any number of promos (text below or on the image), menu labels, an announcement bar with countdowns, and a sticky or transparent header.</li>
  <li>${Object.values(sections).filter((s) => s.schema.presets?.length).length} sections you can add, including Hero slider with WebGL transitions, Zoom reveal, Runway, Showcase, Shop the look, Lookbook, Before / after, Timeline, Stats and Comparison.</li>
  <li>Product page with ${productBlocks.length} blocks, including pickup availability, complementary products, countdown, delivery estimate, tabs and highlights; image zoom, video and 3D models; quick view and quick add.</li>
  <li>Filters and sorting from Search & Discovery, predictive search, and a quick order list for bulk and B2B orders.</li>
  <li>Cart drawer, page or popup, with a free shipping bar, gift wrap and gift messages.</li>
  <li>GSAP animations that load on first interaction, per-section styles, and support for reduced motion.</li>
  <li>Storefront text in English, French, German, Italian and Spanish, and right-to-left languages.</li>
</ul>
`);

/* ---------- Write ---------- */

for (const [file, html] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, file), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Built ${Object.keys(pages).length} pages into ${OUT}`);
console.log(`Sections documented: ${CATEGORIES.flatMap(([, k]) => k).filter((k) => sections[k]).length + others.length + 2}; product blocks: ${productBlocks.length}`);
if (others.length) console.log('Sections not in a category:', others.join(', '));
