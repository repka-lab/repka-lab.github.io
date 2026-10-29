# Дедушка — промпты для генерации

Дедушка — главный персонаж канала. Канонический дедушка для видео — [grandpa.svg](grandpa.svg): ролики Remotion анимируют именно его в сценах [board.svg](../scenes/board.svg), [desk.svg](../scenes/desk.svg) и [monitor.svg](../scenes/monitor.svg). Сгенерированные картинки нужны для аватара, баннера и обложек. Выбранный стиль затем переносится в SVG через палитру и толщину линий.

Во всех вариантах соблюдаются три правила:

- **Дедушка явно не человек.** Это стикмен: голова-круг, тело и конечности одной линией. На шнурке висит бейдж «AI».
- **Никакого фотореализма.** Нет кожи, морщин, реалистичного лица и 3D-рендера.
- **На доске и экране нет данных.** Нет тикеров, чисел, знаков валют и слов вроде «profit», чтобы картинка не выглядела как сигнал или обещание дохода. Логотипов и брендов тоже нет.

Приметы, одинаковые во всех вариантах: лысая макушка с вихрами по бокам, круглые очки, густые брови (правая приподнята), пышные усы, лёгкая ухмылка, бейдж «AI», мелок в руке. Наушников нет.

Имя в промптах не указано, пока оно не выбрано. Промпты написаны на английском: модели понимают его лучше.

---

## Вариант A — «Ink line» (совпадает с grandpa.svg)

Чёрная линия на белом фоне, минимализм в духе xkcd. Лучше всего читается на маленьком аватаре и совпадает с видео один в один.

**DALL-E / ChatGPT images**

```
A minimalist stick figure character drawn in thick, clean black ink lines on a plain white background, in the style of a simple webcomic. The character is an elderly professor: a perfectly round head that is bald on top with a few short tufts of hair sticking out on both sides, round glasses, thick bushy eyebrows with the right one raised, a big bushy mustache and a slight lopsided smirk under it. The body and limbs are single straight lines. He wears a lanyard with a small badge that reads "AI". He stands next to a dark green chalkboard and holds a piece of white chalk against it, drawing a simple rising zigzag line that splits into one arrow pointing up and one arrow pointing down, with a question mark between them. Flat 2D line art, no shading, no gradients, lots of white space. Do not include any numbers, ticker symbols, currency signs, logos, or any text other than "AI" on the badge. Not photorealistic, no realistic human features, no skin, no wrinkles, no 3D.
```

**Midjourney**

```
minimalist webcomic stick figure, thick clean black ink lines on plain white background, elderly professor, round bald head with small hair tufts on the sides, round glasses, bushy eyebrows one raised, big bushy mustache, slight smirk, single-line body and limbs, lanyard badge reading "AI", holding white chalk against a dark green chalkboard, drawing a zigzag line that splits into an up arrow and a down arrow with a question mark, flat 2D line art, no shading, generous white space --ar 1:1 --style raw --stylize 50 --no photo, photorealistic, 3d render, realistic face, skin, wrinkles, logo, brand, numbers, currency symbols, ticker, gradient
```

---

## Вариант B — «Chalkboard»

Сам дедушка нарисован мелом на тёмно-зелёной доске, как будто он часть собственной лекции. Выделяется в тёмной теме X и продолжает сцену с доской.

**DALL-E / ChatGPT images**

```
A stick figure character drawn entirely in off-white chalk on a dark green school chalkboard, with soft chalk texture and faint smudges of erased chalk in the background. The character is an elderly professor: a round head that is bald on top with short tufts of hair on both sides, round glasses, thick bushy eyebrows with the right one raised, a big bushy mustache and a slight smirk. The body and limbs are single chalk lines. He wears a lanyard with a small badge that reads "AI". He is drawing on the board next to himself: a simple zigzag line that splits into an up arrow and a down arrow, and four short blank horizontal lines stacked in a list, each with a small arrow next to it. Only off-white chalk, plus one pale yellow chalk accent on the arrows. Flat 2D, no shading beyond the chalk texture. No numbers, no ticker symbols, no currency signs, no logos, no text other than "AI" on the badge. Not photorealistic, no realistic human features, no wrinkles, no 3D.
```

**Midjourney**

```
off-white chalk drawing on dark green school chalkboard, soft chalk texture, faint erased smudges, stick figure elderly professor, round bald head with small side hair tufts, round glasses, bushy eyebrows one raised, big bushy mustache, slight smirk, single-line body and limbs, lanyard badge reading "AI", drawing a zigzag line splitting into an up arrow and a down arrow, a short list of four blank lines with small arrows, one pale yellow chalk accent, flat 2D --ar 1:1 --style raw --stylize 75 --no photo, photorealistic, 3d render, realistic face, skin, wrinkles, logo, brand, numbers, currency symbols, ticker, neon
```

---

## Вариант C — «Notebook doodle»

Синяя шариковая ручка на листе в клетку, неровная «живая» линия. Похоже на поля конспекта старого профессора. Этот стиль самый тёплый и «ручной».

**DALL-E / ChatGPT images**

```
A hand-drawn doodle of a stick figure character sketched with a blue ballpoint pen on grid notebook paper, slightly wobbly imperfect lines, like a doodle in the margin of an old professor's lecture notes. The character is an elderly professor: a round head that is bald on top with a few tufts of hair on both sides, round glasses, thick bushy eyebrows with the right one raised, a big bushy mustache and a small smirk. The body and limbs are single lines. He wears a lanyard with a little badge that says "AI". He sits on an office chair at a desk and points at a computer monitor that shows a scribbled zigzag line with no labels and four short horizontal bars. A mug of tea with a curl of steam stands on the desk. Only blue ink on the paper, with one light yellow highlighter stroke across the monitor. No numbers, no ticker symbols, no currency signs, no logos, no text other than "AI" on the badge. Not photorealistic, no realistic human features, no wrinkles, no 3D.
```

**Midjourney**

```
blue ballpoint pen doodle on grid notebook paper, wobbly hand-drawn stick figure, elderly professor, round bald head with side hair tufts, round glasses, bushy eyebrows one raised, big bushy mustache, small smirk, single-line body and limbs, lanyard badge reading "AI", sitting on an office chair pointing at a computer monitor with a scribbled unlabeled zigzag line and four short bars, mug of tea with steam, one yellow highlighter stroke, lecture notes margin doodle --ar 1:1 --style raw --stylize 100 --no photo, photorealistic, 3d render, realistic face, skin, wrinkles, logo, brand, numbers, currency symbols, ticker
```

---

## После выбора

1. **Аватар.** Взять промпт выбранного варианта и заменить сцену на «head and shoulders portrait, centered, wide margin around the head». X обрезает аватар в круг, и в ленте он около 48 px. Поэтому голова должна занимать центр, а усы и очки должны читаться даже на таком размере.
2. **Character sheet**, чтобы дедушка выглядел одинаково на всех картинках. Добавить к промпту «character sheet, 5 poses: writing on a chalkboard with chalk, sitting at a computer, pointing at a monitor, shrugging, adjusting his glasses». В Midjourney затем прикладывать выбранную картинку как character/omni reference.
3. **grandpa.svg.** Подогнать под выбранный стиль:
   - вариант A — без изменений;
   - вариант B — заменить палитру в `<style>` на меловую (линии `#f4f1e8` на `#2f4a3a`);
   - вариант C — заменить палитру и добавить SVG-фильтр «дрожащей» линии.
