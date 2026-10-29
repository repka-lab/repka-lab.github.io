# Max — промпты для генерации

Max — главный персонаж канала. Канонический Max для видео — [max.svg](max.svg): видеоролики Remotion анимируют именно его. Сгенерированные картинки нужны для аватара, баннера и обложек. Поэтому выбранный стиль затем переносится в SVG через палитру и толщину линий.

Во всех вариантах соблюдаются три правила:

- **Max явно не человек.** Это стикмен: голова-круг, тело и конечности одной линией. На шнурке висит бейдж «AI».
- **Никакого фотореализма.** Нет кожи, реалистичного лица и 3D-рендера.
- **На графике нет данных.** Нет тикеров, чисел и знаков валют, чтобы картинка не выглядела как сигнал по реальному активу. Логотипов и брендов тоже нет.

Промпты написаны на английском: модели понимают его лучше.

---

## Вариант A — «Ink line» (совпадает с max.svg)

Чёрная линия на белом фоне, минимализм в духе xkcd. Этот вариант лучше всего читается на маленьком аватаре и совпадает с видео один в один.

**DALL-E / ChatGPT images**

```
A minimalist stick figure character drawn in thick, clean black ink lines on a plain white background, in the style of a simple webcomic. The character is a young researcher named Max: a perfectly round head, the body and limbs are single straight lines. He wears round glasses and large over-ear headphones, and a lanyard with a small badge that reads "AI". One eyebrow is raised and he has a slight lopsided smirk: curious and a little skeptical. He stands next to a desk, holding a magnifying glass up to a laptop screen that shows a simple unlabeled zigzag line chart drawn in one blue accent color. A small closed notebook lies on the desk. Flat 2D line art, no shading, no gradients, lots of white space. Do not include any numbers, ticker symbols, currency signs, logos, or any text other than "AI" on the badge. Not photorealistic, no realistic human features, no skin, no 3D.
```

**Midjourney**

```
minimalist webcomic stick figure, thick clean black ink lines on plain white background, round head, single-line body and limbs, round glasses, big over-ear headphones, lanyard badge reading "AI", one raised eyebrow, slight skeptical smirk, holding a magnifying glass up to a laptop showing an unlabeled zigzag line chart in a single blue accent, small notebook on desk, flat 2D line art, no shading, generous white space --ar 1:1 --style raw --stylize 50 --no photo, photorealistic, 3d render, realistic face, skin, hair, logo, brand, numbers, currency symbols, ticker, gradient
```

---

## Вариант B — «Notebook doodle»

Синяя шариковая ручка на листе в клетку, неровная «живая» линия. Похоже на полевые заметки исследователя. Этот стиль теплее и выглядит более «ручным».

**DALL-E / ChatGPT images**

```
A hand-drawn doodle of a stick figure character sketched with a blue ballpoint pen on grid notebook paper, slightly wobbly imperfect lines, like a page from a researcher's lab notebook. The character is a young researcher named Max: a round head, the body and limbs are single lines. He wears round glasses, big over-ear headphones, and a lanyard with a little badge that says "AI". He looks curious and skeptical: one eyebrow raised, a small smirk. He peers through a magnifying glass at a laptop on a desk; the laptop screen shows a scribbled zigzag line chart with no labels. A few small hand-drawn arrows and question marks float near the chart. Only blue ink on the paper, with one light yellow highlighter stroke across the chart. No numbers, no ticker symbols, no currency signs, no logos, no text other than "AI" on the badge. Not photorealistic, no realistic human features, no 3D.
```

**Midjourney**

```
blue ballpoint pen doodle on grid notebook paper, wobbly hand-drawn stick figure, round head, single-line body and limbs, round glasses, big over-ear headphones, lanyard badge reading "AI", raised eyebrow, small skeptical smirk, peering through a magnifying glass at a laptop with a scribbled unlabeled zigzag chart, small arrows and question marks, one yellow highlighter stroke, lab notebook page --ar 1:1 --style raw --stylize 100 --no photo, photorealistic, 3d render, realistic face, skin, hair, logo, brand, numbers, currency symbols, ticker
```

---

## Вариант C — «Night lab»

Светлые линии на тёмно-синем фоне, как мел на доске или чертёж. Выделяется в тёмной теме X. Тёмная палитра уже проверена на max.svg.

**DALL-E / ChatGPT images**

```
A stick figure character drawn in clean off-white chalk-like lines on a deep navy blue background, like a sketch on a dark lab whiteboard. The character is a young researcher named Max: a round head, the body and limbs are single lines. He wears round glasses, big over-ear headphones, and a lanyard with a small badge that reads "AI". He has one eyebrow raised and a slight smirk: curious and skeptical. He holds a magnifying glass up to a laptop on a desk; the screen shows a simple unlabeled zigzag line chart glowing in a single bright blue accent. Flat 2D, minimal, no shading, plenty of empty dark space. No numbers, no ticker symbols, no currency signs, no logos, no text other than "AI" on the badge. Not photorealistic, no realistic human features, no 3D.
```

**Midjourney**

```
off-white chalk line stick figure on deep navy background, dark lab whiteboard sketch, round head, single-line body and limbs, round glasses, big over-ear headphones, lanyard badge reading "AI", raised eyebrow, slight skeptical smirk, holding a magnifying glass up to a laptop with an unlabeled zigzag line chart glowing in one bright blue accent, flat 2D, minimal, lots of negative space --ar 1:1 --style raw --stylize 50 --no photo, photorealistic, 3d render, realistic face, skin, hair, logo, brand, numbers, currency symbols, ticker, neon glow overload
```

---

## После выбора

1. **Аватар.** Взять промпт выбранного варианта и заменить сцену на «head and shoulders portrait, centered, wide margin around the head». X обрезает аватар в круг, и в ленте он около 48 px, поэтому голова должна занимать центр кадра.
2. **Character sheet**, чтобы Max выглядел одинаково на всех картинках. Добавить к промпту «character sheet, 4 poses: pointing at a chart, facepalm, shrugging, writing in a notebook». В Midjourney затем прикладывать выбранную картинку как character/omni reference.
3. **max.svg.** Подогнать под выбранный стиль:
   - вариант A — без изменений;
   - вариант C — заменить палитру в `<style>`;
   - вариант B — заменить палитру и добавить SVG-фильтр «дрожащей» линии.
