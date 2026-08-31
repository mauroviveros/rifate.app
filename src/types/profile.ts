export type Role = 'USER' | 'ADMIN';

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  contactPhone: string | null;
  role: Role;
  createdAt: number;
  updatedAt: number;
};
