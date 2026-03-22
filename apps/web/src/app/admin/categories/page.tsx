"use client";

import { useState, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod/v4";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import { PlusCircle, FilePenIcon, TrashIcon, TagsIcon } from "lucide-react";
import { Button } from "@finopenpos/ui/components/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { DataTable, TableActions, TableActionButton, type Column, type ExportColumn } from "@finopenpos/ui/components/data-table";
import { SearchFilter } from "@finopenpos/ui/components/search-filter";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations } from "next-intl";

type Category = RouterOutputs["categories"]["list"][number];

export default function CategoriesPage() {
  const trpc = useTRPC();
  const { data: categories = [], isLoading, error } = useQuery(trpc.categories.list.queryOptions());
  const t = useTranslations("categories");
  const tc = useTranslations("common");

  const categoryFormSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
  });

  const tableColumns: Column<Category>[] = [
    {
      key: "name",
      header: tc("name"),
      sortable: true,
      className: "font-medium",
    },
    {
      key: "created_at",
      header: tc("date"),
      sortable: true,
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
    },
  ];

  const exportColumns: ExportColumn<Category>[] = [
    { key: "name", header: tc("name"), getValue: (c) => c.name },
    { key: "created_at", header: tc("date"), getValue: (c) => c.created_at?.toISOString() ?? "" },
  ];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isEditing = editingId !== null;
  const invalidateKeys = trpc.categories.list.queryOptions().queryKey;

  const createMutation = useCrudMutation({
    mutationOptions: trpc.categories.create.mutationOptions(),
    invalidateKeys,
    successMessage: t("created"),
    errorMessage: t("createError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const updateMutation = useCrudMutation({
    mutationOptions: trpc.categories.update.mutationOptions(),
    invalidateKeys,
    successMessage: t("updated"),
    errorMessage: t("updateError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const deleteMutation = useCrudMutation({
    mutationOptions: trpc.categories.delete.mutationOptions(),
    invalidateKeys,
    successMessage: t("deleted"),
    errorMessage: t("deleteError"),
  });

  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmit: categoryFormSchema,
    },
    onSubmit: ({ value }) => {
      if (isEditing) {
        updateMutation.mutate({ id: editingId, name: value.name });
      } else {
        createMutation.mutate({ name: value.name });
      }
    },
  });

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const q = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(q);
    });
  }, [categories, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    form.reset();
    form.setFieldValue("name", c.name);
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId !== null) {
      deleteMutation.mutate({ id: deleteId });
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const actionsColumn: Column<Category> = {
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
      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0"><div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-32" /></div></CardHeader>
        <CardContent className="p-0 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-20" /></div>))}</CardContent>
      </Card>
    );
  }

  if (error) { return <Card><CardContent><p className="text-red-500">{error.message}</p></CardContent></Card>; }

  return (
    <Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
      <CardHeader className="p-0">
        <SearchFilter
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("searchPlaceholder")}
        >
          <Button size="sm" onClick={openCreate}><PlusCircle className="w-4 h-4 mr-2" />{t("addCategory")}</Button>
        </SearchFilter>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          data={filteredCategories}
          columns={[...tableColumns, actionsColumn]}
          exportColumns={exportColumns}
          exportFilename="categories"
          emptyMessage={t("noCategories")}
          emptyIcon={<TagsIcon className="w-8 h-8" />}
          defaultSort={[{ id: "name", desc: false }]}
        />
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isEditing ? t("editCategory") : t("createCategory")}</DialogTitle></DialogHeader>
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
                    <Label htmlFor="name">{tc("name")}</Label>
                    <div className="col-span-3">
                      <Input id="name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map(e => e?.message ?? e).join(", ") : undefined} />
                    </div>
                  </div>
                )}
              </form.Field>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>{tc("cancel")}</Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                    {isEditing ? t("updateCategory") : t("addCategory")}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} description={t("deleteMessage")} />
    </Card>
  );
}
