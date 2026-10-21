import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BatchService } from '../../core/batch.service';
import { PublicOrigin } from '../../core/models';

@Component({
  selector: 'app-origin-story',
  imports: [DatePipe],
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
}
