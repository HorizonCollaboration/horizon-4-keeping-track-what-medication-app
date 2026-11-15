# Modern

Calm, slick and modern, like Notion and Linear: black, white and grey, white space, thin-line icons and a quiet picture for everything. Colour only ever means something.

**Build every screen from Horizon's kit**, described in KIT.md. Import it from `"@/kit"`, and icons from `"lucide-react"`. Never import from `@/kit/ui` or the library under it, and never write your own buttons, cards, tags, fields or navigation. The linter rejects both, and Tailwind colour names.

- Every screen goes inside your app's own `AppShell` component (in `src/components/`, wrapping the kit's), with one tab per job, each its own page. Each screen starts with `ScreenHeader` (a picture, the title, one sentence).
- On a computer the tabs are in a sidebar. Give `AppShell` `nav="top"` when the brief or prototype asks for navigation along the top instead. There are no other layouts: never build your own.
- Lists are a `List` of `Row`s, each with a `Tile` as its picture, and `href` when the row opens a page. Cards for forms and a few related things side by side.
- Give each kind of thing its own Lucide icon, the same wherever it appears. Tiles are quiet whatever their tone: colour is for `Tag` tones (urgent, warning, good) and `Notice`, never decoration.
- One `primary` button per screen, for the main action; others outline, ghost or secondary.
- Show what a form's server action said with `FormMessage`, what a button did with `Notice`, and a helpful `EmptyState` wherever there could be nothing.
- Don't style colours, borders, shadows or corners: the kit does. Tailwind only for layout and spacing (`flex`, `grid`, `gap-4`, `md:grid-cols-3`) and text size or weight.
