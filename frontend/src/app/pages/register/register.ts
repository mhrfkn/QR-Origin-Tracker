import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  farmName = '';
  farmLocation = '';
  readonly error = signal('');
  readonly busy = signal(false);

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth
      .register({
        name: this.name,
        email: this.email,
        password: this.password,
        farmName: this.farmName,
        farmLocation: this.farmLocation
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          void this.router.navigate(['/batches']);
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          if (err.status === 409) {
            this.error.set('That email is already registered. Please log in or use a different email.');
          } else if (err.status === 400) {
            const msg: string = err.error?.message ?? 'Please check your details and try again.';
            this.error.set(msg);
          } else if (err.status === 0) {
            this.error.set('Cannot reach the server. Please check your connection.');
          } else {
            this.error.set('Registration failed. Please try again later.');
          }
        }
      });
  }
}
