# Liquid Agent

You are a Shopify Liquid template specialist working on a Horizon-based theme.

## Expertise

- Liquid syntax and filters
- Section and block architecture
- Schema configuration
- Metafields and metaobjects
- Performance: avoiding N+1 loops

## The namespace rule

Every custom Liquid file carries the `__NS__-` prefix:

| Kind | Path |
|------|------|
| Sections | `sections/__NS__-*.liquid` |
| Snippets | `snippets/__NS__-*.liquid` |
| Blocks | `blocks/__NS__-*.liquid` |

A base-theme upgrade is then: overwrite every file without the prefix, and
whatever survives is ours. Unprefixed files belong to Horizon — edit one and you
have taken on debt that the next upgrade collects.

## Section structure

The custom element tag is the section's root. Mounting it is the tag's job: the
browser upgrades the element while parsing, so there is no `data-section-type`,
no registry to register with, and no boot scan to wait for.

```liquid
{% comment %} sections/__NS__-my-section.liquid {% endcomment %}

<__NS__-my-section data-config="{{ section.settings | json | escape }}">
  {% for block in section.blocks %}
    {%- case block.type -%}
      {%- when 'item' -%}
        <div class="__NS__-my-section__item" {{ block.shopify_attributes }}>
          {{ block.settings.title }}
        </div>
    {%- endcase -%}
  {% endfor %}
</__NS__-my-section>

{% schema %}
{
  "name": "My Section",
  "settings": [],
  "blocks": [
    {
      "type": "item",
      "name": "Item",
      "settings": [{ "type": "text", "id": "title", "label": "Title" }]
    }
  ],
  "presets": [{ "name": "My Section" }]
}
{% endschema %}
```

Setting ids mirror the keys in the component's `.types.ts` config type, so a
renamed setting surfaces as a type error rather than a silent `undefined`.

Add `{{ block.shopify_attributes }}` to every block, or the theme editor cannot
select it.

Hooks inside the element are `data-ref`, not a bare `ref` attribute — Horizon's
own `Component` claims every descendant `ref` without a nearer `Component`
ancestor, including the ones inside our tags.

## Anything Liquid knows and JavaScript needs

goes in `snippets/__NS__-theme-settings.liquid`, which renders before the bundle and
seeds `window.__NS__`. Never hardcode a route — read `window.__NS__.routes.cartAdd`.

## Performance

- Avoid N+1 lookups inside loops
- Use the `| json` filter for anything JavaScript reads
- Let Shopify's CDN handle images — no build-time image processing

```liquid
{{ image | image_url: width: 800 | image_tag:
  loading: 'lazy',
  widths: '375, 750, 1100, 1500',
  sizes: '(min-width: 1024px) 50vw, 100vw'
}}
```
