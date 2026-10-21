import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BatchSummary, PublicOrigin } from './models';
import { apiBase } from './api-base';

@Injectable({ providedIn: 'root' })
export class BatchService {
  constructor(private readonly http: HttpClient) {}

  listMine() {
    return this.http.get<BatchSummary[]>(`${apiBase()}/api/batches`);
  }

  create(payload: {
    cropName: string;
    variety: string;
    quantityKg: number;
    harvestDate: string;
    organic: boolean;
    originStory: string;
  }) {
    return this.http.post<BatchSummary>(`${apiBase()}/api/batches`, payload);
  }

  qrPng(batchId: string) {
    return this.http.get(`${apiBase()}/api/batches/${batchId}/qr`, { responseType: 'blob' });
  }

  publicOrigin(batchId: string) {
    return this.http.get<PublicOrigin>(`${apiBase()}/api/public/batches/${batchId}`);
  }
}
