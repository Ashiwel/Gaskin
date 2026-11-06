/**
 * #design: every component and chart primitive in one page, for visual QA in both themes.
 * Add ?scheme=both to see light and dark side by side; otherwise the page follows the app theme.
 * No Storybook: this is an ordinary route inside the app, so it ships with the build and works offline.
 */
import { useState, type ReactNode } from 'react';
import { getLocalTimeZone, today } from '@internationalized/date';
import { AlertTriangle, Calendar, CheckCircle, HeartHand, Home03, Mail01, Plus, SearchLg, Send01, Users01 } from '@untitledui/icons';
import { Button } from '../components/base/buttons/button';
import { ButtonUtility } from '../components/base/buttons/button-utility';
import { ButtonGroup, ButtonGroupItem } from '../components/base/button-group/button-group';
import { Input } from '../components/base/input/input';
import { TextArea } from '../components/base/textarea/textarea';
import { Select } from '../components/base/select/select';
import { Checkbox } from '../components/base/checkbox/checkbox';
import { Toggle } from '../components/base/toggle/toggle';
import { RadioButton, RadioGroup } from '../components/base/radio-buttons/radio-buttons';
import { Badge, BadgeWithDot, BadgeWithIcon } from '../components/base/badges/badges';
import { Avatar } from '../components/base/avatar/avatar';
import { AvatarLabelGroup } from '../components/base/avatar/avatar-label-group';
import { Tooltip, TooltipTrigger } from '../components/base/tooltip/tooltip';
import { Dropdown } from '../components/base/dropdown/dropdown';
import { ProgressBar } from '../components/base/progress-indicators/progress-indicators';
import { ProgressBarCircle } from '../components/base/progress-indicators/progress-circles';
import { Tabs } from '../components/application/tabs/tabs';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '../components/application/modals/modal';
import { SlideoutMenu } from '../components/application/slideout-menus/slideout-menu';
import { Table } from '../components/application/table/table';
import { EmptyState } from '../components/application/empty-state/empty-state';
import { FeaturedIcon } from '../components/foundations/featured-icon/featured-icon';
import { PaginationCardMinimal } from '../components/application/pagination/pagination';
import { DatePicker } from '../components/application/date-picker/date-picker';
import { Alert, Toast } from '../components/application/notifications/notifications';
import { AIPill, GlobalSearch, LegalFooter, PinLock, ThemeSegmented, WorkerCard } from '../components/shell';
import { AreaChart, BarChart, BPChart, CalendarStrip, DonutChart, GrowthChart, JourneyTimeline, KpiTile, ProgressRing, RiskGauge, Sparkline, StackedBar } from '../components/viz';
import { cx } from '../utils/cx';
import { WHO_WFA_GIRLS_0_24 } from './sampleData';

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={`ds-${id}`} aria-labelledby={`ds-${id}-h`} className="scroll-mt-24 border-t border-secondary pt-8">
      <h2 id={`ds-${id}-h`} className="text-lg font-semibold text-primary">
        {title}
      </h2>
      {lede ? <p className="mt-1 max-w-2xl text-sm text-tertiary">{lede}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset', className)}>
      {title ? <h3 className="mb-4 text-sm font-semibold text-primary">{title}</h3> : null}
      {children}
    </div>
  );
}

