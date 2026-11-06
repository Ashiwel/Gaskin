/** Gaskin chart primitives: plain SVG, token-coloured, accessible, reduced-motion aware. */
export { Sparkline, type SparklineProps } from './Sparkline';
export { AreaChart, Legend, type AreaChartProps, type AreaSeries } from './AreaChart';
export { BarChart, type BarChartProps, type Bar } from './BarChart';
export { DonutChart, ProgressRing, type DonutChartProps, type DonutSlice, type ProgressRingProps } from './DonutChart';
export { StackedBar, type StackedBarProps, type StackPart } from './StackedBar';
export { JourneyTimeline, JOURNEY_END, type JourneyTimelineProps, type JourneyContact, type ContactState } from './JourneyTimeline';
export { RiskGauge, type RiskGaugeProps, type RiskLevel } from './RiskGauge';
export { KpiTile, type KpiTileProps } from './KpiTile';
export { CalendarStrip, type CalendarStripProps, type CalendarDay } from './CalendarStrip';
export { GrowthChart, type GrowthChartProps, type GrowthReferenceRow, type GrowthPoint } from './GrowthChart';
export { BPChart, bpZone, type BPChartProps, type BPReading } from './BPChart';
export { SERIES, TONE, type Tone } from './shared';
