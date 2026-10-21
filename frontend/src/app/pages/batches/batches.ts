import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BatchService } from '../../core/batch.service';
import { BatchSummary } from '../../core/models';

@Component({
  selector: 'app-batches',
  imports: [FormsModule, RouterLink],
  templateUrl: './batches.html',
  styleUrl: './batches.css'
})
export class Batches implements OnInit {
  private readonly batchesApi = inject(BatchService);

  cropName = 'Organic Tomatoes';
  variety = '';
  quantityKg = 50;
  harvestDate = new Date().toISOString().slice(0, 10);
  organic = true;
  originStory = '';
  readonly batches = signal<BatchSummary[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);

  ngOnInit() {
    this.reload();
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.batchesApi
      .create({
        cropName: this.cropName,
        variety: this.variety,
        quantityKg: this.quantityKg,
        harvestDate: this.harvestDate,
        organic: this.organic,
        originStory: this.originStory
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.originStory = '';
          this.reload();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not register this batch. Check the form and try again.');
        }
      });
  }

  private reload() {
    this.batchesApi.listMine().subscribe({
      next: (rows) => this.batches.set(rows),
      error: () => this.error.set('Could not load batches.')
    });
  }
}
