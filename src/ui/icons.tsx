/**
 * UI icons from @untitledui/icons (MIT), under the names the screens already use, so legacy
 * screens keep working while each is redesigned. Defaults: currentColor, 1.75 stroke, 24 px,
 * hidden from screen readers unless labelled.
 * The product's own pictograms (src/illustrations) stay hand-drawn.
 */
import type { FC, SVGProps } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChartSquare02,
  Beaker02,
  BookOpen01,
  Building07,
  Check,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  ClipboardPlus,
  Clock,
  CloudOff,
  Copy01,
  DotsHorizontal,
  Download01,
  Droplets01,
  Edit02,
  Eye,
  FaceSmile,
  HeartRounded,
  InfoCircle,
  Lightbulb02,
  Lock01,
  MedicalCircle,
  MedicalCross,
  MessageCircle01,
  Moon01,
  Phone01,
  PlayCircle,
  Plus,
  Printer,
  Scales02,
  SearchLg,
  Send01,
  Settings01,
  ShieldTick,
  Stars02,
  Thermometer02,
  Translate01,
  Trash01,
  Upload01,
  Users01,
  Wind01,
  XClose,
  Zap,
} from '@untitledui/icons';

type P = SVGProps<SVGSVGElement>;
type UntitledIcon = FC<P & { size?: number; color?: string }>;

function wrap(Icon: UntitledIcon, name: string) {
  // 24 px by default, as before; screens size them with CSS or width/height.
  const C = ({ strokeWidth, ...p }: P) => <Icon aria-hidden={p['aria-label'] ? undefined : true} strokeWidth={Number(strokeWidth ?? 1.75)} {...(p as object)} />;
  C.displayName = name;
  return C;
}

export const IToday = wrap(ClipboardCheck, 'IToday');
export const IPeople = wrap(Users01, 'IPeople');
export const IReview = wrap(Scales02, 'IReview');
export const IChart = wrap(BarChartSquare02, 'IChart');
export const IBook = wrap(BookOpen01, 'IBook');
export const IInfo = wrap(InfoCircle, 'IInfo');
export const ISettings = wrap(Settings01, 'ISettings');
export const IPhone = wrap(Phone01, 'IPhone');
export const ISearch = wrap(SearchLg, 'ISearch');
export const IBack = wrap(ArrowLeft, 'IBack');
export const IChevron = wrap(ChevronRight, 'IChevron');
export const IClose = wrap(XClose, 'IClose');
export const ILock = wrap(Lock01, 'ILock');
export const IAlert = wrap(AlertTriangle, 'IAlert');
export const IPlus = wrap(Plus, 'IPlus');
export const IEdit = wrap(Edit02, 'IEdit');
export const ITrash = wrap(Trash01, 'ITrash');
export const ISend = wrap(Send01, 'ISend');
export const IPrint = wrap(Printer, 'IPrint');
export const IDownload = wrap(Download01, 'IDownload');
export const IUpload = wrap(Upload01, 'IUpload');
export const ISpark = wrap(Stars02, 'ISpark');
export const IShield = wrap(ShieldTick, 'IShield');
export const ICheck = wrap(Check, 'ICheck');
export const ICheckCircle = wrap(CheckCircle, 'ICheckCircle');
export const IWarnCircle = wrap(AlertCircle, 'IWarnCircle');
export const IClipboard = wrap(ClipboardCheck, 'IClipboard');
export const ICopy = wrap(Copy01, 'ICopy');
export const IMessage = wrap(MessageCircle01, 'IMessage');
export const IStethoscope = wrap(MedicalCircle, 'IStethoscope');
export const IDrop = wrap(Droplets01, 'IDrop');
export const IFlask = wrap(Beaker02, 'IFlask');
export const IHeart = wrap(HeartRounded, 'IHeart');
export const IBaby = wrap(FaceSmile, 'IBaby');
export const IReferral = wrap(Building07, 'IReferral');
export const ISyringe = wrap(MedicalCross, 'ISyringe');
export const IThermo = wrap(Thermometer02, 'IThermo');
export const IHead = wrap(Lightbulb02, 'IHead');
export const IEye = wrap(Eye, 'IEye');
export const IMoon = wrap(Moon01, 'IMoon');
export const IWind = wrap(Wind01, 'IWind');
export const IBolt = wrap(Zap, 'IBolt');
export const IDot = wrap(Activity, 'IDot');
export const IClock = wrap(Clock, 'IClock');
export const ICloudOff = wrap(CloudOff, 'ICloudOff');
export const IMore = wrap(DotsHorizontal, 'IMore');
export const IDemo = wrap(PlayCircle, 'IDemo');
export const ITranslate = wrap(Translate01, 'ITranslate');
export const IRecord = wrap(ClipboardPlus, 'IRecord');
