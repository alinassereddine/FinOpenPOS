"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import {
  ShoppingCartIcon,
  DollarSignIcon,
  PackageIcon,
  BarChart3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  TrendingUpIcon,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency, type CurrencyCode } from "@/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/router";

type Order = RouterOutputs["orders"]["list"][number];
type OrderDetail = RouterOutputs["orders"]["get"];

export default function SalesPage() {
  const trpc = useTRPC();
  const { data: orders = [], isLoading } = useQuery(trpc.orders.list.queryOptions());
  const { data: storeSettings, isLoading: loadingSettings } = useQuery(
    trpc.settings.getStoreSettings.queryOptions()
  );
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Fetch details for expanded sale
  const { data: expandedOrder, isLoading: loadingDetail } = useQuery({
    ...trpc.orders.get.queryOptions({ id: expandedSaleId! }),
    enabled: expandedSaleId !== null,
  });

  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === "completed"),
    [orders]
  );

  const isToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate.getTime() === today.getTime();
  }, [selectedDate]);

  const filteredOrders = useMemo(() => {
    const dayStart = selectedDate.getTime();
    const dayEnd = dayStart + 86400000; // +24h
    return completedOrders.filter((o) => {
      if (!o.created_at) return false;
      const t = new Date(o.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
  }, [completedOrders, selectedDate]);

  const allTimeStats = useMemo(
    () => ({
      revenue: completedOrders.reduce((s, o) => s + o.total_amount, 0),
      count: completedOrders.length,
      profit: completedOrders.reduce((s, o) => {
        const cost = o.orderItems?.reduce((cs, i) => cs + (i.cost_price || 0) * i.quantity, 0) || 0;
        return s + (o.total_amount - cost);
      }, 0),
    }),
    [completedOrders]
  );

  const dayStats = useMemo(
    () => ({
      revenue: filteredOrders.reduce((s, o) => s + o.total_amount, 0),
      count: filteredOrders.length,
      avg:
        filteredOrders.length > 0
          ? Math.round(
              filteredOrders.reduce((s, o) => s + o.total_amount, 0) /
                filteredOrders.length
            )
          : 0,
      profit: filteredOrders.reduce((s, o) => {
        const cost = o.orderItems?.reduce((cs, i) => cs + (i.cost_price || 0) * i.quantity, 0) || 0;
        return s + (o.total_amount - cost);
      }, 0),
    }),
    [filteredOrders]
  );

  const handlePrevDay = () => {
    setSelectedDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
    setExpandedSaleId(null);
  };

  const handleNextDay = () => {
    if (!isToday) {
      setSelectedDate((d) => {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return next;
      });
      setExpandedSaleId(null);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
    setExpandedSaleId(null);
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const stats = [
    {
      label: t("daySales"),
      value: dayStats.count,
      icon: ShoppingCartIcon,
      color: "text-blue-500",
    },
    {
      label: t("dayRevenue"),
      value: formatCurrency(
        dayStats.revenue,
        locale,
        storeSettings?.currency as CurrencyCode,
        storeSettings?.lbp_rate
      ),
      icon: DollarSignIcon,
      color: "text-green-500",
    },
    {
      label: tc("grossProfit"),
      value: formatCurrency(
        dayStats.profit,
        locale,
        storeSettings?.currency as CurrencyCode,
        storeSettings?.lbp_rate
      ),
      icon: TrendingUpIcon,
      color: "text-emerald-500",
    },
    {
      label: t("avgSale"),
      value: formatCurrency(
        dayStats.avg,
        locale,
        storeSettings?.currency as CurrencyCode,
        storeSettings?.lbp_rate
      ),
      icon: BarChart3Icon,
      color: "text-purple-500",
    },
  ];

  if (isLoading || loadingSettings) {
    return (
      <div className="space-y-6 p-2">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("allTimeStats", {
            count: String(allTimeStats.count),
            revenue: formatCurrency(
              allTimeStats.revenue,
              locale,
              storeSettings?.currency as CurrencyCode,
              storeSettings?.lbp_rate
            ),
          })}
        </p>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
          onClick={handlePrevDay}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="rounded-xl border bg-card px-5 py-2.5 flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">
            {formatDateLabel(selectedDate)}
          </span>
          {isToday && (
            <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {t("today")}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
          onClick={handleNextDay}
          disabled={isToday}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button variant="link" size="sm" onClick={handleGoToToday}>
            {t("goToToday")}
          </Button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border bg-card p-4 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {t("transactions")} —{" "}
          {selectedDate.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          })}
        </h2>

        {filteredOrders.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 flex flex-col items-center text-muted-foreground">
            <BarChart3Icon className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">{t("noSales")}</p>
            <p className="text-xs">{t("completeSale")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...filteredOrders].reverse().map((sale) => (
              <div
                key={sale.id}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSaleId(
                      expandedSaleId === sale.id ? null : sale.id
                    )
                  }
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <ShoppingCartIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">
                        {tc("completed")} #{sale.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.customer?.name ?? "—"} ·{" "}
                        {sale.created_at
                          ? new Date(sale.created_at).toLocaleTimeString(locale)
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold tabular-nums">
                      {formatCurrency(
                        sale.total_amount,
                        locale,
                        storeSettings?.currency as CurrencyCode,
                        storeSettings?.lbp_rate
                      )}
                    </span>
                    <div className="flex flex-col items-end mr-2">
                       <span className="text-[10px] text-emerald-500 font-medium">
                         +{formatCurrency(
                           sale.total_amount - (sale.orderItems?.reduce((s, i) => s + (i.cost_price || 0) * i.quantity, 0) || 0),
                           locale,
                           storeSettings?.currency as CurrencyCode,
                           storeSettings?.lbp_rate
                         )}
                       </span>
                    </div>
                    <ChevronDownIcon
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedSaleId === sale.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {expandedSaleId === sale.id && (
                  <div className="border-t px-4 pb-3 pt-2 space-y-1">
                    {loadingDetail ? (
                      <div className="flex items-center gap-2 py-2 text-muted-foreground">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{tc("loading")}</span>
                      </div>
                    ) : expandedOrder?.orderItems ? (
                      expandedOrder.orderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <div>
                            <span>{item.product?.name ?? "—"}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              × {item.quantity}
                            </span>
                          </div>
                          <span className="tabular-nums font-medium">
                            {formatCurrency(
                              item.price * item.quantity,
                              locale,
                              storeSettings?.currency as CurrencyCode,
                              storeSettings?.lbp_rate
                            )}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        No items found
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
