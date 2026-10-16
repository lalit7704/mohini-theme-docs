# MOHINI theme documentation

Documentation for the MOHINI Shopify theme, published at https://lalit7704.github.io/mohini-theme-docs/

The section, block and theme settings reference is generated from the theme's own schemas. After changing the theme, rebuild the pages and push:

```
node scripts/build.js ../shadow-theme
```

Hand-written pages (getting started, FAQ, support and the rest) live in `scripts/build.js`; styles are in `assets/style.css`.

The support form on `support.html` posts to FormSubmit (https://formsubmit.co), which emails each request to the support address and sends the customer an automatic reply.
