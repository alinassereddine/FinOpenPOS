"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Badge } from "@finopenpos/ui/components/badge";
import { Combobox } from "@finopenpos/ui/components/combobox";
import {
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  ReceiptTextIcon,
  PackageIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<Product, "id" | "name" | "price" | "in_stock" | "image_url"> & {
  category: string;
  quantity: number;
};

export default function POSPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: loadingProducts } = useQuery(trpc.products.list.queryOptions());
  const { data: customers = [], isLoading: loadingCustomers } = useQuery(trpc.customers.list.queryOptions());
  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery(trpc.paymentMethods.list.queryOptions());
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const tOrders = useTranslations("orders");
  const locale = useLocale();

  const loading = loadingProducts || loadingCustomers || loadingMethods;

  const createOrderMutation = useMutation(
    trpc.orders.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.orders.list.queryOptions());
        queryClient.invalidateQueries(trpc.products.list.queryOptions());
        toast.success(tOrders("createdSuccessfully"));
        setSelectedProducts([]);
        setSelectedCustomer(null);
        setPaymentMethod(null);
      },
      onError: (err) => toast.error(err.message || tOrders("createError")),
    })
  );

  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<{ id: number; name: string } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [emitNfce, setEmitNfce] = useState(false);

  // Extract unique categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of products) {
      if (p.category) cats.add(p.category);
    }
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "all" && (p.category ?? "") !== categoryFilter) return false;
      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q);
    });
  }, [products, productSearch, categoryFilter]);

  const handleSelectProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.in_stock <= 0) {
      toast.error(t("outOfStock", { name: product.name }));
      return;
    }
    const existing = selectedProducts.find((p) => p.id === productId);
    if (existing && existing.quantity >= product.in_stock) {
      toast.error(t("limitedStock", { count: product.in_stock, name: product.name }));
      return;
    }
    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.id === productId ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          in_stock: product.in_stock,
          image_url: product.image_url,
          category: product.category ?? "",
          quantity: 1,
        },
      ]);
    }
  };

  const handleSelectCustomer = (customerId: number | string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) setSelectedCustomer(customer);
  };

  const handleSelectPaymentMethod = (paymentMethodId: number | string) => {
    const method = paymentMethods.find((pm) => pm.id === paymentMethodId);
    if (method) setPaymentMethod(method);
  };

  const handleQuantityChange = (productId: number, delta: number) => {
    const product = products.find((p) => p.id === productId);
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newQty = p.quantity + delta;
        if (newQty <= 0) return p;
        if (product && newQty > product.in_stock) {
          toast.error(t("limitedUnits", { count: product.in_stock }));
          return p;
        }
        return { ...p, quantity: newQty };
      })
    );
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const total = selectedProducts.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0
  );

  const cartItemCount = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  const canCreate = selectedProducts.length > 0 && selectedCustomer && paymentMethod;

  const handleCreateOrder = () => {
    if (!canCreate) return;
    createOrderMutation.mutate({
      customerId: selectedCustomer!.id,
      paymentMethodId: paymentMethod!.id,
      products: selectedProducts.map((p) => ({
        id: p.id,
        quantity: p.quantity,
        price: p.price,
      })),
      total,
    });
  };

  // Get the quantity of a product already in the cart
  const getCartQuantity = (productId: number) => {
    const item = selectedProducts.find((p) => p.id === productId);
    return item?.quantity ?? 0;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] gap-4 p-4">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="w-80 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] gap-3 overflow-hidden">
      {/* LEFT: Product Grid */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Search Bar */}
        <div className="shrink-0 px-1 pt-1 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10 h-12 text-base rounded-xl"
            />
            {productSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={() => setProductSearch("")}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="shrink-0 px-1 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation ${
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t("allCategories")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors touch-manipulation ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-1 pb-2">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <PackageIcon className="h-12 w-12" />
              <p className="text-sm">{tc("noItemFound")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const inCart = getCartQuantity(product.id);
                const outOfStock = product.in_stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product.id)}
                    disabled={outOfStock}
                    className={`relative flex flex-col rounded-xl border p-2 text-left transition-all touch-manipulation active:scale-[0.97] ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : inCart > 0
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "bg-card hover:bg-accent hover:shadow-md border-border"
                    }`}
                  >
                    {/* Quantity Badge */}
                    {inCart > 0 && (
                      <div className="absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
                        {inCart}
                      </div>
                    )}

                    {/* Product Image */}
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div
                        className={`absolute inset-0 flex items-center justify-center ${
                          product.image_url ? "hidden" : ""
                        }`}
                      >
                        <PackageIcon className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-col gap-0.5 min-h-[3rem]">
                      <span className="text-sm font-medium leading-tight line-clamp-2">
                        {product.name}
                      </span>
                      <span className="text-base font-bold text-primary">
                        {formatCurrency(product.price, locale)}
                      </span>
                    </div>

                    {/* Stock Badge */}
                    <div className="mt-1">
                      {outOfStock ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {t("outOfStock", { name: "" }).replace(" is ", "").trim()}
                        </Badge>
                      ) : product.in_stock <= 5 ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600">
                          {product.in_stock} left
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart Sidebar */}
      <div className="w-72 md:w-80 lg:w-96 shrink-0 flex flex-col bg-card border-l overflow-hidden">
        {/* Cart Header */}
        <div className="shrink-0 border-b p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5" />
              <h2 className="font-semibold text-base">{t("saleDetails")}</h2>
            </div>
            {selectedProducts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {t("itemsInCart", { count: cartItemCount })}
              </Badge>
            )}
          </div>

          {/* Customer & Payment Method */}
          <div className="flex flex-col gap-2">
            <Combobox
              items={customers}
              placeholder={t("selectCustomer")}
              onSelect={handleSelectCustomer}
            />
            <Combobox
              items={paymentMethods}
              placeholder={t("selectPaymentMethod")}
              onSelect={handleSelectPaymentMethod}
            />
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-4">
              <ShoppingCartIcon className="h-12 w-12 opacity-30" />
              <p className="text-sm text-center">{t("emptyCart")}</p>
            </div>
          ) : (
            selectedProducts.map((product) => {
              const source = products.find((p) => p.id === product.id);
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2"
                >
                  {/* Mini product image */}
                  <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PackageIcon className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Product name & price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(product.price * product.quantity, locale)}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 touch-manipulation"
                      onClick={() => handleQuantityChange(product.id, -1)}
                      disabled={product.quantity <= 1}
                    >
                      <MinusIcon className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {product.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 touch-manipulation"
                      onClick={() => handleQuantityChange(product.id, 1)}
                      disabled={source ? product.quantity >= source.in_stock : false}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive touch-manipulation"
                    onClick={() => handleRemoveProduct(product.id)}
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        <div className="shrink-0 border-t p-3 space-y-3">
          {/* NFC-e toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none touch-manipulation">
            <input
              type="checkbox"
              checked={emitNfce}
              onChange={(e) => setEmitNfce(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300"
            />
            <ReceiptTextIcon className="h-4 w-4 text-muted-foreground" />
            NFC-e
          </label>

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{tc("total")}</span>
            <span className="text-2xl font-bold">{formatCurrency(total, locale)}</span>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={handleCreateOrder}
            disabled={!canCreate || createOrderMutation.isPending}
            size="lg"
            className="w-full h-14 text-lg font-semibold rounded-xl touch-manipulation"
          >
            {createOrderMutation.isPending && (
              <Loader2Icon className="h-5 w-5 animate-spin mr-2" />
            )}
            {t("checkout")}
          </Button>

          {/* Clear cart */}
          {selectedProducts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full touch-manipulation"
              onClick={() => setSelectedProducts([])}
            >
              {t("clearCart")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
