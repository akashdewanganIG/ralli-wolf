"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarItem,
  SidebarCollapsibleItem,
  SidebarProvider,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui";
import Image from "next/image";
import ralliWolfLogo from "../app/assets/images/logos/ralli-wolf-logo.png";
import {
  ChartNoAxesCombined,
  Users,
  Settings,
  Bell,
  Megaphone,
  FileText,
  Bot,
  ListChecks,
  UserCheck,
  Share2,
  Building2,
  BookUser,
  Mail,
  MessageCircle,
  UserLock,
  TrendingUp,
  BarChart,
  Package,
  ReceiptText,
  LayoutTemplate,
  Layers,
  ShoppingCart,
  BookAIcon,
  BookCheckIcon,
  ClipboardCheck,
  Boxes,
  Warehouse,
  Truck,
  GitBranch,
  Factory,
  ArrowLeftRight,
  TriangleAlert,
  SlidersHorizontal,
  ClipboardList,
  Component,
  PackageSearch,
  Recycle,
  ScanBarcode,
  Handshake,
  FileCheck2,
  BadgeCheck,
  Wallet,
  X,
} from "@repo/ui/icons";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsSystemAdmin } from "./guards/RoleGuard";

function SidebarBrand() {
  const { open } = useSidebar();
  return open ? (
    <Image
      src={ralliWolfLogo}
      alt="Ralli Wolf"
      height={32}
      className="h-8 w-auto max-w-[10.75rem] object-contain"
      priority
    />
  ) : null;
}

