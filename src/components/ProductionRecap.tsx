import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
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
  const [groupBy, setGroupBy] = useState<'location' | 'product'>('location');
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

  // Filter data based on location filter and view mode
  const filteredProductionData = useMemo(() => {
    let filtered = [...productionData];

    // Filter only END PRODUCT and TURUNAN (exclude BAHAN BAKU + WIP)
    filtered = filtered.filter(item => 
      item.jenisproduk === 'END PRODUCT' || item.jenisproduk === 'TURUNAN'
    );

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

  // Process data for charts - Group by location
  const chartDataByLocation = useMemo(() => {
    if (filteredProductionData.length === 0) return [];

    const grouped = filteredProductionData.reduce((acc, item) => {
      const key = `${item.location}_${item.period_date}`;
      
      if (!acc[key]) {
        acc[key] = {
          location: item.location,
          period: new Date(item.period_date).toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'short' 
          }),
          periodDate: item.period_date,
          totalQty: 0,
          products: {}
        };
      }
      
      acc[key].totalQty += item.qty;
      
      if (!acc[key].products[item.jenisproduk]) {
        acc[key].products[item.jenisproduk] = 0;
      }
      acc[key].products[item.jenisproduk] += item.qty;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime()
    );
  }, [filteredProductionData]);

  // Process data for charts - Group by product
  const chartDataByProduct = useMemo(() => {
    if (filteredProductionData.length === 0) return [];

    const grouped = filteredProductionData.reduce((acc, item) => {
      const key = `${item.jenisproduk}_${item.period_date}`;
      
      if (!acc[key]) {
        acc[key] = {
          product: item.jenisproduk,
          period: new Date(item.period_date).toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'short' 
          }),
          periodDate: item.period_date,
          totalQty: 0,
          locations: {}
        };
      }
      
      acc[key].totalQty += item.qty;
      
      if (!acc[key].locations[item.location]) {
        acc[key].locations[item.location] = 0;
      }
      acc[key].locations[item.location] += item.qty;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime()
    );
  }, [filteredProductionData]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalQty = filteredProductionData.reduce((sum, item) => sum + item.qty, 0);
    const uniqueProducts = new Set(filteredProductionData.map(item => item.jenisproduk)).size;
    const uniqueLocations = new Set(filteredProductionData.map(item => item.location)).size;
    const positiveQty = filteredProductionData.filter(item => item.qty > 0).reduce((sum, item) => sum + item.qty, 0);
    const negativeQty = filteredProductionData.filter(item => item.qty < 0).reduce((sum, item) => sum + Math.abs(item.qty), 0);

    return {
      totalQty,
      uniqueProducts,
      uniqueLocations,
      positiveQty,
      negativeQty,
      netQty: positiveQty - negativeQty
    };
  }, [filteredProductionData]);

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
  const formatNumber = (num: number) => {
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
            
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tampilkan Berdasarkan
              </label>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as 'location' | 'product')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Lokasi</SelectItem>
                  <SelectItem value="product">Jenis Produk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Total Produksi Akhir</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-900 mt-1">
                {formatNumber(statistics.totalQty)}
              </p>
              <p className="text-xs text-green-600 mt-1">END PRODUCT + TURUNAN</p>
            </div>
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 opacity-80" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Produksi (+)</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-1">
                {formatNumber(statistics.positiveQty)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 opacity-80" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 font-medium">Penyesuaian (-)</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-900 mt-1">
                {formatNumber(statistics.negativeQty)}
              </p>
            </div>
            <TrendingDown className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600 opacity-80" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Jenis Produk</p>
              <p className="text-2xl sm:text-3xl font-bold text-purple-900 mt-1">
                {statistics.uniqueProducts}
              </p>
            </div>
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600 opacity-80" />
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

      {/* Charts */}
      {!isLoadingProduction && !error && filteredProductionData.length > 0 && (
        <>
          {/* Bar Chart */}
          <Card className="p-4 sm:p-6">
            <h4 className="text-lg font-semibold text-green-800 mb-4">
              Grafik Produksi {groupBy === 'location' ? 'per Lokasi' : 'per Jenis Produk'}
            </h4>
            
            <div className="w-full" style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupBy === 'location' ? chartDataByLocation : chartDataByProduct}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                  <XAxis 
                    dataKey={groupBy === 'location' ? 'location' : 'product'}
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    stroke="#166534"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="#166534"
                    label={{ 
                      value: 'Kuantitas', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { fontSize: 12 }
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f0fdf4', 
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => formatNumber(Number(value))}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    iconType="square"
                  />
                  <Bar 
                    dataKey="totalQty" 
                    name="Total Produksi"
                    radius={[4, 4, 0, 0]}
                  >
                    {(groupBy === 'location' ? chartDataByLocation : chartDataByProduct).map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={groupBy === 'location' 
                          ? getLocationColor(entry.location, index) 
                          : getProductColor(entry.product, index)
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend for products/locations */}
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-100">
              <h5 className="text-sm font-medium text-green-800 mb-3">
                {groupBy === 'location' ? 'Lokasi:' : 'Jenis Produk:'}
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {groupBy === 'location' 
                  ? chartDataByLocation.map((item: any, index: number) => (
                      <div key={item.location} className="flex items-center space-x-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: getLocationColor(item.location, index) }}
                        />
                        <span className="text-xs text-gray-700 truncate">{item.location}</span>
                      </div>
                    ))
                  : uniqueProducts.map((product: string, index: number) => (
                      <div key={product} className="flex items-center space-x-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: getProductColor(product, index) }}
                        />
                        <span className="text-xs text-gray-700 truncate">{product}</span>
                      </div>
                    ))
                }
              </div>
            </div>
          </Card>

          {/* Detailed Table */}
          <Card className="p-4 sm:p-6">
            <h4 className="text-lg font-semibold text-green-800 mb-4">
              Detail Data Produksi
            </h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-200 bg-green-50">
                    <th className="text-left p-3 font-semibold text-green-800">Lokasi</th>
                    <th className="text-left p-3 font-semibold text-green-800">Jenis Produk</th>
                    <th className="text-left p-3 font-semibold text-green-800">Tanggal</th>
                    <th className="text-right p-3 font-semibold text-green-800">Kuantitas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductionData
                    .sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime())
                    .slice(0, 50) // Limit to 50 rows for performance
                    .map((item, index) => (
                      <tr 
                        key={item.id} 
                        className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="p-3 text-gray-700">{item.location}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {item.jenisproduk}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-600">
                          {new Date(item.period_date).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                        <td className={`p-3 text-right font-medium ${
                          item.qty >= 0 ? 'text-green-700' : 'text-orange-700'
                        }`}>
                          {item.qty >= 0 ? '+' : ''}{formatNumber(item.qty)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {filteredProductionData.length > 50 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Menampilkan 50 dari {filteredProductionData.length} data
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
