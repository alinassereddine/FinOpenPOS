"use client";

import { useState, useEffect } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@finopenpos/ui/components/select";
import { Label } from "@finopenpos/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@finopenpos/ui/components/card";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2Icon, SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("common");
  
  const { data: settings, isLoading } = useQuery(
    trpc.settings.getStoreSettings.queryOptions()
  );

  const [currency, setCurrency] = useState("USD");
  const [lbpRate, setLbpRate] = useState("89000");

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency);
      setLbpRate(settings.lbp_rate.toString());
    }
  }, [settings]);

  const updateMutation = useMutation(
    trpc.settings.updateStoreSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.settings.getStoreSettings.queryOptions());
        toast.success("Settings saved successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to save settings");
      },
    })
  );

  const handleSave = () => {
    const rate = parseInt(lbpRate, 10);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Please enter a valid exchange rate");
      return;
    }
    
    updateMutation.mutate({
      currency,
      lbp_rate: rate,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-6">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Store Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your store preferences and display configurations
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currency Preferences</CardTitle>
          <CardDescription>
            Configure how prices are displayed across the application. Internal values are always stored in base cents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currency">Display Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency" className="w-full sm:max-w-md">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="BRL">BRL (R$)</SelectItem>
                <SelectItem value="LBP">LBP (LL)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This changes the currency symbol and formatting globally.
            </p>
          </div>

          {currency === "LBP" && (
            <div className="space-y-2">
              <Label htmlFor="lbpRate">LBP Exchange Rate</Label>
              <div className="flex items-center gap-2 w-full sm:max-w-md">
                <span className="text-sm font-medium whitespace-nowrap">1 Base =</span>
                <Input
                  id="lbpRate"
                  type="number"
                  min="1"
                  step="1"
                  value={lbpRate}
                  onChange={(e) => setLbpRate(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm whitespace-nowrap">LBP</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Base prices will be multiplied by this rate before display. Decimals are hidden.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto ml-auto"
          >
            {updateMutation.isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            {t("save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
