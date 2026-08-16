export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  countryCode?: string;
  position: string;
  accountName: string;
  createdAt: string;
  isConvertedLead?: boolean;
}

export interface Account {
  id: string;
  name: string;
  industry: string;
  website: string;
  contact: string;
  email: string;
  createdAt: string;
}

export const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@techcorp.com",
    phone: "+1 555-0123",
    position: "Sales Director",
    accountName: "TechCorp Solutions",
    createdAt: "Sep 29, 2025",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "m.chen@globaldyn.com",
    phone: "+1 555-0124",
    position: "VP Operations",
    accountName: "Global Dynamics Inc",
    createdAt: "Sep 27, 2025",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "e.rodriguez@innovate.io",
    phone: "+1 555-0125",
    position: "Product Manager",
    accountName: "Innovate Labs",
    createdAt: "Sep 27, 2025",
  },
  {
    id: "4",
    name: "David Patel",
    email: "d.patel@primeconsult.com",
    phone: "+1 555-0126",
    position: "CEO",
    accountName: "Prime Consulting",
    createdAt: "Sep 26, 2025",
  },
  {
    id: "5",
    name: "Jessica Williams",
    email: "j.williams@nextgen.com",
    phone: "+1 555-0127",
    position: "CFO",
    accountName: "NextGen Ventures",
    createdAt: "Sep 26, 2025",
  },
  {
    id: "6",
    name: "Robert Martinez",
    email: "r.martinez@summit.com",
    phone: "+1 555-0128",
    position: "CTO",
    accountName: "Summit Systems",
    createdAt: "Sep 26, 2025",
  },
];

export const mockAccounts: Account[] = [
  {
    id: "1",
    name: "TechCorp Solutions",
    industry: "Technology",
    website: "techcorp.com",
    contact: "Sarah Johnson",
    email: "sarah.j@techcorp.com",
    createdAt: "Sep 29, 2025",
  },
  {
    id: "2",
    name: "Global Dynamics Inc",
    industry: "Manufacturing",
    website: "globaldynamics.com",
    contact: "Michael Chen",
    email: "m.chen@global.com",
    createdAt: "Sep 27, 2025",
  },
  {
    id: "3",
    name: "Innovate Labs",
    industry: "Software",
    website: "innovatelabs.io",
    contact: "Emily Rodriguez",
    email: "e.rodriguez@innovate.io",
    createdAt: "Sep 27, 2025",
  },
  {
    id: "4",
    name: "Prime Consulting",
    industry: "Consulting",
    website: "primeconsult.com",
    contact: "David Patel",
    email: "d.patel@primeconsult.com",
    createdAt: "Sep 26, 2025",
  },
  {
    id: "5",
    name: "NextGen Ventures",
    industry: "Finance",
    website: "nextgenvc.com",
    contact: "Jessica Williams",
    email: "j.williams@nextgen.com",
    createdAt: "Sep 26, 2025",
  },
  {
    id: "6",
    name: "Summit Systems",
    industry: "Healthcare",
    website: "summitsys.com",
    contact: "Robert Martinez",
    email: "r.martinez@summit.com",
    createdAt: "Sep 26, 2025",
  },
];
