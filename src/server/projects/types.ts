export type PublicClient = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  internalNotes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicProjectMember = {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
};

export type PublicProject = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  brief: string;
  ownerUserId: string;
  ownerName: string;
  archivedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: PublicProjectMember[];
};