export function AppSidebar({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const canManageUsers = useIsSystemAdmin();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Marketing and sales modules
  const isLeadManagementActive = pathname.startsWith("/leads");
  const isCampaignsActive = pathname.startsWith("/campaigns");
  const isSalesManagementActive = pathname.startsWith("/sales");
  const isLandingPageActive =
    pathname === "/landing-page" ||
    pathname.startsWith("/landing-page-trackers");

  // Supply chain modules
  const isInventoryActive = pathname.startsWith("/inventory");
  const isMaterialsActive = pathname.startsWith("/materials");
  const isWarehouseActive = pathname.startsWith("/warehouse");
  const isBomActive =
    pathname.startsWith("/bom") || pathname.startsWith("/production");
  const isPurchasingActive = pathname.startsWith("/purchasing");

  return (
    <SidebarProvider>
      <Sidebar className="h-full">
        <SidebarHeader>
          <SidebarBrand />
          <div className="hidden lg:block">
            <SidebarTrigger />
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/25 lg:hidden whitespace-nowrap"
          >
            <X className="h-5 w-5" />
          </button>
        </SidebarHeader>
        {/* The rail still scrolls, but without a visible track cutting through
            the section rules. */}
        <SidebarContent className="scrollbar-none overscroll-contain">
          <SidebarGroup>
            <SidebarItem
              icon={ChartNoAxesCombined}
              label="Dashboard"
              href="/"
              active={isClient && pathname === "/"}
            />
          </SidebarGroup>

          {/* Front office, in the order a customer record is built up: publish
              the page, capture and work the lead, nurture it, then sell to it. */}
          <SidebarGroup title="Marketing & Sales">
            <SidebarCollapsibleItem
              icon={LayoutTemplate}
              label="Landing Page"
              active={isClient && isLandingPageActive}
              defaultOpen={isClient && isLandingPageActive}
            >
              <SidebarItem
                label="Landing Page Builder"
                href="https://app.landingi.com/landings"
                target="_blank"
                active={isClient && pathname === "/landing-page"}
                icon={FileText}
              />
              <SidebarItem
                label="Landing Page Trackers"
                href="/landing-page-trackers"
                active={
                  isClient && pathname.startsWith("/landing-page-trackers")
                }
                icon={Layers}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={Users}
              label="Lead Management"
              active={isClient && isLeadManagementActive}
              defaultOpen={isClient && isLeadManagementActive}
            >
              <SidebarItem
                label="Lead Master"
                href="/leads/lead-master"
                active={isClient && pathname === "/leads/lead-master"}
                icon={ListChecks}
              />
              <SidebarItem
                label="Unassigned Leads"
                href="/leads/unassigned-leads"
                active={isClient && pathname === "/leads/unassigned-leads"}
                icon={Share2}
              />
              <SidebarItem
                label="Assigned Leads"
                href="/leads/assigned"
                active={isClient && pathname === "/leads/assigned"}
                icon={UserCheck}
              />
              <SidebarItem
                label="Accounts"
                href="/leads/accounts"
                active={isClient && pathname === "/leads/accounts"}
                icon={Building2}
              />
              <SidebarItem
                label="Contacts"
                href="/leads/contacts"
                active={isClient && pathname === "/leads/contacts"}
                icon={BookUser}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={Megaphone}
              label="Campaign Management"
              active={isClient && isCampaignsActive}
              defaultOpen={isClient && isCampaignsActive}
            >
              <SidebarItem
                label="Segments"
                href="/campaigns/segments"
                active={isClient && pathname.startsWith("/campaigns/segments")}
                icon={ListChecks}
              />
              <SidebarItem
                label="Email Campaigns"
                href="/campaigns/email"
                active={isClient && pathname.startsWith("/campaigns/email")}
                icon={Mail}
              />
              <SidebarItem
                label="WhatsApp Campaigns"
                href="/campaigns/whatsapp"
                active={isClient && pathname.startsWith("/campaigns/whatsapp")}
                icon={MessageCircle}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={TrendingUp}
              label="Sales Management"
              active={isClient && isSalesManagementActive}
              defaultOpen={isClient && isSalesManagementActive}
            >
              <SidebarItem
                label="Product Configuration"
                href="/sales/products"
                active={isClient && pathname.startsWith("/sales/products")}
                icon={Package}
              />
              <SidebarItem
                label="Price Books"
                href="/sales/price-books"
                active={isClient && pathname.startsWith("/sales/price-books")}
                icon={BookCheckIcon}
              />
              <SidebarItem
                label="Opportunities"
                href="/sales/opportunities"
                active={isClient && pathname.startsWith("/sales/opportunities")}
                icon={BookAIcon}
              />
              <SidebarItem
                label="Quotes"
                href="/sales/quotes"
                active={isClient && pathname.startsWith("/sales/quotes")}
                icon={ReceiptText}
              />
              <SidebarItem
                label="Orders"
                href="/sales/orders"
                active={isClient && pathname.startsWith("/sales/orders")}
                icon={ShoppingCart}
              />
              <SidebarItem
                label="Approvals"
                href="/sales/approvals"
                active={isClient && pathname.startsWith("/sales/approvals")}
                icon={ClipboardCheck}
              />
            </SidebarCollapsibleItem>
            <SidebarItem
              icon={Bot}
              label="Chatbot"
              href="/chatbot"
              active={isClient && pathname === "/chatbot"}
            />
          </SidebarGroup>

          {/* Back office, in the order the data is actually entered: stand up
              the warehouse, define the materials, buy them in, then track the
              stock those receipts create and consume it in production. */}
          <SidebarGroup title="Supply Chain & Operations">
            <SidebarCollapsibleItem
              icon={Warehouse}
              label="Warehouse"
              active={isClient && isWarehouseActive}
              defaultOpen={isClient && isWarehouseActive}
            >
              <SidebarItem
                label="Warehouses & Bins"
                href="/warehouse"
                active={isClient && pathname === "/warehouse"}
                icon={Warehouse}
              />
              <SidebarItem
                label="Putaway Queue"
                href="/warehouse/putaway"
                active={isClient && pathname.startsWith("/warehouse/putaway")}
                icon={Package}
              />
              <SidebarItem
                label="Pick Lists"
                href="/warehouse/pick-lists"
                active={
                  isClient && pathname.startsWith("/warehouse/pick-lists")
                }
                icon={ListChecks}
              />
              <SidebarItem
                label="Packages"
                href="/warehouse/packages"
                active={isClient && pathname.startsWith("/warehouse/packages")}
                icon={Truck}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={Component}
              label="Materials"
              active={isClient && isMaterialsActive}
              defaultOpen={isClient && isMaterialsActive}
            >
              <SidebarItem
                label="Material Master"
                href="/materials"
                active={isClient && pathname === "/materials"}
                icon={Layers}
              />
              <SidebarItem
                label="Build Availability"
                href="/materials/availability"
                active={
                  isClient && pathname.startsWith("/materials/availability")
                }
                icon={ListChecks}
              />
              <SidebarItem
                label="Shortages"
                href="/materials/shortages"
                active={isClient && pathname.startsWith("/materials/shortages")}
                icon={TriangleAlert}
              />
              <SidebarItem
                label="Requisitions"
                href="/materials/requisitions"
                active={
                  isClient && pathname.startsWith("/materials/requisitions")
                }
                icon={ClipboardList}
              />
              <SidebarItem
                label="Consumption & Wastage"
                href="/materials/consumption"
                active={
                  isClient && pathname.startsWith("/materials/consumption")
                }
                icon={Recycle}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={Handshake}
              label="Purchasing"
              active={isClient && isPurchasingActive}
              defaultOpen={isClient && isPurchasingActive}
            >
              <SidebarItem
                label="Overview"
                href="/purchasing"
                active={isClient && pathname === "/purchasing"}
                icon={BarChart}
              />
              <SidebarItem
                label="Suppliers"
                href="/purchasing/suppliers"
                active={
                  isClient && pathname.startsWith("/purchasing/suppliers")
                }
                icon={Building2}
              />
              <SidebarItem
                label="Requisitions"
                href="/purchasing/requisitions"
                active={
                  isClient && pathname.startsWith("/purchasing/requisitions")
                }
                icon={ClipboardList}
              />
              <SidebarItem
                label="Purchase Orders"
                href="/purchasing/orders"
                active={isClient && pathname.startsWith("/purchasing/orders")}
                icon={ShoppingCart}
              />
              <SidebarItem
                label="Goods Receipts"
                href="/purchasing/goods-receipts"
                active={
                  isClient && pathname.startsWith("/purchasing/goods-receipts")
                }
                icon={FileCheck2}
              />
              <SidebarItem
                label="Quality Checks"
                href="/purchasing/quality"
                active={isClient && pathname.startsWith("/purchasing/quality")}
                icon={BadgeCheck}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={Boxes}
              label="Inventory"
              active={isClient && isInventoryActive}
              defaultOpen={isClient && isInventoryActive}
            >
              <SidebarItem
                label="Overview"
                href="/inventory"
                active={isClient && pathname === "/inventory"}
                icon={BarChart}
              />
              <SidebarItem
                label="Stock Positions"
                href="/inventory/stock"
                active={isClient && pathname.startsWith("/inventory/stock")}
                icon={PackageSearch}
              />
              <SidebarItem
                label="Stock Ledger"
                href="/inventory/movements"
                active={isClient && pathname.startsWith("/inventory/movements")}
                icon={ArrowLeftRight}
              />
              <SidebarItem
                label="Stock Counts"
                href="/inventory/counts"
                active={isClient && pathname.startsWith("/inventory/counts")}
                icon={ScanBarcode}
              />
              <SidebarItem
                label="Reorder Policies"
                href="/inventory/reorder-rules"
                active={
                  isClient && pathname.startsWith("/inventory/reorder-rules")
                }
                icon={SlidersHorizontal}
              />
              <SidebarItem
                label="Alerts"
                href="/inventory/alerts"
                active={isClient && pathname.startsWith("/inventory/alerts")}
                icon={TriangleAlert}
              />
              <SidebarItem
                label="Valuation"
                href="/inventory/valuation"
                active={isClient && pathname.startsWith("/inventory/valuation")}
                icon={Wallet}
              />
            </SidebarCollapsibleItem>
            <SidebarCollapsibleItem
              icon={GitBranch}
              label="BOM & Production"
              active={isClient && isBomActive}
              defaultOpen={isClient && isBomActive}
            >
              <SidebarItem
                label="Bills of Materials"
                href="/bom"
                active={isClient && pathname.startsWith("/bom")}
                icon={GitBranch}
              />
              <SidebarItem
                label="Production Orders"
                href="/production"
                active={isClient && pathname.startsWith("/production")}
                icon={Factory}
              />
            </SidebarCollapsibleItem>
          </SidebarGroup>

          <SidebarGroup title="Administration">
            {canManageUsers && (
              <SidebarItem
                icon={UserLock}
                label="User Management"
                href="/admin/user-management"
                active={isClient && pathname === "/admin/user-management"}
              />
            )}
            {/*
              Not gated on canManageUsers: these are the signed-in user's own
              notification choices, so everyone with an account needs them.
            */}
            <SidebarItem
              icon={Bell}
              label="Notifications"
              href="/admin/notifications"
              active={isClient && pathname === "/admin/notifications"}
            />
            <SidebarItem
              icon={Settings}
              label="Settings"
              href="/settings"
              active={isClient && pathname === "/settings"}
            />
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p className="text-xs font-medium text-muted-foreground">
            © {new Date().getFullYear()} Ralli Wolf
          </p>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
