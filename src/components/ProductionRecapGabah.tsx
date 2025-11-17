import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, Wheat, Factory } from 'lucide-react';
import { SupabaseClient } from "@supabase/supabase-js";

interface ProductionRecapGabahData {
  m_location_id: number;
  location: string;
  month: string;
  jenisproduk: string;
  total_qty: number;
  record_count?: number;
  avg_qty?: number;
  min_qty?: number;
  max_qty?: number;
}

interface ProductionRecapGabahProps {
  supabaseClient: SupabaseClient | null;
  allLocations: Array<{ id: number; name: string; value: string; is_active: boolean }>;
  locationFilter: string[];
  userRole: string | null;
}

export default function ProductionRecapGabah({ 
  supabaseClient, 
  allLocations,
  locationFilter,
  userRole 
}: ProductionRecapGabahProps) {
  const [productionData, setProductionData] = useState<ProductionRecapGabahData[]>([]);
  const [isLoadingProduction, setIsLoadingProduction] = useState(true);
  const [viewMode, setViewMode] = useState<'mtd' | 'periodic'>('mtd');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Format: YYYY-MM
  const [selectedLocation, setSelectedLocation] = useState<string>('all'); // 'all' or location name
  const [error, setError] = useState<string | null>(null);

  // Helper function to format month name in Indonesian
  const formatMonthName = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Fetch production recap gabah data
  useEffect(() => {
    const fetchProductionData = async () => {
      if (!supabaseClient) {
        setIsLoadingProduction(false);
        return;
      }

      try {
        setIsLoadingProduction(true);
        setError(null);

        const { data, error: fetchError } = await supabaseClient
          .from('production_recap_gabah_monthly')
          .select('*')
          .order('month', { ascending: false });

        if (fetchError) {
          console.error('Error fetching production gabah data:', fetchError);
          setError(fetchError.message);
          setProductionData([]);
        } else {
          setProductionData(data || []);
          console.log('Production gabah data fetched:', data?.length || 0, 'records');
        }
      } catch (err) {
        console.error('Error in fetchProductionData:', err);
        setError('Failed to fetch production gabah data');
        setProductionData([]);
      } finally {
        setIsLoadingProduction(false);
      }
    };

    fetchProductionData();
  }, [supabaseClient]);

  // Get available months from data
  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(productionData.map(item => {
      const date = new Date(item.month);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))).sort().reverse(); // Most recent first
    
    return months;
  }, [productionData]);

  // Get available locations from data (only locations that have production gabah data)
  const availableLocations = useMemo(() => {
    const locations = Array.from(new Set(productionData.map(item => item.location)))
      .sort(); // Sort alphabetically
    return locations;
  }, [productionData]);

  // Set default selected month when data loads
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]); // Default to most recent month
    }
  }, [availableMonths, selectedMonth]);

  // Filter data for statistics
  const allFilteredData = useMemo(() => {
    let filtered = [...productionData];

    // Apply local location filter (from dropdown)
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(item => item.location === selectedLocation);
    }

    // Apply date filter based on view mode
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (viewMode === 'mtd') {
      // MTD: Show current month data
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.month);
        return itemDate.getFullYear() === currentYear && 
               itemDate.getMonth() + 1 === currentMonth;
      });
    } else {
      // Periodic: Show selected month only
      if (selectedMonth) {
        const [targetYear, targetMonth] = selectedMonth.split('-').map(Number);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.month);
          return itemDate.getFullYear() === targetYear && 
                 itemDate.getMonth() + 1 === targetMonth;
        });
      }
    }

    return filtered;
  }, [productionData, selectedLocation, viewMode, selectedMonth]);

  // Calculate statistics per location
  const statisticsByLocation = useMemo(() => {
    // Group data by location
    const locationGroups = new Map<string, ProductionRecapGabahData[]>();
    
    allFilteredData.forEach(item => {
      const existing = locationGroups.get(item.location) || [];
      locationGroups.set(item.location, [...existing, item]);
    });

    // Calculate statistics for each location
    const result = Array.from(locationGroups.entries()).map(([location, data]) => {
      // Sum all jenisproduk quantities for total gabah production
      const totalGabahQty = data.reduce((sum, item) => sum + (item?.total_qty || 0), 0);
      const totalGabahTon = Math.round((totalGabahQty || 0) / 1000); // Convert to TON and round

      // Get breakdown by jenisproduk (if needed)
      const byProduct = new Map<string, number>();
      data.forEach(item => {
        const current = byProduct.get(item.jenisproduk) || 0;
        byProduct.set(item.jenisproduk, current + (item?.total_qty || 0));
      });

      return {
        location,
        locationId: data[0]?.m_location_id,
        totalGabahQty: totalGabahTon,
        productBreakdown: Array.from(byProduct.entries()).map(([product, qty]) => ({
          product,
          qty: Math.round(qty / 1000), // Convert to TON
          percentage: totalGabahQty > 0 ? (qty / totalGabahQty) * 100 : 0
        })).sort((a, b) => b.qty - a.qty) // Sort by quantity descending
      };
    });

    // Sort by location name
    return result.sort((a, b) => a.location.localeCompare(b.location));
  }, [allFilteredData]);

  // Format number with locale
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-800 flex items-center gap-2">
            <Wheat className="w-6 h-6" />
            Produksi Gabah
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant={viewMode === 'mtd' ? 'default' : 'outline'}
            onClick={() => setViewMode('mtd')}
            className="flex-1 sm:flex-initial"
          >
            <Calendar className="w-4 h-4 mr-2" />
            MTD
          </Button>
          <Button
            variant={viewMode === 'periodic' ? 'default' : 'outline'}
            onClick={() => setViewMode('periodic')}
            className="flex-1 sm:flex-initial"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Periodik
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Location Filter */}
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Pilih Lokasi
            </label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Lokasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lokasi</SelectItem>
                {availableLocations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter - Only show in Periodic mode */}
          {viewMode === 'periodic' && (
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Pilih Bulan
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bulan..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthName(month + '-01')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Statistics Cards - Separated by Location */}
      {statisticsByLocation.length > 0 && (
        <div className="space-y-6">
          {statisticsByLocation.map((locationStats) => (
            <div key={locationStats.locationId} className="space-y-3">
              {/* Location Header */}
              <div className="flex items-center gap-2 border-b border-amber-300 pb-2">
                <Factory className="w-5 h-5 text-amber-700" />
                <h4 className="text-lg font-bold text-amber-800">{locationStats.location}</h4>
              </div>

              {/* Statistics Cards for this Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Gabah Card */}
                <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-700 font-medium">Total Produksi Gabah</p>
                      <p className="text-2xl sm:text-3xl font-bold text-amber-900 mt-1">
                        {formatNumber(locationStats.totalGabahQty)} <span className="text-lg sm:text-xl">TON</span>
                      </p>
                      <p className="text-xs text-amber-600 mt-1">Semua Jenis</p>
                    </div>
                    <Wheat className="w-10 h-10 sm:w-12 sm:h-12 text-amber-600 opacity-80" />
                  </div>
                </Card>

                {/* Product Breakdown Cards */}
                {locationStats.productBreakdown.slice(0, 5).map((product, idx) => (
                  <Card 
                    key={product.product} 
                    className={`p-4 bg-gradient-to-br ${
                      idx === 0 ? 'from-yellow-50 to-yellow-100 border-yellow-200' :
                      idx === 1 ? 'from-orange-50 to-orange-100 border-orange-200' :
                      idx === 2 ? 'from-lime-50 to-lime-100 border-lime-200' :
                      idx === 3 ? 'from-green-50 to-green-100 border-green-200' :
                      'from-emerald-50 to-emerald-100 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          idx === 0 ? 'text-yellow-700' :
                          idx === 1 ? 'text-orange-700' :
                          idx === 2 ? 'text-lime-700' :
                          idx === 3 ? 'text-green-700' :
                          'text-emerald-700'
                        }`}>{product.product}</p>
                        <p className={`text-2xl sm:text-3xl font-bold mt-1 ${
                          idx === 0 ? 'text-yellow-900' :
                          idx === 1 ? 'text-orange-900' :
                          idx === 2 ? 'text-lime-900' :
                          idx === 3 ? 'text-green-900' :
                          'text-emerald-900'
                        }`}>
                          {formatNumber(product.qty)} <span className="text-lg sm:text-xl">TON</span>
                        </p>
                        <p className={`text-xs mt-1 ${
                          idx === 0 ? 'text-yellow-600' :
                          idx === 1 ? 'text-orange-600' :
                          idx === 2 ? 'text-lime-600' :
                          idx === 3 ? 'text-green-600' :
                          'text-emerald-600'
                        }`}>
                          {Math.round(product.percentage)}% dari total
                        </p>
                      </div>
                      <div className={`rounded-full p-2 ${
                        idx === 0 ? 'bg-yellow-200' :
                        idx === 1 ? 'bg-orange-200' :
                        idx === 2 ? 'bg-lime-200' :
                        idx === 3 ? 'bg-green-200' :
                        'bg-emerald-200'
                      }`}>
                        <Wheat className={`w-8 h-8 ${
                          idx === 0 ? 'text-yellow-700' :
                          idx === 1 ? 'text-orange-700' :
                          idx === 2 ? 'text-lime-700' :
                          idx === 3 ? 'text-green-700' :
                          'text-emerald-700'
                        }`} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoadingProduction && (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <span className="ml-3 text-gray-600">Memuat data produksi gabah...</span>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-800">Error memuat data</h4>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* No Data State */}
      {!isLoadingProduction && !error && allFilteredData.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <Wheat className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Tidak ada data produksi gabah</p>
            <p className="text-sm mt-2">
              {viewMode === 'mtd' 
                ? 'Belum ada data produksi gabah untuk bulan ini' 
                : selectedMonth 
                  ? `Belum ada data produksi gabah untuk ${formatMonthName(selectedMonth + '-01')}` 
                  : 'Belum ada data produksi gabah'}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
