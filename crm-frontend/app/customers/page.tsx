"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getCustomers, getCustomerStats } from "@/lib/api";
import type { Customer, CustomerStats } from "@/types";
import CustomerTable from "@/components/CustomerTable";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Stat { 
  label: string; 
  value: string | number; 
  icon: string; 
  color: string; 
  bg: string;
  trend?: string;
  shadowHover?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats]         = useState<CustomerStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const statsRef                  = useRef<CustomerStats | null>(null);

  const load = useCallback(async (params?: { segment?: string; city?: string; min_spend?: number }) => {
    setLoading(true);
    try {
      const [custs, s] = await Promise.all([
        getCustomers(params),
        statsRef.current ? Promise.resolve(statsRef.current) : getCustomerStats(),
      ]);
      setCustomers(custs);
      if (!statsRef.current) {
        statsRef.current = s as CustomerStats;
        setStats(s as CustomerStats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const statCards: Stat[] = [
    { 
      label: "Total Customers", 
      value: stats?.total_customers ?? "—", 
      icon: "group", 
      color: "text-primary", 
      bg: "bg-primary/10",
      trend: "+12%",
      shadowHover: "hover:shadow-primary/5"
    },
    { 
      label: "Avg Lifetime Spend", 
      value: stats ? formatCurrency(stats.avg_spend) : "—", 
      icon: "payments", 
      color: "text-tertiary", 
      bg: "bg-tertiary/10",
      trend: "+5.2%",
      shadowHover: "hover:shadow-tertiary/5"
    },
    { 
      label: "At Risk", 
      value: stats?.by_segment["at_risk"] ?? "—", 
      icon: "warning", 
      color: "text-error", 
      bg: "bg-error/10",
      trend: "-2.1%",
      shadowHover: "hover:shadow-error/5"
    },
    { 
      label: "New This Month", 
      value: stats?.by_segment["new"] ?? "—", 
      icon: "person_add", 
      color: "text-secondary", 
      bg: "bg-secondary/10",
      trend: "+18%",
      shadowHover: "hover:shadow-secondary/5"
    },
  ];

  return (
    <div className="pt-8 pb-32 px-4 lg:px-0 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-headline-lg text-3xl md:text-5xl font-bold text-on-surface tracking-tight">Customers</h1>
        <p className="text-on-surface-variant mt-2">Manage and analyze your global customer base with precision.</p>
      </div>

      {/* Stat Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map(({ label, value, icon, color, bg, trend, shadowHover }) => (
          <div key={label} className={cn("glass-panel ghost-border rounded-xl p-6 shadow-lg transition-all duration-300 group", shadowHover)}>
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2 rounded-lg", bg, color)}>
                <span className="material-symbols-outlined">{icon}</span>
              </div>
              <span className={cn("text-xs font-bold", color)}>{trend}</span>
            </div>
            <h3 className="text-on-surface-variant text-xs font-label-sm uppercase tracking-widest">{label}</h3>
            <p className="text-3xl font-bold text-on-surface mt-1">{value}</p>
            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full w-2/3", bg.replace("/10", ""))}></div>
            </div>
          </div>
        ))}
      </section>

      <CustomerTable
        customers={customers}
        onFilter={load}
        cities={stats?.cities ?? []}
        loading={loading}
      />
    </div>
  );
}
