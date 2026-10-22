import { Component, Input, OnChanges, computed, signal } from '@angular/core';

// ─── Crop shelf-life knowledge base (days post-harvest) ─────────────────────
// Each entry: [keywords[], typical shelf life in days]
const SHELF_LIFE_DB: [string[], number][] = [
  [['strawberr', 'raspberry', 'blackberr', 'blueberr', 'gooseberr'], 5],
  [['cherry', 'cherries'], 7],
  [['spinach', 'lettuce', 'arugula', 'rocket', 'kale', 'chard', 'watercress', 'microgreen'], 8],
  [['mushroom'], 7],
  [['asparagus', 'broccoli', 'cauliflower'], 10],
  [['herb', 'coriander', 'cilantro', 'parsley', 'mint', 'basil', 'dill', 'chive'], 10],
  [['corn', 'maize', 'sweetcorn'], 3],
  [['peach', 'plum', 'nectarine', 'apricot'], 10],
  [['tomato', 'cucumber', 'zucchini', 'courgette', 'aubergine', 'eggplant'], 14],
  [['mango', 'papaya', 'guava'], 10],
  [['bean', 'pea', 'okra', 'ladyfinger'], 7],
  [['grape', 'grapes'], 14],
  [['capsicum', 'pepper', 'chilli', 'chili'], 14],
  [['apple', 'pear'], 30],
  [['carrot', 'parsnip', 'turnip', 'beetroot', 'beet', 'radish'], 45],
  [['potato', 'sweet potato', 'yam'], 60],
  [['orange', 'lemon', 'lime', 'grapefruit', 'citrus', 'mandarin', 'tangerine'], 28],
  [['banana'], 10],
  [['pineapple', 'watermelon', 'melon', 'cantaloupe'], 14],
  [['cabbage'], 30],
  [['onion', 'shallot', 'leek'], 60],
  [['garlic'], 90],
  [['rice', 'wheat', 'barley', 'oat', 'rye', 'millet', 'sorghum', 'quinoa'], 365],
  [['lentil', 'chickpea', 'soybean', 'soy'], 365],
  [['groundnut', 'peanut', 'cashew', 'almond', 'walnut'], 180],
  [['cotton', 'sugarcane', 'jute', 'flax'], 180],
  [['coffee', 'cocoa', 'cacao', 'tea'], 180],
  [['ginger', 'turmeric'], 90],
];

const DEFAULT_SHELF_LIFE = 14; // days — fallback for unknown crops

export interface FreshnessInfo {
  daysSince: number;
  shelfLife: number;
  freshnessPct: number;   // 0–100, where 100 = just harvested
  status: 'peak' | 'fresh' | 'aging' | 'past';
  label: string;
  color: string;
  emoji: string;
  note: string;           // human-readable tip
}

function resolveShelfLife(cropName: string): number {
  const lower = cropName.toLowerCase();
  for (const [keywords, days] of SHELF_LIFE_DB) {
    if (keywords.some(k => lower.includes(k))) return days;
  }
  return DEFAULT_SHELF_LIFE;
}

function computeFreshness(cropName: string, harvestDate: string): FreshnessInfo {
  const harvest = new Date(harvestDate);
  const now = new Date();
  const daysSince = Math.max(0, Math.floor((now.getTime() - harvest.getTime()) / 86_400_000));
  const shelfLife = resolveShelfLife(cropName);
  const freshnessPct = Math.max(0, Math.round(((shelfLife - daysSince) / shelfLife) * 100));

  let status: FreshnessInfo['status'];
  let label: string;
  let color: string;
  let emoji: string;
  let note: string;

  if (freshnessPct >= 80) {
    status = 'peak'; label = 'Peak Fresh'; color = '#2d8f4e'; emoji = '🌿';
    note = `Harvested ${daysSince === 0 ? 'today' : `${daysSince}d ago`} — ideal eating window.`;
  } else if (freshnessPct >= 50) {
    status = 'fresh'; label = 'Fresh'; color = '#5aaa6e'; emoji = '✅';
    note = `${shelfLife - daysSince} days left in typical window for ${cropName}.`;
  } else if (freshnessPct >= 15) {
    status = 'aging'; label = 'Aging'; color = '#d4883a'; emoji = '⏳';
    note = `Approaching end of typical ${shelfLife}-day window — consume soon.`;
  } else {
    status = 'past'; label = 'Past Best'; color = '#c0392b'; emoji = '⚠️';
    note = `Beyond typical ${shelfLife}-day shelf life for ${cropName}.`;
  }

  return { daysSince, shelfLife, freshnessPct, status, label, color, emoji, note };
}

