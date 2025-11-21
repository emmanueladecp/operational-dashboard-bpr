import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UserButton, useUser, useAuth } from "@clerk/clerk-react";
//import { supabase } from "../lib/supabase";
import { Package, Truck, ShoppingCart, Wheat, Sprout, Scale, MapPin, Plus, Edit, Trash2, Search, Users } from 'lucide-react';
// Add these imports at the top
import { useSession } from "@clerk/clerk-react";
import { createClerkSupabaseClient, resetClerkSupabaseClient } from "../lib/supabase";
import ProductionRecap from "./ProductionRecap";
import ProductionRecapGabah from "./ProductionRecapGabah";

// Cache clearing utility for logout
const clearServiceWorkerCache = async () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    console.log('[Logout] Clearing service worker cache...');

    return new Promise((resolve) => {
      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('[Logout] Cache clearing timeout - proceeding with logout');
        resolve({ timeout: true, message: 'Cache clearing timeout' });
      }, 3000); // 3 second timeout

      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = function(event) {
        clearTimeout(timeout); // Clear timeout on successful response

        if (event.data && event.data.type === 'CACHE_CLEARED') {
          if (event.data.success) {
            console.log('[Logout] Service worker cache cleared successfully:', event.data);
          } else {
            console.warn('[Logout] Service worker cache clearing failed:', event.data.error);
          }
          resolve(event.data);
        } else {
          console.log('[Logout] Unexpected message from service worker:', event.data);
          resolve(event.data);
        }
      };

      messageChannel.port1.onmessageerror = function(error) {
        clearTimeout(timeout); // Clear timeout on error
        console.error('[Logout] Error clearing service worker cache:', error);
        resolve({ error: 'Failed to clear cache', timeout: false });
      };

      // Send cache clear request to service worker
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_CACHE'
          }, [messageChannel.port2]);
        } else {
          clearTimeout(timeout);
          console.error('[Logout] Service worker controller is null');
          resolve({ error: 'Service worker controller is null' });
        }
      } catch (postError) {
        clearTimeout(timeout);
        console.error('[Logout] Failed to send message to service worker:', postError);
        resolve({ error: 'Failed to send message to service worker' });
      }
    });
  } else {
    console.log('[Logout] No active service worker found');
    return Promise.resolve({ message: 'No active service worker' });
  }
};


interface User {
  id: string;
  clerk_id: string;
  name: string;
  role: string;
  locations?: number[];
}

interface Location {
  id: number;
  name: string;
  value: string;
  is_active: boolean;
}

interface SalesSummary {
  period: string; // YYYY-MM format
  m_location_id: number;
  location: string;
  m_product_category_id: number;
  product_category_name: string;
  total_qty_sales: number;
  created_at?: string;
  updated_at?: string;
}

