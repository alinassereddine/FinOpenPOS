"use client";

import { useState, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod/v4";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import { FilePenIcon, TrashIcon, PlusIcon, PackageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@finopenpos/ui/components/select";
import { Label } from "@finopenpos/ui/components/label";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { DataTable, TableActions, TableActionButton, type Column, type ExportColumn } from "@finopenpos/ui/components/data-table";
import { SearchFilter, type FilterOption } from "@finopenpos/ui/components/search-filter";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];

export default function Products() {
  const trpc = useTRPC();
  const { data: products = [], isLoading } = useQuery(trpc.products.list.queryOptions());
  const { data: catList = [] } = useQuery(trpc.categories.list.queryOptions());
  const t = useTranslations("products");
  const tCat = useTranslations("categories");
  const tc = useTranslations("common");
  const locale = useLocale();

  const productFormSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    description: z.string(),
    price: z.number().min(0, t("priceMustBePositive")),
    cost_price: z.number().min(0, t("priceMustBePositive")),
    in_stock: z.number().int().min(0, t("stockMustBeNonNegative")),
    category_id: z.number().nullable(),
    image_url: z.string(),
  });

  const categoryFilterOptions: FilterOption[] = useMemo(() => [
    { label: tc("all"), value: "all" },
    ...catList.map(c => ({ label: c.name, value: String(c.id) }))
  ], [catList, tc]);

  const stockFilterOptions: FilterOption[] = [
    { label: t("allStock"), value: "all" },
    { label: t("inStock"), value: "in-stock", variant: "success" },
    { label: t("outOfStock"), value: "out-of-stock", variant: "danger" },
  ];

  const columns: Column<Product>[] = [
    { key: "name", header: t("product"), sortable: true, className: "font-medium" },
    { key: "description", header: tc("description"), hideOnMobile: true },
    {
      key: "price",
      header: tc("price"),
      sortable: true,
      accessorFn: (row) => row.price,
      render: (row) => formatCurrency(row.price, locale),
    },
    {
      key: "cost_price",
      header: tc("costPrice"),
      sortable: true,
      accessorFn: (row) => row.cost_price,
      render: (row) => formatCurrency(row.cost_price, locale),
    },
    { key: "in_stock", header: t("stock"), sortable: true },
    {
      key: "category",
      header: tc("category"),
      render: (row) => row.category?.name ?? "-",
    },
  ];

  const exportColumns: ExportColumn<Product>[] = [
    { key: "name", header: tc("name"), getValue: (p) => p.name },
    { key: "description", header: tc("description"), getValue: (p) => p.description ?? "" },
    { key: "cost_price", header: tc("costPrice"), getValue: (p) => (p.cost_price / 100).toFixed(2) },
    { key: "price", header: tc("price"), getValue: (p) => (p.price / 100).toFixed(2) },
    { key: "in_stock", header: t("stock"), getValue: (p) => p.in_stock },
    { key: "category", header: tc("category"), getValue: (p) => p.category?.name ?? "" },
  ];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const isEditing = editingId !== null;
  const invalidateKeys = trpc.products.list.queryOptions().queryKey;

  const createMutation = useCrudMutation({
    mutationOptions: trpc.products.create.mutationOptions(),
    invalidateKeys,
    successMessage: t("created"),
    errorMessage: t("createError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const updateMutation = useCrudMutation({
    mutationOptions: trpc.products.update.mutationOptions(),
    invalidateKeys,
    successMessage: t("updated"),
    errorMessage: t("updateError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const deleteMutation = useCrudMutation({
    mutationOptions: trpc.products.delete.mutationOptions(),
    invalidateKeys,
    successMessage: t("deleted"),
    errorMessage: t("deleteError"),
  });

  const form = useForm({
    defaultValues: { name: "", description: "", price: 0, cost_price: 0, in_stock: 0, category_id: null as number | null, image_url: "" },
    validators: {
      onSubmit: productFormSchema,
    },
    onSubmit: ({ value }) => {
      const payload = {
        name: value.name,
        description: value.description || undefined,
        price: Math.round(value.price * 100),
        cost_price: Math.round(value.cost_price * 100),
        in_stock: value.in_stock,
        category_id: value.category_id,
        image_url: value.image_url || undefined,
      };
      if (isEditing) {
        updateMutation.mutate({ id: editingId, ...payload });
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "all" && String(p.category_id) !== categoryFilter) return false;
      if (stockFilter === "in-stock" && p.in_stock === 0) return false;
      if (stockFilter === "out-of-stock" && p.in_stock > 0) return false;
      return p.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [products, categoryFilter, stockFilter, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    form.reset();
    form.setFieldValue("name", p.name);
    form.setFieldValue("description", p.description ?? "");
    form.setFieldValue("cost_price", p.cost_price / 100);
    form.setFieldValue("price", p.price / 100);
    form.setFieldValue("in_stock", p.in_stock);
    form.setFieldValue("category_id", p.category_id);
    form.setFieldValue("image_url", p.image_url ?? "");
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId !== null) {
      deleteMutation.mutate({ id: deleteId });
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const actionsColumn: Column<Product> = {
    key: "actions",
    header: tc("actions"),
    render: (row) => (
      <TableActions>
        <TableActionButton onClick={() => openEdit(row)} icon={<FilePenIcon className="w-4 h-4" />} label={tc("edit")} />
        <TableActionButton variant="danger" onClick={() => { setDeleteId(row.id); setIsDeleteOpen(true); }} icon={<TrashIcon className="w-4 h-4" />} label={tc("delete")} />
      </TableActions>
    ),
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
        <CardHeader className="p-0"><div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-32" /></div></CardHeader>
        <CardContent className="p-0 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" /><Skeleton className="h-8 w-20" /></div>))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
        <CardHeader className="p-0">
          <SearchFilter
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t("searchPlaceholder")}
            filters={[
              { options: categoryFilterOptions, value: categoryFilter, onChange: setCategoryFilter },
              { options: stockFilterOptions, value: stockFilter, onChange: setStockFilter },
            ]}
          >
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="w-4 h-4 mr-2" />{t("addProduct")}
            </Button>
          </SearchFilter>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={filteredProducts}
            columns={[...columns, actionsColumn]}
            exportColumns={exportColumns}
            exportFilename="products"
            emptyMessage={t("noProducts")}
            emptyIcon={<PackageIcon className="w-8 h-8" />}
            defaultSort={[{ id: "name", desc: false }]}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? t("editProduct") : t("addNewProduct")}</DialogTitle>
            <DialogDescription>{isEditing ? t("editDescription") : t("addDescription")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="grid gap-4 py-4">
              <form.Field name="name">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="name" className="sm:text-right">{tc("name")}</Label>
                    <div className="col-span-3">
                      <Input
                        id="name"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map(e => e?.message ?? e).join(", ") : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="description">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="description" className="sm:text-right">{tc("description")}</Label>
                    <Input id="description" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="col-span-3" />
                  </div>
                )}
              </form.Field>
              <form.Field name="price">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="price" className="sm:text-right">{tc("price")}</Label>
                    <div className="col-span-3">
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map((e: any) => e?.message ?? e).join(", ") : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="cost_price">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="cost_price" className="sm:text-right">{tc("costPrice")}</Label>
                    <div className="col-span-3">
                      <Input
                        id="cost_price"
                        type="number"
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map((e: any) => e?.message ?? e).join(", ") : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="in_stock">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="in_stock" className="sm:text-right">{t("stock")}</Label>
                    <div className="col-span-3">
                      <Input
                        id="in_stock"
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map((e: any) => e?.message ?? e).join(", ") : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="category_id">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="category" className="sm:text-right">{tc("category")}</Label>
                    <Select value={field.state.value ? String(field.state.value) : "none"} onValueChange={(value) => field.handleChange(value === "none" ? null : Number(value))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder={t("selectCategory")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tc("all")}</SelectItem>
                        {catList.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
              <form.Field name="image_url">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-start gap-2 sm:gap-4">
                    <Label htmlFor="image_url" className="sm:text-right mt-2">{t("imageUrl")}</Label>
                    <div className="col-span-3 space-y-2">
                       <Input
                        id="image_url"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t("imageUrlPlaceholder")}
                      />
                      {field.state.value && (
                        <img
                          src={field.state.value}
                          alt="Preview"
                          className="h-20 w-20 object-cover rounded-md border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </form.Field>
              </div>
            <DialogFooter>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                    {isEditing ? t("updateProduct") : t("addProduct")}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} description={t("deleteMessage")} />
    </>
  );
}
