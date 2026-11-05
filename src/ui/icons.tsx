/**
 * UI icons from lucide-react (ISC licence), under the names the screens already use.
 * Calm defaults: 1.75 stroke, currentColor, hidden from screen readers unless labelled.
 * The product's own pictograms (src/illustrations) stay hand-drawn.
 */
import type { SVGProps } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Baby,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CirclePlay,
  ClipboardList,
  ClipboardPlus,
  Clock,
  CloudOff,
  Copy,
  Download,
  Droplet,
  Ellipsis,
  Eye,
  FlaskConical,
  HeartPulse,
  Info,
  Languages,
  Lock,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Printer,
  Scale,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Syringe,
  Thermometer,
  TriangleAlert,
  Trash2,
  Upload,
  UsersRound,
  Wind,
  X,
  Zap,
  Hospital,
  type LucideIcon,
} from 'lucide-react';

type P = SVGProps<SVGSVGElement>;

function wrap(Icon: LucideIcon) {
  const C = ({ strokeWidth, ...p }: P) => <Icon aria-hidden={p['aria-label'] ? undefined : true} strokeWidth={Number(strokeWidth ?? 1.75)} absoluteStrokeWidth={false} {...(p as object)} />;
  C.displayName = Icon.displayName;
  return C;
}

export const IToday = wrap(ClipboardList);
export const IPeople = wrap(UsersRound);
export const IReview = wrap(Scale);
export const IChart = wrap(BarChart3);
export const IBook = wrap(BookOpen);
export const IInfo = wrap(Info);
export const ISettings = wrap(Settings2);
export const IPhone = wrap(Smartphone);
export const ISearch = wrap(Search);
export const IBack = wrap(ArrowLeft);
export const IChevron = wrap(ChevronRight);
export const IClose = wrap(X);
export const ILock = wrap(Lock);
export const IAlert = wrap(TriangleAlert);
export const IPlus = wrap(Plus);
export const IEdit = wrap(Pencil);
export const ITrash = wrap(Trash2);
export const ISend = wrap(Send);
export const IPrint = wrap(Printer);
export const IDownload = wrap(Download);
export const IUpload = wrap(Upload);
export const ISpark = wrap(Sparkles);
export const IShield = wrap(ShieldCheck);
export const ICheck = wrap(Check);
export const ICheckCircle = wrap(CheckCircle2);
export const IWarnCircle = wrap(CircleAlert);
export const IClipboard = wrap(ClipboardList);
export const ICopy = wrap(Copy);
export const IMessage = wrap(MessageCircle);
export const IStethoscope = wrap(Stethoscope);
export const IDrop = wrap(Droplet);
export const IFlask = wrap(FlaskConical);
export const IHeart = wrap(HeartPulse);
export const IBaby = wrap(Baby);
export const IReferral = wrap(Hospital);
export const ISyringe = wrap(Syringe);
export const IThermo = wrap(Thermometer);
export const IHead = wrap(Brain);
export const IEye = wrap(Eye);
export const IMoon = wrap(Moon);
export const IWind = wrap(Wind);
export const IBolt = wrap(Zap);
export const IDot = wrap(Activity);
export const IClock = wrap(Clock);
export const ICloudOff = wrap(CloudOff);
export const IMore = wrap(Ellipsis);
export const IDemo = wrap(CirclePlay);
export const ITranslate = wrap(Languages);
export const IRecord = wrap(ClipboardPlus);
