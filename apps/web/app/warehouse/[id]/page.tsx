"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ProtectedRoute } from "@/components/protected-route";
import { ImagePicker } from "@/components/supply-chain/image-picker";
import { ImageIcon, Maximize2, Trash2 } from "@repo/ui/icons";
import { ConfirmationDialog } from "@repo/ui/components/ui/confirmation-dialog";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  Pager,
  Panel,
  SelectField,
  SimpleTable,
  StatCard,
  StatusBadge,
} from "@/components/supply-chain/shared";
import {
  usePallets,
  useStorageBins,
  useStorageUtilisation,
  useWarehouse,
  useWarehouseMutations,
  useWarehouseZones,
} from "@/hooks/use-supply-chain";
import {
  formatPercent,
  formatQuantity,
  humanizeEnum,
} from "@/lib/utils/decimal";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Tag } from "@repo/ui/components/ui/tag";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

const ZONE_TYPES = [
  "RECEIVING",
  "STORAGE",
  "PICKING",
  "PACKING",
  "SHIPPING",
  "QUARANTINE",
  "RETURNS",
  "PRODUCTION",
  "STAGING",
];
const BIN_TYPES = [
  "PALLET_RACK",
  "SHELF",
  "BULK_FLOOR",
  "BIN_BOX",
  "CAROUSEL",
  "HAZMAT",
  "COLD_STORAGE",
];

