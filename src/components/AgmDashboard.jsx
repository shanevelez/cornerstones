import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AgmDashboard() {
  const [metrics, setMetrics] = useState([]);
  const [totals, setTotals] = useState({ totalRevenue: 0, avgOccupancy: 0, lostRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateAdvancedMetrics() {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'approved');

      if (!bookings) {
        setLoading(false);
        return;
      }

      // Initialize a calendar baseline for the last 12 months dynamically
      const monthsMap = {};
      const today = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        
        monthsMap[monthKey] = {
          name: monthKey,
          daysInMonth,
          bookedDays: 0,
          actualRevenue: 0,
          guestNights: 0,
          // Max Potential assume a standard average family footprint of 2 adults, 2 young adults + cleaning fee per weekly cycle
          // Let's baseline max capacity conservatively as a full occupancy standard rate baseline (£40/night for adults)
          potentialRevenue: daysInMonth * 40 
        };
      }

      let totalRevenue = 0;

      // Map over approved bookings and cleanly attribute metrics to the precise month bucket
      bookings.forEach(b => {
        const start = new Date(b.check_in);
        const end = new Date(b.check_out);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const totalGuests = (b.adults || 0) + (b.grandchildren_over21 || 0) + (b.children_16plus || 0) + (b.students || 0);
        
        totalRevenue += (b.total_paid || 0);

        const monthKey = start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        
        if (monthsMap[monthKey]) {
          monthsMap[monthKey].bookedDays += nights;
          monthsMap[monthKey].actualRevenue += (b.total_paid || 0);
          monthsMap[monthKey].guestNights += (nights * totalGuests);
        }
      });

      // Compute final calculations for percentages and revenue leaks
      const monthlyDataArray = Object.values(monthsMap).map(m => {
        const occupancyRate = Math.min(Math.round((m.bookedDays / m.daysInMonth) * 100), 100);
        const vacancyRate = 100 - occupancyRate;
        
        // Lost revenue is evaluated as the vacancy percentage multiplied by the baseline opportunity cost
        const lostRev = Math.round((vacancyRate / 100) * m.potentialRevenue);

        return {
          ...m,
          'Occupancy %': occupancyRate,
          'Vacancy Days': m.daysInMonth - m.bookedDays,
          'Revenue Leakage': lostRev,
          'Realized Income': m.actualRevenue
        };
      });

      const totalOccupancySum = monthlyDataArray.reduce((acc, curr) => acc + curr['Occupancy %'], 0);
      const totalLostRevenue = monthlyDataArray.reduce((acc, curr) => acc + curr['Revenue Leakage'], 0);
      const avgOccupancy = Math.round(totalOccupancySum / monthlyDataArray.length);

      setTotals({ totalRevenue, avgOccupancy, lostRevenue: totalLostRevenue });
      setMetrics(monthlyDataArray);
      setLoading(false);
    }

    calculateAdvancedMetrics();
  }, []);

  if (loading) return <p className="text-gray-500">Compiling advanced trust analytics...</p>;

  return (
    <div className="space-y-8">
      {/* KPI Highlight Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Annual Realized Income</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">£{totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Year-Round Occupancy</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{totals.avgOccupancy}%</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estimated Revenue Leakage</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">£{totals.lostRevenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Percentage Occupancy & Unbooked Days Tracking */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-1">Calendar Occupancy Timeline</h4>
          <p className="text-xs text-gray-400 mb-4">Identifies the most unbooked months and baseline usage density over time.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => name === 'Occupancy %' ? `${value}%` : `${value} Days`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Occupancy %" fill="#e7b333" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Vacancy Days" fill="#9ca3af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Revenue Leakage vs Realized Income */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-1">Financial Opportunity Loss (Revenue Leakage)</h4>
          <p className="text-xs text-gray-400 mb-4">Visualizes where the trust loses asset value due to calendar vacancies.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit="£" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `£${value.toLocaleString()}`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Realized Income" stroke="#0f2b4c" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Revenue Leakage" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}