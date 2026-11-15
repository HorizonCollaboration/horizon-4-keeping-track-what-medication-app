# A Horizon app

An open-source app made by a community on [Horizon](https://horizon-app-production-66q1kj.laravel.cloud), where people share problems and build solutions together.

See [HORIZON.md](HORIZON.md) for how it's made, the rules for changing it, and how to run it yourself.

MIT licence: anyone can use, change and share it.

## Real shortage data

Medicine Watch starts with made-up sample medicines. To show Health Canada's real list of medicine shortages instead, from [Health Product Shortages Canada](https://www.healthproductshortages.ca), register an account there and set these environment variables (in Laravel Cloud, on the app's environment, then deploy):

| Variable | What it is |
| --- | --- |
| `OUTSIDE_SHORTAGES_EMAIL` | The account's email address. |
| `OUTSIDE_SHORTAGES_PASSWORD` | The account's password. |
| `OUTSIDE_SHORTAGES_API_URL` | Optional. The list's API, if it isn't `https://www.healthproductshortages.ca/api/v1`. Must start with `https://`. |

The app checks the list just after someone opens a page, when its last good check is more than 6 hours old, so nobody waits for it. A fresh install shows the sample medicines until the first good check replaces them. If the list can't be reached, people see what it said last time. When a medicine someone tracks changes, the app sends the "A tracked medicine changed" email update to whoever has chosen it on the Updates page.
