# A Horizon app

An open-source app made by a community on [Horizon](https://horizon-app-production-66q1kj.laravel.cloud), where people share problems and build solutions together.

See [HORIZON.md](HORIZON.md) for how it's made, the rules for changing it, and how to run it yourself.

MIT licence: anyone can use, change and share it.

## Where the medicines come from

Medicine Watch's list is a copy of Health Canada's [Tier 3 drug shortages](https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-shortages/tier-3-shortages.html) page: the shortages Health Canada rates most serious. It isn't every shortage. The app reads the page itself, so there's nothing to set up and no account: it reads it just after someone opens a page, when the last good read is more than 6 hours old. If the page can't be read, people see what it said last time; until it has been read once, the app says so rather than showing anything made up.

For each medicine it keeps the name, the date it became a Tier 3 shortage, and whether Health Canada says it's used for COVID-19. When a medicine someone tracks joins or leaves the list, the app sends the "A tracked medicine changed" email update, and a new medicine on the list sends "A medicine joined the Tier 3 list", to whoever has chosen them on the Updates page.

The list is reproduced for non-commercial use under [canada.ca's terms and conditions](https://www.canada.ca/en/transparency/terms.html): the app names the material, says it's a copy of the version on canada.ca and when it was read, and links to it. The app reads the page's table, so if Health Canada changes how the page is laid out, reading it may stop working until the app is updated.
