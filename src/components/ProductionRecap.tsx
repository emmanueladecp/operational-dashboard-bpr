import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { SupabaseClient } from "@supabase/supabase-js";

interface ProductionRecapData {
  id: number;
  m_location_id: number;
  location: string;
  period_date: string;
  jenisproduk: string;
  qty: number;
  created_at?: string;
  updated_at?: string;
}

interface ProductionRecapProps {
  supabaseClient: SupabaseClient | null;
  allLocations: Array<{ id: number; name: string; value: string; is_active: boolean }>;
  locationFilter: string[];
  userRole: string | null;
}

export default function ProductionRecap({ 
  supabaseClient, 
  allLocations,
  locationFilter,
  userRole 
}: ProductionRecapProps) {
  const [productionData, setProductionData] = useState<ProductionRecapData[]>([]);
  const [isLoadingProduction, setIsLoadingProduction] = useState(true);
  const [viewMode, setViewMode] = useState<'mtd' | 'periodic'>('mtd');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3'); // Default 3 months
  const [error, setError] = useState<string | null>(null);

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
          .from('production_recap')
          .select('*')
          .order('period_date', { ascending: false });

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

  // Filter data for ALL statistics (including BAHAN BAKU + WIP for statistics only)
  const allFilteredData = useMemo(() => {
    let filtered = [...productionData];

    // Apply location filter
    if (!locationFilter.includes('all') && locationFilter.length > 0) {
      const selectedLocationNames = locationFilter
        .map(locValue => allLocations.find(loc => loc.value === locValue)?.name)
        .filter(Boolean);
      
      filtered = filtered.filter(item => 
        selectedLocationNames.includes(item.location)
      );
    }

    // Apply date filter based on view mode
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (viewMode === 'mtd') {
      // MTD: Show current month data
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.period_date);
        return itemDate.getFullYear() === currentYear && 
               itemDate.getMonth() + 1 === currentMonth;
      });
    } else {
      // Periodic: Show last N months
      const monthsToShow = parseInt(selectedPeriod);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToShow);

      filtered = filtered.filter(item => {
        const itemDate = new Date(item.period_date);
        return itemDate >= cutoffDate;
      });
    }

    return filtered;
  }, [productionData, locationFilter, allLocations, viewMode, selectedPeriod]);

  // Filter data for display (charts and table) - only END PRODUCT and TURUNAN
  const filteredProductionData = useMemo(() => {
    return allFilteredData.filter(item => 
      item.jenisproduk === 'END PRODUCT' || item.jenisproduk === 'TURUNAN'
    );
  }, [allFilteredData]);



  // Calculate statistics
  const statistics = useMemo(() => {
    // Total Produksi: Only END PRODUCT (in TON, rounded down)
    const endProductQty = allFilteredData
      .filter(item => item?.jenisproduk === 'END PRODUCT')
      .reduce((sum, item) => sum + (item?.qty || 0), 0);
    
    // TURUNAN: All TURUNAN products (in TON, rounded down)
    const turunanQty = allFilteredData
      .filter(item => item?.jenisproduk === 'TURUNAN')
      .reduce((sum, item) => sum + (item?.qty || 0), 0);
    
    // Pemakaian Bahan Baku: All BAHAN BAKU + WIP (in TON, rounded down)
    const bahanBakuQty = allFilteredData
      .filter(item => item?.jenisproduk === 'BAHAN BAKU + WIP')
      .reduce((sum, item) => sum + (item?.qty || 0), 0);

    return {
      endProductQty: Math.floor((endProductQty || 0) / 1000), // Convert to TON and round down
      turunanQty: Math.floor((turunanQty || 0) / 1000), // Convert to TON and round down
      bahanBakuQty: Math.floor(Math.abs(bahanBakuQty || 0) / 1000) // Convert to TON and round down
    };
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
      return '0';
    }
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-green-800 flex items-center gap-2">
            <Package className="w-6 h-6" />
            Rekap Hasil Produksi Akhir
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {viewMode === 'mtd' ? 'Month-to-Date (MTD)' : `${selectedPeriod} Bulan Terakhir`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            (Hanya END PRODUCT & TURUNAN)
          </p>
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
      {viewMode === 'periodic' && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Periode
              </label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Bulan</SelectItem>
                  <SelectItem value="3">3 Bulan</SelectItem>
                  <SelectItem value="6">6 Bulan</SelectItem>
                  <SelectItem value="12">12 Bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Total Produksi</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-900 mt-1">
                {formatNumber(statistics.endProductQty)} <span className="text-lg sm:text-xl">TON</span>
              </p>
              <p className="text-xs text-green-600 mt-1">END PRODUCT</p>
            </div>
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 opacity-80" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">TURUNAN</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-1">
                {formatNumber(statistics.turunanQty)} <span className="text-lg sm:text-xl">TON</span>
              </p>
              <p className="text-xs text-blue-600 mt-1">Produk Turunan</p>
            </div>
            <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 opacity-80" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 font-medium">Pemakaian Bahan Baku</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-900 mt-1">
                {formatNumber(statistics.bahanBakuQty)} <span className="text-lg sm:text-xl">TON</span>
              </p>
              <p className="text-xs text-orange-600 mt-1">BAHAN BAKU + WIP</p>
            </div>
            <TrendingDown className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600 opacity-80" />
          </div>
        </Card>
      </div>

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
                : `Belum ada data produksi untuk ${selectedPeriod} bulan terakhir`}
            </p>
          </div>
        </Card>
      )}


    </div>
  );
}