const SWATCHES: Array<[string, string]> = [
  ['bg-primary', 'bg-primary'],
  ['bg-secondary', 'bg-secondary'],
  ['bg-tertiary', 'bg-tertiary'],
  ['bg-brand-solid', 'bg-brand-solid'],
  ['bg-brand-primary', 'bg-brand-primary'],
  ['bg-error-solid', 'bg-error-solid'],
  ['bg-error-primary', 'bg-error-primary'],
  ['bg-warning-solid', 'bg-warning-solid'],
  ['bg-warning-primary', 'bg-warning-primary'],
  ['bg-success-solid', 'bg-success-solid'],
  ['bg-success-primary', 'bg-success-primary'],
];
const BRAND_STEPS = ['25', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const WEEKS = ['3 Aug', '10 Aug', '17 Aug', '24 Aug', '31 Aug', '7 Sep', '14 Sep', '21 Sep', '28 Sep', '5 Oct', '12 Oct', '19 Oct'];
const PNC48 = [41, 44, 43, 47, 52, 50, 55, 58, 57, 61, 64, 68];
const ANC4 = [55, 56, 58, 57, 59, 60, 62, 61, 63, 65, 66, 67];

const startIso = '2026-11-09';
const CAL = [
  { date: '2026-11-09', due: 5, urgent: 1 },
  { date: '2026-11-10', due: 3 },
  { date: '2026-11-11', due: 2 },
  { date: '2026-11-12', due: 6, urgent: 2 },
  { date: '2026-11-13', due: 1 },
  { date: '2026-11-16', due: 4 },
  { date: '2026-11-17', due: 2 },
  { date: '2026-11-18', due: 3 },
  { date: '2026-11-20', due: 1 },
  { date: '2026-11-22', due: 2 },
];

function Gallery() {
  const [tab, setTab] = useState<string | number>('plan');
  const [cal, setCal] = useState(startIso);
  const [page, setPage] = useState(2);
  return (
    <div className="grid gap-10">
      <Section id="tokens" title="Colour tokens" lede="Gaskin teal for the brand, the warm Stone grey for surfaces, and Untitled UI’s red, amber and green for clinical states. Use semantic names (bg-primary, text-secondary, bg-error-primary); never the raw scale.">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-1">
            {BRAND_STEPS.map((s) => (
              <div key={s} className="flex w-14 flex-col items-center gap-1">
                <span className="h-10 w-full rounded-md ring-1 ring-secondary_alt ring-inset" style={{ background: `var(--color-brand-${s})` }} />
                <span className="text-xs text-tertiary tnum">{s}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map(([cls, name]) => (
              <div key={name} className="flex items-center gap-2">
                <span className={cx('size-8 shrink-0 rounded-md ring-1 ring-secondary_alt ring-inset', cls)} />
                <span className="truncate text-xs text-secondary">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-primary">text-primary</span>
            <span className="text-secondary">text-secondary</span>
            <span className="text-tertiary">text-tertiary</span>
            <span className="text-quaternary">text-quaternary</span>
            <span className="text-brand-secondary">text-brand-secondary</span>
            <span className="text-error-primary">text-error-primary</span>
            <span className="text-warning-primary">text-warning-primary</span>
            <span className="text-success-primary">text-success-primary</span>
          </div>
        </div>
      </Section>

      <Section id="type" title="Typography" lede="Inter for everything, embedded so it works offline. Yoruba ẹ ọ ṣ, Igbo ị ọ ụ ṅ, Hausa ɓ ɗ ƙ ƴ, Twi ɛ ɔ, Ewe ɖ ƒ ŋ ɣ ʋ ʒ all render in Inter; Arabic uses the system face.">
        <div className="grid gap-3">
          <p className="text-display-md font-semibold text-primary">Three mothers need you today</p>
          <p className="text-display-xs font-semibold text-primary">Adaeze Okafor, 36 weeks</p>
          <p className="text-lg font-semibold text-primary">Next contact: ANC 7 on Thursday</p>
          <p className="text-md text-secondary">Body text at 16px. One idea per sentence, plain words, numbers as digits.</p>
          <p className="text-sm text-tertiary">Supporting text at 14px, for detail under a heading.</p>
          <p className="text-md text-secondary">
            Ẹ kú àbọ̀ · Ị̀bọ̀ọ̀ ụ̀mụ̀ · Ɓarka da zuwa, ƙananan ƴaƴa · Ɛte sɛn · Ŋkeke ɖeka ƒe ɣeyiɣi ʋ ʒ ·{' '}
            <span lang="ar" dir="rtl">
              مرحبا بالأم
            </span>
          </p>
        </div>
      </Section>

      <Section id="buttons" title="Buttons" lede="One primary action per view. Destructive is the error colour, never brand.">
        <div className="flex flex-wrap items-center gap-3">
          <Button color="primary" iconLeading={Plus}>
            Register a mother
          </Button>
          <Button color="secondary">Message</Button>
          <Button color="tertiary">Cancel</Button>
          <Button color="link-color">See her plan</Button>
          <Button color="primary-destructive" iconLeading={AlertTriangle}>
            Refer now
          </Button>
          <Button color="secondary" isLoading showTextWhileLoading>
            Saving
          </Button>
          <Button color="secondary" isDisabled>
            Disabled
          </Button>
          <ButtonUtility icon={Send01} tooltip="Send" color="secondary" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonGroup defaultSelectedKeys={['week']} aria-label="Range">
            <ButtonGroupItem id="day">Today</ButtonGroupItem>
            <ButtonGroupItem id="week">7 days</ButtonGroupItem>
            <ButtonGroupItem id="month">30 days</ButtonGroupItem>
          </ButtonGroup>
          <ThemeSegmented />
        </div>
      </Section>

      <Section id="forms" title="Form controls" lede="Every input, text area and select has an explicit background from tokens, so none stays light in dark mode.">
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Her name" placeholder="e.g. Adaeze Okafor" hint="As she says it." icon={Users01} />
          <Input label="Phone" placeholder="0803 000 0000" isInvalid hint="Check the number: it has 10 digits." />
          <Select label="Language" placeholder="Choose" items={[{ id: 'yo', label: 'Yorùbá' }, { id: 'ig', label: 'Igbo' }, { id: 'ha', label: 'Hausa' }]} defaultSelectedKey="ig">
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
          <Select.ComboBox label="Facility (search)" placeholder="Search facilities" items={[{ id: 'f1', label: 'Surulere PHC' }, { id: 'f2', label: 'LASUTH Ikeja' }, { id: 'f3', label: 'Island Maternity' }]}>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select.ComboBox>
          <TextArea label="Note" placeholder="What did you see today?" rows={3} />
          <div className="grid gap-4">
            <DatePicker defaultValue={today(getLocalTimeZone())} aria-label="Visit date" />
            <Checkbox label="She agreed to receive messages" hint="Ask again if her phone changes." defaultSelected />
            <Toggle label="Use AI for messages" hint="Danger signs never depend on AI." defaultSelected />
            <RadioGroup aria-label="Feeding" defaultValue="ebf">
              <RadioButton value="ebf" label="Breast milk only" />
              <RadioButton value="mixed" label="Breast milk and formula" />
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Section id="badges" title="Badges, avatars and tooltips">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="gray">Pregnant</Badge>
          <Badge color="brand">After birth</Badge>
          <BadgeWithDot color="error" type="pill-color">
            Danger sign
          </BadgeWithDot>
          <BadgeWithDot color="warning" type="pill-color">
            Overdue 2 days
          </BadgeWithDot>
          <BadgeWithIcon color="success" type="pill-color" iconLeading={CheckCircle}>
            Reviewed
          </BadgeWithIcon>
          <Badge color="blue" type="color">
            Draft translation
          </Badge>
          <Badge color="pink" type="pill-color">
            Twins
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Avatar size="md" initials="AO" />
          <Avatar size="lg" initials="BA" status="online" />
          <AvatarLabelGroup size="md" initials="FA" title="Funke Adeyemi" subtitle="Day 30 after birth" />
          <Tooltip title="Evidence grade A" description="WHO 2016, strong recommendation">
            <TooltipTrigger className="rounded-md text-sm font-medium text-brand-secondary underline underline-offset-2">Why this?</TooltipTrigger>
          </Tooltip>
          <Dropdown.Root>
            <Button color="secondary" size="sm">
              Actions
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item icon={Mail01} label="Message her" />
                <Dropdown.Item icon={Calendar} label="Move visit" />
                <Dropdown.Separator />
                <Dropdown.Item icon={AlertTriangle} label="Refer" />
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
      </Section>

      <Section id="nav" title="Tabs, progress and pagination">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <Tabs.List
            type="underline"
            items={[
              { id: 'plan', label: 'Plan' },
              { id: 'timeline', label: 'Timeline', badge: 3 },
              { id: 'baby', label: 'Baby' },
              { id: 'messages', label: 'Messages' },
            ]}
          >
            {(t) => <Tabs.Item {...t} />}
          </Tabs.List>
        </Tabs>
        <div className="mt-4">
          <Tabs selectedKey={tab} onSelectionChange={setTab}>
            <Tabs.List
              type="button-border"
              items={[
                { id: 'plan', label: 'Plan' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'baby', label: 'Baby' },
              ]}
            >
              {(t) => <Tabs.Item {...t} />}
            </Tabs.List>
          </Tabs>
        </div>
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <ProgressBar value={68} labelPosition="right" />
          <ProgressBarCircle value={68} size="xxs" />
        </div>
        <div className="mt-6">
          <PaginationCardMinimal page={page} total={8} onPageChange={setPage} />
        </div>
      </Section>

      <Section id="feedback" title="Alerts, toasts and featured icons" lede="Danger alerts use the error scale and carry an icon and words, so colour is never the only cue.">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="error" title="Severe pre-eclampsia signs" actions={<Button color="primary-destructive" size="sm">Refer now</Button>}>
            Blood pressure 168/112 with headache. Give the first dose of magnesium sulfate and refer to LASUTH today.
          </Alert>
          <Alert tone="warning" title="ANC 6 is 2 days overdue">
            Call her or visit before Friday.
          </Alert>
          <Alert tone="success" title="Message delivered">
            Her reply will appear in Messages.
          </Alert>
          <Alert tone="brand" title="A new library release is ready" onDismiss={() => {}}>
            Three rules changed after expert review.
          </Alert>
          <Toast title="Visit saved" body="The plan now has 2 new items." tone="success" />
          <Toast title="Could not send" body="No network. It will go when you reconnect." tone="error" />
        </div>
        <div className="mt-5 flex flex-wrap gap-4">
          <FeaturedIcon icon={HeartHand} color="brand" theme="light" size="lg" />
          <FeaturedIcon icon={AlertTriangle} color="error" theme="light" size="lg" />
          <FeaturedIcon icon={AlertTriangle} color="warning" theme="outline" size="lg" />
          <FeaturedIcon icon={CheckCircle} color="success" theme="modern" size="lg" />
          <FeaturedIcon icon={Home03} color="gray" theme="modern" size="lg" />
        </div>
      </Section>

      <Section id="overlays" title="Modal and slide-out sheet">
        <div className="flex flex-wrap gap-3">
          <DialogTrigger>
            <Button color="secondary">Open modal</Button>
            <ModalOverlay isDismissable>
              <Modal>
                <Dialog>
                  {({ close }) => (
                    <div className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl">
                      <FeaturedIcon icon={AlertTriangle} color="error" theme="light" size="lg" />
                      <h2 className="mt-4 text-lg font-semibold text-primary">Remove this item from her plan?</h2>
                      <p className="mt-1 text-sm text-tertiary">Say why. Your reason helps the clinical board improve the rules.</p>
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <Button color="secondary" onClick={close}>
                          Keep it
                        </Button>
                        <Button color="primary-destructive" onClick={close}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
          <SlideoutMenu.Trigger>
            <Button color="secondary">Open sheet</Button>
            <SlideoutMenu isDismissable>
              {({ close }) => (
                <>
                  <SlideoutMenu.Header onClose={close}>
                    <h2 className="text-lg font-semibold text-primary">Record a visit</h2>
                    <p className="text-sm text-tertiary">ANC 7, 36 weeks</p>
                  </SlideoutMenu.Header>
                  <SlideoutMenu.Content>
                    <Input label="Blood pressure" placeholder="120/80" />
                    <TextArea label="Note" rows={4} />
                  </SlideoutMenu.Content>
                  <SlideoutMenu.Footer className="flex justify-end gap-3">
                    <Button color="secondary" onClick={close}>
                      Cancel
                    </Button>
                    <Button onClick={close}>Save visit</Button>
                  </SlideoutMenu.Footer>
                </>
              )}
            </SlideoutMenu>
          </SlideoutMenu.Trigger>
        </div>
      </Section>

      <Section id="table" title="Table and empty state">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
            <Table aria-label="Mothers due" size="sm">
              <Table.Header>
                <Table.Head id="name" label="Mother" isRowHeader />
                <Table.Head id="stage" label="Stage" />
                <Table.Head id="next" label="Next contact" />
              </Table.Header>
              <Table.Body>
                <Table.Row id="1">
                  <Table.Cell>
                    <AvatarLabelGroup size="sm" initials="UE" title="Ufuoma Edewor" subtitle="Sapele, Delta" />
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="brand" size="sm">
                      Day 30
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>In 12 days</Table.Cell>
                </Table.Row>
                <Table.Row id="2">
                  <Table.Cell>
                    <AvatarLabelGroup size="sm" initials="GW" title="Gift Wokoma" subtitle="Port Harcourt" />
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="gray" size="sm">
                      36 weeks
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <BadgeWithDot color="error" size="sm" type="pill-color">
                      2 days overdue
                    </BadgeWithDot>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </div>
          <Card>
            <EmptyState size="sm">
              <EmptyState.Header pattern="circle">
                <EmptyState.FeaturedIcon icon={SearchLg} color="gray" />
              </EmptyState.Header>
              <EmptyState.Content>
                <EmptyState.Title>No mothers match</EmptyState.Title>
                <EmptyState.Description>Try another name or community.</EmptyState.Description>
              </EmptyState.Content>
              <EmptyState.Footer>
                <Button color="secondary" size="sm">
                  Clear search
                </Button>
              </EmptyState.Footer>
            </EmptyState>
          </Card>
        </div>
      </Section>

      <Section id="viz" title="Charts" lede="Plain SVG, coloured only by tokens. Each has a role=img label that states the numbers. Visual summary first, detail after.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Postnatal check within 48 hours" value="68%" delta={6} deltaUnit=" pts" period="vs last month" trend={PNC48} />
          <KpiTile label="Four or more ANC contacts" value="67%" delta={2} deltaUnit=" pts" period="vs last month" trend={ANC4} />
          <KpiTile label="Missed contacts" value="14" delta={3} period="vs last week" higherIsBetter={false} trend={[8, 9, 7, 10, 11, 9, 12, 11, 14]} />
          <KpiTile label="Facility births" value="51%" delta={0} period="no change" trend={[49, 50, 52, 51, 50, 51, 51]} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Postnatal checks within 48 hours, by week" className="lg:col-span-2">
            <AreaChart labels={WEEKS} series={[{ name: 'Within 48 hours', values: PNC48 }, { name: 'Four or more ANC', values: ANC4 }]} label="Share of mothers, by week" unit="%" max={100} />
          </Card>
          <Card title="Caseload by stage">
            <DonutChart
              label="Caseload by stage"
              centerLabel="mothers"
              data={[
                { label: 'Pregnant', value: 38 },
                { label: 'After birth', value: 21 },
                { label: 'Baby under 2', value: 54 },
                { label: 'Before pregnancy', value: 6 },
              ]}
            />
          </Card>
          <Card title="Contacts by week">
            <BarChart label="Contacts by week" data={WEEKS.slice(-8).map((w, i) => ({ label: w.split(' ')[0], value: [12, 15, 11, 18, 16, 21, 19, 24][i] }))} />
          </Card>
          <Card title="Referrals by reason">
            <BarChart
              orientation="horizontal"
              label="Referrals by reason"
              data={[
                { label: 'Raised blood pressure', value: 9, tone: 'danger' },
                { label: 'Anaemia', value: 7 },
                { label: 'Club foot', value: 3 },
                { label: 'Poor weight gain', value: 2 },
              ]}
            />
          </Card>
          <Card title="Targets">
            <div className="flex flex-wrap items-center gap-5">
              <ProgressRing value={68} label="PNC within 48 hours" />
              <ProgressRing value={91} label="Consent recorded" tone="success" />
              <ProgressRing value={34} label="Danger signs answered within 1 hour" tone="danger" />
            </div>
            <div className="mt-5 grid gap-4">
              <StackedBar
                label="Alerts by level"
                parts={[
                  { label: 'Emergency', value: 2, tone: 'danger' },
                  { label: 'Urgent', value: 5, tone: 'warning' },
                  { label: 'Routine', value: 31, tone: 'neutral' },
                ]}
              />
              <StackedBar
                size="tall"
                label="Babies by feeding"
                parts={[
                  { label: 'Breast milk only', value: 46 },
                  { label: 'Mixed', value: 14 },
                  { label: 'Formula', value: 5 },
                ]}
              />
            </div>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Care journey, conception to day 1,000" className="lg:col-span-2">
            <JourneyTimeline
              label="Adaeze Okafor's care journey"
              today={240}
              contacts={[
                { day: 70, label: 'ANC 1', state: 'done' },
                { day: 126, label: 'ANC 2', state: 'done' },
                { day: 168, label: 'ANC 3', state: 'done' },
                { day: 196, label: 'ANC 4', state: 'missed' },
                { day: 224, label: 'ANC 5', state: 'overdue' },
                { day: 238, label: 'ANC 6', state: 'due' },
                { day: 252, label: 'ANC 7', state: 'upcoming' },
                { day: 267, label: 'PNC 24 h', state: 'upcoming' },
                { day: 315, label: 'Child 6 weeks', state: 'upcoming' },
                { day: 446, label: '6 months', state: 'upcoming' },
                { day: 631, label: '12 months', state: 'upcoming' },
                { day: 996, label: '24 months', state: 'upcoming' },
              ]}
            />
            <div className="mt-5">
              <JourneyTimeline compact label="Compact journey" today={520} contacts={[{ day: 267, label: 'PNC', state: 'done' }, { day: 446, label: '6 months', state: 'done' }, { day: 540, label: '9 months', state: 'due' }]} />
            </div>
          </Card>
          <Card title="Risk">
            <div className="flex flex-wrap justify-around gap-4">
              <RiskGauge value={88} level="danger" label="Pre-eclampsia" size={140} />
              <RiskGauge value={30} level="low" label="Bleeding" size={140} />
            </div>
          </Card>
          <Card title="Next 14 days" className="lg:col-span-3">
            <CalendarStrip start={startIso} days={CAL} selected={cal} onSelect={setCal} />
          </Card>
          <Card title="Weight-for-age, girls (WHO)" className="lg:col-span-2">
            <GrowthChart
              label="Weight-for-age, girls"
              reference={WHO_WFA_GIRLS_0_24}
              points={[
                { month: 0, value: 3.1 },
                { month: 1, value: 4.0 },
                { month: 2, value: 4.9 },
                { month: 4, value: 5.9 },
                { month: 6, value: 6.2 },
                { month: 9, value: 6.6 },
                { month: 12, value: 6.9 },
              ]}
            />
          </Card>
          <Card title="Blood pressure">
            <BPChart
              readings={[
                { label: '20 w', systolic: 118, diastolic: 76 },
                { label: '26 w', systolic: 124, diastolic: 80 },
                { label: '30 w', systolic: 138, diastolic: 88 },
                { label: '34 w', systolic: 146, diastolic: 94 },
                { label: '36 w', systolic: 168, diastolic: 112 },
              ]}
            />
          </Card>
          <Card title="Sparklines">
            <div className="grid gap-3">
              {(['brand', 'success', 'warning', 'danger'] as const).map((t, i) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-tertiary">{t}</span>
                  <Sparkline tone={t} label={`${t} trend`} values={[3, 4, 3, 5, 6, 5, 7, 8, 7 + i, 9 - i]} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section id="shell" title="Shell pieces" lede="The worker card opens the worker menu (switch worker, lock, log out). The PIN screen locks a shared device. Personal mode shows the legal footer with the emergency number.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Worker card">
            <WorkerCard
              worker={{ id: 'w1', name: 'Bisola Adebayo', role: 'Midwife', subtitle: 'Surulere PHC' }}
              sync={{ line: 'Saved on this phone', state: 'local', storageUsed: 0.18, storageLabel: '18% of storage used' }}
              actions={{ others: [{ id: 'w2', name: 'Ngozi Eze' }], onSwitch: () => {}, onLock: () => {}, onLogOut: () => {}, onAddWorker: () => {} }}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <AIPill status={{ label: 'Claude, live', state: 'live' }} />
              <AIPill status={{ label: 'Templates', state: 'templates' }} />
            </div>
            <div className="mt-4">
              <GlobalSearch search={(q) => [{ id: '1', label: `Adaeze Okafor (${q})`, detail: 'Surulere', group: 'Mother', onSelect: () => {} }]} shortcut={false} />
            </div>
          </Card>
          <div className="lg:col-span-2">
            <PinLock inline worker={{ id: 'w1', name: 'Bisola Adebayo' }} onSubmit={(p) => (p === '1234' ? true : 'That PIN is not right. 2 tries left.')} onSwitchWorker={() => {}} forgotHint="Forgot your PIN? Ask your supervisor to reset it." />
          </div>
          <Card className="lg:col-span-3">
            <LegalFooter info={{ disclaimer: 'Gaskin helps you plan. It does not replace a health worker.', emergencyNumber: '112', emergencyLabel: 'Emergency', onMore: () => {} }} />
          </Card>
        </div>
      </Section>
    </div>
  );
}

export function DesignShowcase() {
  let both = false;
  try {
    both = /[?&]scheme=both\b/.test(window.location.search);
  } catch {
    both = false;
  }
  return (
    <div className="mx-auto max-w-[1280px]" data-testid="design-showcase">
      <header className="mb-8">
        <p className="text-sm font-semibold text-brand-secondary">Design system</p>
        <h1 className="mt-1 text-display-sm font-semibold text-primary">Gaskin components</h1>
        <p className="mt-2 max-w-2xl text-md text-tertiary">Untitled UI React components on Gaskin’s tokens, with the chart primitives and shell pieces. Switch the theme in the top bar to check dark mode.</p>
      </header>
      {both ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl bg-primary p-6 ring-1 ring-secondary">
            <Gallery />
          </div>
          <div className="dark-mode rounded-2xl bg-primary p-6 text-primary ring-1 ring-secondary">
            <Gallery />
          </div>
        </div>
      ) : (
        <Gallery />
      )}
    </div>
  );
}
