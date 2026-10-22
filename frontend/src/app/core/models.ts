export interface AuthResponse {
  token: string;
  name: string;
  email: string;
  farmName: string;
}

export interface BatchSummary {
  id: string;
  cropName: string;
  variety: string | null;
  quantityKg: number;
  harvestDate: string;
  organic: boolean;
  trackingUrl: string;
}

export interface PublicOrigin {
  batchId: string;
  cropName: string;
  variety: string | null;
  quantityKg: number;
  harvestDate: string;
  organic: boolean;
  originStory: string;
  farmName: string;
  farmLocation: string;
  producerName: string;
  grownIn: string;
}
