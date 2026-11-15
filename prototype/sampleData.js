// Made-up data for trying the prototype. Never real people or real details.
// The medicine names are everyday generic names, but every maker, status and
// date here is invented: none of it is a real shortage.

// What each status means, in words.
export const statuses = {
    shortage: { label: 'Short supply', tone: 'urgent', long: 'In short supply' },
    expected: { label: 'Shortage expected', tone: 'warning', long: 'A shortage is expected' },
    available: { label: 'Available', tone: 'good', long: 'Available as normal' },
    discontinued: { label: 'No longer made', tone: 'neutral', long: 'No longer made' },
};

// "ago" is how many days before today something happened, so the dates stay fresh.
// "backIn" is how many days from today the maker expects supply to be back.
// History is newest first; the first entry is the medicine's status now.
export const medicines = [
    {
        id: 'amoxicillin-liquid',
        name: 'Amoxicillin',
        strength: '250 mg/5 mL',
        form: 'Liquid for children',
        maker: 'Northbay Pharma',
        reason: 'More people need it than usual.',
        backIn: 21,
        history: [
            { ago: 0, status: 'shortage', note: 'Now in short supply. The maker expects more in about 3 weeks.' },
            { ago: 12, status: 'expected', note: 'The maker said a shortage may be coming.' },
            { ago: 60, status: 'available', note: 'Back to normal supply.' },
        ],
    },
    {
        id: 'salbutamol-inhaler',
        name: 'Salbutamol',
        strength: '100 mcg per puff',
        form: 'Inhaler',
        maker: 'Maplewood Generics',
        reason: null,
        backIn: null,
        history: [
            { ago: 2, status: 'available', note: 'Back in stock. Pharmacies should get deliveries this week.' },
            { ago: 25, status: 'shortage', note: 'Short supply because of a delay at the factory.' },
        ],
    },
    {
        id: 'methylphenidate-er',
        name: 'Methylphenidate',
        strength: '18 mg',
        form: 'Slow-release tablet',
        maker: 'Cedar Lake Labs',
        reason: 'Not enough of one ingredient.',
        backIn: 45,
        history: [
            { ago: 5, status: 'shortage', note: 'Expected date pushed back by 2 weeks.' },
            { ago: 40, status: 'shortage', note: 'Now in short supply.' },
        ],
    },
    {
        id: 'levothyroxine',
        name: 'Levothyroxine',
        strength: '50 mcg',
        form: 'Tablet',
        maker: 'Harbourline Pharma',
        reason: null,
        backIn: null,
        history: [{ ago: 90, status: 'available', note: 'Available as normal.' }],
    },
    {
        id: 'semaglutide-pen',
        name: 'Semaglutide',
        strength: '1 mg',
        form: 'Injection pen',
        maker: 'Silverbirch Medical',
        reason: 'Far more people need it than the maker planned for.',
        backIn: 30,
        history: [
            { ago: 3, status: 'expected', note: 'The maker said a shortage may start next month.' },
            { ago: 80, status: 'available', note: 'Available as normal.' },
        ],
    },
    {
        id: 'insulin-glargine',
        name: 'Insulin glargine',
        strength: '100 units/mL',
        form: 'Injection pen',
        maker: 'Silverbirch Medical',
        reason: null,
        backIn: null,
        history: [{ ago: 120, status: 'available', note: 'Available as normal.' }],
    },
    {
        id: 'metformin',
        name: 'Metformin',
        strength: '500 mg',
        form: 'Tablet',
        maker: 'Maplewood Generics',
        reason: null,
        backIn: null,
        history: [{ ago: 150, status: 'available', note: 'Available as normal.' }],
    },
    {
        id: 'estradiol-patch',
        name: 'Estradiol',
        strength: '0.1 mg a day',
        form: 'Skin patch',
        maker: 'Cedar Lake Labs',
        reason: 'A problem on the packing line.',
        backIn: 14,
        history: [
            { ago: 9, status: 'shortage', note: 'Now in short supply. Other strengths are still available.' },
            { ago: 100, status: 'available', note: 'Available as normal.' },
        ],
    },
    {
        id: 'sertraline',
        name: 'Sertraline',
        strength: '50 mg',
        form: 'Capsule',
        maker: 'Harbourline Pharma',
        reason: null,
        backIn: null,
        history: [{ ago: 70, status: 'available', note: 'Available as normal.' }],
    },
    {
        id: 'epinephrine-autoinjector',
        name: 'Epinephrine',
        strength: '0.3 mg',
        form: 'Auto-injector',
        maker: 'Northbay Pharma',
        reason: 'Delay in shipping from the factory.',
        backIn: 10,
        history: [
            { ago: 6, status: 'expected', note: 'The maker said a shortage may be coming. Other makers have stock.' },
            { ago: 200, status: 'available', note: 'Available as normal.' },
        ],
    },
    {
        id: 'ibuprofen-children',
        name: 'Ibuprofen for children',
        strength: '100 mg/5 mL',
        form: 'Liquid',
        maker: 'Maplewood Generics',
        reason: null,
        backIn: null,
        history: [
            { ago: 4, status: 'available', note: 'Back in stock.' },
            { ago: 50, status: 'shortage', note: 'Now in short supply.' },
        ],
    },
    {
        id: 'ranitidine',
        name: 'Ranitidine',
        strength: '150 mg',
        form: 'Tablet',
        maker: 'Harbourline Pharma',
        reason: 'The maker has stopped making it.',
        backIn: null,
        history: [{ ago: 300, status: 'discontinued', note: 'No longer made. Ask your pharmacist about other options.' }],
    },
    {
        id: 'lisdexamfetamine',
        name: 'Lisdexamfetamine',
        strength: '30 mg',
        form: 'Capsule',
        maker: 'Cedar Lake Labs',
        reason: 'More people need it than usual.',
        backIn: 28,
        history: [
            { ago: 1, status: 'shortage', note: 'Now in short supply. 20 mg and 40 mg are still available.' },
            { ago: 18, status: 'expected', note: 'The maker said a shortage may be coming.' },
        ],
    },
    {
        id: 'atorvastatin',
        name: 'Atorvastatin',
        strength: '20 mg',
        form: 'Tablet',
        maker: 'Northbay Pharma',
        reason: null,
        backIn: null,
        history: [{ ago: 110, status: 'available', note: 'Available as normal.' }],
    },
];

// The medicines someone is following when they first open the prototype.
export const startingTracked = ['amoxicillin-liquid', 'salbutamol-inhaler', 'methylphenidate-er'];

// The list is checked every hour, so the last check was at the start of this hour (24-hour clock).
export const lastCheckedTime = `${String(new Date().getHours()).padStart(2, '0')}:00`;
