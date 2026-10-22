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

  // ── Create form fields ──────────────────────────────────────────────────────
  cropName = 'Organic Tomatoes';
  variety = '';
  quantityKg = 50;
  harvestDate = new Date().toISOString().slice(0, 10);
  organic = true;
  originStory = '';

  // ── State ───────────────────────────────────────────────────────────────────
  readonly batches = signal<BatchSummary[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);

  // ── Edit modal state ────────────────────────────────────────────────────────
  readonly editingBatch = signal<BatchSummary | null>(null);
  editCropName = '';
  editVariety = '';
  editQuantityKg = 0;
  editHarvestDate = '';
  editOrganic = false;
  editOriginStory = '';
  readonly editError = signal('');
  readonly editBusy = signal(false);

  // ── Delete confirm state ────────────────────────────────────────────────────
  readonly deletingBatch = signal<BatchSummary | null>(null);
  readonly deleteBusy = signal(false);
  readonly deleteError = signal('');

  ngOnInit() {
    this.reload();
  }

  // ── Create ──────────────────────────────────────────────────────────────────
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

  // ── Edit ────────────────────────────────────────────────────────────────────
  openEdit(batch: BatchSummary) {
    this.editCropName = batch.cropName;
    this.editVariety = batch.variety ?? '';
    this.editQuantityKg = Number(batch.quantityKg);
    this.editHarvestDate = batch.harvestDate;
    this.editOrganic = batch.organic;
    this.editOriginStory = '';
    this.editError.set('');
    this.editingBatch.set(batch);
  }

  closeEdit() {
    this.editingBatch.set(null);
  }

  saveEdit() {
    const batch = this.editingBatch();
    if (!batch) return;
    this.editBusy.set(true);
    this.editError.set('');
    this.batchesApi
      .update(batch.id, {
        cropName: this.editCropName,
        variety: this.editVariety,
        quantityKg: this.editQuantityKg,
        harvestDate: this.editHarvestDate,
        organic: this.editOrganic,
        originStory: this.editOriginStory
      })
      .subscribe({
        next: () => {
          this.editBusy.set(false);
          this.editingBatch.set(null);
          this.reload();
        },
        error: () => {
          this.editBusy.set(false);
          this.editError.set('Could not save changes. Please try again.');
        }
      });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  openDelete(batch: BatchSummary) {
    this.deleteError.set('');
    this.deletingBatch.set(batch);
  }

  closeDelete() {
    this.deletingBatch.set(null);
  }

  confirmDelete() {
    const batch = this.deletingBatch();
    if (!batch) return;
    this.deleteBusy.set(true);
    this.deleteError.set('');
    this.batchesApi.delete(batch.id).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.deletingBatch.set(null);
        this.reload();
      },
      error: () => {
        this.deleteBusy.set(false);
        this.deleteError.set('Could not delete batch. Please try again.');
      }
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private reload() {
    this.batchesApi.listMine().subscribe({
      next: (rows) => this.batches.set(rows),
      error: () => this.error.set('Could not load batches.')
    });
  }
}
