import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BatchService } from '../../core/batch.service';
import { BatchSummary } from '../../core/models';

@Component({
  selector: 'app-qr-label',
  imports: [RouterLink],
  templateUrl: './qr-label.html',
  styleUrl: './qr-label.css'
})
export class QrLabel implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly batchesApi = inject(BatchService);

  readonly batchId = this.route.snapshot.paramMap.get('batchId') ?? '';
  readonly qrUrl = signal<string | null>(null);
  readonly batch = signal<BatchSummary | null>(null);
  readonly error = signal('');

  ngOnInit() {
    // Load QR image
    this.batchesApi.qrPng(this.batchId).subscribe({
      next: (blob) => this.qrUrl.set(URL.createObjectURL(blob)),
      error: () => this.error.set('Could not load this QR code. You may not own the batch.')
    });

    // Load batch list to get the trackingUrl that is baked into the QR
    this.batchesApi.listMine().subscribe({
      next: (batches) => {
        const found = batches.find(b => b.id === this.batchId);
        if (found) this.batch.set(found);
      }
    });
  }

  ngOnDestroy() {
    const url = this.qrUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
