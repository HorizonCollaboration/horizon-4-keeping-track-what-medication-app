import { useEffect, useState } from 'react';
import { Bell, CircleCheck, Mail, Pill, Plus, RefreshCw, Search } from 'lucide-react';
import { AppShell, Button, Card, EmptyState, Field, List, Notice, Row, ScreenHeader, Section, Select, Stat, Tag, Tile } from './kit/index.js';
import { lastCheckedTime, medicines, startingTracked, statuses } from './sampleData.js';
import { useStoredState } from './storage.js';

// Days with a change in this many days count as "this week".
const WEEK = 7;

const statusOrder = { shortage: 0, expected: 1, discontinued: 2, available: 3 };

function dateFromToday(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function whenText(ago) {
    if (ago === 0) {
        return 'Today';
    }
    if (ago === 1) {
        return 'Yesterday';
    }
    if (ago < WEEK) {
        return `${ago} days ago`;
    }

    return dateFromToday(-ago);
}

const statusOf = (medicine) => medicine.history[0].status;
const changedAgo = (medicine) => medicine.history[0].ago;
const fullName = (medicine) => `${medicine.name} ${medicine.strength}`;
const byUrgency = (a, b) => statusOrder[statusOf(a)] - statusOrder[statusOf(b)] || a.name.localeCompare(b.name);

function StatusTag({ status }) {
    const info = statuses[status];

    return <Tag tone={info.tone}>{info.label}</Tag>;
}

// Every change to the given medicines, newest first.
function changesFor(list) {
    return list
        .flatMap((medicine) => medicine.history.map((change, index) => ({ ...change, medicine, key: `${medicine.id}-${index}` })))
        .sort((a, b) => a.ago - b.ago);
}

function MedicinesScreen({ tracked, onOpen, onFind, onUpdates }) {
    const shortCount = tracked.filter((medicine) => statusOf(medicine) === 'shortage').length;
    const weekChanges = changesFor(tracked).filter((change) => change.ago < WEEK);
    const changedToday = weekChanges.filter((change) => change.ago === 0);

    return (
        <>
            <ScreenHeader
                icon={Pill}
                title="My medicines"
                description="The medicines you track, and whether you can get them right now."
                action={
                    <Button variant="primary" onClick={onFind}>
                        <Plus aria-hidden="true" />
                        Add a medicine
                    </Button>
                }
            />

            {tracked.length === 0 ? (
                <EmptyState
                    icon={Pill}
                    title="You're not tracking any medicines yet"
                    description="Find the medicines you take or give out, and we'll tell you when they get harder or easier to find."
                    action={<Button onClick={onFind}>Find a medicine</Button>}
                />
            ) : (
                <>
                    <Card
                        title={`Checked today at ${lastCheckedTime}`}
                        description={
                            changedToday.length > 0
                                ? `${changedToday.length === 1 ? '1 medicine' : `${changedToday.length} medicines`} you track changed today.`
                                : 'No update today. Nothing has changed for your medicines.'
                        }
                        action={
                            <Button variant="ghost" size="sm" onClick={onUpdates}>
                                See updates
                            </Button>
                        }
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <Stat label="Tracking" value={tracked.length} icon={Pill} />
                        <Stat label="Short supply" value={shortCount} icon={Bell} />
                        <Stat label="Changed this week" value={weekChanges.length} icon={RefreshCw} />
                    </div>

                    <List>
                        {[...tracked].sort(byUrgency).map((medicine) => (
                            <Row
                                key={medicine.id}
                                media={<Tile icon={Pill} />}
                                title={fullName(medicine)}
                                description={`${medicine.form} · changed ${whenText(changedAgo(medicine)).toLowerCase()}`}
                                onClick={() => onOpen(medicine.id)}
                            >
                                <StatusTag status={statusOf(medicine)} />
                                {changedAgo(medicine) < 3 && <Tag tone="info">New change</Tag>}
                            </Row>
                        ))}
                    </List>
                </>
            )}
        </>
    );
}

function FindScreen({ trackedIds, onToggle, onOpen, onDone }) {
    const [query, setQuery] = useState('');
    const [show, setShow] = useState('all');

    const words = query.trim().toLowerCase();
    const results = medicines
        .filter((medicine) => show === 'all' || statusOf(medicine) === show)
        .filter((medicine) => !words || `${medicine.name} ${medicine.strength} ${medicine.form} ${medicine.maker}`.toLowerCase().includes(words))
        .sort(byUrgency);

    return (
        <>
            <ScreenHeader
                icon={Search}
                title="Find a medicine"
                description="Search the government's public list of medicine shortages, and track the ones you care about."
                action={
                    <Button variant="primary" onClick={onDone}>
                        <Pill aria-hidden="true" />
                        See my medicines ({trackedIds.length})
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                    <Field label="Medicine name" type="search" value={query} onChange={setQuery} placeholder="For example, amoxicillin" />
                </div>
                <Select
                    label="Show"
                    value={show}
                    onChange={setShow}
                    options={[
                        { value: 'all', label: 'All medicines' },
                        { value: 'shortage', label: 'Short supply' },
                        { value: 'expected', label: 'Shortage expected' },
                        { value: 'available', label: 'Available' },
                        { value: 'discontinued', label: 'No longer made' },
                    ]}
                />
            </div>

            <p className="text-sm" aria-live="polite">
                {results.length === 1 ? '1 medicine' : `${results.length} medicines`}
            </p>

            {results.length === 0 ? (
                <EmptyState
                    icon={Search}
                    title="No medicines found"
                    description={words ? `Nothing matches "${query.trim()}". Check the spelling, or try the name on your prescription label.` : 'No medicines have this status right now. Try showing all medicines.'}
                    action={
                        <Button
                            onClick={() => {
                                setQuery('');
                                setShow('all');
                            }}
                        >
                            Show all medicines
                        </Button>
                    }
                />
            ) : (
                <List>
                    {results.map((medicine) => {
                        const isTracked = trackedIds.includes(medicine.id);

                        return (
                            <Row
                                key={medicine.id}
                                media={<Tile icon={Pill} />}
                                title={fullName(medicine)}
                                description={`${medicine.form} · ${medicine.maker}`}
                                onClick={() => onOpen(medicine.id)}
                                actions={
                                    <Button
                                        size="sm"
                                        variant={isTracked ? 'secondary' : 'outline'}
                                        aria-label={isTracked ? `Tracking ${fullName(medicine)}. Select to stop tracking` : `Track ${fullName(medicine)}`}
                                        onClick={() => onToggle(medicine.id)}
                                    >
                                        {isTracked ? <CircleCheck aria-hidden="true" /> : <Plus aria-hidden="true" />}
                                        {isTracked ? 'Tracking' : 'Track'}
                                    </Button>
                                }
                            >
                                <StatusTag status={statusOf(medicine)} />
                            </Row>
                        );
                    })}
                </List>
            )}
        </>
    );
}

function ChangeRow({ change, onOpen }) {
    return (
        <Row
            media={<Tile icon={RefreshCw} />}
            title={fullName(change.medicine)}
            description={change.note}
            onClick={() => onOpen(change.medicine.id)}
        >
            <StatusTag status={change.status} />
            <Tag>{whenText(change.ago)}</Tag>
        </Row>
    );
}

function UpdatesScreen({ tracked, onOpen, onFind, onAlerts }) {
    const changes = changesFor(tracked);
    const days = Array.from({ length: WEEK }, (_, ago) => ago);
    const earlier = changes.filter((change) => change.ago >= WEEK && change.ago <= 60);
    const count = tracked.length === 1 ? 'your medicine' : `your ${tracked.length} medicines`;

    return (
        <>
            <ScreenHeader
                icon={Bell}
                title="Updates"
                description="Every change to the medicines you track. On days with no change we still say so, so you know it's working."
                action={
                    tracked.length > 0 && (
                        <Button variant="primary" onClick={onAlerts}>
                            <Mail aria-hidden="true" />
                            Get these by email
                        </Button>
                    )
                }
            />

            {tracked.length === 0 ? (
                <EmptyState icon={Bell} title="No updates yet" description="Track a medicine and its changes will show here." action={<Button onClick={onFind}>Find a medicine</Button>} />
            ) : (
                <>
                    <Card title={`Last checked today at ${lastCheckedTime}`} description="We check the government's list every hour, and only tell you when one of your medicines changes." />

                    <Section title="This week">
                        <List>
                            {days.map((ago) => {
                                const dayChanges = changes.filter((change) => change.ago === ago);

                                return dayChanges.length > 0 ? (
                                    dayChanges.map((change) => <ChangeRow key={change.key} change={change} onOpen={onOpen} />)
                                ) : (
                                    <Row
                                        key={`quiet-${ago}`}
                                        compact
                                        media={<Tile icon={CircleCheck} size="sm" />}
                                        title="No update available"
                                        description={`${whenText(ago)} · Checked ${count}. Nothing changed.`}
                                    />
                                );
                            })}
                        </List>
                    </Section>

                    {earlier.length > 0 && (
                        <Section title="Earlier">
                            <List>
                                {earlier.map((change) => (
                                    <ChangeRow key={change.key} change={change} onOpen={onOpen} />
                                ))}
                            </List>
                        </Section>
                    )}
                </>
            )}
        </>
    );
}

function AlertsScreen({ tracked, alerts, onSave, onStop, onFind }) {
    const [email, setEmail] = useState(alerts.email);
    const [often, setOften] = useState(alerts.often);
    const [error, setError] = useState('');

    const latest = changesFor(tracked)[0];

    const save = () => {
        const clean = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
            setError('Add an email address with an @ in it, like name@example.com');

            return;
        }
        setError('');
        onSave({ email: clean, often, on: true });
    };

    return (
        <>
            <ScreenHeader icon={Mail} title="Email alerts" description="No account or password needed. Leave an email address and we'll write when one of your medicines changes." />

            {alerts.on && (
                <Card
                    title="Email alerts are on"
                    description={`We'll email ${alerts.email} about ${tracked.length === 1 ? '1 medicine' : `${tracked.length} medicines`}${alerts.often === 'weekly' ? ', with a note each week if nothing has changed' : ''}.`}
                    action={
                        <Button variant="ghost" size="sm" onClick={onStop}>
                            Turn off
                        </Button>
                    }
                >
                    <Tag tone="good">On</Tag>
                </Card>
            )}

            {tracked.length === 0 && (
                <EmptyState icon={Pill} title="Track a medicine first" description="Emails only cover the medicines you choose, so pick at least one." action={<Button onClick={onFind}>Find a medicine</Button>} />
            )}

            <form
                className="flex flex-col gap-5"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <Field label="Email address" type="email" autoComplete="email" value={email} onChange={setEmail} error={error} placeholder="name@example.com" hint="We only use it to send these alerts." />
                <Select
                    label="When to email me"
                    value={often}
                    onChange={setOften}
                    className="md:w-full"
                    options={[
                        { value: 'changes', label: 'Only when something changes' },
                        { value: 'weekly', label: "When something changes, plus a weekly 'no update' note" },
                    ]}
                />
                <div>
                    <Button type="submit" variant="primary">
                        <Mail aria-hidden="true" />
                        {alerts.on ? 'Save email alerts' : 'Turn on email alerts'}
                    </Button>
                </div>
            </form>

            {latest && (
                <Card title="What an email looks like" description="This is a prototype, so no emails are really sent.">
                    <div className="flex flex-col gap-2">
                        <p className="font-medium">
                            {fullName(latest.medicine)}: {statuses[latest.status].long.toLowerCase()}
                        </p>
                        <p>{latest.note}</p>
                        <p className="text-sm">
                            You get this because you track {latest.medicine.name}. Ask your pharmacist before changing any medicine.
                        </p>
                    </div>
                </Card>
            )}
        </>
    );
}

function MedicineScreen({ medicine, isTracked, onToggle, back }) {
    const status = statusOf(medicine);

    return (
        <>
            <ScreenHeader
                back={back}
                icon={Pill}
                title={fullName(medicine)}
                description={`${medicine.form} · made by ${medicine.maker}`}
                action={
                    isTracked ? (
                        <Button onClick={() => onToggle(medicine.id)}>Stop tracking</Button>
                    ) : (
                        <Button variant="primary" onClick={() => onToggle(medicine.id)}>
                            <Plus aria-hidden="true" />
                            Track this medicine
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card title="Right now" description={`Last changed ${whenText(changedAgo(medicine)).toLowerCase()}`}>
                    <div className="flex flex-col gap-2">
                        <div>
                            <StatusTag status={status} />
                        </div>
                        {medicine.reason && <p>{medicine.reason}</p>}
                        {status === 'available' && <p>Pharmacies should be able to get it as normal.</p>}
                    </div>
                </Card>
                <Card title="Expected back" description={medicine.backIn ? "The maker's best guess, which can change." : 'Nothing expected.'}>
                    <p className="text-lg font-medium">
                        {medicine.backIn ? `Around ${dateFromToday(medicine.backIn)}` : status === 'discontinued' ? 'Not coming back' : 'Already available'}
                    </p>
                </Card>
            </div>

            <Section title="What's changed">
                <List>
                    {medicine.history.map((change, index) => (
                        <Row key={index} compact media={<Tile icon={RefreshCw} size="sm" />} title={change.note} description={whenText(change.ago)}>
                            <StatusTag status={change.status} />
                        </Row>
                    ))}
                </List>
            </Section>
        </>
    );
}

const tabLabels = { mine: 'My medicines', find: 'Find a medicine', updates: 'Updates', alerts: 'Email alerts' };

export default function App() {
    const [tab, setTab] = useStoredState('tab', 'mine');
    const [trackedIds, setTrackedIds] = useStoredState('tracked', startingTracked);
    const [alerts, setAlerts] = useStoredState('alerts', { email: '', often: 'changes', on: false });
    const [openId, setOpenId] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!message) {
            return undefined;
        }
        const timer = setTimeout(() => setMessage(''), 4000);

        return () => clearTimeout(timer);
    }, [message]);

    const tracked = medicines.filter((medicine) => trackedIds.includes(medicine.id));
    const opened = medicines.find((medicine) => medicine.id === openId);
    const shortCount = tracked.filter((medicine) => statusOf(medicine) === 'shortage').length;
    const weekCount = changesFor(tracked).filter((change) => change.ago < WEEK).length;

    const goTo = (id) => {
        setOpenId(null);
        setTab(id);
    };

    const toggleTracked = (id) => {
        const medicine = medicines.find((item) => item.id === id);
        if (trackedIds.includes(id)) {
            setTrackedIds(trackedIds.filter((trackedId) => trackedId !== id));
            setMessage(`Stopped tracking ${medicine.name}.`);
        } else {
            setTrackedIds([...trackedIds, id]);
            setMessage(`Now tracking ${medicine.name}. You'll see its changes in Updates.`);
        }
    };

    return (
        <AppShell
            name="Medicine watch"
            icon={Pill}
            current={tab}
            onChange={goTo}
            tabs={[
                { id: 'mine', label: 'My medicines', icon: Pill, count: shortCount, countTone: 'urgent' },
                { id: 'find', label: 'Find', icon: Search },
                { id: 'updates', label: 'Updates', icon: Bell, count: weekCount },
                { id: 'alerts', label: 'Emails', icon: Mail },
            ]}
        >
            {opened ? (
                <MedicineScreen medicine={opened} isTracked={trackedIds.includes(opened.id)} onToggle={toggleTracked} back={{ label: tabLabels[tab], onClick: () => setOpenId(null) }} />
            ) : (
                <>
                    {tab === 'mine' && <MedicinesScreen tracked={tracked} onOpen={setOpenId} onFind={() => goTo('find')} onUpdates={() => goTo('updates')} />}
                    {tab === 'find' && <FindScreen trackedIds={trackedIds} onToggle={toggleTracked} onOpen={setOpenId} onDone={() => goTo('mine')} />}
                    {tab === 'updates' && <UpdatesScreen tracked={tracked} onOpen={setOpenId} onFind={() => goTo('find')} onAlerts={() => goTo('alerts')} />}
                    {tab === 'alerts' && (
                        <AlertsScreen
                            key={alerts.on ? alerts.email : 'off'}
                            tracked={tracked}
                            alerts={alerts}
                            onFind={() => goTo('find')}
                            onSave={(next) => {
                                setAlerts(next);
                                setMessage(`Email alerts saved for ${next.email}.`);
                            }}
                            onStop={() => {
                                setAlerts({ ...alerts, on: false });
                                setMessage('Email alerts turned off.');
                            }}
                        />
                    )}
                </>
            )}
            <Notice message={message} onClose={() => setMessage('')} />
        </AppShell>
    );
}
