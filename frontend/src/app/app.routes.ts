import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register)
  },
  {
    path: 'batches',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/batches/batches').then((m) => m.Batches)
  },
  {
    path: 'batches/:batchId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/qr-label/qr-label').then((m) => m.QrLabel)
  },
  {
    path: 'track/:batchId',
    loadComponent: () => import('./pages/origin-story/origin-story').then((m) => m.OriginStory)
  },
  { path: '**', redirectTo: '' }
];
