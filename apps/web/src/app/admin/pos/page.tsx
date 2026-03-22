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
  PercentIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency, type CurrencyCode } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<Product, "id" | "name" | "price" | "in_stock" | "image_url"> & {
  categoryName: string;
  quantity: number;
  discount: number;
};

export default function POSPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: loadingProducts } = useQuery(trpc.products.list.queryOptions());
  const { data: categoriesData = [], isLoading: loadingCategories } = useQuery(trpc.categories.list.queryOptions());
  const { data: customers = [], isLoading: loadingCustomers } = useQuery(trpc.customers.list.queryOptions());
  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery(trpc.paymentMethods.list.queryOptions());
  const { data: storeSettings, isLoading: loadingSettings } = useQuery(
    trpc.settings.getStoreSettings.queryOptions()
  );
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const tOrders = useTranslations("orders");
  const locale = useLocale();

  const loading = loadingProducts || loadingCategories || loadingCustomers || loadingMethods || loadingSettings;

  const createOrderMutation = useMutation(
    trpc.orders.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(trpc.orders.list.queryOptions());
        queryClient.invalidateQueries(trpc.products.list.queryOptions());
        setLastSale({
          orderId: data.id,
          items: [...selectedProducts],
          total,
          totalDiscount: selectedProducts.reduce((sum, p) => sum + p.discount, 0),
          customerName: selectedCustomer?.name ?? "",
          paymentMethodName: paymentMethod?.name ?? "",
        });
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
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [lastSale, setLastSale] = useState<{
    orderId: number;
    items: POSProduct[];
    total: number;
    totalDiscount: number;
    customerName: string;
    paymentMethodName: string;
  } | null>(null);

  const createDefaultCustomer = useMutation(
    trpc.customers.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(trpc.customers.list.queryOptions());
        setSelectedCustomer({ id: data.id, name: data.name });
      }
    })
  );

  // Auto-select defaults
  const hasTriggeredCustomerCreate = React.useRef(false);

  React.useEffect(() => {
    if (!loadingCustomers) {
      // Find walked-in customer
      const defaultCustomer = customers.find(c => c.name.toLowerCase() === "walked-in customer");
      
      if (defaultCustomer && !selectedCustomer) {
        setSelectedCustomer({ id: defaultCustomer.id, name: defaultCustomer.name });
      } else if (!defaultCustomer && !hasTriggeredCustomerCreate.current) {
        hasTriggeredCustomerCreate.current = true;
        createDefaultCustomer.mutate({
          name: "Walked-in Customer",
          email: `walkin_${Date.now()}@example.com`,
          phone: "0000000000"
        });
      }
    }
  }, [customers, loadingCustomers, selectedCustomer]);

  React.useEffect(() => {
    if (!loadingMethods && !paymentMethod && paymentMethods.length > 0) {
      const defaultMethod = paymentMethods.find(m => m.name.toLowerCase() === "cash" || m.name.toLowerCase() === "dinheiro");
      if (defaultMethod) {
        setPaymentMethod({ id: defaultMethod.id, name: defaultMethod.name });
      } else if (paymentMethods.length > 0) {
        // Fallback to first available if "cash" not found
        setPaymentMethod({ id: paymentMethods[0].id, name: paymentMethods[0].name });
      }
    }
  }, [paymentMethods, loadingMethods, paymentMethod]);

  // Use the new categories table for POS filtering
  const categoriesList = useMemo(() => {
    return categoriesData.map(c => ({ id: c.id, name: c.name }));
  }, [categoriesData]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "all" && String(p.category_id) !== categoryFilter) return false;
      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.category?.name ?? "").toLowerCase().includes(q);
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
          categoryName: product.category?.name ?? "",
          quantity: 1,
          discount: 0,
        },
      ]);
    }
  };

  const handleSelectCustomer = (customerId: number | string) => {
    const customer = customers.find((c) => c.id.toString() === customerId.toString());
    if (customer) setSelectedCustomer({ id: customer.id, name: customer.name });
  };

  const handleSelectPaymentMethod = (paymentMethodId: number | string) => {
    const method = paymentMethods.find((pm) => pm.id.toString() === paymentMethodId.toString());
    if (method) setPaymentMethod({ id: method.id, name: method.name });
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
    (sum, product) => sum + (product.price * product.quantity) - product.discount,
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
        discount: p.discount,
      })),
      total,
    });
  };

  // Get the quantity of a product already in the cart
  const getCartQuantity = (productId: number) => {
    const item = selectedProducts.find((p) => p.id === productId);
    return item?.quantity ?? 0;
  };

  const handleApplyDiscount = (productId: number) => {
    const cents = Math.round(parseFloat(discountInput || "0") * 100);
    if (cents >= 0) {
      setSelectedProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, discount: cents } : p))
      );
    }
    setEditingDiscountId(null);
    setDiscountInput("");
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

  // Sale completion receipt screen
  if (lastSale) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md w-full p-8 rounded-2xl border bg-card shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2Icon className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{t("saleComplete")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("orderRef", { id: String(lastSale.orderId) })}
            </p>
          </div>
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(
              lastSale.total,
              locale,
              storeSettings?.currency as CurrencyCode,
              storeSettings?.lbp_rate
            )}
          </div>
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tOrders("customer")}</span>
              <span className="font-medium">{lastSale.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tOrders("paymentMethod")}</span>
              <span className="font-medium">{lastSale.paymentMethodName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("itemsInCart", { count: lastSale.items.reduce((s, i) => s + i.quantity, 0) })}</span>
              <span className="font-medium">{lastSale.items.length} {t("productsLabel")}</span>
            </div>
            {lastSale.totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("discount")}</span>
                <span className="font-medium text-amber-600">
                  -{formatCurrency(
                    lastSale.totalDiscount,
                    locale,
                    storeSettings?.currency as CurrencyCode,
                    storeSettings?.lbp_rate
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="w-full border-t pt-3 space-y-1 max-h-40 overflow-y-auto">
            {lastSale.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="truncate flex-1">{item.name} × {item.quantity}</span>
                <span className="font-medium tabular-nums ml-2">
                  {formatCurrency(
                    item.price * item.quantity - item.discount,
                    locale,
                    storeSettings?.currency as CurrencyCode,
                    storeSettings?.lbp_rate
                  )}
                </span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => setLastSale(null)}
            size="lg"
            className="w-full h-14 text-lg font-semibold rounded-xl touch-manipulation"
          >
            {t("newTransaction")}
          </Button>
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
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(String(cat.id))}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors touch-manipulation ${
                  categoryFilter === String(cat.id)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {cat.name}
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
              value={selectedCustomer?.name}
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
                  className="flex flex-col gap-1 rounded-lg border bg-background p-2"
                >
                  <div className="flex items-center gap-2">
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
                        {formatCurrency(
                          product.price * product.quantity - product.discount,
                          locale,
                          storeSettings?.currency as CurrencyCode,
                          storeSettings?.lbp_rate
                        )}
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

                    {/* Discount toggle */}
                    <Button
                      variant={product.discount > 0 ? "default" : "ghost"}
                      size="icon"
                      className={`h-8 w-8 shrink-0 touch-manipulation ${
                        product.discount > 0 ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                      }`}
                      onClick={() => {
                        if (editingDiscountId === product.id) {
                          setEditingDiscountId(null);
                          setDiscountInput("");
                        } else {
                          setEditingDiscountId(product.id);
                          setDiscountInput(product.discount > 0 ? (product.discount / 100).toString() : "");
                        }
                      }}
                    >
                      <PercentIcon className="h-3.5 w-3.5" />
                    </Button>

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

                  {/* Discount input row */}
                  {editingDiscountId === product.id && (
                    <div className="flex items-center gap-2 pl-12">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t("discountAmount")}
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyDiscount(product.id);
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-8 touch-manipulation"
                        onClick={() => handleApplyDiscount(product.id)}
                      >
                        {tc("save")}
                      </Button>
                    </div>
                  )}
                  {product.discount > 0 && editingDiscountId !== product.id && (
                    <p className="text-xs text-amber-600 pl-12">
                      {t("discount")}: -
                      {formatCurrency(
                        product.discount,
                        locale,
                        storeSettings?.currency as CurrencyCode,
                        storeSettings?.lbp_rate
                      )}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        <div className="shrink-0 border-t p-3 space-y-3">
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
