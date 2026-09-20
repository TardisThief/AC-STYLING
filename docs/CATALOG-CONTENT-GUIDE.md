# Vault catalog content guide

Everything needed to fully populate the masterclasses and the courses, and the
template + scripts to import it.

- Template: [`content/catalog/catalog.template.json`](../content/catalog/catalog.template.json)
- Export what is live now: `node scripts/export_catalog.mjs` → `content/catalog/catalog.json`
- Validate / import: `node scripts/import_catalog.mjs` (dry run) then `--apply`

Both scripts need `DATABASE_URL` in `.env.local`.

## The shape of the catalog

Two tables:

- **`masterclasses`** — a course: card, price, teaser, publish flag. It is what
  a customer buys.
- **`chapters`** — a lesson. A chapter with `masterclass_id` set is a **module**
  inside a masterclass (`is_standalone: false`). A chapter without one is a
  **standalone course** — its own single-video product (`is_standalone: true`,
  `category: "course"`).

The import file mirrors that: masterclasses carry their modules inline, and
standalone courses live in `standalone_courses`.

Rows match on **`masterclasses.title`** and **`chapters.slug`** — existing rows
are updated in place so uuids, purchases, access grants and progress survive.
Changing a title or slug creates a *new* row; it does not rename the old one.
Nothing is ever deleted by the importer.

## Per-course fields (`masterclasses`)

| Field | Required | What to supply |
|---|---|---|
| `title` | yes | English course name. Match key. |
| `subtitle` | no | One line under the title on the card. |
| `description` | to publish | 2–4 sentences: what the student learns. |
| `title_es` / `subtitle_es` / `description_es` | recommended | Spanish copy. Missing → Spanish visitors see English. |
| `thumbnail_url` | to publish | Public URL of the 16:9 card image (`vault-assets` bucket or the admin uploader). |
| `video_url` | no | Free teaser. A Vimeo URL or bare id; anything else and the teaser silently doesn't render. |
| `order_index` | yes | Integer; position in the catalog. |
| `price_display` | to publish | The literal string on the card, e.g. `"$50"`. Authored, not computed — keep it in step with Stripe. |
| `runtime_minutes` | no | Approximate course length. Rendered hedged ("about an hour"). Course-level only; there is deliberately no per-module runtime. |
| `stripe_product_id` | to publish | `prod_…`. The Stripe webhook resolves this to grant access. |
| `price_id` | to publish | `price_…`. What Checkout charges. |
| `is_published` | — | `true` renders the card fully on `/vault-access`. `false` = "in production". |
| `available_at` | no | A real committed date, or `null`. Never infer one — `null` renders as "in production" with no date claimed. |

## Per-lesson fields (`chapters`)

| Field | Required | What to supply |
|---|---|---|
| `slug` | yes | Lowercase kebab-case. The URL segment and the match key — freeze it at launch. |
| `title` | yes | Lesson title. |
| `subtitle` | no | Short line under the title. |
| `description` | to publish | What the lesson covers. |
| `title_es` / `subtitle_es` / `description_es` | recommended | Spanish copy. |
| `video_id` | **yes** | Vimeo id, digits only (`1207933620`). `NOT NULL` in the DB, so a placeholder like `pending_video` is the only way to park a row — and only while `is_published` is false. |
| `video_id_es` | no | Spanish Vimeo id; `null` falls back to the English video. |
| `thumbnail_url` | for standalone | Module cards inherit the course image; a standalone course needs its own. |
| `category` | yes | `masterclass` (module) or `course` (standalone). DB CHECK constraint. |
| `order_index` | yes | Integer; position within the course. |
| `is_standalone` | yes | `false` for a module, `true` for a standalone course. |
| `takeaways` / `takeaways_es` | recommended | Array of short strings, 3–6 reads best. |
| `lab_questions` | no | Essence Lab prompts — see below. |
| `resource_urls` | no | `[{ "name": "Workbook (PDF)", "url": "https://…" }]`. |
| `stripe_product_id` / `price_id` | standalone only | Only if the lesson is bought on its own. |
| `is_published` / `available_at` | — | Same meaning as on the course. |

### `lab_questions`

```json
{
  "key": "col_m1_q1",
  "label": "What type of looks do you use most?",
  "placeholder": "e.g., I mostly use safe neutrals…",
  "label_es": "¿Qué tipo de looks usas más?",
  "placeholder_es": "ej. Principalmente uso neutros…",
  "mapToEssence": true,
  "mappingCategory": "style_words"
}
```

- `key` must be **unique across the entire catalog** — answers are stored in
  `essence_responses.question_key` and the profile builds one global key map, so
  a reused key collides between courses. The importer enforces this.
- The Lab renders **`label`**, not `question`. Some legacy rows only have
  `question` and therefore render a blank prompt; the importer errors on those.
- `mapToEssence: true` surfaces the answer in the student's profile header;
  `mappingCategory` must then be one of `style_words`, `archetype`,
  `power_features`, `color_energy`.

## Videos

Vimeo only. `video_id` takes the numeric id; `masterclasses.video_url` takes a
full URL or an id. `chapters.video_id` / `video_id_es` are entitlement-gated at
the column level (migration 09) — only the server reads them, so they never
appear in any public catalog query.

## What "publishable" means

The importer refuses to set `is_published: true` unless:

- **Course**: `thumbnail_url`, `description`, `price_display`,
  `stripe_product_id`, `price_id`, and at least one published module.
- **Lesson**: a real (non-placeholder) `video_id` and a `description`; a
  standalone course also needs `thumbnail_url`.

## Workflow

```bash
node scripts/export_catalog.mjs          # snapshot live content into content/catalog/catalog.json
# edit catalog.json
node scripts/import_catalog.mjs          # validate — 0 errors before proceeding
node scripts/import_catalog.mjs --apply  # one transaction; rolls back on any failure
```

Then redeploy (or revalidate the `vault-catalog` cache tag) so the public sales
page picks up the change. The admin console (`/vault/admin`) edits the same
rows; the file and the console are interchangeable.

## Current gaps (as of 2026-09-20)

Live rows: 3 masterclasses (Colorimetry, The AC Method, Body Shape), 17 modules,
3 standalone courses (Jewelry, Perfumery, Dopamine Dressing).

**Blocking publication:**

1. **No real videos anywhere.** Colorimetry's 5 modules are `TODO_FILL_IN`;
   every other module and course is `pending_video`. Colorimetry is flagged
   published with placeholder videos — the importer errors on that combination.
2. **The AC Method and Body Shape** have no `thumbnail_url`, `price_display`,
   `stripe_product_id` or `price_id`, and their `video_url` is literally
   `vimeo.com/pending_m1` / `_m2`.
3. **Standalone courses** (Jewelry, Perfumery, Dopamine Dressing) have no
   thumbnail, no takeaways, no lab questions and no Stripe product.

**Data drift to fix while filling the file:**

4. Six modules of The AC Method / Body Shape have `is_standalone: true`
   despite sitting inside a masterclass — that makes the access check treat them
   as separately-gated items. Set them to `false`.
5. Eight lab questions use `question` instead of `label` and currently render a
   blank prompt in the Lab.
6. Most modules have exactly one takeaway; no module has any `resource_urls`.
7. `video_id_es` is a placeholder everywhere — set it to a real id or `null`
   (null cleanly falls back to the English video).

Spanish copy (`title_es`, `subtitle_es`, `description_es`, `takeaways_es`) is
already complete on every existing row; only the per-question `label_es` /
`placeholder_es` are missing on the AC Method and Body Shape modules.
