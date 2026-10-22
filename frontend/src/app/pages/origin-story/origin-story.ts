import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BatchService } from '../../core/batch.service';
import { PublicOrigin } from '../../core/models';
import { MapComponent } from '../../core/map.component';
import { FreshnessIndicatorComponent } from '../../core/freshness-indicator.component';

@Component({
  selector: 'app-origin-story',
  imports: [DatePipe, MapComponent, FreshnessIndicatorComponent],
  templateUrl: './origin-story.html',
  styleUrl: './origin-story.css'
})
export class OriginStory implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly batchesApi = inject(BatchService);

  readonly origin = signal<PublicOrigin | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);

  ngOnInit() {
    const batchId = this.route.snapshot.paramMap.get('batchId');
    if (!batchId) {
      this.loading.set(false);
      this.error.set('Missing batch id.');
      return;
    }
    this.batchesApi.publicOrigin(batchId).subscribe({
      next: (data) => {
        this.origin.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('This harvest batch was not found. The QR may be old or mistyped.');
      }
    });
  }

  encodeSubject(text: string): string {
    return encodeURIComponent(text);
  }

  encodeBody(batch: PublicOrigin): string {
    const body = [
      `Hi ${batch.producerName},`,
      ``,
      `I scanned the QR code on your ${batch.cropName}${batch.variety ? ` (${batch.variety})` : ''} from ${batch.farmName} and I have a question.`,
      ``,
      `[Please write your question here]`,
      ``,
      `—`,
      `Batch ID: ${batch.batchId}`,
      `Harvest date: ${batch.harvestDate}`,
    ].join('\n');
    return encodeURIComponent(body);
  }
}
