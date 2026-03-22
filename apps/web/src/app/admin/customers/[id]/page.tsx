"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { formatCurrency, type CurrencyCode } from "@/lib/utils";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ShoppingCartIcon,
  ChevronDownIcon,
  Loader2Icon,
  UserCircleIcon,
  BarChart3Icon
} from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

export default function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const trpc = useTRPC();
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { data: storeSettings, isLoading: loadingSettings } = useQuery(
    trpc.settings.getStoreSettings.queryOptions()
  );

  const unwrappedParams = use(params);
  const customerId = Number(unwrappedParams.id);

  const { data: customer, isLoading, error } = useQuery(
    trpc.customers.getDetails.queryOptions({ id: customerId })
  );

  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  if (isLoading || loadingSettings) {
    return (
      <div className="space-y-6 p-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">{error?.message ?? "Customer not found"}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            {tc("back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-2 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0 h-10 w-10 rounded-xl">
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {customer.name}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                customer.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {customer.status === "active" ? tc("active") : tc("inactive")}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">ID: {customer.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Info Card */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-muted-foreground" />
              {t("customerDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
                <MailIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("email")}</p>
                <p className="text-sm font-medium">{customer.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <PhoneIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("phone")}</p>
                <p className="text-sm font-medium">{customer.phone || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("memberSince")}</p>
                <p className="text-sm font-medium">
                  {customer.created_at ? new Date(customer.created_at).toLocaleDateString(locale) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3Icon className="h-5 w-5 text-muted-foreground" />
              {t("purchaseStats")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 h-full">
            <div className="flex flex-col justify-center items-center p-4 bg-muted/50 rounded-xl border border-dashed text-center">
              <ShoppingBagIcon className="h-6 w-6 text-primary mb-2" />
              <span className="text-2xl font-bold">{customer.totalOrders}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                {t("totalOrders")}
              </span>
            </div>
            <div className="flex flex-col justify-center items-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800 text-center">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(
                  customer.totalSpent,
                  locale,
                  storeSettings?.currency as CurrencyCode,
                  storeSettings?.lbp_rate
                )}
              </p>
              <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider font-semibold mt-1">
                {t("totalSpent")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <div>
        <h2 className="text-xl font-bold mb-4">{t("purchaseHistory")}</h2>

        {customer.orders.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 flex flex-col items-center text-muted-foreground h-48 justify-center shadow-sm">
            <ShoppingCartIcon className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">{t("noPurchaseHistory")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customer.orders.map((order) => (
              <div key={order.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors touch-manipulation"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <ShoppingBagIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left flex flex-col gap-0.5">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {tc("order")} #{order.id}
                        {order.status === "completed" ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded uppercase">
                            {tc("completed")}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-muted text-muted-foreground font-bold px-1.5 py-0.5 rounded uppercase">
                            {order.status}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {order.created_at ? new Date(order.created_at).toLocaleString(locale) : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pr-1">
                    <span className="font-bold tabular-nums text-base">
                      {formatCurrency(
                        order.total_amount,
                        locale,
                        storeSettings?.currency as CurrencyCode,
                        storeSettings?.lbp_rate
                      )}
                    </span>
                    <div className="bg-muted p-1 rounded-md">
                      <ChevronDownIcon
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          expandedOrderId === order.id ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {expandedOrderId === order.id && (
                  <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
                    {order.orderItems && order.orderItems.length > 0 ? (
                      order.orderItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm py-1.5 px-2 rounded-md hover:bg-card">
                          <div className="flex font-medium">
                            <span className="w-8 text-muted-foreground tabular-nums text-right mr-3">
                              {item.quantity}x
                            </span>
                            <span>{item.product?.name ?? "Unknown Product"}</span>
                          </div>
                          <span className="tabular-nums font-semibold">
                            {formatCurrency(
                              (item.price * item.quantity) - item.discount,
                              locale,
                              storeSettings?.currency as CurrencyCode,
                              storeSettings?.lbp_rate
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-3 text-center italic">
                        No items recorded
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
