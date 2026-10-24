import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewInit, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BatchService } from '../../core/batch.service';
import { ScanAnalytics } from '../../core/models';

@Component({
  selector: 'app-analytics',
  imports: [RouterLink],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class Analytics implements OnInit, AfterViewInit, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly batchesApi = inject(BatchService);

  @ViewChild('timelineCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly analytics = signal<ScanAnalytics | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  batchId = '';

  private dataReady = false;
  private chartDrawn = false;

  ngOnInit() {
    this.batchId = this.route.snapshot.paramMap.get('batchId') ?? '';
    if (!this.batchId) {
      this.loading.set(false);
      this.error.set('Missing batch ID.');
      return;
    }
    this.batchesApi.getAnalytics(this.batchId).subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.loading.set(false);
        this.dataReady = true;
        // Reset so AfterViewChecked will attempt a draw once canvas is in DOM
        this.chartDrawn = false;
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load analytics for this batch.');
      }
    });
  }

  ngAfterViewInit() {
    // Canvas may not exist yet (inside @if block), handled by ngAfterViewChecked
    this.maybeDrawChart();
  }

  ngAfterViewChecked() {
    // Called after every change-detection cycle — draw once canvas is in the DOM
    this.maybeDrawChart();
  }

  private maybeDrawChart() {
    if (this.chartDrawn || !this.dataReady) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const data = this.analytics();
    if (!data || data.hourlySeries.length === 0) return;
    this.chartDrawn = true;
    // Use rAF to ensure the canvas has been laid out and has non-zero dimensions
    requestAnimationFrame(() => this.drawTimeline(data.hourlySeries));
  }

  private drawTimeline(series: { hour: string; count: number }[]) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Use offsetWidth/offsetHeight as fallback if clientWidth is 0
    const W = canvas.clientWidth || canvas.offsetWidth || 760;
    const H = canvas.clientHeight || canvas.offsetHeight || 220;

    if (W === 0 || H === 0) {
      // Canvas not yet laid out — retry on next frame
      this.chartDrawn = false;
      requestAnimationFrame(() => this.drawTimeline(series));
      return;
    }

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ── Zero-gap fill ──────────────────────────────────────────────────────────
    // The backend only returns hours that had scans. Fill in every hourly slot
    // between the first and last scan so the chart shows a proper time-series
    // with valleys at zero instead of only the active hours.
    // Normalize keys: backend may omit milliseconds ("...T17:00:00Z") while
    // toISOString() always emits them ("...T17:00:00.000Z"). Run both through
    // new Date() → toISOString() so the format is always identical.
    const toKey = (iso: string) => new Date(iso).toISOString().slice(0, 13) + ':00:00.000Z';
    const countMap = new Map(series.map(s => [toKey(s.hour), s.count]));
    const startHour = new Date(series[0].hour);
    const endHour   = new Date(series[series.length - 1].hour);
    const filled: { hour: string; count: number }[] = [];
    for (const t = new Date(startHour); t <= endHour; t.setHours(t.getHours() + 1)) {
      const key = t.toISOString().slice(0, 13) + ':00:00.000Z';
      filled.push({ hour: key, count: countMap.get(key) ?? 0 });
    }
    // Use the gap-filled series for all rendering below
    series = filled;
    // ──────────────────────────────────────────────────────────────────────────

    const padL = 48, padR = 20, padT = 16, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Shared Y-coordinate helper (used in both single- and multi-point paths)
    const getYFn = (v: number, max: number, pT: number, cH: number) =>
      pT + cH - (v / max) * cH;

    const counts = series.map(s => s.count);
    const maxVal = Math.max(...counts, 1);
    const n = series.length;

    // ── Y-axis: integer ticks that never duplicate ─────────────────────────────
    // Determine a nice step size so tick labels are always whole numbers.
    const maxTicks = 4;
    const tickStep = Math.ceil(maxVal / maxTicks); // always >= 1
    const topTick = tickStep * Math.ceil(maxVal / tickStep); // round maxVal up to nearest step
    // topTick is the axis ceiling (>= maxVal), used for scaling so the line never clips the top
    const axisMax = topTick;

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let tick = 0; tick <= axisMax; tick += tickStep) {
      const y = padT + chartH - (tick / axisMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.fillText(String(tick), padL - 6, y + 3.5);
    }

    // Override maxVal used for Y-scaling to use axisMax (so bars never clip top)
    const scaledMaxVal = axisMax;

    // ── Bar chart ─────────────────────────────────────────────────────────────
    // Each hourly slot = one bar. Active hours glow bright green with a count
    // label above; empty hours show a subtle tinted stub for visual rhythm.
    const slotW  = chartW / n;
    const barGap = Math.max(1, Math.floor(slotW * 0.2));
    const barW   = Math.max(3, Math.floor(slotW) - barGap);
    const baseY  = padT + chartH;
    const radius = Math.min(4, barW / 2);

    // Active bar: vivid top → semi-transparent bottom
    const barGrad = ctx.createLinearGradient(0, padT, 0, baseY);
    barGrad.addColorStop(0, '#34d399');
    barGrad.addColorStop(1, 'rgba(52, 211, 153, 0.25)');

    for (let i = 0; i < n; i++) {
      const count = counts[i];
      const x = padL + i * slotW + barGap / 2;
      const cx = x + barW / 2; // horizontal centre of this bar slot

      if (count === 0) {
        // Subtle tick so the time-scale reads clearly
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, baseY - 3, barW, 3);
        continue;
      }

      // Enforce a tall minimum so even 1 scan is clearly visible:
      // at least 30% of chart height, or the proportional height — whichever is greater.
      const proportional = (count / scaledMaxVal) * chartH;
      const barH = Math.max(chartH * 0.30, proportional);
      const y    = baseY - barH;

      // ── Multi-layer glow for impact ──
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur  = 18;

      // Rounded-top bar
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, baseY);
      ctx.lineTo(x, baseY);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fillStyle = barGrad;
      ctx.fill();

      // Extra glow pass — draw a wider blurred bar on top for the halo effect
      ctx.shadowBlur = 28;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

      // ── Count label above bar ──
      ctx.fillStyle   = '#34d399';
      ctx.font        = `bold ${Math.max(10, Math.min(13, barW))}px Inter, sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(count), cx, y - 4);
      ctx.textBaseline = 'alphabetic';
    }

    // ── X-axis labels ─────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    const labelIndices = n <= 6
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];

    for (const idx of labelIndices) {
      const barCx = padL + idx * slotW + barGap / 2 + barW / 2;
      const date  = new Date(series[idx].hour);
      const label = date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit' });
      ctx.fillText(label, barCx, baseY + 20);
    }
  }

  /** Returns a CSS width percentage for a bar in the country chart */
  barWidth(count: number): string {
    const data = this.analytics();
    if (!data || data.topCountries.length === 0) return '0%';
    const max = data.topCountries[0].count;
    return `${(count / max) * 100}%`;
  }

  /** Flag emoji from country name via Unicode lookup (best-effort) */
  countryFlag(countryName: string): string {
    const map: Record<string, string> = {
      'India': '🇮🇳', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
      'Germany': '🇩🇪', 'France': '🇫🇷', 'Japan': '🇯🇵', 'China': '🇨🇳',
      'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Brazil': '🇧🇷',
      'Netherlands': '🇳🇱', 'Singapore': '🇸🇬', 'UAE': '🇦🇪',
      'South Africa': '🇿🇦', 'Mexico': '🇲🇽', 'Italy': '🇮🇹',
      'Spain': '🇪🇸', 'South Korea': '🇰🇷', 'Indonesia': '🇮🇩',
    };
    return map[countryName] ?? '🌍';
  }

  formatScanTime(isoStr: string): string {
    return new Date(isoStr).toLocaleString('en', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
