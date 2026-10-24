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

    const padL = 48, padR = 20, padT = 16, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Shared Y-coordinate helper (used in both single- and multi-point paths)
    const getYFn = (v: number, max: number, pT: number, cH: number) =>
      pT + cH - (v / max) * cH;

    const counts = series.map(s => s.count);
    const maxVal = Math.max(...counts, 1);
    const n = series.length;

    // ── Y-axis: smart tick count so labels are never duplicated ───────────────
    // If maxVal is small (e.g. 2), fewer grid lines prevent duplicated integers.
    const maxGridLines = Math.min(4, maxVal);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const seenLabels = new Set<number>();
    for (let i = 0; i <= maxGridLines; i++) {
      const y = padT + chartH - (i / maxGridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      const labelVal = Math.round((i / maxGridLines) * maxVal);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      // Only draw each integer label once
      if (!seenLabels.has(labelVal)) {
        seenLabels.add(labelVal);
        ctx.fillText(String(labelVal), padL - 6, y + 3.5);
      }
    }

    // ── Single-point special case ──────────────────────────────────────────────
    // When there's only one data point the line has no direction, so we render
    // a centered dot + full-width dashed horizontal reference line instead.
    if (n === 1) {
      const cx = padL + chartW / 2;
      const cy = getYFn(counts[0], maxVal, padT, chartH);

      // Gradient fill under the horizontal line
      const grad1 = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad1.addColorStop(0, 'rgba(52, 211, 153, 0.3)');
      grad1.addColorStop(1, 'rgba(52, 211, 153, 0.01)');
      ctx.fillStyle = grad1;
      ctx.fillRect(padL, cy, chartW, padT + chartH - cy);

      // Dashed horizontal line at the data value
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + chartW, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot with glow
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // White inner dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      // X-axis label centred
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      const date = new Date(series[0].hour);
      const label = date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit' });
      ctx.fillText(label, cx, padT + chartH + 20);
      return;
    }

    // ── Multi-point path ───────────────────────────────────────────────────────
    const stepX = chartW / (n - 1);
    const getX = (i: number) => padL + i * stepX;
    const getY = (v: number) => getYFn(v, maxVal, padT, chartH);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.55)');
    grad.addColorStop(1, 'rgba(52, 211, 153, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(counts[0]));
    for (let i = 1; i < n; i++) {
      const cpx = (getX(i - 1) + getX(i)) / 2;
      ctx.bezierCurveTo(cpx, getY(counts[i - 1]), cpx, getY(counts[i]), getX(i), getY(counts[i]));
    }
    ctx.lineTo(getX(n - 1), padT + chartH);
    ctx.lineTo(getX(0), padT + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(counts[0]));
    for (let i = 1; i < n; i++) {
      const cpx = (getX(i - 1) + getX(i)) / 2;
      ctx.bezierCurveTo(cpx, getY(counts[i - 1]), cpx, getY(counts[i]), getX(i), getY(counts[i]));
    }
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Data point dots with glow on hover-worthy points
    for (let i = 0; i < n; i++) {
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(getX(i), getY(counts[i]), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // White inner dot for contrast
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(getX(i), getY(counts[i]), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // X-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelIndices = n <= 6
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1];

    for (const idx of labelIndices) {
      const date = new Date(series[idx].hour);
      const label = date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit' });
      ctx.fillText(label, getX(idx), padT + chartH + 20);
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
