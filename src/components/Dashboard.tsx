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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UserButton, useUser, useAuth } from "@clerk/clerk-react";
//import { supabase } from "../lib/supabase";
import { Package, TrendingUp, TrendingDown, MapPin, Plus, Edit, Trash2, Search, Users } from 'lucide-react';
// Add these imports at the top
import { useSession } from "@clerk/clerk-react";
import { createClerkSupabaseClient, resetClerkSupabaseClient } from "../lib/supabase";


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

export default function Dashboard() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useAuth();
  const [userRole, setUserRole] = useState<'NO_ROLE' | 'SUPERADMIN_ROLE' | 'BOD_ROLE' | 'SALES_MANAGER_ROLE' | 'SALES_SUPERVISOR_ROLE' | 'AUDITOR_ROLE' | null>(null);
  const [currentUserLocations, setCurrentUserLocations] = useState<number[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [timePeriod, setTimePeriod] = useState("1");
  const [viewBy, setViewBy] = useState("location");
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
          console.log('Current User Role:', data.role);
          console.log('Current User Locations (original):', data.locations, 'Converted:', userLocations);
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
        console.log('All locations fetched:', allLocationsData.map(l => ({ id: l.id, name: l.name, is_active: l.is_active })));
        console.log('Location 1000007 exists:', allLocationsData.some(l => l.id === 1000007));
        const location1000007 = allLocationsData.find(l => l.id === 1000007);
        console.log('Location 1000007 details:', location1000007);
      };

      fetchData();
    }
  }, [userRole, supabaseClient]);

  // Separate effect to fetch locations when supabaseClient is available (for proper lookup)
  useEffect(() => {
    if (supabaseClient && allLocations.length === 0) {
      const fetchLocations = async () => {
        console.log('Fetching locations for lookup...');
        const { data: locationsData, error: locationsError } = await supabaseClient
          .from('master_locations')
          .select('*');

        if (locationsError) {
          console.error('Error fetching locations for lookup:', locationsError);
          return;
        }

        const allLocationsData = locationsData || [];
        setAllLocations(allLocationsData);
        console.log('Locations for lookup fetched:', allLocationsData.length, 'locations');
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

  // Process stock data for display (filter by user role and location, then aggregate by category)
  const processedStockData = useMemo(() => {
    if (!stockData.length) return [];

    let filteredData = stockData;

    // Filter for sales roles based on their assigned locations
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
    }

    // Filter to show only Raw Materials (BB) for now
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
  }, [stockData, userRole, currentUserLocations]);

  // Mock data for sales (varies by time period)
  const getSalesData = (period: string) => {
    const baseData = [
      { name: "Jakarta", value: 145, category: "Premium" },
      { name: "Surabaya", value: 98, category: "Standar" },
      { name: "Bandung", value: 67, category: "Organik" },
      { name: "Medan", value: 89, category: "Premium" },
      { name: "Yogyakarta", value: 45, category: "Standar" },
    ];

    const multiplier = period === "1" ? 1 : period === "2" ? 1.8 : 2.5;
    let data = baseData.map(item => ({ ...item, value: Math.round(item.value * multiplier) }));

    // Filter for sales roles
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      data = data.filter(item => currentUserLocationNames.includes(item.name));
    }

    return data;
  };

  // Mock data for purchases
  const getPurchaseData = (period: string) => {
    const baseData = [
      { name: "Petani Lokal - Jawa", value: 200, category: "Beras Mentah" },
      { name: "Koperasi - Sumatera", value: 150, category: "Beras Mentah" },
      { name: "Supplier Premium", value: 80, category: "Beras Khusus" },
      { name: "Perkebunan Organik", value: 60, category: "Beras Organik" },
    ];

    const multiplier = period === "1" ? 1 : period === "2" ? 1.9 : 2.7;
    let data = baseData.map(item => ({ ...item, value: Math.round(item.value * multiplier) }));

    // Filter for sales roles (assuming purchases are associated with locations, but since mock doesn't have location, skip for now or add location to mock)
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      // For purchases, since mock doesn't have location, show all for now
    }

    return data;
  };

  const pieColors = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'];

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

    console.log("ALL LOCATION ", allLocations.length, "locations:", allLocations.map(l => ({ id: l.id, name: l.name })));
    console.log("Looking for location IDs:", locationIds);

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

  const salesData = useMemo(() => getSalesData(timePeriod), [timePeriod, userRole, currentUserLocations]);
  const purchaseData = useMemo(() => getPurchaseData(timePeriod), [timePeriod, userRole, currentUserLocations]);
  const totalSales = useMemo(() => salesData.reduce((sum, item) => sum + item.value, 0), [salesData]);
  const totalPurchases = useMemo(() => purchaseData.reduce((sum, item) => sum + item.value, 0), [purchaseData]);
  const totalStockBB = useMemo(() =>
    processedStockData.reduce((sum, item) => sum + item.quantity, 0),
    [processedStockData]
  );

  const totalStockFG = useMemo(() => {
    if (!stockData.length) return 0;

    let filteredData = stockData;

    // Filter for sales roles based on their assigned locations
    if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
      const currentUserLocationNames = getCurrentUserLocationNames();
      filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
    }

    // Calculate FG total from filtered data (before BB-only filtering)
    return filteredData
      .filter(item => item.product_type === 'FINISHED GOODS')
      .reduce((sum, item) => sum + Number(item.sumqtyonhand), 0);
  }, [stockData, userRole, currentUserLocations]);


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
                <h1 className="text-xl font-bold text-green-800">Sistem Monitoring</h1>
                <p className="text-sm text-green-600">Dashboard Operasional</p>
              </div>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Stok BB</p>
                <p className="text-2xl font-bold text-green-800">{totalStockBB.toLocaleString()} ton</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Total Stok FG</p>
                <p className="text-2xl font-bold text-green-800">{totalStockFG.toLocaleString()} ton</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Penjualan ({timePeriod} bulan)</p>
                <p className="text-2xl font-bold text-green-800">{totalSales} ton</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          
          <Card className="p-4 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">Pembelian ({timePeriod} bulan)</p>
                <p className="text-2xl font-bold text-green-800">{totalPurchases} ton</p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-600" />
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

        {/* Main Tabs */}
        <Tabs defaultValue="stocks" className="space-y-4">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex bg-green-100 p-1 rounded-lg min-w-max">
              <TabsTrigger value="stocks" className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-3 py-2">
                Level Stok BB
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
          <TabsContent value="stocks" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                  <Select value={viewBy} onValueChange={setViewBy}>
                    <SelectTrigger className="w-full sm:w-40 border-green-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">Berdasarkan Lokasi</SelectItem>
                      <SelectItem value="category">Berdasarkan Kategori</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Stock List */}
                  <div className="space-y-3">
                    {isLoadingStock ? (
                      <div className="text-center py-8 text-green-600">Memuat data stok...</div>
                    ) : processedStockData.length === 0 ? (
                      <div className="text-center py-8 text-green-600">Tidak ada data stok untuk lokasi Anda</div>
                    ) : (
                      processedStockData.map((item, index) => (
                        <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-100">
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
                              <p className="font-bold text-green-800">{item.quantity} {item.unit}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Stock Chart */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedStockData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                        <XAxis
                          dataKey="location"
                          tick={{ fontSize: 12 }}
                          stroke="#166534"
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="#166534" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px'
                          }}
                          labelFormatter={(label) => `Location: ${label}`}
                          formatter={(value, name, props) => [
                            `${value} ${props.payload?.unit || 'ton'}`,
                            props.payload?.category || 'Category'
                          ]}
                        />
                        <Bar dataKey="quantity" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Sales Data Tab */}
          <TabsContent value="sales" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-green-800">Analitik Penjualan</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-full sm:w-32 border-green-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Bulan</SelectItem>
                        <SelectItem value="2">2 Bulan</SelectItem>
                        <SelectItem value="3">3 Bulan</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={viewBy} onValueChange={setViewBy}>
                      <SelectTrigger className="w-full sm:w-40 border-green-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="location">Berdasarkan Lokasi</SelectItem>
                        <SelectItem value="category">Berdasarkan Kategori</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sales Chart */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          stroke="#166534"
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="#166534" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#f0fdf4', 
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Sales Pie Chart */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}t`}
                        >
                          {salesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Sales Summary */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <p className="text-green-800">
                    <strong>Total Penjualan ({timePeriod} bulan):</strong> {totalSales} ton
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Purchase Data Tab */}
          <TabsContent value="purchases" className="space-y-4">
            <Card className="border-green-200">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-green-800">Analitik Pembelian</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger className="w-full sm:w-32 border-green-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Bulan</SelectItem>
                        <SelectItem value="2">2 Bulan</SelectItem>
                        <SelectItem value="3">3 Bulan</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={viewBy} onValueChange={setViewBy}>
                      <SelectTrigger className="w-full sm:w-40 border-green-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="location">Berdasarkan Lokasi</SelectItem>
                        <SelectItem value="category">Berdasarkan Kategori</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Purchase Chart */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={purchaseData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          stroke="#166534"
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="#166534" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#f0fdf4', 
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" fill="#15803d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Purchase Distribution */}
                  <div className="space-y-3">
                    {purchaseData.map((item, index) => (
                      <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium text-green-800">{item.name}</h4>
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700 mt-1">
                              {item.category}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-800">{item.value} tons</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Purchase Summary */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <p className="text-green-800">
                    <strong>Total Pembelian ({timePeriod} bulan):</strong> {totalPurchases} ton
                  </p>
                </div>
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
        </Tabs>
      </main>
    </div>
  );
}