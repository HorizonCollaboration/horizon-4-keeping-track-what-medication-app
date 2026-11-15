# Medicine Watch

The brief this app is built from, approved on Horizon.

## What it's for
In Canada, data on which medicines are in short supply is published openly by the government, but hardly anyone knows it exists or can make sense of it, so people end up ringing round pharmacies instead. Medicine Watch lets anyone search that data in plain language, pick the medicines they care about, and get told by email only when something changes for those medicines.

## Who uses it
Anyone can look at the list of medicines and their current availability without signing in. To keep a personal list of medicines, see your own updates, or get email alerts, you need to sign in with an emailed link (just an email address, no password). This suits patients, carers, and health workers like doctors, nurses and pharmacists, who all use the same simple screens.

## Screens
- Sign in: enter your email and get a link to sign in. No password, no other details asked for.
- My medicines: the medicines you track and their status right now (such as 'Short supply', 'Shortage expected', 'Available', or 'No longer made'). Shows when the list was last checked, a quick summary (how many tracked, how many short, how many changed this week), and a button to 'Add a medicine'. If you track nothing yet, an empty state invites you to find a medicine.
- Find a medicine: search all medicines by name, and filter by status. Each result shows its status and a 'Track' or 'Tracking' button. An empty state appears if a search finds nothing.
- Medicine detail: full details of one medicine (strength, form, maker, current status, expected return date if known, and its history of changes), with a button to track or stop tracking it.
- Updates: every change to the medicines you track, newest first, grouped by day. Days with no change still show 'No update available' so you know the system is working. Only shown once signed in.
- Email alerts: choose whether to be emailed only when something changes, or also get a weekly 'no update' note, using the email address you signed in with. A button to turn alerts off.

## What it keeps
- The medicine list itself (name, strength, form, maker, current status, reason, expected return date, and history of changes) is shared reference data that everyone signed in can see; nobody owns it personally.
- Each person's list of tracked medicines and their email alert preference (on/off, how often) are private to them.
- The only personal detail stored is an email address, used solely for signing in and sending alerts. No health records, prescriptions, or other personal or medical details are ever asked for or stored.

## Sample data
Starts with around a dozen made-up medicines (such as Amoxicillin liquid, Salbutamol inhaler, and Methylphenidate tablets) with invented makers, statuses and change histories, so there's a realistic mix of short supply, expected shortages, available, and no-longer-made medicines to try searching and tracking straight away.

## Not yet
- No live connection to the real government data feed yet; it uses the sample data for now.
- No separate views or extra tools for pharmacists, doctors or nurses beyond the same simple screens everyone uses.
- No real emails are sent yet; alert preferences are saved, ready for that to be switched on later.
- No sharing of tracked lists between people, teams, or organisations.

## Resources
https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-shortages.html

https://www.canadadrugshortage.com/
