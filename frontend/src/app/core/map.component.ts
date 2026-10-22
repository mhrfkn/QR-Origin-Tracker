import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';

// Fix the default marker icon path that breaks when bundled with Angular
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

type GeocodeResult = { lat: string; lon: string; display_name: string } | null;

@Component({
  selector: 'app-map',
  standalone: true,
  template: `
    <div class="map-wrapper">
      @if (geocoding) {
        <div class="map-loading">
          <span class="map-spinner"></span>
          <span>Locating farm…</span>
        </div>
      } @else if (failed) {
        <div class="map-failed">
          <span>📍</span> Could not locate <em>{{ location }}</em> on the map.
        </div>
      } @else {
        <div #mapEl class="map-el" aria-label="Farm location map"></div>
      }
    </div>
  `,
  styles: [`
    .map-wrapper {
      border-radius: 1rem;
      overflow: hidden;
      border: 1px solid #e4dccb;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }

    .map-el {
      height: 240px;
      width: 100%;
    }

    .map-loading,
    .map-failed {
      height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      font-size: 0.9rem;
      color: #5c6456;
      background: #f8fafc;
    }

    .map-failed {
      font-style: italic;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 1.5rem;
      color: #8c9486;
    }

    .map-failed em {
      font-size: 0.85rem;
      font-style: normal;
    }

    .map-spinner {
      display: inline-block;
      width: 22px;
      height: 22px;
      border: 2px solid #e4dccb;
      border-top-color: #3d6b45;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) location!: string;
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  geocoding = true;
  failed = false;

  private map?: L.Map;
  private coords?: [number, number];

  ngAfterViewInit() {
    if (this.coords) {
      this.initMap(this.coords);
    }
  }

  ngOnChanges() {
    this.resetMap();
    this.geocoding = true;
    this.failed = false;
    this.geocode(this.location);
  }

  ngOnDestroy() {
    this.resetMap();
  }

  private async geocode(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    try {
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data: GeocodeResult[] = await res.json();
      const first = data?.[0];
      if (!first) throw new Error('no results');
      const { lat, lon } = first;
      this.coords = [parseFloat(lat), parseFloat(lon)];
      this.geocoding = false;
      // Wait one tick for @if to render the map div
      setTimeout(() => {
        if (this.mapEl) this.initMap(this.coords!);
      }, 0);
    } catch {
      this.geocoding = false;
      this.failed = true;
    }
  }

  private initMap(coords: [number, number]) {
    if (!this.mapEl) return;
    this.map = L.map(this.mapEl.nativeElement, {
      center: coords,
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    L.marker(coords)
      .addTo(this.map)
      .bindPopup(`<strong>📍 ${this.location}</strong>`, { closeButton: false })
      .openPopup();
  }

  private resetMap() {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
}
