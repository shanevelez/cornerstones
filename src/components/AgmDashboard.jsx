import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AgmDashboard() {
  const [allBookings, setAllBookings] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [totals, setTotals] = useState({ 
    totalRevenue: 0, 
    avgOccupancy: 0, 
    lostRevenue: 0, 
    familyRevenue: 0, 
    standardRevenue: 0,
    cancellationLoss: 0,
    highestNightRate: 0,
    lowestNightRate: 0
  });
  const [avgFootprint, setAvgFootprint] = useState({ adults: 0, grandchildren: 0, young: 0, ratePerNight: 40 });
  const [loading, setLoading] = useState(true);
  
  // Date Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchRawData() {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .in('status', ['approved', 'cancelled']);

      if (bookings) {
        setAllBookings(bookings);
      }
      setLoading(false);
    }
    fetchRawData();
  }, []);

  useEffect(() => {
    if (allBookings.length === 0 && !loading) return;

    // 1. Filter raw data down to your selected calendar scope
    let filtered = [...allBookings];
    if (startDate) filtered = filtered.filter(b => b.check_in >= startDate);
    if (endDate) filtered = filtered.filter(b => b.check_in <= endDate);

    const approvedBookings = filtered.filter(b => b.status === 'approved');
    const cancelledBookings = filtered.filter(b => b.status === 'cancelled');

    // 2. DYNAMIC OPPORTUNITY COST: Calculate average group size for vacant night baselines
    let totalAdultsCount = 0;
    let totalGrandchildrenCount = 0;
    let totalYoungCount = 0;
    
    approvedBookings.forEach(b => {
      totalAdultsCount += (b.adults || 0);
      totalGrandchildrenCount += (b.grandchildren_over21 || 0);
      totalYoungCount += ((b.children_16plus || 0) + (b.students || 0));
    });

    const activeCount = approvedBookings.length || 1;
    const avgAdults = Math.round((totalAdultsCount / activeCount) * 10) / 10;
    const avgGrand = Math.round((totalGrandchildrenCount / activeCount) * 10) / 10;
    const avgYoung = Math.round((totalYoungCount / activeCount) * 10) / 10;

    const derivedNightlyRate = Math.max((avgAdults * 40) + (avgGrand * 40) + (avgYoung * 12), 40);

    setAvgFootprint({
      adults: avgAdults,
      grandchildren: avgGrand,
      young: avgYoung,
      ratePerNight: Math.round(derivedNightlyRate)
    });

    // 3. Map out a Set of EVERY night that has a valid, approved stay (Normalized to Noon)
    const approvedNightsSet = new Set();
    approvedBookings.forEach(b => {
      let currentNight = new Date(b.check_in + 'T12:00:00');
      const endCheckOut = new Date(b.check_out + 'T12:00:00');
      while (currentNight < endCheckOut) {
        approvedNightsSet.add(currentNight.toISOString().split('T')[0]);
        currentNight.setDate(currentNight.getDate() + 1);
      }
    });

    // 4. Dynamically determine the start and end month bounds for the chart axis
    let minDate = startDate ? new Date(startDate + 'T12:00:00') : null;
    let maxDate = endDate ? new Date(endDate + 'T12:00:00') : null;

    if (!minDate || !maxDate) {
      allBookings.forEach(b => {
        const bStart = new Date(b.check_in + 'T12:00:00');
        const bEnd = new Date(b.check_out + 'T12:00:00');
        if (!minDate || bStart < minDate) minDate = bStart;
        if (!maxDate || bEnd > maxDate) maxDate = bEnd;
      });
    }

    if (!minDate) minDate = new Date();
    if (!maxDate) maxDate = new Date();

    let currentIter = new Date(minDate.getFullYear(), minDate.getMonth(), 1, 12, 0, 0);
    const endBound = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1, 12, 0, 0);

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
        potentialRevenue: Math.round(daysInMonth * derivedNightlyRate)
      };
      
      currentIter.setMonth(currentIter.getMonth() + 1);
    }

    let totalRevenue = 0;
    let familyRevenue = 0;
    let standardRevenue = 0;
    let cancellationLoss = 0;
    let highestNightRate = 0;
    let lowestNightRate = Infinity;

    // 5. Distribute approved nights across axis cleanly with normalized midday stamps
    approvedBookings.forEach(b => {
      let currentNight = new Date(b.check_in + 'T12:00:00');
      const endCheckOut = new Date(b.check_out + 'T12:00:00');
      const totalGuests = (b.adults || 0) + (b.grandchildren_over21 || 0) + (b.children_16plus || 0) + (b.students || 0);

      totalRevenue += (b.total_paid || 0);
      if (b.family_member === true) familyRevenue += (b.total_paid || 0);
      else standardRevenue += (b.total_paid || 0);

      const stayNights = Math.ceil((endCheckOut - currentNight) / (1000 * 60 * 60 * 24)) || 1;
      const cleanFee = b.breakdown?.cleaning || 40;
      const dynamicStayNightRate = Math.max(((b.total_paid || 0) - cleanFee) / stayNights, 0);

      if (dynamicStayNightRate > highestNightRate) highestNightRate = dynamicStayNightRate;
      if (dynamicStayNightRate < lowestNightRate) lowestNightRate = dynamicStayNightRate;

      while (currentNight < endCheckOut) {
        const monthKey = currentNight.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        if (monthsMap[monthKey]) {
          monthsMap[monthKey].bookedDays += 1;
          monthsMap[monthKey].guestNights += totalGuests;
        }
        currentNight.setDate(currentNight.getDate() + 1);
      }

      const checkInMonthKey = new Date(b.check_in + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (monthsMap[checkInMonthKey]) {
        monthsMap[checkInMonthKey].actualRevenue += (b.total_paid || 0);
      }
    });

    if (lowestNightRate === Infinity) lowestNightRate = 0;

    // 6. Unroll cancelled bookings (Normalized to Noon)
    cancelledBookings.forEach(b => {
      let currentNight = new Date(b.check_in + 'T12:00:00');
      const endCheckOut = new Date(b.check_out + 'T12:00:00');
      
      const start = new Date(b.check_in + 'T12:00:00');
      const end = new Date(b.check_out + 'T12:00:00');
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
      const nightlyValueLost = Math.max(((b.total_paid || 0) - (b.breakdown?.cleaning || 40)) / nights, 0);

      while (currentNight < endCheckOut) {
        const dateStr = currentNight.toISOString().split('T')[0];
        if (!approvedNightsSet.has(dateStr)) {
          cancellationLoss += nightlyValueLost;
        }
        currentNight.setDate(currentNight.getDate() + 1);
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

    setTotals({ 
      totalRevenue, 
      avgOccupancy, 
      lostRevenue: totalLostRevenue, 
      familyRevenue, 
      standardRevenue, 
      cancellationLoss: Math.round(cancellationLoss),
      highestNightRate: Math.round(highestNightRate),
      lowestNightRate: Math.round(lowestNightRate)
    });
    setMetrics(monthlyDataArray);
  }, [startDate, endDate, allBookings, loading]);

  if (loading) return <p className="text-gray-500">Compiling trust analytics...</p>;

  return (
    <div className="space-y-6">
      {/* Filter Layout Controls Card */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-4">
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

        {/* Split Revenue Summary KPIs */}
        <div className="flex items-center gap-4 text-xs font-medium border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
          <div className="text-right">
            <span className="text-gray-400 block uppercase tracking-wider text-[10px]">Family</span>
            <span className="text-blue-600 font-bold text-sm">£{totals.familyRevenue.toLocaleString()}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 block uppercase tracking-wider text-[10px]">Non-Family</span>
            <span className="text-amber-600 font-bold text-sm">£{totals.standardRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* KPI Highlight Rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Income Yield</p>
          <p className="text-xl font-bold text-gray-900 mt-1">£{totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Occupancy</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{totals.avgOccupancy}%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vacancy Loss</p>
          <p className="text-xl font-bold text-amber-600 mt-1">£{totals.lostRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Cancel Loss</p>
          <p className="text-xl font-bold text-red-600 mt-1">£{totals.cancellationLoss.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200 shadow-sm">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Max Night Rate</p>
          <p className="text-xl font-bold text-blue-800 mt-1">£{totals.highestNightRate}/n</p>
        </div>
        <div className="bg-amber-50/40 p-4 rounded-lg border border-amber-200 shadow-sm">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Min Night Rate</p>
          <p className="text-xl font-bold text-amber-800 mt-1">£{totals.lowestNightRate}/n</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Percentage Occupancy */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
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
          <p className="text-xs text-gray-500 mt-4 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100">
            <strong>Timeline Breakdown:</strong> Tracks the actual nights the property is utilized each month vs. the remaining vacant nights. Cross-month visits are split dynamically across individual nights to preserve mathematical precision and eliminate artificial layout distortions.
          </p>
        </div>

        {/* Chart 2: Revenue Leakage */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
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
          <p className="text-xs text-gray-500 mt-4 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100">
            <strong>Calculation Insight:</strong> Vacancy loss tracks opportunity cost based on an average booking profile of <strong>{avgFootprint.adults} Adults</strong>, setting a baseline of <strong>£{avgFootprint.ratePerNight}/night</strong>. The <em>Lost to Cancellations</em> card isolates nights explicitly dropped by group cancellations that were never filled by subsequent approved stays.
          </p>
        </div>
      </div>
    </div>
  );
}