export default function Dashboard() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useAuth();

  // Custom logout handler that clears cache before signing out
  const handleLogout = async () => {
    let logoutButton: HTMLButtonElement | null = null;

    try {
      console.log('[Logout] Starting logout process...');

      // Show loading state or disable button
      logoutButton = document.querySelector('[data-logout-button]') as HTMLButtonElement;
      if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.textContent = 'Clearing Cache...';
      }

      // Clear service worker cache first (with timeout protection)
      console.log('[Logout] Clearing service worker cache...');
      const cacheResult = await clearServiceWorkerCache();

      // Check if cache clearing had issues (type-safe checking)
      if (cacheResult && typeof cacheResult === 'object' && 'timeout' in cacheResult && cacheResult.timeout) {
        console.warn('[Logout] Cache clearing timed out, proceeding with logout anyway');
      } else if (cacheResult && typeof cacheResult === 'object' && 'error' in cacheResult && cacheResult.error) {
        console.warn('[Logout] Cache clearing failed, proceeding with logout anyway:', cacheResult.error);
      } else {
        console.log('[Logout] Cache cleared successfully');
      }

      // Update button text
      if (logoutButton) {
        logoutButton.textContent = 'Signing Out...';
      }

      // Then sign out from Clerk
      console.log('[Logout] Signing out from Clerk...');
      await clerkSignOut();

      console.log('[Logout] Logout process completed successfully');
    } catch (error) {
      console.error('[Logout] Error during logout process:', error);

      // Even if cache clearing fails, still try to sign out
      try {
        await clerkSignOut();
      } catch (signOutError) {
        console.error('[Logout] Error during Clerk sign out:', signOutError);
        alert('Error during logout. Please refresh the page and try again.');
      }
    } finally {
      // Re-enable button in case of any error
      if (logoutButton) {
        logoutButton.disabled = false;
        logoutButton.textContent = 'Logout';
      }
    }
  };

  // Override the default signOut to use our custom handler
  const customSignOut = async () => {
    await handleLogout();
  };
  const [userRole, setUserRole] = useState<'NO_ROLE' | 'SUPERADMIN_ROLE' | 'BOD_ROLE' | 'SALES_MANAGER_ROLE' | 'SALES_SUPERVISOR_ROLE' | 'AUDITOR_ROLE' | null>(null);
  const [currentUserLocations, setCurrentUserLocations] = useState<number[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [stockData, setStockData] = useState<any[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string[]>(['all']);
  const [selectedStockItem, setSelectedStockItem] = useState<any>(null);
  const [isStockDetailDialogOpen, setIsStockDetailDialogOpen] = useState(false);
  const [detailedStockItems, setDetailedStockItems] = useState<any[]>([]);
  const [isLoadingDetailedStock, setIsLoadingDetailedStock] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSortBy, setProductSortBy] = useState('name');
  
  // Sales Summary state variables
  const [salesSummaryData, setSalesSummaryData] = useState<SalesSummary[]>([]);
  const [salesSummaryDataUnfiltered, setSalesSummaryDataUnfiltered] = useState<SalesSummary[]>([]);
  const [isLoadingSalesSummary, setIsLoadingSalesSummary] = useState(true);
  const [salesPeriodFilter, setSalesPeriodFilter] = useState<string[]>([]);
  const [selectedPeriodRange, setSelectedPeriodRange] = useState<string>('3');
  const [salesError, setSalesError] = useState<string | null>(null);
  // Note: locationFilter (shared with Stock BB/FG) is used for sales location filtering

  // Pembelian (Purchases) state variables
  const [pembelianData, setPembelianData] = useState<any[]>([]);
  const [pembelianDataUnfiltered, setPembelianDataUnfiltered] = useState<any[]>([]);
  const [isLoadingPembelian, setIsLoadingPembelian] = useState(true);
  const [pembelianPeriodFilter, setPembelianPeriodFilter] = useState<string[]>([]);
  const [selectedPembelianPeriodRange, setSelectedPembelianPeriodRange] = useState<string>('3');
  const [pembelianError, setPembelianError] = useState<string | null>(null);
  // Note: locationFilter (shared with Stock BB/FG and Sales) is also used for pembelian location filtering

  // Create authenticated client
  const supabaseClient = useMemo(() => {
    if (!session) {
      resetClerkSupabaseClient();
      return null;
    }
    return createClerkSupabaseClient(() => session.getToken());
  }, [session]);

  // Sync user to Supabase if not exists and fetch current user details
  useEffect(() => {
    if (isLoaded && user && supabaseClient) {
      const syncUser = async () => {
        const { data: existingUser, error: fetchError } = await supabaseClient
          .from('users')
          .select('id, name')
          .eq('clerk_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching user:', fetchError);
          return;
        }

        const updateData = {
          name: user.username || user.fullName,
        };

        if (!existingUser) {
          const { error: insertError } = await supabaseClient
            .from('users')
            .insert({ clerk_id: user.id, role: 'NO_ROLE', ...updateData });

          if (insertError) {
            console.error('Error creating user:', insertError);
          }
        } else {
          const { error: updateError } = await supabaseClient
            .from('users')
            .update({ ...updateData })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('Error updating user:', updateError);
          }
        }
      };

      syncUser();
    }
  }, [isLoaded, user, supabaseClient]);

  // Fetch current user role and locations
  useEffect(() => {
    if (isLoaded && user && supabaseClient) {
      const fetchCurrentUser = async () => {
        const { data, error } = await supabaseClient
          .from('users')
          .select('role, locations')
          .eq('clerk_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching current user:', error);
          return;
        }

        if (data) {
          setUserRole(data.role);
          const userLocations = (data.locations || []).map((loc: any) => Number(loc)); // Convert string IDs to numbers
          setCurrentUserLocations(userLocations);
          //console.log('Current User Role:', data.role);
          //console.log('Current User Locations (original):', data.locations, 'Converted:', userLocations);
        }
      };

      fetchCurrentUser();
    }
  }, [isLoaded, user, supabaseClient]);

  // Fetch all users and locations for management (SUPERADMIN only)
  useEffect(() => {
    if (userRole === 'SUPERADMIN_ROLE' && supabaseClient) {
      const fetchData = async () => {
        // Fetch all users
        const { data: usersData, error: usersError } = await supabaseClient
          .from('users')
          .select('*');

        if (usersError) {
          console.error('Error fetching users:', usersError);
          return;
        }

        // Convert string location IDs to numbers for all users
        const processedUsers = (usersData || []).map(user => ({
          ...user,
          locations: user.locations ? user.locations.map((loc: any) => Number(loc)) : []
        }));
        setAllUsers(processedUsers);
        console.log('Users fetched:', processedUsers.length, 'users');
        console.log('User location data:', processedUsers.map(u => ({ name: u.name, locations: u.locations, locationTypes: u.locations?.map((l: any) => typeof l) })));

        // Fetch all locations (including inactive ones for proper display)
        const { data: locationsData, error: locationsError } = await supabaseClient
          .from('master_locations')
          .select('*');

        if (locationsError) {
          console.error('Error fetching locations:', locationsError);
          return;
        }

        // Store all locations for proper lookup, but filter active ones for selection
        const allLocationsData = locationsData || [];
        setAllLocations(allLocationsData);

        // Debug: Log location IDs to help identify issues
        //console.log('All locations fetched:', allLocationsData.map(l => ({ id: l.id, name: l.name, is_active: l.is_active })));
        //console.log('Location 1000007 exists:', allLocationsData.some(l => l.id === 1000007));
        //const location1000007 = allLocationsData.find(l => l.id === 1000007);
        //console.log('Location 1000007 details:', location1000007);
      };

      fetchData();
    }
  }, [userRole, supabaseClient]);

  // Separate effect to fetch locations when supabaseClient is available (for proper lookup)
  useEffect(() => {
    if (supabaseClient && allLocations.length === 0) {
      const fetchLocations = async () => {
        //console.log('Fetching locations for lookup...');
        const { data: locationsData, error: locationsError } = await supabaseClient
          .from('master_locations')
          .select('*');

        if (locationsError) {
          console.error('Error fetching locations for lookup:', locationsError);
          return;
        }

        const allLocationsData = locationsData || [];
        setAllLocations(allLocationsData);
        //console.log('Locations for lookup fetched:', allLocationsData.length, 'locations');
      };

      fetchLocations();
    }
  }, [supabaseClient, allLocations.length]);

  // Fetch stock data from Supabase
  useEffect(() => {
    if (supabaseClient) {
      const fetchStockData = async () => {
        setIsLoadingStock(true);
        try {
          const { data, error } = await supabaseClient
            .from('stock')
            .select('*')
            .order('location')
            .order('name');

          if (error) {
            console.error('Error fetching stock data:', error);
            return;
          }

          setStockData(data || []);
        } catch (error) {
          console.error('Error in fetchStockData:', error);
        } finally {
          setIsLoadingStock(false);
        }
      };

      fetchStockData();
    }
  }, [supabaseClient]);

  // Helper function to get last N months periods in YYYY-MM format
  const getLastNMonthsPeriods = (n: number): string[] => {
    const periods: string[] = [];
    const today = new Date();
    for (let i = 0; i < n; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periods.push(period);
    }
    return periods;
  };

  // Helper function to get period range based on selection
  const getPeriodRange = (range: string): string[] => {
    const n = parseInt(range);
    return getLastNMonthsPeriods(n);
  };

  // Helper function to format period (YYYY-MM) to Indonesian month name and year
  const formatMonthYear = (period: string): string => {
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const [year, month] = period.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  };

  // Initialize default period filter (last 3 months)
  useEffect(() => {
    if (salesPeriodFilter.length === 0) {
      const defaultPeriods = getLastNMonthsPeriods(3);
      setSalesPeriodFilter(defaultPeriods);
    }
  }, [salesPeriodFilter.length]);

  // Initialize default period filter for pembelian (last 3 months)
  useEffect(() => {
    if (pembelianPeriodFilter.length === 0) {
      const defaultPeriods = getLastNMonthsPeriods(3);
      setPembelianPeriodFilter(defaultPeriods);
    }
  }, [pembelianPeriodFilter.length]);

  // Fetch sales summary data from Supabase (unfiltered for filter options)
  useEffect(() => {
    if (supabaseClient && salesPeriodFilter.length > 0) {
      const fetchSalesSummaryData = async () => {
        setIsLoadingSalesSummary(true);
        setSalesError(null);
        try {
          // Fetch unfiltered data (only period filter) for filter options
          const unfilteredQuery = supabaseClient
            .from('sales_summary')
            .select('*')
            .in('period', salesPeriodFilter)
            .order('period', { ascending: false })
            .order('location')
            .order('product_category_name');

          const { data: unfilteredData, error: unfilteredError } = await unfilteredQuery;

          if (unfilteredError) {
            console.error('Error fetching sales summary:', unfilteredError);
            setSalesError('Gagal memuat data penjualan. Silakan refresh halaman.');
            return;
          }

          setSalesSummaryDataUnfiltered(unfilteredData || []);

          // Apply client-side filtering for the table data
          let filteredData = unfilteredData || [];

          // Apply location filter if selected (using shared locationFilter state from Stock BB/FG)
          if (!locationFilter.includes('all') && locationFilter.length > 0) {
            filteredData = filteredData.filter(item => 
              locationFilter.includes(item.location) // Filter by location name (string)
            );
          } else if (locationFilter.length === 0) {
            // If no locations selected, show no data
            filteredData = [];
          }

          setSalesSummaryData(filteredData);
        } catch (error) {
          console.error('Error in fetchSalesSummaryData:', error);
          setSalesError('Terjadi kesalahan saat memuat data penjualan.');
        } finally {
          setIsLoadingSalesSummary(false);
        }
      };

      fetchSalesSummaryData();
    }
  }, [supabaseClient, salesPeriodFilter, locationFilter]);

  // Fetch pembelian data from Supabase
  useEffect(() => {
    if (supabaseClient && pembelianPeriodFilter.length > 0) {
      const fetchPembelianData = async () => {
        setIsLoadingPembelian(true);
        setPembelianError(null);
        try {
          // Convert period filters to date range
          const startDate = pembelianPeriodFilter[pembelianPeriodFilter.length - 1] + '-01';
          const endPeriod = pembelianPeriodFilter[0];
          const endDate = new Date(endPeriod + '-01');
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0); // Last day of the month
          const endDateStr = endDate.toISOString().split('T')[0];

          // Fetch unfiltered data (only period filter) for filter options
          const unfilteredQuery = supabaseClient
            .from('pembelian')
            .select('*')
            .gte('periode_date', startDate)
            .lte('periode_date', endDateStr)
            .order('periode_date', { ascending: false })
            .order('location')
            .order('product_name');

          const { data: unfilteredData, error: unfilteredError } = await unfilteredQuery;

          if (unfilteredError) {
            console.error('Error fetching pembelian data:', unfilteredError);
            setPembelianError('Gagal memuat data pembelian. Silakan refresh halaman.');
            return;
          }

          setPembelianDataUnfiltered(unfilteredData || []);

          // Apply client-side filtering for the table data
          let filteredData = unfilteredData || [];

          // Apply location filter if selected (using shared locationFilter state)
          if (!locationFilter.includes('all') && locationFilter.length > 0) {
            filteredData = filteredData.filter(item => 
              locationFilter.includes(item.location) // Filter by location name (string)
            );
          } else if (locationFilter.length === 0) {
            // If no locations selected, show no data
            filteredData = [];
          }

          setPembelianData(filteredData);
        } catch (error) {
          console.error('Error in fetchPembelianData:', error);
          setPembelianError('Terjadi kesalahan saat memuat data pembelian.');
        } finally {
          setIsLoadingPembelian(false);
        }
      };

      fetchPembelianData();
    }
  }, [supabaseClient, pembelianPeriodFilter, locationFilter]);

  // Process stock data for BB (Raw Materials) and FG (Finished Goods) separately
  const processedStockDataBB = useMemo(() => {
    if (!stockData.length) return [];

    let filteredData = stockData;

    // Filter for sales roles based on their assigned locations
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
    }

    // Apply location filter if not 'all' and locations are selected
    if (!locationFilter.includes('all') && locationFilter.length > 0) {
      filteredData = filteredData.filter(item => locationFilter.includes(item.location));
    } else if (locationFilter.length === 0) {
      // If no locations selected, show no data
      filteredData = [];
    }

    // Filter to show only Raw Materials (BB)
    filteredData = filteredData.filter(item => item.product_type === 'RAW MATERIAL');

    // Aggregate data by category and location
    const aggregatedMap = new Map();

    filteredData.forEach(item => {
      const key = `${item.product_category_name}-${item.location}`;
      const quantity = Number(item.sumqtyonhand);

      if (aggregatedMap.has(key)) {
        aggregatedMap.get(key).quantity += quantity;
      } else {
        aggregatedMap.set(key, {
          category: item.product_category_name,
          location: item.location,
          quantity: quantity,
          unit: item.uom_name
        });
      }
    });

    // Convert map to array and sort by location then category
    return Array.from(aggregatedMap.values())
      .sort((a, b) => {
        if (a.location !== b.location) {
          return a.location.localeCompare(b.location);
        }
        return a.category.localeCompare(b.category);
      });
  }, [stockData, userRole, currentUserLocations, locationFilter]);

  // Process stock data for BROKEN products
  const processedStockDataBroken = useMemo(() => {
    if (!stockData.length) return [];

    let filteredData = stockData;

    // Filter for sales roles based on their assigned locations
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
    }

    // Apply location filter if not 'all' and locations are selected
    if (!locationFilter.includes('all') && locationFilter.length > 0) {
      filteredData = filteredData.filter(item => locationFilter.includes(item.location));
    } else if (locationFilter.length === 0) {
      // If no locations selected, show no data
      filteredData = [];
    }

    // Filter to show only BROKEN products
    filteredData = filteredData.filter(item => item.product_type === 'BROKEN');

    // Aggregate data by category and location
    const aggregatedMap = new Map();

    filteredData.forEach(item => {
      const key = `${item.product_category_name}-${item.location}`;
      const quantity = Number(item.sumqtyonhand);

      if (aggregatedMap.has(key)) {
        aggregatedMap.get(key).quantity += quantity;
      } else {
        aggregatedMap.set(key, {
          category: item.product_category_name,
          location: item.location,
          quantity: quantity,
          unit: item.uom_name
        });
      }
    });

    // Convert map to array and sort by location then category
    return Array.from(aggregatedMap.values())
      .sort((a, b) => {
        if (a.location !== b.location) {
          return a.location.localeCompare(b.location);
        }
        return a.category.localeCompare(b.category);
      });
  }, [stockData, userRole, currentUserLocations, locationFilter]);

  const processedStockDataFG = useMemo(() => {
    if (!stockData.length) return [];

    let filteredData = stockData;

    // Filter for sales roles based on their assigned locations
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
    }

    // Apply location filter if not 'all' and locations are selected
    if (!locationFilter.includes('all') && locationFilter.length > 0) {
      filteredData = filteredData.filter(item => locationFilter.includes(item.location));
    } else if (locationFilter.length === 0) {
      // If no locations selected, show no data
      filteredData = [];
    }

    // Filter to show only Finished Goods (FG)
    filteredData = filteredData.filter(item => item.product_type === 'FINISHED GOODS');

    // Aggregate data by category and location
    const aggregatedMap = new Map();

    filteredData.forEach(item => {
      const key = `${item.product_category_name}-${item.location}`;
      const quantity = Number(item.sumqtyonhand);

      if (aggregatedMap.has(key)) {
        aggregatedMap.get(key).quantity += quantity;
      } else {
        aggregatedMap.set(key, {
          category: item.product_category_name,
          location: item.location,
          quantity: quantity,
          unit: item.uom_name
        });
      }
    });

    // Convert map to array and sort by location then category
    return Array.from(aggregatedMap.values())
      .sort((a, b) => {
        if (a.location !== b.location) {
          return a.location.localeCompare(b.location);
        }
        return a.category.localeCompare(b.category);
      });
  }, [stockData, userRole, currentUserLocations, locationFilter]);

  // Keep the original processedStockData for backward compatibility (BB data)
  const processedStockData = processedStockDataBB;

  // Process sales summary data with grouping by location → category → period
  const processedSalesData = useMemo(() => {
    if (!salesSummaryData.length) return [];

    // Group by location → category → period
    const grouped = new Map<string, {
      location: string;
      m_location_id: number;
      category: string;
      m_product_category_id: number;
      periods: Record<string, number>;
      total: number;
    }>();

    salesSummaryData.forEach(item => {
      const key = `${item.m_location_id}-${item.m_product_category_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          location: item.location,
          m_location_id: item.m_location_id,
          category: item.product_category_name,
          m_product_category_id: item.m_product_category_id,
          periods: {},
          total: 0
        });
      }

      const group = grouped.get(key)!;
      group.periods[item.period] = item.total_qty_sales;
      group.total += item.total_qty_sales;
    });

    return Array.from(grouped.values()).sort((a, b) => 
      a.location.localeCompare(b.location) || a.category.localeCompare(b.category)
    );
  }, [salesSummaryData]);

  // Process pembelian data with grouping by location → category → period
  const processedPembelianData = useMemo(() => {
    if (!pembelianData.length) return [];

    // Group by location → category → period (YYYY-MM)
    const grouped = new Map<string, {
      location: string;
      m_location_id: number;
      category: string;
      category_id: number;
      periods: Record<string, number>;
      periodPrices: Record<string, Map<string, { totalValue: number; totalQty: number }>>; // Map of date -> {totalValue, totalQty} for weighted avg
      total: number;
    }>();

    pembelianData.forEach(item => {
      const period = item.periode_date.substring(0, 7); // Extract YYYY-MM from date
      const fullDate = item.periode_date; // Full date (YYYY-MM-DD)
      const key = `${item.m_location_id}-${item.category_id || item.category_name}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          location: item.location,
          m_location_id: item.m_location_id,
          category: item.category_name || 'Uncategorized',
          category_id: item.category_id || 0,
          periods: {},
          periodPrices: {},
          total: 0
        });
      }

      const group = grouped.get(key)!;
      
      // Aggregate quantities
      if (!group.periods[period]) {
        group.periods[period] = 0;
      }
      group.periods[period] += item.movementqty;
      group.total += item.movementqty;

      // Aggregate prices for weighted average calculation (group by unique date within period)
      if (!group.periodPrices[period]) {
        group.periodPrices[period] = new Map<string, { totalValue: number; totalQty: number }>();
      }
      const dateMap = group.periodPrices[period];
      const currentData = dateMap.get(fullDate) || { totalValue: 0, totalQty: 0 };
      
      // Calculate weighted average: sum(price * qty) / sum(qty)
      dateMap.set(fullDate, {
        totalValue: currentData.totalValue + (item.priceharian * item.movementqty),
        totalQty: currentData.totalQty + item.movementqty
      });
    });

    return Array.from(grouped.values()).sort((a, b) => 
      a.location.localeCompare(b.location) || a.category.localeCompare(b.category)
    );
  }, [pembelianData]);

  // Get unique locations from sales data (use unfiltered data for filter options)
  // Returns array of location names (strings) to match locationFilter format
  const uniqueSalesLocations = useMemo(() => {
    const locations = new Set<string>();
    salesSummaryDataUnfiltered.forEach(item => {
      locations.add(item.location);
    });
    return Array.from(locations).sort();
  }, [salesSummaryDataUnfiltered]);

  // Calculate total sales from sales_summary
  const totalSalesFromSummary = useMemo(() => 
    processedSalesData.reduce((sum, item) => sum + item.total, 0),
    [processedSalesData]
  );

  // Calculate total pembelian from processed data
  const totalPembelianFromData = useMemo(() => 
    processedPembelianData.reduce((sum, item) => sum + item.total, 0),
    [processedPembelianData]
  );

  // Prepare data for period comparison chart (grouped by location)
  const salesPeriodComparisonData = useMemo(() => {
    if (!salesSummaryData.length || salesPeriodFilter.length === 0) return [];

    // Group sales by location and period
    const locationPeriodData = new Map<string, Map<string, number>>();
    
    salesSummaryData.forEach(item => {
      if (!locationPeriodData.has(item.location)) {
        locationPeriodData.set(item.location, new Map());
      }
      const periodMap = locationPeriodData.get(item.location)!;
      const currentTotal = periodMap.get(item.period) || 0;
      periodMap.set(item.period, currentTotal + item.total_qty_sales);
    });

    // Convert to array format for recharts
    const chartData: Array<{
      location: string;
      period: string;
      total: number;
      totalKg: number;
      locationPeriod: string; // For grouping display
    }> = [];

    locationPeriodData.forEach((periodMap, location) => {
      periodMap.forEach((total, period) => {
        chartData.push({
          location,
          period,
          total: Math.round(total / 1000 * 100) / 100, // Convert to Tons with 2 decimals
          totalKg: total,
          locationPeriod: `${location} - ${period}`
        });
      });
    });

    // Sort by location then period
    return chartData.sort((a, b) => {
      if (a.location !== b.location) {
        return a.location.localeCompare(b.location);
      }
      return a.period.localeCompare(b.period);
    });
  }, [salesSummaryData, salesPeriodFilter]);



  const pieColors = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'];

  // Expanded color palette for different categories to reduce collisions
  const categoryColors = [
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#ec4899', // pink-500
    '#6b7280', // gray-500
    '#14b8a6', // teal-500
    '#f43f5e', // rose-500
    '#6366f1', // indigo-500
    '#a855f7', // purple-500
    '#059669', // emerald-600
    '#dc2626', // red-600
    '#2563eb', // blue-600
    '#7c3aed', // violet-600
    '#0891b2', // cyan-600
    '#ea580c', // orange-600
  ];

  // Category color mapping to ensure consistency and uniqueness
  const categoryColorMap = useMemo(() => {
    const map = new Map();

    // Pre-assign colors for known special categories
    map.set('BERAS 42', '#22c55e'); // green-500
    map.set('BERAS ASALAN', '#3b82f6'); // blue-500
    map.set('GABAH 64', '#f97316'); // orange-500
    map.set('GABAH BULAT', '#06b6d4'); // cyan-500

    return map;
  }, []);

  // Function to get color for category
  const getCategoryColor = (category: string, index: number) => {
    // Check if we already have a color assigned for this category
    if (categoryColorMap.has(category)) {
      return categoryColorMap.get(category);
    }

    // Use a more robust hashing algorithm to ensure unique colors for different categories
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      const char = category.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use the absolute value and modulo to get a consistent index
    const colorIndex = Math.abs(hash) % categoryColors.length;

    // Double-check that this color isn't already used by another category
    const selectedColor = categoryColors[colorIndex];

    // If this exact color is already used by a different category, try the next one
    for (let i = 1; i < categoryColors.length; i++) {
      const checkIndex = (colorIndex + i) % categoryColors.length;
      if (!Array.from(categoryColorMap.values()).includes(categoryColors[checkIndex])) {
        const finalColor = categoryColors[checkIndex];
        categoryColorMap.set(category, finalColor);
        return finalColor;
      }
    }

    // Fallback: use the originally selected color
    categoryColorMap.set(category, selectedColor);
    return selectedColor;
  };

  // Get unique categories for legend
  const uniqueCategories = useMemo(() => {
    const categories = new Set(processedStockData.map(item => item.category));
    return Array.from(categories).sort();
  }, [processedStockData]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPERADMIN_ROLE': return 'bg-red-100 text-red-800 border-red-200';
      case 'BOD_ROLE': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SALES_MANAGER_ROLE': return 'bg-green-100 text-green-800 border-green-200';
      case 'SALES_SUPERVISOR_ROLE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'AUDITOR_ROLE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'SUPERADMIN_ROLE': return 'Super Admin';
      case 'BOD_ROLE': return 'BOD';
      case 'SALES_MANAGER_ROLE': return 'Sales Manager';
      case 'SALES_SUPERVISOR_ROLE': return 'Sales Supervisor';
      case 'AUDITOR_ROLE': return 'Auditor';
      default: return role;
    }
  };

  const getLocationNamesFromIds = (locationIds: number[]) => {
    // If no locations are loaded yet, return placeholder
    if (allLocations.length === 0) {
      console.log("No locations loaded yet, returning placeholder for IDs:", locationIds);
      return locationIds.map(id => `Loading... (${id})`);
    }

    //console.log("ALL LOCATION ", allLocations.length, "locations:", allLocations.map(l => ({ id: l.id, name: l.name })));
    //console.log("Looking for location IDs:", locationIds);

    return locationIds.map(id => {
      // Ensure ID is a number for comparison
      const numericId = Number(id);
      console.log(`Looking for location ID: ${numericId} (original: ${id}, type: ${typeof id})`);

      // Try both numeric and string comparison in case of data type issues
      const location = allLocations.find(loc => loc.id === numericId) ||
                      allLocations.find(loc => loc.id === id) ||
                      allLocations.find(loc => String(loc.id) === String(id));

      if (location) {
        console.log(`Found location: ${location.name} (ID: ${location.id})`);
        // Show if location is inactive
        return location.is_active ? location.name : `${location.name} (Inactive)`;
      }
      console.warn(`Location ID ${numericId} not found in locations list. Available locations:`, allLocations.map(l => ({ id: l.id, name: l.name, is_active: l.is_active })));
      return `Unknown Location (${numericId})`;
    });
  };

  const getCurrentUserLocationNames = () => {
    return getLocationNamesFromIds(currentUserLocations);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setNewUsername('');
    setNewPassword('');
    setNewUserRole('');
    setSelectedLocations([]);
    setIsUserDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    // user.locations now contains IDs directly, no conversion needed
    setSelectedLocations(user.locations || []);
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!supabaseClient) return;

    setIsCreatingUser(true);

    try {
      if (editingUser) {
        // UPDATE existing user via Edge Function
        const { data, error } = await supabaseClient.functions.invoke('create-user', {
          body: {
            action: 'update-user',
            clerkId: editingUser.clerk_id,
            role: editingUser.role,
            locations: selectedLocations
          }
        });

        if (error) {
          console.error('Error updating user:', error);
          alert('Failed to update user: ' + (error.message || 'Unknown error'));
          return;
        }

        console.log('User updated successfully');
      } else {
        // CREATE new user via Edge Function
        if (!newUsername || !newPassword || !newUserRole) {
          alert('Please fill in all required fields: Username, Password, and Role');
          return;
        }

        if (newPassword.length < 8) {
          alert('Password must be at least 8 characters long');
          return;
        }

        const { data, error } = await supabaseClient.functions.invoke('create-user', {
          body: {
            action: 'create-user',
            username: newUsername,
            password: newPassword,
            role: newUserRole,
            locations: selectedLocations
          }
        });

        if (error) {
          console.error('Error creating user:', error);
          alert('Failed to create user: ' + (error.message || 'Unknown error'));
          return;
        }

        console.log('User created successfully:', data);
        alert('User created successfully! Username: ' + newUsername);
      }

      // Refresh users list
      const { data: usersData } = await supabaseClient.from('users').select('*');
      // Convert string location IDs to numbers
      const processedUsers = (usersData || []).map(user => ({
        ...user,
        locations: user.locations ? user.locations.map((loc: any) => Number(loc)) : []
      }));
      setAllUsers(processedUsers);

      setIsUserDialogOpen(false);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('An error occurred: ' + (error as Error).message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!supabaseClient) return;

    if (!confirm('Are you sure you want to delete this user? This will also remove them from Clerk.')) {
      return;
    }

    try {
      // Get the user's clerk_id first
      const user = allUsers.find(u => u.id === userId);
      if (!user || !user.clerk_id) {
        alert('User not found or missing Clerk ID');
        return;
      }

      // Call Edge Function to delete from both Clerk and Supabase
      const { data, error } = await supabaseClient.functions.invoke('create-user', {
        body: {
          action: 'delete-user',
          clerkId: user.clerk_id
        }
      });

      if (error) {
        console.error('Delete request failed:', error);
        throw error;
      }

      console.log('User deleted successfully');

      // Refresh users list
      const { data: usersData } = await supabaseClient.from('users').select('*');
      // Convert string location IDs to numbers
      const processedUsers = (usersData || []).map(user => ({
        ...user,
        locations: user.locations ? user.locations.map((loc: any) => Number(loc)) : []
      }));
      setAllUsers(processedUsers);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('An error occurred: ' + (error as Error).message);
    }
  };

  const handleAddLocation = () => {
    setEditingLocation({ id: 0, name: '', value: '', is_active: true });
    setIsLocationDialogOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    if (editingLocation && supabaseClient) {
      const locData = {
        name: editingLocation.name,
        value: editingLocation.value,
        is_active: editingLocation.is_active,
      };
  
      let error;
      if (editingLocation.id === 0) {
        // Add new
        const { error: insertError } = await supabaseClient
          .from('master_locations')
          .insert(locData);
        error = insertError;
      } else {
        // Update existing
        const { error: updateError } = await supabaseClient
          .from('master_locations')
          .update(locData)
          .eq('id', editingLocation.id);
        error = updateError;
      }
  
      if (error) {
        console.error('Error saving location:', error);
        return;
      }
  
      // Refresh locations
      const { data: locationsData } = await supabaseClient
        .from('master_locations')
        .select('*');
  
      setAllLocations(locationsData || []);
  
      setIsLocationDialogOpen(false);
    }
  };

  const handleDeleteLocation = async (locationId: number) => {
    if (!supabaseClient) return;

    const { error } = await supabaseClient
      .from('master_locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      console.error('Error deleting location:', error);
      return;
    }

    // Refresh locations
    const { data: locationsData } = await supabaseClient
      .from('master_locations')
      .select('*');

    setAllLocations(locationsData || []);
  };

  const handleStockItemClick = (item: any, product_type: string) => {
    const updatedItem = { ...item, product_type };
    //console.log('Stock item clicked:', updatedItem);
    //console.log('stockData:', stockData);
    setSelectedStockItem(updatedItem);

    // Filter existing stockData instead of querying database
    const filteredDetailedData = stockData.filter(stockItem =>
      stockItem.product_category_name === item.category &&
      stockItem.location === item.location &&
      stockItem.product_type === product_type
    );

    //console.log('Filtered detailed stock data:', filteredDetailedData);
    setDetailedStockItems(filteredDetailedData);
    setIsStockDetailDialogOpen(true);
  };

  const filteredUsers = useMemo(() =>
    allUsers.filter((user: User) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRoleDisplay(user.role).toLowerCase().includes(searchTerm.toLowerCase())
    ), [allUsers, searchTerm]
  );

  const filteredLocations = useMemo(() =>
    allLocations.filter((location: Location) =>
      location.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [allLocations, searchTerm]
  );

  const totalStockBB = useMemo(() =>
    processedStockData.reduce((sum, item) => sum + item.quantity, 0),
    [processedStockData]
  );

  const totalStockFG = useMemo(() =>
    processedStockDataFG.reduce((sum, item) => sum + item.quantity, 0),
    [processedStockDataFG]
  );

  const totalStockBroken = useMemo(() =>
    processedStockDataBroken.reduce((sum, item) => sum + item.quantity, 0),
    [processedStockDataBroken]
  );

  // Calculate BB:Broken ratio
  const ratioBBtoBroken = useMemo(() => {
    if (totalStockBroken === 0) return 0;
    return totalStockBB / totalStockBroken;
  }, [totalStockBB, totalStockBroken]);

  // Filter and sort detailed stock items
  const filteredAndSortedProducts = useMemo(() => {
    if (!detailedStockItems.length) return [];

    let filtered = detailedStockItems;

    // Apply search filter
    if (productSearchTerm.trim()) {
      const searchLower = productSearchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.m_product_id.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (productSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'code':
          return a.m_product_id.localeCompare(b.m_product_id);
        case 'quantity-high':
          return Number(b.sumqtyonhand) - Number(a.sumqtyonhand);
        case 'quantity-low':
          return Number(a.sumqtyonhand) - Number(b.sumqtyonhand);
        default:
          return 0;
      }
    });

    return filtered;
  }, [detailedStockItems, productSearchTerm, productSortBy]);



  const totalStock = useMemo(() => totalStockBB + totalStockFG, [totalStockBB, totalStockFG]);

  const canAccessRestricted = userRole === 'SUPERADMIN_ROLE';

  if (!isLoaded || userRole === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-lg text-green-600">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-green-100">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-green-800">Belitang Operational Dashboard</h1>
                {/* <p className="text-sm text-green-600">Dashboard Operasional</p> */}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-green-700">
                Welcome, {user?.firstName || user?.username || 'User'}
              </span>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                data-logout-button
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Stok BB</p>
                <p className="text-2xl font-bold text-green-800">{ (totalStockBB/1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton</p>
              </div>
              <Sprout className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Stok Broken</p>
                <p className="text-2xl font-bold text-green-800">{ (totalStockBroken/1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Stok FG</p>
                <p className="text-2xl font-bold text-green-800">{( totalStockFG / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton</p>
              </div>
              <Wheat className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Penjualan</p>
                <p className="text-2xl font-bold text-green-800">
                  {(totalSalesFromSummary / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton
                </p>
                <p className="text-xs text-green-500 mt-1">
                  {selectedPeriodRange} bulan terakhir
                </p>
              </div>
              <Truck className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Pembelian</p>
                <p className="text-2xl font-bold text-green-800">
                  {(totalPembelianFromData / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Ton
                </p>
                <p className="text-xs text-green-500 mt-1">
                  {selectedPembelianPeriodRange} bulan terakhir
                </p>
              </div>
              <ShoppingCart className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 mb-1">Rasio BB:Broken</p>
                <p className="text-2xl font-bold text-blue-800">
                  {ratioBBtoBroken > 0 ? `${ratioBBtoBroken.toLocaleString('id-ID', { maximumFractionDigits: 1 })} : 1` : '-'}
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  {ratioBBtoBroken > 0 ? `BB ${ratioBBtoBroken.toFixed(1)}x dari Broken` : 'No Broken stock'}
                </p>
              </div>
              <Scale className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Lokasi Aktif</p>
                <p className="text-2xl font-bold text-green-800">{allLocations.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </div>

        {/* Detailed BB vs Broken Comparison */}
        <Card className="p-6 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">Perbandingan Stok BB vs Broken</h3>
            </div>
            
            <div className="space-y-4">
              {/* BB Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-700">Stok BB (Bahan Baku)</span>
                  </div>
                  <span className="text-xl font-bold text-green-700">
                    {(totalStockBB / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ton
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${totalStockBB > 0 ? Math.min((totalStockBB / (totalStockBB + totalStockBroken)) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Broken Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-gray-700">Stok Broken</span>
                  </div>
                  <span className="text-xl font-bold text-amber-700">
                    {(totalStockBroken / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ton
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${totalStockBroken > 0 ? Math.min((totalStockBroken / (totalStockBB + totalStockBroken)) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="stocks-bb" className="space-y-4">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex bg-green-100 p-1 rounded-lg min-w-max">
              <TabsTrigger value="stocks-bb" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Level Stok BB
              </TabsTrigger>
              <TabsTrigger value="stocks-fg" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Level Stok FG
              </TabsTrigger>
              <TabsTrigger value="production" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Produksi FG
              </TabsTrigger>
              <TabsTrigger value="production-gabah" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Produksi Gabah
              </TabsTrigger>
              <TabsTrigger value="sales" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Data Penjualan
              </TabsTrigger>
              <TabsTrigger value="purchases" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Data Pembelian
              </TabsTrigger>
              {canAccessRestricted && (
                <>
                  <TabsTrigger value="users" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                    Management User
                  </TabsTrigger>
                  <TabsTrigger value="locations" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                    Management Lokasi
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* Stock Levels Tab */}
          <TabsContent value="stocks-bb" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-green-800">Level Stok Bahan Baku (BB)</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Label className="text-sm text-green-700 mr-2">Filter Lokasi:</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="all-locations-bb"
                          checked={locationFilter.includes('all')}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setLocationFilter(['all']);
                            } else if (locationFilter.length === 1) {
                              setLocationFilter([]);
                            }
                          }}
                        />
                        <Label htmlFor="all-locations-bb" className="text-sm text-green-700">
                          Semua Lokasi
                        </Label>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-2">
                        {allLocations.filter(location => location.is_active).sort((a, b) => a.name.localeCompare(b.name)).map((location) => (
                          <div key={location.id} className="flex items-center space-x-1">
                            <Checkbox
                              id={`location-bb-${location.id}`}
                              checked={locationFilter.includes(location.name)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  if (locationFilter.includes('all')) {
                                    setLocationFilter([location.name]);
                                  } else {
                                    setLocationFilter(prev => [...prev.filter(l => l !== 'all'), location.name]);
                                  }
                                } else {
                                  setLocationFilter(prev => prev.filter(l => l !== location.name));
                                }
                              }}
                            />
                            <Label htmlFor={`location-bb-${location.id}`} className="text-xs text-green-700">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock List */}
                {isLoadingStock ? (
                  <div className="text-center py-8 text-green-600">Memuat data stok...</div>
                ) : processedStockData.length === 0 && processedStockDataBroken.length === 0 ? (
                  <div className="text-center py-8 text-green-600">Tidak ada data stok untuk lokasi Anda</div>
                ) : (
                  <div className="space-y-6">
                    {/* Raw Material Section */}
                    {processedStockData.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="h-1 flex-1 bg-green-200 rounded"></div>
                          <h4 className="text-sm font-semibold text-green-800 px-3 py-1 bg-green-100 rounded-full">
                            RAW MATERIAL
                          </h4>
                          <div className="h-1 flex-1 bg-green-200 rounded"></div>
                        </div>
                        {processedStockData.map((item, index) => (
                          <div
                            key={`raw-${index}`}
                            className="p-4 bg-green-50 rounded-lg border border-green-100 cursor-pointer hover:bg-green-100 transition-colors"
                            onClick={() => handleStockItemClick(item, "RAW MATERIAL")}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                              <div className="flex-1">
                                <h4 className="font-medium text-green-800">{item.category}</h4>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                    {item.location}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-800">{item.quantity.toLocaleString('id-ID')} {item.unit}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Broken Section */}
                    {processedStockDataBroken.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="h-1 flex-1 bg-amber-200 rounded"></div>
                          <h4 className="text-sm font-semibold text-amber-800 px-3 py-1 bg-amber-100 rounded-full">
                            BROKEN
                          </h4>
                          <div className="h-1 flex-1 bg-amber-200 rounded"></div>
                        </div>
                        {processedStockDataBroken.map((item, index) => (
                          <div
                            key={`broken-${index}`}
                            className="p-4 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                            onClick={() => handleStockItemClick(item, "BROKEN")}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                              <div className="flex-1">
                                <h4 className="font-medium text-amber-800">{item.category}</h4>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                                    {item.location}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-amber-800">{item.quantity.toLocaleString('id-ID')} {item.unit}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Finished Goods Tab */}
          <TabsContent value="stocks-fg" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-blue-800">Level Stok Barang Jadi (FG)</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Label className="text-sm text-blue-700 mr-2">Filter Lokasi:</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="all-locations-fg"
                          checked={locationFilter.includes('all')}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setLocationFilter(['all']);
                            } else if (locationFilter.length === 1) {
                              setLocationFilter([]);
                            }
                          }}
                        />
                        <Label htmlFor="all-locations-fg" className="text-sm text-blue-700">
                          Semua Lokasi
                        </Label>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-2">
                        {allLocations.filter(location => location.is_active).sort((a, b) => a.name.localeCompare(b.name)).map((location) => (
                          <div key={location.id} className="flex items-center space-x-1">
                            <Checkbox
                              id={`location-fg-${location.id}`}
                              checked={locationFilter.includes(location.name)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  if (locationFilter.includes('all')) {
                                    setLocationFilter([location.name]);
                                  } else {
                                    setLocationFilter(prev => [...prev.filter(l => l !== 'all'), location.name]);
                                  }
                                } else {
                                  setLocationFilter(prev => prev.filter(l => l !== location.name));
                                }
                              }}
                            />
                            <Label htmlFor={`location-fg-${location.id}`} className="text-xs text-blue-700">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock List */}
                <div className="space-y-3">
                  {isLoadingStock ? (
                    <div className="text-center py-8 text-green-600">Memuat data stok...</div>
                  ) : processedStockDataFG.length === 0 ? (
                    <div className="text-center py-8 text-green-600">Tidak ada data stok finished goods untuk lokasi Anda</div>
                  ) : (
                    processedStockDataFG.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleStockItemClick(item, "FINISHED GOODS")}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-800">{item.category}</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                {item.location}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-800">{item.quantity.toLocaleString('id-ID')} {item.unit}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
              </div>
            </Card>
          </TabsContent>

          {/* Production Recap Tab */}
          <TabsContent value="production" className="space-y-4">
            <ProductionRecap 
              supabaseClient={supabaseClient}
              allLocations={allLocations}
              locationFilter={locationFilter}
              userRole={userRole}
            />
          </TabsContent>

          {/* Production Recap Gabah Tab */}
          <TabsContent value="production-gabah" className="space-y-4">
            <ProductionRecapGabah 
              supabaseClient={supabaseClient}
              allLocations={allLocations}
              locationFilter={locationFilter}
              userRole={userRole}
            />
          </TabsContent>

          {/* Sales Data Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-green-800">Data Penjualan</h3>
                  
                  {/* Filters */}
                  <div className="flex flex-col space-y-3 p-4 bg-green-50 rounded-lg border border-green-100">
                    {/* Period Filter */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm text-green-700 font-medium min-w-[80px]">Periode:</Label>
                      <Select 
                        value={selectedPeriodRange} 
                        onValueChange={(value) => {
                          setSalesPeriodFilter(getPeriodRange(value));
                          setSelectedPeriodRange(value);
                        }}
                      >
                        <SelectTrigger className="w-40 border-green-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Bulan Ini</SelectItem>
                          <SelectItem value="2">2 Bulan Terakhir</SelectItem>
                          <SelectItem value="3">3 Bulan Terakhir</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-green-600 ml-2">
                        {salesPeriodFilter.length > 0 && `(${salesPeriodFilter.join(', ')})`}
                      </div>
                    </div>

                    {/* Location Filter - Shared with Stock BB/FG */}
                    <div className="flex flex-wrap items-start gap-2">
                      <Label className="text-sm text-green-700 font-medium min-w-[80px] pt-1">Lokasi:</Label>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center space-x-1">
                          <Checkbox
                            id="all-sales-locations"
                            checked={locationFilter.includes('all')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setLocationFilter(['all']);
                              } else if (locationFilter.length === 1) {
                                setLocationFilter([]);
                              }
                            }}
                          />
                          <Label htmlFor="all-sales-locations" className="text-xs text-green-700">Semua</Label>
                        </div>
                        {allLocations.filter(location => location.is_active).sort((a, b) => a.name.localeCompare(b.name)).map((location) => (
                          <div key={location.id} className="flex items-center space-x-1">
                            <Checkbox
                              id={`sales-loc-${location.id}`}
                              checked={locationFilter.includes(location.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (locationFilter.includes('all')) {
                                    setLocationFilter([location.name]);
                                  } else {
                                    setLocationFilter(prev => [...prev.filter(l => l !== 'all'), location.name]);
                                  }
                                } else {
                                  setLocationFilter(prev => prev.filter(l => l !== location.name));
                                }
                              }}
                            />
                            <Label htmlFor={`sales-loc-${location.id}`} className="text-xs text-green-700">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content: Loading, Error, or Data */}
                {isLoadingSalesSummary ? (
                  <div className="text-center py-12 text-green-600">
                    <div className="animate-pulse">Memuat data penjualan...</div>
                  </div>
                ) : salesError ? (
                  <div className="text-center py-12 text-red-600">
                    <p className="font-medium">{salesError}</p>
                    <Button 
                      onClick={() => window.location.reload()} 
                      className="mt-4 bg-green-600 hover:bg-green-700"
                    >
                      Refresh Halaman
                    </Button>
                  </div>
                ) : processedSalesData.length === 0 ? (
                  <div className="text-center py-12 text-green-600">
                    <p>Tidak ada data penjualan untuk filter yang dipilih</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="mb-6">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-sm text-green-700">
                          <strong>Total Keseluruhan:</strong> {(totalSalesFromSummary / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton
                          <span className="text-xs ml-2">({selectedPeriodRange} bulan terakhir)</span>
                        </p>
                      </div>
                    </div>

                    {/* Sales Data Table */}
                    <div className="mb-6 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Lokasi</TableHead>
                            <TableHead className="font-semibold">Kategori Produk</TableHead>
                            {salesPeriodFilter.map(period => (
                              <TableHead key={period} className="font-semibold text-right">{formatMonthYear(period)}</TableHead>
                            ))}
                            <TableHead className="font-semibold text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedSalesData.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-green-50">
                              <TableCell className="font-medium">{item.location}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                  {item.category}
                                </Badge>
                              </TableCell>
                              {salesPeriodFilter.map(period => (
                                <TableCell key={period} className="text-right">
                                  {item.periods[period] ? item.periods[period].toLocaleString('id-ID') : '-'}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-bold text-green-800">
                                {item.total.toLocaleString('id-ID')} kg
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Purchase Data Tab */}
          <TabsContent value="purchases" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-green-800">Data Pembelian</h3>
                  
                  {/* Filters */}
                  <div className="flex flex-col space-y-3 p-4 bg-green-50 rounded-lg border border-green-100">
                    {/* Period Filter */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm text-green-700 font-medium min-w-[80px]">Periode:</Label>
                      <Select 
                        value={selectedPembelianPeriodRange} 
                        onValueChange={(value) => {
                          setPembelianPeriodFilter(getPeriodRange(value));
                          setSelectedPembelianPeriodRange(value);
                        }}
                      >
                        <SelectTrigger className="w-40 border-green-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Bulan Ini</SelectItem>
                          <SelectItem value="2">2 Bulan Terakhir</SelectItem>
                          <SelectItem value="3">3 Bulan Terakhir</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-green-600 ml-2">
                        {pembelianPeriodFilter.length > 0 && `(${pembelianPeriodFilter.join(', ')})`}
                      </div>
                    </div>

                    {/* Location Filter - Shared with Stock BB/FG and Sales */}
                    <div className="flex flex-wrap items-start gap-2">
                      <Label className="text-sm text-green-700 font-medium min-w-[80px] pt-1">Lokasi:</Label>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center space-x-1">
                          <Checkbox
                            id="all-pembelian-locations"
                            checked={locationFilter.includes('all')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setLocationFilter(['all']);
                              } else if (locationFilter.length === 1) {
                                setLocationFilter([]);
                              }
                            }}
                          />
                          <Label htmlFor="all-pembelian-locations" className="text-xs text-green-700">Semua</Label>
                        </div>
                        {allLocations.filter(location => location.is_active).sort((a, b) => a.name.localeCompare(b.name)).map((location) => (
                          <div key={location.id} className="flex items-center space-x-1">
                            <Checkbox
                              id={`pembelian-loc-${location.id}`}
                              checked={locationFilter.includes(location.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (locationFilter.includes('all')) {
                                    setLocationFilter([location.name]);
                                  } else {
                                    setLocationFilter(prev => [...prev.filter(l => l !== 'all'), location.name]);
                                  }
                                } else {
                                  setLocationFilter(prev => prev.filter(l => l !== location.name));
                                }
                              }}
                            />
                            <Label htmlFor={`pembelian-loc-${location.id}`} className="text-xs text-green-700">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content: Loading, Error, or Data */}
                {isLoadingPembelian ? (
                  <div className="text-center py-12 text-green-600">
                    <div className="animate-pulse">Memuat data pembelian...</div>
                  </div>
                ) : pembelianError ? (
                  <div className="text-center py-12 text-red-600">
                    <p className="font-medium">{pembelianError}</p>
                    <Button 
                      onClick={() => window.location.reload()} 
                      className="mt-4 bg-green-600 hover:bg-green-700"
                    >
                      Refresh Halaman
                    </Button>
                  </div>
                ) : processedPembelianData.length === 0 ? (
                  <div className="text-center py-12 text-green-600">
                    <p>Tidak ada data pembelian untuk filter yang dipilih</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="mb-6">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-sm text-green-700">
                          <strong>Total Keseluruhan:</strong> {(totalPembelianFromData / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton
                          <span className="text-xs ml-2">({selectedPembelianPeriodRange} bulan terakhir)</span>
                        </p>
                      </div>
                    </div>

                    {/* Pembelian Data Table */}
                    <div className="mb-6 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Lokasi</TableHead>
                            <TableHead className="font-semibold">Kategori Produk</TableHead>
                            <TableHead className="font-semibold">Tipe Data</TableHead>
                            {pembelianPeriodFilter.map(period => (
                              <TableHead key={period} className="font-semibold text-right">{formatMonthYear(period)}</TableHead>
                            ))}
                            <TableHead className="font-semibold text-right">Total/Avg</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedPembelianData.map((item, idx) => (
                            <>
                              {/* Quantity Row */}
                              <TableRow key={`${idx}-qty`} className="hover:bg-green-50">
                                <TableCell className="font-medium" rowSpan={2}>{item.location}</TableCell>
                                <TableCell rowSpan={2}>
                                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                    {item.category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-gray-600">Qty (kg)</TableCell>
                                {pembelianPeriodFilter.map(period => (
                                  <TableCell key={period} className="text-right">
                                    {item.periods[period] ? item.periods[period].toLocaleString('id-ID') : '-'}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right font-bold text-green-800">
                                  {item.total.toLocaleString('id-ID')} kg
                                </TableCell>
                              </TableRow>
                              {/* Average Price Row */}
                              <TableRow key={`${idx}-price`} className="hover:bg-green-50 bg-gray-50">
                                <TableCell className="text-xs text-gray-600">Harga Avg</TableCell>
                                {pembelianPeriodFilter.map(period => {
                                  const dateMap = item.periodPrices[period];
                                  if (!dateMap || dateMap.size === 0) {
                                    return (
                                      <TableCell key={period} className="text-right text-sm text-gray-700">
                                        -
                                      </TableCell>
                                    );
                                  }
                                  
                                  // Calculate weighted average for the period: sum(price × qty) / sum(qty) for all days
                                  let periodTotalValue = 0;
                                  let periodTotalQty = 0;
                                  
                                  dateMap.forEach(dayData => {
                                    periodTotalValue += dayData.totalValue;
                                    periodTotalQty += dayData.totalQty;
                                  });
                                  
                                  const periodAvg = periodTotalQty > 0 ? periodTotalValue / periodTotalQty : 0;
                                  
                                  return (
                                    <TableCell key={period} className="text-right text-sm text-gray-700">
                                      {periodAvg > 0 ? `Rp ${Math.round(periodAvg).toLocaleString('id-ID')}` : '-'}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-right text-sm text-gray-700 italic">
                                  {(() => {
                                    // Calculate overall weighted average price across all periods
                                    let overallTotalValue = 0;
                                    let overallTotalQty = 0;
                                    
                                    Object.values(item.periodPrices).forEach(dateMap => {
                                      if (dateMap && dateMap.size > 0) {
                                        dateMap.forEach(dayData => {
                                          overallTotalValue += dayData.totalValue;
                                          overallTotalQty += dayData.totalQty;
                                        });
                                      }
                                    });
                                    
                                    const overallAvg = overallTotalQty > 0 ? overallTotalValue / overallTotalQty : 0;
                                    return overallAvg > 0 ? `Rp ${Math.round(overallAvg).toLocaleString('id-ID')}` : '-';
                                  })()}
                                </TableCell>
                              </TableRow>
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* User Management Tab */}
          {canAccessRestricted && (
            <TabsContent value="users" className="space-y-4">
              <Card className="border-green-200">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                    <h3 className="text-lg font-semibold text-green-800">Management User</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input 
                          placeholder="Cari user..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 border-green-200"
                        />
                      </div>
                      <Button onClick={handleAddUser} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah User
                      </Button>
                      <Button onClick={() => {
                        const fetchData = async () => {
                          if (!supabaseClient) return;
                          const { data: usersData } = await supabaseClient.from('users').select('*');
                          // Convert string location IDs to numbers
                          const processedUsers = (usersData || []).map(user => ({
                            ...user,
                            locations: user.locations ? user.locations.map((loc: any) => Number(loc)) : []
                          }));
                          setAllUsers(processedUsers);
                        };
                        fetchData();
                      }} className="bg-green-600 hover:bg-green-700 text-white">
                        <Users className="w-4 h-4 mr-2" />
                        Refresh Users
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="block sm:hidden space-y-3">
                    {filteredUsers.map((user: User) => (
                      <Card key={user.id} className="p-4 border-green-100">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-green-800">{user.name}</h4>
                            </div>
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                              {getRoleDisplay(user.role)}
                            </Badge>
                            {user.locations && getLocationNamesFromIds(user.locations).map((locationName: string) => (
                              <Badge key={locationName} variant="outline" className="text-xs border-green-300 text-green-700">
                                {locationName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Lokasi</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user: User) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                                {getRoleDisplay(user.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.locations && getLocationNamesFromIds(user.locations).map((locationName: string) => (
                                <Badge key={locationName} variant="outline" className="text-xs border-green-300 text-green-700 mr-1">
                                  {locationName}
                                </Badge>
                              ))}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-1">
                                <Button size="sm" variant="outline" onClick={() => handleEditUser(user)}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* User Dialog */}
                <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                  <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingUser ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {editingUser ? (
                        <>
                          <div className="space-y-2">
                            <Label>Username</Label>
                            <Input value={editingUser.name} disabled />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={editingUser.role} onValueChange={(value: string) => setEditingUser({ ...editingUser, role: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SUPERADMIN_ROLE">Super Admin</SelectItem>
                                <SelectItem value="BOD_ROLE">BOD</SelectItem>
                                <SelectItem value="SALES_MANAGER_ROLE">Sales Manager</SelectItem>
                                <SelectItem value="SALES_SUPERVISOR_ROLE">Sales Supervisor</SelectItem>
                                <SelectItem value="AUDITOR_ROLE">Auditor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="username">Username *</Label>
                            <Input 
                              id="username"
                              placeholder="john_doe"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Password *</Label>
                            <Input 
                              id="password"
                              type="password"
                              placeholder="Minimum 8 characters"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="newUserRole">Role *</Label>
                            <Select value={newUserRole} onValueChange={setNewUserRole}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SUPERADMIN_ROLE">Super Admin</SelectItem>
                                <SelectItem value="BOD_ROLE">BOD</SelectItem>
                                <SelectItem value="SALES_MANAGER_ROLE">Sales Manager</SelectItem>
                                <SelectItem value="SALES_SUPERVISOR_ROLE">Sales Supervisor</SelectItem>
                                <SelectItem value="AUDITOR_ROLE">Auditor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <Label>Lokasi</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {allLocations.filter((location: Location) => location.is_active).map((location: any) => (
                            <div key={location.id} className="flex items-center space-x-2 min-w-0">
                              <Checkbox
                                id={`location-${location.id}`}
                                checked={selectedLocations.includes(location.id)}
                                onCheckedChange={(checked: boolean) => {
                                  if (checked) {
                                    setSelectedLocations(prev => [...prev, location.id]);
                                  } else {
                                    setSelectedLocations(prev => prev.filter(l => l !== location.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`location-${location.id}`} className="text-xs leading-tight truncate">
                                {location.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" onClick={() => setIsUserDialogOpen(false)} disabled={isCreatingUser}>
                          Batal
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveUser} disabled={isCreatingUser}>
                          {isCreatingUser ? 'Saving...' : 'Simpan'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            </TabsContent>
          )}

          {/* Location Management Tab */}
          {canAccessRestricted && (
            <TabsContent value="locations" className="space-y-4">
              <Card className="border-green-200">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                    <h3 className="text-lg font-semibold text-green-800">Management Lokasi</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={handleAddLocation} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah Lokasi
                      </Button>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Cari lokasi..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 border-green-200"
                        />
                      </div>
                      <Button onClick={() => {
                        const fetchData = async () => {
                          if (!supabaseClient) return;
                          const { data: locationsData } = await supabaseClient
                            .from('master_locations')
                            .select('*');

                          setAllLocations(locationsData || []);
                        };
                        fetchData();
                      }} className="bg-green-600 hover:bg-green-700 text-white">
                        <Users className="w-4 h-4 mr-2" />
                        Refresh Locations
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="block lg:hidden space-y-3">
                    {filteredLocations.map((location: Location) => (
                      <Card key={location.id} className="p-4 border-green-100">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-green-800">{location.name}</h4>
                            </div>
                            <div className="flex space-x-1 ml-2">
                              <Button size="sm" variant="outline" onClick={() => handleEditLocation(location)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteLocation(location.id)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Lokasi</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLocations.map((location: Location) => (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">{location.name}</TableCell>
                            <TableCell>{location.value}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-1">
                                <Button size="sm" variant="outline" onClick={() => handleEditLocation(location)}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeleteLocation(location.id)} className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Location Dialog */}
                <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                  <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nama Lokasi</Label>
                        <Input id="name" value={editingLocation?.name || ''} onChange={(e) => setEditingLocation({ ...editingLocation!, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="value">Value</Label>
                        <Input id="value" value={editingLocation?.value || ''} onChange={(e) => setEditingLocation({ ...editingLocation!, value: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="is_active">Aktif</Label>
                        <Checkbox
                          id="is_active"
                          checked={editingLocation?.is_active || false}
                          onCheckedChange={(checked: boolean) => setEditingLocation({ ...editingLocation!, is_active: checked })}
                        />
                      </div>
                      <div className="flex justify-end space-x-2 pt-4">
                        <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                          Batal
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveLocation}>
                          Simpan
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            </TabsContent>
          )}

          {/* Stock Detail Dialog */}
           <Dialog open={isStockDetailDialogOpen} onOpenChange={setIsStockDetailDialogOpen}>
             <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[85vh] overflow-y-auto">
               <DialogHeader>
                 <DialogTitle className="text-lg sm:text-xl">Detail Stok - {selectedStockItem?.category} ({selectedStockItem?.location})</DialogTitle>
               </DialogHeader>
               {selectedStockItem && (
                 <div className="space-y-4 py-4">
                   {/* Summary Section */}
                   <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                       <div className="space-y-1">
                         <Label className="text-xs sm:text-sm font-medium text-gray-600">Kategori</Label>
                         <p className="font-semibold text-sm sm:text-base lg:text-lg break-words">{selectedStockItem.category}</p>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs sm:text-sm font-medium text-gray-600">Lokasi</Label>
                         <p className="font-semibold text-sm sm:text-base lg:text-lg break-words">{selectedStockItem.location}</p>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs sm:text-sm font-medium text-gray-600">Total Items</Label>
                         <p className="font-bold text-lg sm:text-xl lg:text-2xl text-green-800">
                           {isLoadingDetailedStock ? '...' : filteredAndSortedProducts.length}
                         </p>
                       </div>
                       <div className="space-y-1">
                         <Label className="text-xs sm:text-sm font-medium text-gray-600">Total Quantity</Label>
                         <p className="font-bold text-lg sm:text-xl lg:text-2xl text-green-800 break-words">
                           {isLoadingDetailedStock ? '...' : `${filteredAndSortedProducts.reduce((sum, item) => sum + Number(item.sumqtyonhand), 0).toLocaleString('id-ID')} ${selectedStockItem.unit}`}
                         </p>
                       </div>
                     </div>

                     <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                       <div className={`inline-flex px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                         selectedStockItem.product_type === 'RAW MATERIAL'
                           ? 'bg-green-100 text-green-800'
                           : selectedStockItem.product_type === 'BROKEN'
                           ? 'bg-amber-100 text-amber-800'
                           : 'bg-blue-100 text-blue-800'
                       }`}>
                         {selectedStockItem.product_type === 'RAW MATERIAL' 
                           ? 'Bahan Baku (BB)' 
                           : selectedStockItem.product_type === 'BROKEN'
                           ? 'Produk Broken'
                           : 'Barang Jadi (FG)'}
                       </div>
                     </div>
                   </div>

                   {/* Search and Filter Controls */}
                   {!isLoadingDetailedStock && detailedStockItems.length > 0 && (
                     <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                       <div className="flex-1 min-w-0">
                         <div className="relative">
                           <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                           <Input
                             placeholder="Cari produk atau kode..."
                             value={productSearchTerm}
                             onChange={(e) => setProductSearchTerm(e.target.value)}
                             className="pl-8 sm:pl-10 text-sm"
                           />
                         </div>
                       </div>
                       <div className="sm:w-40 lg:w-48 flex-shrink-0">
                         <Select value={productSortBy} onValueChange={setProductSortBy}>
                           <SelectTrigger className="text-sm">
                             <SelectValue placeholder="Urutkan" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="name">Nama Produk</SelectItem>
                             <SelectItem value="code">Kode Produk</SelectItem>
                             <SelectItem value="quantity-high">Jumlah (Tertinggi)</SelectItem>
                             <SelectItem value="quantity-low">Jumlah (Terendah)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                   )}

                   {/* Detailed Products Section */}
                   <div className="border rounded-lg">
                     <div className="p-3 sm:p-4 border-b bg-gray-50">
                       <h3 className="font-semibold text-sm sm:text-base text-gray-800">Detail Produk</h3>
                     </div>

                     <div className="max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
                       {isLoadingDetailedStock ? (
                         <div className="p-6 sm:p-8 text-center text-gray-600">
                           <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                           <p className="text-sm sm:text-base">Memuat detail produk...</p>
                         </div>
                       ) : filteredAndSortedProducts.length === 0 ? (
                         <div className="p-6 sm:p-8 text-center text-gray-600">
                           <p className="text-sm sm:text-base">
                             {detailedStockItems.length === 0
                               ? 'Tidak ada produk ditemukan untuk kategori dan lokasi ini'
                               : 'Tidak ada produk yang sesuai dengan filter pencarian'
                             }
                           </p>
                         </div>
                       ) : (
                         <div className="divide-y">
                           {filteredAndSortedProducts.map((product, index) => (
                             <div key={index} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 items-center">
                                 <div className="sm:col-span-1 lg:col-span-2 min-w-0">
                                   <Label className="text-xs font-medium text-gray-500 block">Nama Produk</Label>
                                   <p className="font-medium text-xs sm:text-sm text-gray-900 break-words mt-1">{product.name}</p>
                                   {/* <p className="text-xs text-gray-500 mt-1 break-all">{product.m_product_id}</p> */}
                                 </div>
                                 <div className="text-left sm:text-right lg:text-right">
                                   <Label className="text-xs font-medium text-gray-500 block">Stok</Label>
                                   <p className="font-bold text-sm sm:text-base text-green-800 mt-1">
                                     {Number(product.sumqtyonhand).toLocaleString('id-ID')} {product.uom_name}
                                   </p>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="flex justify-end pt-3 sm:pt-4">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setIsStockDetailDialogOpen(false);
                         setDetailedStockItems([]);
                         setProductSearchTerm('');
                         setProductSortBy('name');
                       }}
                       className="text-sm"
                     >
                       Tutup
                     </Button>
                   </div>
                 </div>
               )}
             </DialogContent>
           </Dialog>
        </Tabs>
      </main>
    </div>
  );
}