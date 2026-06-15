"use client";

import { useState, useCallback } from "react";
import type { Customer } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CustomerTableProps {
  customers: Customer[];
  onFilter: (params: { segment?: string; city?: string; min_spend?: number }) => void;
  cities: string[];
  loading?: boolean;
}

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const colors = [
    ["#7c3aed", "#5b21b6"],
    ["#4f46e5", "#3730a3"],
    ["#0891b2", "#0e7490"],
    ["#059669", "#047857"],
    ["#d97706", "#b45309"],
    ["#dc2626", "#b91c1c"],
    ["#db2777", "#be185d"],
  ];
  const idx = name.charCodeAt(0) % colors.length;
  const [from, to] = colors[idx];

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 border border-white/10"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {initials}
    </div>
  );
}

function SegmentBadge({ tag }: { tag: string }) {
  if (tag === "vip" || tag === "high_value") {
    return <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/20">VIP</span>;
  }
  if (tag === "at_risk") {
    return <span className="bg-error-container/20 text-error px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-error/20">Churn Risk</span>;
  }
  return <span className="bg-secondary-container/20 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-secondary/20">Regular</span>;
}

export default function CustomerTable({ customers, onFilter, cities, loading }: CustomerTableProps) {
  const [search, setSearch]     = useState("");
  const [segment, setSegment]   = useState("");
  const [city, setCity]         = useState("");
  const [minSpend, setMinSpend] = useState("");

  const handleFilter = useCallback(() => {
    onFilter({
      segment:   segment   || undefined,
      city:      city      || undefined,
      min_spend: minSpend ? Number(minSpend) : undefined,
    });
  }, [segment, city, minSpend, onFilter]);

  const filtered = customers.filter(c =>
    search
      ? c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <>
      {/* Filter Bar */}
      <section className="glass-panel ghost-border rounded-xl p-4 mb-8 overflow-x-auto custom-scrollbar">
        <div className="flex flex-nowrap lg:flex-wrap items-center gap-4 min-w-max lg:min-w-0">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input 
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-lowest border-none rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/50" 
              placeholder="Search customers..." 
              type="text"
            />
          </div>
          
          <div className="relative">
            <select value={segment} onChange={(e) => setSegment(e.target.value)} className="bg-surface-container-lowest border-none rounded-lg px-4 py-2.5 text-sm text-on-surface-variant focus:ring-2 focus:ring-primary/50 appearance-none pr-10 min-w-[140px]">
              <option value="">All Segments</option>
              <option value="high_value">VIP</option>
              <option value="regular">Regular</option>
              <option value="at_risk">Churn Risk</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">expand_more</span>
          </div>

          <div className="relative">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-surface-container-lowest border-none rounded-lg px-4 py-2.5 text-sm text-on-surface-variant focus:ring-2 focus:ring-primary/50 appearance-none pr-10 min-w-[140px]">
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs">expand_more</span>
          </div>

          <div className="flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 text-sm text-on-surface-variant">
            <span className="mr-2 text-xs">$ Min Spend</span>
            <input 
              value={minSpend} onChange={(e) => setMinSpend(e.target.value)}
              className="w-16 bg-transparent border-none p-0 focus:ring-0 text-on-surface text-sm" 
              type="number" 
              placeholder="0"
            />
          </div>

          <button onClick={handleFilter} className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg shadow-primary/20">
            Apply
          </button>
        </div>
      </section>

      {/* Customer Table */}
      <section className="glass-panel ghost-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-on-surface-variant text-label-sm font-label-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Customer</th>
                <th className="px-6 py-4 font-bold">City</th>
                <th className="px-6 py-4 font-bold">Segment</th>
                <th className="px-6 py-4 font-bold text-right">Total Spend</th>
                <th className="px-6 py-4 font-bold">Last Purchase</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant text-sm">Loading customers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant text-sm">No customers found.</td></tr>
              ) : (
                filtered.map(customer => (
                  <tr key={customer.id} className="hover:bg-white/[0.03] transition-colors duration-150 group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={customer.name} />
                        <div>
                          <p className="font-bold text-on-surface group-hover:text-primary transition-colors">{customer.name}</p>
                          <p className="text-xs text-on-surface-variant">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant text-sm">{customer.city}</td>
                    <td className="px-6 py-4">
                      <SegmentBadge tag={customer.segment_tag} />
                    </td>
                    <td className="px-6 py-4 text-right text-on-surface font-semibold">{formatCurrency(customer.total_spend)}</td>
                    <td className="px-6 py-4 text-on-surface-variant text-sm">{formatDate(customer.last_purchase_date)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-on-surface-variant hover:text-primary">
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-white/5 px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">Showing {filtered.length} of {customers.length} customers</span>
        </div>
      </section>
    </>
  );
}
