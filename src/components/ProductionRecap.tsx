import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, GitBranch, Container, Package, Factory, Layers, Percent, Gauge } from 'lucide-react';
import { SupabaseClient } from "@supabase/supabase-js";

interface ProductionRecapData {
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

interface ProductionRecapProps {
  supabaseClient: SupabaseClient | null;
  allLocations: Array<{ id: number; name: string; value: string; is_active: boolean }>;
  locationFilter: string[];
  userRole: string | null;
  currentUserLocations: number[];
}

export default function ProductionRecap({ 
  supabaseClient, 
  allLocations,
  locationFilter,
  userRole,
  currentUserLocations
}: ProductionRecapProps) {
  const [productionData, setProductionData] = useState<ProductionRecapData[]>([]);
  const [isLoadingProduction, setIsLoadingProduction] = useState(true);
  const [viewMode, setViewMode] = useState<'mtd' | 'periodic'>('mtd');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Format: YYYY-MM
  const [selectedLocation, setSelectedLocation] = useState<string>('all'); // 'all' or location name
  const [error, setError] = useState<string | null>(null);

  // Helper function to check if a location is accessible by the current user
  const isLocationAccessible = (locationId: number): boolean => {
    if (userRole === 'SUPERADMIN_ROLE' || userRole === 'BOD_ROLE') {
      return true;
    }
    return currentUserLocations.includes(locationId);
  };

  // Initialize selectedLocation based on user role
  useEffect(() => {
    if (userRole && allLocations.length > 0) {
      if (userRole !== 'SUPERADMIN_ROLE' && userRole !== 'BOD_ROLE') {
        // For restricted roles, default to first accessible location
        const accessibleLocations = allLocations.filter(
          loc => loc.is_active && currentUserLocations.includes(loc.id)
        );
        if (accessibleLocations.length > 0 && selectedLocation === 'all') {
          setSelectedLocation(accessibleLocations[0].name);
        }
      }
    }
  }, [userRole, allLocations, currentUserLocations]);

  // Helper function to safely return 0 for NaN values
  const safeNumber = (num: number): number => {
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  // Helper function to format month name in Indonesian
  const formatMonthName = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Fetch production recap data
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
          .from('production_recap_monthly')
          .select('*')
          .order('month', { ascending: false });

        if (fetchError) {
          console.error('Error fetching production data:', fetchError);
          setError(fetchError.message);
          setProductionData([]);
        } else {
          setProductionData(data || []);
          console.log('Production data fetched:', data?.length || 0, 'records');
        }
      } catch (err) {
        console.error('Error in fetchProductionData:', err);
        setError('Failed to fetch production data');
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

  // Get available locations from data (only locations that have production data)
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

  // Filter data for ALL statistics (including BAHAN BAKU + WIP for statistics only)
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

  // Filter data for display (charts and table) - only FG and TR
  const filteredProductionData = useMemo(() => {
    return allFilteredData.filter(item => 
      item.jenisproduk === 'FG' || item.jenisproduk === 'TR'
    );
  }, [allFilteredData]);



  // Calculate statistics per location
  const statisticsByLocation = useMemo(() => {
    // Group data by location
    const locationGroups = new Map<string, ProductionRecapData[]>();
    
    allFilteredData.forEach(item => {
      const existing = locationGroups.get(item.location) || [];
      locationGroups.set(item.location, [...existing, item]);
    });

    // Calculate statistics for each location
    const result = Array.from(locationGroups.entries()).map(([location, data]) => {
      const endProductQty = data
        .filter(item => item?.jenisproduk === 'FG')
        .reduce((sum, item) => sum + (item?.total_qty || 0), 0);
      
      const turunanQty = data
        .filter(item => item?.jenisproduk === 'TR-BERAS')
        .reduce((sum, item) => sum + (item?.total_qty || 0), 0);
      
      const bahanBakuQty = data
        .filter(item => item?.jenisproduk === 'WIP-BERAS')
        .reduce((sum, item) => sum + (item?.total_qty || 0), 0);
      
      const turunanLainQty = data
        .filter(item => item?.jenisproduk === 'TR-LAIN')
        .reduce((sum, item) => sum + (item?.total_qty || 0), 0);

      const endProductTon = Math.round((endProductQty || 0) / 1000); // Convert to TON and round
      const turunanTon = Math.round((turunanQty || 0) / 1000); // Convert to TON and round
      const bahanBakuTon = Math.round(Math.abs(bahanBakuQty || 0) / 1000); // Convert to TON and round
      const turunanLainTon = Math.round((turunanLainQty || 0) / 1000); // Convert to TON and round
      
      // Calculate Rendemen FG = (Total Produksi / Pemakaian Bahan Baku) * 100
      const rendemenPercentage = bahanBakuTon > 0 
        ? safeNumber((endProductTon / bahanBakuTon) * 100)
        : 0;
      
      // Calculate Rendemen Turunan Beras = (Turunan Beras / Pemakaian Bahan Baku) * 100
      const rendemenTurunanBeras = bahanBakuTon > 0 
        ? safeNumber((turunanTon / bahanBakuTon) * 100)
        : 0;
      
      // Calculate Rendemen Turunan Lain = (Turunan Lain / Pemakaian Bahan Baku) * 100
      const rendemenTurunanLain = bahanBakuTon > 0 
        ? safeNumber((turunanLainTon / bahanBakuTon) * 100)
        : 0;

      return {
        location,
        locationId: data[0]?.m_location_id,
        endProductQty: endProductTon,
        turunanQty: turunanTon,
        bahanBakuQty: bahanBakuTon,
        turunanLainQty: turunanLainTon,
        rendemenPercentage: safeNumber(rendemenPercentage),
        rendemenTurunanBeras: safeNumber(rendemenTurunanBeras),
        rendemenTurunanLain: safeNumber(rendemenTurunanLain)
      };
    });

    // Sort by location name
    return result.sort((a, b) => a.location.localeCompare(b.location));
  }, [allFilteredData]);

  // Get unique products for legend
  const uniqueProducts = useMemo(() => {
    return Array.from(new Set(filteredProductionData.map(item => item.jenisproduk))).sort();
  }, [filteredProductionData]);

  // Color palette for charts
  const getProductColor = (product: string, index: number) => {
    const colors = [
      '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac',
      '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4',
      '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'
    ];
    return colors[index % colors.length];
  };

  const getLocationColor = (location: string, index: number) => {
    const colors = [
      '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac',
      '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'
    ];
    return colors[index % colors.length];
  };

  // Format number with locale
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0,0';
    }
    return num.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-green-800 flex items-center gap-2">
            <Package className="w-6 h-6" />
            Produksi FG
          </h1>
          {/* <p className="text-sm text-gray-600 mt-1">
            {viewMode === 'mtd' 
              ? 'Month-to-Date (MTD)' 
              : selectedMonth ? formatMonthName(selectedMonth + '-01') : 'Pilih Bulan'}
          </p> */}
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
                {(userRole === 'SUPERADMIN_ROLE' || userRole === 'BOD_ROLE') && (
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                )}
                {availableLocations.map((location) => {
                  const locationData = allLocations.find(loc => loc.name === location);
                  const isAccessible = locationData ? isLocationAccessible(locationData.id) : true;
                  return (
                    <SelectItem 
                      key={location} 
                      value={location}
                      disabled={!isAccessible}
                      className={!isAccessible ? 'text-gray-400' : ''}
                    >
                      {location}
                    </SelectItem>
                  );
                })}
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
              <div className="flex items-center gap-2 border-b border-gray-300 pb-2">
                <Factory className="w-5 h-5 text-green-700" />
                <h4 className="text-lg font-bold text-green-800">{locationStats.location}</h4>
              </div>

              {/* Statistics Cards for this Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Total Produksi</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-900 mt-1">
                        {formatNumber(locationStats.endProductQty)} <span className="text-lg sm:text-xl">TON</span>
                      </p>
                      <p className="text-xs text-green-600 mt-1">FG (Finished Goods)</p>
                    </div>
                    <Factory className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 opacity-80" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Turunan Beras</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-1">
                        {formatNumber(locationStats.turunanQty)} <span className="text-lg sm:text-xl">TON</span>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">TR-BERAS</p>
                    </div>
                    <GitBranch className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 opacity-80" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-700 font-medium">Pemakaian Bahan Baku</p>
                      <p className="text-2xl sm:text-3xl font-bold text-orange-900 mt-1">
                        {formatNumber(locationStats.bahanBakuQty)} <span className="text-lg sm:text-xl">TON</span>
                      </p>
                      <p className="text-xs text-orange-600 mt-1">WIP-BERAS</p>
                    </div>
                    <Container className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600 opacity-80" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-teal-700 font-medium">Turunan Lain</p>
                      <p className="text-2xl sm:text-3xl font-bold text-teal-900 mt-1">
                        {formatNumber(locationStats.turunanLainQty)} <span className="text-lg sm:text-xl">TON</span>
                      </p>
                      <p className="text-xs text-teal-600 mt-1">TR-LAIN</p>
                    </div>
                    <Layers className="w-10 h-10 sm:w-12 sm:h-12 text-teal-600 opacity-80" />
                  </div>
                </Card>

              
              </div>
              {/* Rendemen FG Information */}
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-purple-700 font-medium mb-1">Rendemen FG</p>
                    <p className="text-xs text-purple-600 mb-2">Total Produksi / Pemakaian Bahan Baku × 100%</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl sm:text-4xl font-bold text-purple-900">
                        {Math.round(locationStats.rendemenPercentage)}
                      </p>
                      <span className="text-xl sm:text-2xl font-semibold text-purple-700">%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-purple-200 rounded-full p-3">
                      <svg className="w-8 h-8 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Rendemen Turunan Beras Information */}
              <Card className="p-4 bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-sky-700 font-medium mb-1">Rendemen Turunan Beras</p>
                    <p className="text-xs text-sky-600 mb-2">Turunan Beras / Pemakaian Bahan Baku × 100%</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl sm:text-4xl font-bold text-sky-900">
                        {Math.round(locationStats.rendemenTurunanBeras)}
                      </p>
                      <span className="text-xl sm:text-2xl font-semibold text-sky-700">%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-sky-200 rounded-full p-3">
                      <Percent className="w-8 h-8 text-sky-700" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Rendemen Turunan Lain Information */}
              <Card className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-cyan-700 font-medium mb-1">Rendemen Turunan Lain</p>
                    <p className="text-xs text-cyan-600 mb-2">Turunan Lain / Pemakaian Bahan Baku × 100%</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl sm:text-4xl font-bold text-cyan-900">
                        {Math.round(locationStats.rendemenTurunanLain)}
                      </p>
                      <span className="text-xl sm:text-2xl font-semibold text-cyan-700">%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-cyan-200 rounded-full p-3">
                      <Gauge className="w-8 h-8 text-cyan-700" />
                    </div>
                  </div>
                </div>
              </Card>
              
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isLoadingProduction && (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <span className="ml-3 text-gray-600">Memuat data produksi...</span>
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
      {!isLoadingProduction && !error && filteredProductionData.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Tidak ada data produksi</p>
            <p className="text-sm mt-2">
              {viewMode === 'mtd' 
                ? 'Belum ada data produksi untuk bulan ini' 
                : selectedMonth 
                  ? `Belum ada data produksi untuk ${formatMonthName(selectedMonth + '-01')}` 
                  : 'Belum ada data produksi'}
            </p>
          </div>
        </Card>
      )}


    </div>
  );
}