export default function WarehouseDetailPage() {
  const params = useParams<{ id: string }>();
  const warehouseId = Number(params.id);
  const [tab, setTab] = useState<"zones" | "bins" | "utilisation" | "pallets">(
    "zones"
  );
  const [binPage, setBinPage] = useState(1);
  const [binSearch, setBinSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<number | undefined>(undefined);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const [imagePendingRemoval, setImagePendingRemoval] = useState<{
    id: number;
    position: number;
  } | null>(null);

  const { data: warehouseData, isLoading, error } = useWarehouse(warehouseId);
  const { data: zonesData, isLoading: zonesLoading } =
    useWarehouseZones(warehouseId);
  const {
    bins,
    pagination: binPagination,
    isLoading: binsLoading,
  } = useStorageBins(warehouseId, {
    page: binPage,
    limit: 100,
    search: binSearch || undefined,
    zoneId: zoneFilter,
  });
  const { data: utilisationData, isLoading: utilisationLoading } =
    useStorageUtilisation(warehouseId);
  const { pallets, isLoading: palletsLoading } = usePallets(warehouseId, {
    limit: 100,
  });
  const {
    createZone,
    createBin,
    generateBins,
    updateBin,
    createPallet,
    addImages,
    deleteImage,
  } = useWarehouseMutations();

  const warehouse = warehouseData?.data;
  const zones = zonesData?.data ?? [];
  const utilisation = utilisationData?.data;

  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    zoneType: "STORAGE",
  });
  const [binForm, setBinForm] = useState({
    zoneId: "",
    code: "",
    aisle: "",
    rack: "",
    level: "",
    binType: "SHELF",
    pickSequence: "0",
    maxWeightKg: "",
  });
  const [rackForm, setRackForm] = useState({
    zoneId: "",
    aisles: "2",
    racksPerAisle: "4",
    levelsPerRack: "3",
    positionsPerLevel: "2",
    binType: "PALLET_RACK",
  });

  return (
    <ProtectedRoute>
      <PageShell>
        <PageHeader
          title={
            isLoading
              ? "Loading warehouse…"
              : warehouse
                ? `${warehouse.code} — ${warehouse.name}`
                : "Warehouse"
          }
          subtitle={
            warehouse
              ? `${humanizeEnum(warehouse.type)} · ${[warehouse.city, warehouse.state].filter(Boolean).join(", ") || "no address on file"}`
              : undefined
          }
          breadcrumb={[
            { label: "Warehouse management", href: "/warehouse" },
            { label: warehouse?.code ?? String(warehouseId) },
          ]}
          actions={
            warehouse && (
              <StatusBadge
                status={warehouse.isActive ? "ACTIVE" : "INACTIVE"}
              />
            )
          }
        />

        <ErrorBanner error={error} />
        <ErrorBanner error={createZone.error} />
        <ErrorBanner error={createBin.error} />
        <ErrorBanner error={generateBins.error} />
        <ErrorBanner error={createPallet.error} />
        <ErrorBanner error={addImages.error} />
        <ErrorBanner error={deleteImage.error} />

        {warehouse && (
          <Panel
            title="Warehouse photos"
            description="Photos of this warehouse, so anyone can see the building and where things are kept."
            actions={
              <span className="text-xs text-muted-foreground">
                {warehouse.images?.length ?? 0} of 8 images
              </span>
            }
          >
            <div className="space-y-4">
              {warehouse.images && warehouse.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {warehouse.images.map((image, index) => (
                    <figure
                      key={image.id}
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                        onClick={() =>
                          setPreviewImage({
                            url: image.url,
                            alt: `${warehouse.name} photo ${index + 1}`,
                          })
                        }
                        aria-label={`View warehouse photo ${index + 1}`}
                      >
                        <Image
                          src={image.url}
                          alt={`${warehouse.name} photo ${index + 1}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.025]"
                        />
                        <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-lg bg-foreground/70 text-background opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <Maximize2 className="size-4" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setImagePendingRemoval({
                            id: image.id,
                            position: index + 1,
                          })
                        }
                        disabled={deleteImage.isPending}
                        className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-lg bg-foreground/80 text-background shadow-sm outline-none transition-colors hover:bg-foreground focus-visible:ring-2 focus-visible:ring-background/70 disabled:opacity-50"
                        aria-label={`Remove warehouse photo ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
                  <ImageIcon className="size-5 shrink-0" />
                  No photos have been added for this warehouse yet.
                </div>
              )}

              {(warehouse.images?.length ?? 0) < 8 && (
                <ImagePicker
                  files={pendingImages}
                  onChange={setPendingImages}
                  existingCount={warehouse.images?.length ?? 0}
                  itemLabel="warehouse images"
                  disabled={addImages.isPending}
                />
              )}

              {pendingImages.length > 0 && (
                <button
                  type="button"
                  disabled={addImages.isPending}
                  onClick={() =>
                    addImages.mutate(
                      { warehouseId, images: pendingImages },
                      {
                        onSuccess: () => {
                          setPendingImages([]);
                        },
                      }
                    )
                  }
                  data-slot="button"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  {addImages.isPending
                    ? "Uploading…"
                    : `Upload ${pendingImages.length} image${pendingImages.length === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </Panel>
        )}

        <div className="grid-auto-fit gap-3">
          <StatCard label="Zones" value={zones.length} />
          <StatCard
            label="Bins"
            value={utilisation?.totalBins ?? warehouse?._count?.bins ?? 0}
          />
          <StatCard
            label="Empty bins"
            value={utilisation?.emptyBins ?? 0}
            hint={
              utilisation
                ? `${utilisation.totalBins - utilisation.emptyBins} occupied`
                : undefined
            }
          />
          <StatCard
            label="Bins over weight capacity"
            value={utilisation?.binsOverCapacity ?? 0}
            tone={utilisation?.binsOverCapacity ? "critical" : "positive"}
          />
        </div>

        <CategorySwitcher
          label="Warehouse sections"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "zones", label: "Zones", count: zones.length },
            {
              value: "bins",
              label: "Bins",
              count: binPagination?.totalItems ?? 0,
            },
            { value: "utilisation", label: "Utilisation" },
            { value: "pallets", label: "Pallets", count: pallets.length },
          ]}
        />

        {tab === "zones" && (
          <>
            <Panel
              title="Add a zone"
              description="Zones split a warehouse into areas by job — for example, where deliveries land before being put away."
            >
              <form
                className="grid gap-4 md:grid-cols-4"
                onSubmit={event => {
                  event.preventDefault();
                  createZone.mutate(
                    { warehouseId, payload: zoneForm },
                    {
                      onSuccess: () =>
                        setZoneForm({
                          code: "",
                          name: "",
                          zoneType: "STORAGE",
                        }),
                    }
                  );
                }}
              >
                <Field label="Code">
                  <Input
                    required
                    value={zoneForm.code}
                    onChange={e =>
                      setZoneForm({ ...zoneForm, code: e.target.value })
                    }
                    placeholder="e.g. RCV"
                  />
                </Field>
                <Field label="Name">
                  <Input
                    required
                    value={zoneForm.name}
                    onChange={e =>
                      setZoneForm({ ...zoneForm, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Zone type">
                  <SelectField
                    value={zoneForm.zoneType}
                    onChange={e =>
                      setZoneForm({ ...zoneForm, zoneType: e.target.value })
                    }
                  >
                    {ZONE_TYPES.map(type => (
                      <option key={type} value={type}>
                        {humanizeEnum(type)}
                      </option>
                    ))}
                  </SelectField>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={createZone.isPending}
                    className="w-full"
                  >
                    {createZone.isPending ? "Adding…" : "Add zone"}
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel flush title="Zones">
              <SimpleTable
                isLoading={zonesLoading}
                rows={zones}
                keyOf={row => row.id}
                empty="No zones yet. Add a receiving zone and a storage zone to get started."
                columns={[
                  {
                    header: "Code",
                    cell: row => (
                      <span className="font-mono text-xs">{row.code}</span>
                    ),
                  },
                  { header: "Name", cell: row => row.name },
                  {
                    header: "Type",
                    cell: row =>
                      row.zoneType ? <Tag>{row.zoneType}</Tag> : "—",
                  },
                  {
                    header: "Bins",
                    align: "right",
                    cell: row => row._count?.bins ?? 0,
                  },
                  {
                    header: "Temperature controlled",
                    cell: row => (row.temperatureControlled ? "Yes" : "No"),
                  },
                  {
                    header: "Status",
                    cell: row => (
                      <StatusBadge
                        status={row.isActive ? "ACTIVE" : "INACTIVE"}
                      />
                    ),
                  },
                ]}
              />
            </Panel>
          </>
        )}

        {tab === "bins" && (
          <>
            {zones.length === 0 ? (
              <EmptyState
                title="Add a zone first"
                description="Bins live inside a zone. Create at least one zone before adding storage locations."
              />
            ) : (
              <>
                <Panel
                  title="Generate a rack layout"
                  description="Creates all the shelf locations at once, numbered in the order a picker walks, so no aisle is walked twice."
                >
                  <form
                    className="grid gap-4 md:grid-cols-6"
                    onSubmit={event => {
                      event.preventDefault();
                      if (!rackForm.zoneId) return;
                      generateBins.mutate({
                        warehouseId,
                        payload: {
                          zoneId: Number(rackForm.zoneId),
                          aisles: Number(rackForm.aisles),
                          racksPerAisle: Number(rackForm.racksPerAisle),
                          levelsPerRack: Number(rackForm.levelsPerRack),
                          positionsPerLevel: Number(rackForm.positionsPerLevel),
                          binType: rackForm.binType,
                        },
                      });
                    }}
                  >
                    <Field label="Zone">
                      <SelectField
                        required
                        value={rackForm.zoneId}
                        onChange={e =>
                          setRackForm({ ...rackForm, zoneId: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.id}>
                            {zone.code} — {zone.name}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                    <Field label="Aisles">
                      <Input
                        inputMode="numeric"
                        value={rackForm.aisles}
                        onChange={e =>
                          setRackForm({ ...rackForm, aisles: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Racks / aisle">
                      <Input
                        inputMode="numeric"
                        value={rackForm.racksPerAisle}
                        onChange={e =>
                          setRackForm({
                            ...rackForm,
                            racksPerAisle: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Levels / rack">
                      <Input
                        inputMode="numeric"
                        value={rackForm.levelsPerRack}
                        onChange={e =>
                          setRackForm({
                            ...rackForm,
                            levelsPerRack: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Positions / level">
                      <Input
                        inputMode="numeric"
                        value={rackForm.positionsPerLevel}
                        onChange={e =>
                          setRackForm({
                            ...rackForm,
                            positionsPerLevel: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        disabled={generateBins.isPending || !rackForm.zoneId}
                        className="w-full"
                      >
                        {generateBins.isPending
                          ? "Generating…"
                          : `Generate ${Number(rackForm.aisles) * Number(rackForm.racksPerAisle) * Number(rackForm.levelsPerRack) * Number(rackForm.positionsPerLevel) || 0}`}
                      </Button>
                    </div>
                  </form>
                  {generateBins.isSuccess && generateBins.data && (
                    <p className="mt-3 text-sm text-success-foreground">
                      Created {generateBins.data.data.created} bin(s);{" "}
                      {generateBins.data.data.skippedExisting} already existed.
                    </p>
                  )}
                </Panel>

                <Panel title="Add a single bin">
                  <form
                    className="grid gap-4 md:grid-cols-6"
                    onSubmit={event => {
                      event.preventDefault();
                      if (!binForm.zoneId) return;
                      createBin.mutate(
                        {
                          warehouseId,
                          payload: {
                            ...binForm,
                            zoneId: Number(binForm.zoneId),
                            pickSequence: Number(binForm.pickSequence) || 0,
                            maxWeightKg: binForm.maxWeightKg || undefined,
                          },
                        },
                        {
                          onSuccess: () =>
                            setBinForm({
                              ...binForm,
                              code: "",
                              aisle: "",
                              rack: "",
                              level: "",
                            }),
                        }
                      );
                    }}
                  >
                    <Field label="Zone">
                      <SelectField
                        required
                        value={binForm.zoneId}
                        onChange={e =>
                          setBinForm({ ...binForm, zoneId: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.id}>
                            {zone.code}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                    <Field label="Bin code">
                      <Input
                        required
                        value={binForm.code}
                        onChange={e =>
                          setBinForm({ ...binForm, code: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Aisle">
                      <Input
                        value={binForm.aisle}
                        onChange={e =>
                          setBinForm({ ...binForm, aisle: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Rack">
                      <Input
                        value={binForm.rack}
                        onChange={e =>
                          setBinForm({ ...binForm, rack: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Bin type">
                      <SelectField
                        value={binForm.binType}
                        onChange={e =>
                          setBinForm({ ...binForm, binType: e.target.value })
                        }
                      >
                        {BIN_TYPES.map(type => (
                          <option key={type} value={type}>
                            {humanizeEnum(type)}
                          </option>
                        ))}
                      </SelectField>
                    </Field>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={
                          createBin.isPending ||
                          !binForm.zoneId ||
                          !binForm.code
                        }
                        className="w-full rounded-lg border inline-flex items-center justify-center h-10 whitespace-nowrap px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Add bin
                      </button>
                    </div>
                  </form>
                </Panel>

                <Panel
                  flush
                  title="Bins"
                  actions={
                    <SearchFilterToolbar
                      search={
                        <Input
                          placeholder="Search bin code"
                          value={binSearch}
                          onChange={event => {
                            setBinSearch(event.target.value);
                            setBinPage(1);
                          }}
                        />
                      }
                      filters={
                        <SelectField
                          aria-label="Filter by zone"
                          className="w-full md:w-40"
                          value={zoneFilter ?? ""}
                          onChange={event => {
                            setZoneFilter(
                              event.target.value
                                ? Number(event.target.value)
                                : undefined
                            );
                            setBinPage(1);
                          }}
                        >
                          <option value="">All zones</option>
                          {zones.map(zone => (
                            <option key={zone.id} value={zone.id}>
                              {zone.code}
                            </option>
                          ))}
                        </SelectField>
                      }
                    />
                  }
                >
                  <SimpleTable
                    isLoading={binsLoading}
                    rows={bins}
                    keyOf={row => row.id}
                    empty="No bins match. Generate a rack layout above to create them in bulk."
                    columns={[
                      {
                        header: "Bin",
                        cell: row => (
                          <span className="font-mono text-xs">{row.code}</span>
                        ),
                      },
                      { header: "Zone", cell: row => row.zone?.code ?? "—" },
                      {
                        header: "Aisle / rack / level",
                        cell: row =>
                          [row.aisle, row.rack, row.level]
                            .filter(Boolean)
                            .join(" / ") || "—",
                      },
                      {
                        header: "Type",
                        cell: row =>
                          row.binType ? <Tag>{row.binType}</Tag> : "—",
                      },
                      {
                        header: "Pick seq",
                        align: "right",
                        cell: row => row.pickSequence,
                      },
                      {
                        header: "Max weight",
                        align: "right",
                        cell: row =>
                          row.maxWeightKg
                            ? `${formatQuantity(row.maxWeightKg)} kg`
                            : "—",
                      },
                      {
                        header: "Slots in use",
                        align: "right",
                        cell: row => row._count?.stockBalances ?? 0,
                      },
                      {
                        header: "Flags",
                        cell: row => (
                          <div className="flex flex-wrap gap-1">
                            {row.isReceiving && (
                              <Tag tone="progress">receiving</Tag>
                            )}
                            {row.isShipping && (
                              <Tag tone="neutral">shipping</Tag>
                            )}
                            {row.isPickFace && (
                              <Tag tone="active">pick face</Tag>
                            )}
                            {row.isQuarantine && (
                              <Tag tone="pending">quarantine</Tag>
                            )}
                            {row.isBlocked && <Tag tone="danger">blocked</Tag>}
                          </div>
                        ),
                      },
                      {
                        header: "",
                        cell: row => (
                          <button
                            type="button"
                            onClick={() =>
                              updateBin.mutate({
                                binId: row.id,
                                payload: { isBlocked: !row.isBlocked },
                              })
                            }
                            className="rounded border px-2 py-1 text-xs hover:bg-muted whitespace-nowrap"
                          >
                            {row.isBlocked ? "Unblock" : "Block"}
                          </button>
                        ),
                      },
                    ]}
                  />
                  <Pager
                    page={binPage}
                    totalPages={binPagination?.totalPages}
                    onChange={setBinPage}
                  />
                </Panel>
              </>
            )}
          </>
        )}

        {tab === "utilisation" && (
          <Panel
            flush
            title="Storage utilisation"
            description="How full each storage space is, by weight and by how many different items it holds."
          >
            <SimpleTable
              isLoading={utilisationLoading}
              rows={utilisation?.rows ?? []}
              keyOf={row => row.binId}
              rowClassName={row =>
                row.weightUtilisationPercent &&
                Number(row.weightUtilisationPercent) > 100
                  ? "bg-error-surface/40"
                  : ""
              }
              empty="No bins configured yet."
              columns={[
                {
                  header: "Bin",
                  cell: row => (
                    <span className="font-mono text-xs">{row.binCode}</span>
                  ),
                },
                { header: "Zone", cell: row => row.zone.code },
                {
                  header: "Location",
                  cell: row =>
                    [row.aisle, row.rack, row.level]
                      .filter(Boolean)
                      .join(" / ") || "—",
                },
                {
                  header: "Items",
                  align: "right",
                  cell: row => row.distinctItems,
                },
                {
                  header: "Quantity",
                  align: "right",
                  cell: row => formatQuantity(row.totalQuantity),
                },
                {
                  header: "Weight used",
                  align: "right",
                  cell: row => `${formatQuantity(row.usedWeightKg)} kg`,
                },
                {
                  header: "Capacity",
                  align: "right",
                  cell: row =>
                    row.maxWeightKg
                      ? `${formatQuantity(row.maxWeightKg)} kg`
                      : "not set",
                },
                {
                  header: "Utilisation",
                  align: "right",
                  cell: row =>
                    row.weightUtilisationPercent === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          Number(row.weightUtilisationPercent) > 100
                            ? "font-semibold text-error-foreground"
                            : Number(row.weightUtilisationPercent) > 80
                              ? "font-semibold text-warning-foreground"
                              : ""
                        }
                      >
                        {formatPercent(row.weightUtilisationPercent)}
                      </span>
                    ),
                },
                {
                  header: "Status",
                  cell: row =>
                    row.isBlocked ? (
                      <StatusBadge status="BLOCKED" />
                    ) : row.isEmpty ? (
                      <span className="text-xs text-muted-foreground">
                        empty
                      </span>
                    ) : (
                      <StatusBadge status="AVAILABLE" />
                    ),
                },
              ]}
            />
          </Panel>
        )}

        {tab === "pallets" && (
          <>
            <Panel
              title="Add a pallet"
              description="Add a pallet to this warehouse. Leave the code blank and one is created for you."
            >
              <form
                className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap"
                onSubmit={event => {
                  event.preventDefault();
                  const formData = new FormData(
                    event.currentTarget as HTMLFormElement
                  );
                  createPallet.mutate({
                    warehouseId,
                    payload: {
                      code: (formData.get("code") as string) || undefined,
                      binId: formData.get("binId")
                        ? Number(formData.get("binId"))
                        : undefined,
                    },
                  });
                  (event.currentTarget as HTMLFormElement).reset();
                }}
              >
                <Field label="Pallet code" className="w-full sm:w-52">
                  <Input name="code" placeholder="Auto-generated" />
                </Field>
                <Field label="Initial bin" className="w-full sm:w-52">
                  <SelectField name="binId">
                    <option value="">None</option>
                    {bins.map(bin => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </SelectField>
                </Field>
                <button
                  type="submit"
                  disabled={createPallet.isPending}
                  className="rounded-lg border inline-flex items-center justify-center h-10 whitespace-nowrap px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Add pallet
                </button>
              </form>
            </Panel>

            <Panel flush title="Pallets">
              <SimpleTable
                isLoading={palletsLoading}
                rows={pallets}
                keyOf={row => row.id}
                empty="No pallets registered in this warehouse."
                columns={[
                  {
                    header: "Pallet",
                    cell: row => (
                      <span className="font-mono text-xs">{row.code}</span>
                    ),
                  },
                  { header: "Bin", cell: row => row.bin?.code ?? "—" },
                  {
                    header: "Status",
                    cell: row => <StatusBadge status={row.status} />,
                  },
                  {
                    header: "Items on pallet",
                    align: "right",
                    cell: row => row.stockBalances?.length ?? 0,
                  },
                  {
                    header: "Contents",
                    cell: row =>
                      row.stockBalances && row.stockBalances.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {row.stockBalances
                            .slice(0, 3)
                            .map(
                              balance =>
                                `${balance.product.code} × ${formatQuantity(balance.quantity)}`
                            )
                            .join(", ")}
                          {row.stockBalances.length > 3
                            ? ` +${row.stockBalances.length - 3} more`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          empty
                        </span>
                      ),
                  },
                ]}
              />
            </Panel>
          </>
        )}

        <Dialog
          open={!!previewImage}
          onOpenChange={open => {
            if (!open) setPreviewImage(null);
          }}
        >
          <DialogContent className="max-w-5xl overflow-hidden bg-foreground p-2 shadow-2xl [&>button]:bg-surface/10 [&>button]:text-background [&>button]:hover:bg-surface/20">
            <DialogTitle className="sr-only">
              Warehouse photo preview
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enlarged preview of the selected warehouse photo.
            </DialogDescription>
            {previewImage && (
              <div className="relative aspect-[16/10] max-h-[calc(100svh-3rem)] w-full overflow-hidden rounded-lg bg-foreground">
                <Image
                  src={previewImage.url}
                  alt={previewImage.alt}
                  fill
                  unoptimized
                  priority
                  sizes="(max-width: 1024px) 100vw, 80vw"
                  className="object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmationDialog
          open={!!imagePendingRemoval}
          onOpenChange={open => {
            if (!open) setImagePendingRemoval(null);
          }}
          onConfirm={async () => {
            if (!imagePendingRemoval) return;
            await deleteImage.mutateAsync(imagePendingRemoval.id);
          }}
          title="Remove warehouse photo?"
          description={`Photo ${imagePendingRemoval?.position ?? ""} will be permanently removed from this warehouse.`}
          confirmText="Remove photo"
          variant="destructive"
          isLoading={deleteImage.isPending}
        />
      </PageShell>
    </ProtectedRoute>
  );
}
