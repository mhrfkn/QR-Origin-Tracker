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
    const countMap = new Map(series.map(s => [s.hour, s.count]));
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
    // Each hourly slot = one bar. Active hours glow green; empty hours show a
    // faint baseline stub so the time axis is still readable.
    const barGap = Math.max(1, Math.floor(chartW / n * 0.18)); // ~18% gap between bars
    const barW   = Math.max(2, Math.floor(chartW / n) - barGap);
    const baseY  = padT + chartH; // bottom of chart area
    const radius = Math.min(3, barW / 2); // rounded bar top

    const barGrad = ctx.createLinearGradient(0, padT, 0, baseY);
    barGrad.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
    barGrad.addColorStop(1, 'rgba(52, 211, 153, 0.35)');

    for (let i = 0; i < n; i++) {
      const count = counts[i];
      const x = padL + i * (chartW / n) + barGap / 2;

      if (count === 0) {
        // Draw a 2px faint stub so empty slots are visible
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x, baseY - 2, barW, 2);
        continue;
      }

      const barH = Math.max(4, (count / scaledMaxVal) * chartH);
      const y    = baseY - barH;

      // Glow on active bars
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur  = 8;

      // Rounded-top bar via path
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
      ctx.shadowBlur = 0;
    }

    // ── X-axis labels ─────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    // Pick ~5 evenly-spaced label positions
    const labelIndices = n <= 6
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];

    for (const idx of labelIndices) {
      const barCx = padL + idx * (chartW / n) + barGap / 2 + barW / 2;
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
