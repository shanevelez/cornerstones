import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AgmDashboard() {
  const [metrics, setMetrics] = useState({ monthlyData: [], revenueByTier: [] });
  const [totals, setTotals] = useState({ totalRevenue: 0, totalManNights: 0, cancelRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateMetrics() {
      const { data: allBookings } = await supabase.from('bookings').select('*');
      if (!allBookings) {
        setLoading(false);
        return;
      }

      const approved = allBookings.filter(b => b.status === 'approved');
      const cancelled = allBookings.filter(b => b.status === 'cancelled' || b.status === 'rejected');

      const totalRevenue = approved.reduce((acc, curr) => acc + (curr.total_paid || 0), 0);
      const cancelRate = allBookings.length ? Math.round((cancelled.length / allBookings.length) * 100) : 0;
      
      let totalManNights = 0;
      const monthsMap = {};
      let adultRev = 0, grandChildRev = 0, youngRev = 0;

      approved.forEach(b => {
        const start = new Date(b.check_in);
        const end = new Date(b.check_out);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const totalGuests = (b.adults || 0) + (b.grandchildren_over21 || 0) + (b.children_16plus || 0) + (b.students || 0);
        
        totalManNights += (nights * totalGuests);

        adultRev += (b.breakdown?.adults?.total || 0);
        grandChildRev += (b.breakdown?.grandchildren?.total || 0);
        youngRev += (b.breakdown?.young?.total || 0);

        const monthName = start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        if (!monthsMap[monthName]) {
          monthsMap[monthName] = { name: monthName, 'Nights Booked': 0, 'Man-Nights (Utilization)': 0 };
        }
        monthsMap[monthName]['Nights Booked'] += nights;
        monthsMap[monthName]['Man-Nights (Utilization)'] += (nights * totalGuests);
      });

      setTotals({ totalRevenue, totalManNights, cancelRate });
      setMetrics({
        monthlyData: Object.values(monthsMap),
        revenueByTier: [
          { name: 'Adults (21+)', value: adultRev },
          { name: 'Grandchildren (21+)', value: grandChildRev },
          { name: 'Students / 16+', value: youngRev }
        ]
      });
      setLoading(false);
    }

    calculateMetrics();
  }, []);

  const COLORS = ['#0f2b4c', '#e7b333', '#9ca3af'];

  if (loading) return <p className="text-gray-500">Loading AGM metrics...</p>;

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Realized Income</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">£{totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Wear-and-Tear (Man-Nights)</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totals.totalManNights} Nights</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cancellation Rate</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{totals.cancelRate}%</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm lg:col-span-2">
          <h4 className="text-base font-bold text-gray-900 mb-1">Property Occupancy vs. Density</h4>
          <p className="text-xs text-gray-400 mb-4">Comparing simple nights booked against full headcount wear-and-tear.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Nights Booked" fill="#e7b333" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Man-Nights (Utilization)" fill="#0f2b4c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-1">Revenue Stream Split</h4>
          <p className="text-xs text-gray-400 mb-4">Total cash configurations split across guest categories.</p>
          <div className="h-52 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.revenueByTier}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {metrics.revenueByTier.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `£${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs mt-4">
            {metrics.revenueByTier.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="text-gray-600">{entry.name}</span>
                </div>
                <span className="font-semibold text-gray-900">£{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}