@Component({
  selector: 'app-freshness-indicator',
  standalone: true,
  template: `
    @if (info(); as f) {
      <div class="fi-card">

        <!-- Header -->
        <div class="fi-header">
          <span class="fi-leaf">{{ f.emoji }}</span>
          <h2>Freshness</h2>
          <span class="fi-badge" [style.background]="f.color + '22'" [style.color]="f.color"
                [style.border-color]="f.color + '55'">
            {{ f.label }}
          </span>
        </div>

        <!-- Arc gauge -->
        <div class="fi-gauge-wrap" aria-label="Freshness {{ f.freshnessPct }}%">
          <svg class="fi-gauge-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">
            <!-- Track arc -->
            <path class="fi-track" d="M 10 65 A 50 50 0 0 1 110 65" />
            <!-- Filled arc (clipped by freshness %) -->
            <path class="fi-fill"
              [attr.d]="arcPath(f.freshnessPct)"
              [attr.stroke]="f.color" />
            <!-- Centre label -->
            <text x="60" y="62" class="fi-pct-text" [attr.fill]="f.color">{{ f.freshnessPct }}%</text>
          </svg>
          <div class="fi-axis">
            <span>Harvest</span>
            <span>Best by</span>
          </div>
        </div>

        <!-- Stats row -->
        <div class="fi-stats">
          <div class="fi-stat">
            <span class="fi-stat-val">{{ f.daysSince }}</span>
            <span class="fi-stat-lbl">days since harvest</span>
          </div>
          <div class="fi-divider"></div>
          <div class="fi-stat">
            <span class="fi-stat-val">{{ f.shelfLife }}</span>
            <span class="fi-stat-lbl">typical shelf life</span>
          </div>
        </div>

        <!-- Note -->
        <p class="fi-note">{{ f.note }}</p>

      </div>
    }
  `,
  styles: [`
    .fi-card {
      background: #fff;
      border: 1px solid #e4dccb;
      border-radius: 1.25rem;
      padding: 1.1rem 1.25rem 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .fi-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .fi-leaf { font-size: 1.2rem; }

    .fi-header h2 {
      font-family: var(--serif);
      font-size: 1rem;
      font-weight: 600;
      color: #1f241c;
      margin: 0;
      flex: 1;
    }

    .fi-badge {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      border: 1px solid;
    }

    /* ── Arc gauge ── */
    .fi-gauge-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .fi-gauge-svg {
      width: 100%;
      max-width: 180px;
      height: auto;
      overflow: visible;
    }

    .fi-track {
      fill: none;
      stroke: #f0ebe0;
      stroke-width: 10;
      stroke-linecap: round;
    }

    .fi-fill {
      fill: none;
      stroke-width: 10;
      stroke-linecap: round;
      transition: d 0.6s ease, stroke 0.4s;
    }

    .fi-pct-text {
      font-family: var(--sans);
      font-size: 16px;
      font-weight: 700;
      text-anchor: middle;
      transition: fill 0.4s;
    }

    .fi-axis {
      display: flex;
      justify-content: space-between;
      width: 100%;
      max-width: 180px;
      font-size: 0.65rem;
      color: #8c9486;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: -4px;
    }

    /* ── Stats ── */
    .fi-stats {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: #f8fafc;
      border-radius: 0.75rem;
      padding: 0.65rem 0.5rem;
    }

    .fi-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
    }

    .fi-stat-val {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1f241c;
      line-height: 1;
    }

    .fi-stat-lbl {
      font-size: 0.66rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8c9486;
    }

    .fi-divider {
      width: 1px;
      height: 2rem;
      background: #e4dccb;
    }

    /* ── Note ── */
    .fi-note {
      font-size: 0.82rem;
      color: #5c6456;
      margin: 0;
      line-height: 1.5;
      text-align: center;
    }
  `]
})
export class FreshnessIndicatorComponent implements OnChanges {
  @Input({ required: true }) cropName!: string;
  @Input({ required: true }) harvestDate!: string;

  readonly info = signal<FreshnessInfo | null>(null);

  ngOnChanges() {
    if (this.cropName && this.harvestDate) {
      this.info.set(computeFreshness(this.cropName, this.harvestDate));
    }
  }

  /**
   * Converts a freshness percentage (0–100) into an SVG arc path
   * over the semicircle from (10,65) to (110,65), radius 50.
   */
  arcPath(pct: number): string {
    if (pct <= 0) return 'M 10 65 A 50 50 0 0 1 10.001 65';
    const angle = (pct / 100) * Math.PI; // 0 → π
    const x = 60 - 50 * Math.cos(angle);
    const y = 65 - 50 * Math.sin(angle);
    const largeArc = angle > Math.PI / 2 ? 1 : 0;
    return `M 10 65 A 50 50 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
}
