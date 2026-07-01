import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AgmDashboard() {
  const [allBookings, setAllBookings] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [totals, setTotals] = useState({ totalRevenue: 0, avgOccupancy: 0, lostRevenue: 0 });
  const [loading, setLoading] = useState(true);
  
  // Date Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchRawData() {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'approved');

      if (bookings) {
        setAllBookings(bookings);
      }
      setLoading(false);
    }
    fetchRawData();
  }, []);

  // Dynamic timeline scale recalibration
  useEffect(() => {
    if (allBookings.length === 0 && !loading) return;

    // 1. Filter bookings by selected date range
    let filtered = [...allBookings];
    if (startDate) filtered = filtered.filter(b => b.check_in >= startDate);
    if (endDate) filtered = filtered.filter(b => b.check_in <= endDate);

    // 2. Dynamically determine the start and end month bounds for the chart axis
    let minDate = startDate ? new Date(startDate) : null;
    let maxDate = endDate ? new Date(endDate) : null;

    // If no dates are selected, default strictly to the span of your existing data
    if (!minDate || !maxDate) {
      allBookings.forEach(b => {
        const bStart = new Date(b.check_in);
        const bEnd = new Date(b.check_out);
        if (!minDate || bStart < minDate) minDate = bStart;
        if (!maxDate || bEnd > maxDate) maxDate = bEnd;
      });
    }

    // Fallback safeguard if database is completely empty
    if (!minDate) minDate = new Date();
    if (!maxDate) maxDate = new Date();

    // Align to the first day of the months
    let currentIter = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endBound = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    // 3. Dynamically generate ONLY the required month buckets
    const monthsMap = {};
    while (currentIter <= endBound) {
      const monthKey = currentIter.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const daysInMonth = new Date(currentIter.getFullYear(), currentIter.getMonth() + 1, 0).getDate();
      
      monthsMap[monthKey] = {
        name: monthKey,
        daysInMonth,
        bookedDays: 0,
        actualRevenue: 0,
        guestNights: 0,
        potentialRevenue: daysInMonth * 40 
      };
      
      // Move forward 1 month
      currentIter.setMonth(currentIter.getMonth() + 1);
    }

    let totalRevenue = 0;

    // 4. Distribute the filtered records across the dynamic axis
    filtered.forEach(b => {
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

    const monthlyDataArray = Object.values(monthsMap).map(m => {
      const occupancyRate = Math.min(Math.round((m.bookedDays / m.daysInMonth) * 100), 100);
      const vacancyRate = 100 - occupancyRate;
      const lostRev = Math.round((vacancyRate / 100) * m.potentialRevenue);

      return {
        ...m,
        'Occupancy %': occupancyRate,
        'Vacancy Days': m.daysInMonth - m.bookedDays,
        'Revenue Leakage': lostRev,
        'Realized Income': m.actualRevenue
      };
    });

    const totalOccupancySum = monthlyDataArray.length ? monthlyDataArray.reduce((acc, curr) => acc + curr['Occupancy %'], 0) : 0;
    const totalLostRevenue = monthlyDataArray.reduce((acc, curr) => acc + curr['Revenue Leakage'], 0);
    const avgOccupancy = monthlyDataArray.length ? Math.round(totalOccupancySum / monthlyDataArray.length) : 0;

    setTotals({ totalRevenue, avgOccupancy, lostRevenue: totalLostRevenue });
    setMetrics(monthlyDataArray);
  }, [startDate, endDate, allBookings, loading]);

  if (loading) return <p className="text-gray-500">Compiling trust analytics...</p>;

  return (
    <div className="space-y-6">
      {/* Filter Layout Controls Card */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 text-sm">
        <span className="font-bold text-gray-700">Filter Analysis Window:</span>
        <div className="flex items-center gap-2">
          <label className="text-gray-500 font-medium">From:</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-gray-500 font-medium">To:</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700"
          />
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs text-red-600 hover:underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* KPI Highlight Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtered Income Yield</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">£{totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Window Occupancy</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{totals.avgOccupancy}%</p>
        </div>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue Leakage</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">£{totals.lostRevenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Percentage Occupancy */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-1">Calendar Occupancy Timeline</h4>
          <p className="text-xs text-gray-400 mb-4">Identifies the most unbooked months and usage density inside the filtered scope.</p>
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

        {/* Chart 2: Revenue Leakage */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-1">Financial Opportunity Loss</h4>
          <p className="text-xs text-gray-400 mb-4">Visualizes where the trust loses potential asset contributions due to calendar gaps.</p>
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