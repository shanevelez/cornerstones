import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function BookkeeperReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getTaxReport() {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, guest_name, check_in, check_out, family_member, total_paid, breakdown')
        .eq('status', 'approved');

      if (!error && bookings) {
        setData(bookings);
      }
      setLoading(false);
    }
    getTaxReport();
  }, []);

  const exportToCSV = () => {
    const headers = ['Booking ID', 'Guest Name', 'Check In', 'Check Out', 'Nights', 'Classification', 'Guest Total', 'Cleaning Fee', 'Grand Total'];
    
    const rows = data.map(b => {
      const nights = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
      const guestTotal = (b.breakdown?.adults?.total || 0) + (b.breakdown?.grandchildren?.total || 0) + (b.breakdown?.young?.total || 0);
      
      return [
        b.id,
        `"${b.guest_name}"`,
        b.check_in,
        b.check_out,
        nights,
        b.family_member ? 'Family' : 'Standard',
        guestTotal,
        b.breakdown?.cleaning || 40,
        b.total_paid
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trust_ledger_export_${new Date().getFullYear()}.csv`);
    link.click();
  };

  if (loading) return <p className="text-gray-500">Loading ledger data...</p>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center p-5 bg-gray-50 border-b border-gray-200">
        <div>
          <h4 className="text-base font-bold text-gray-900">Historical Audit Records</h4>
          <p className="text-xs text-gray-500">Delineated breakdown records for annual ledger reconciliations.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-md text-sm font-medium transition shadow-sm"
        >
          Export to Excel (.CSV)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-left text-gray-500">
          <thead className="text-gray-700 uppercase bg-gray-100/70 border-b">
            <tr>
              <th className="px-5 py-3">Guest Reference</th>
              <th className="px-5 py-3">Classification</th>
              <th className="px-5 py-3 text-right">Guest Fees</th>
              <th className="px-5 py-3 text-right">Cleaning Fees</th>
              <th className="px-5 py-3 text-right">Total Contributed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map(b => {
              const guestTotal = (b.breakdown?.adults?.total || 0) + (b.breakdown?.grandchildren?.total || 0) + (b.breakdown?.young?.total || 0);
              return (
                <tr key={b.id} className="hover:bg-gray-50/80">
                  <td className="px-5 py-3 font-medium text-gray-900">{b.guest_name}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${b.family_member ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {b.family_member ? 'Family Core' : 'Standard Guest'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-gray-600">£{guestTotal}</td>
                  <td className="px-5 py-3 text-right font-mono text-gray-600">£{b.breakdown?.cleaning || 40}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-gray-900">£{b.total_paid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}