/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    actor: import('@/lib/auth/actor').Actor;
    user: { name: string; email: string; image: string | null } | null;
  }
}
