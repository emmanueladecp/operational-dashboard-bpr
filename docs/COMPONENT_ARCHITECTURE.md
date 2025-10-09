# Component Architecture Deep Dive

## Overview

This document provides a detailed analysis of the component architecture, focusing on the Dashboard component as the primary application interface and the supporting UI component library.

## Dashboard Component Architecture

### Component Structure

```
Dashboard.tsx (1,685 lines)
├── State Management Layer
│   ├── Authentication State (Clerk)
│   ├── User Management State
│   ├── Location Management State
│   └── Stock Data State
├── Business Logic Layer
│   ├── Data Processing Functions
│   ├── Filtering Logic
│   └── Aggregation Functions
├── UI Rendering Layer
│   ├── Tab-based Navigation
│   ├── Data Visualization
│   └── Interactive Controls
└── Event Handling Layer
    ├── User Actions
    ├── Location Management
    └── Data Operations
```

### State Management Architecture

#### Authentication State
```typescript
// Clerk integration with custom hooks
const { session } = useSession();
const { user, isLoaded } = useUser();
const { signOut: clerkSignOut } = useAuth();

// Custom state for role-based access
const [userRole, setUserRole] = useState<UserRole>(null);
const [currentUserLocations, setCurrentUserLocations] = useState<number[]>([]);
```

#### Data State Management
```typescript
// Location data
const [allLocations, setAllLocations] = useState<Location[]>([]);
const [selectedLocations, setSelectedLocations] = useState<number[]>([]);

// User management
const [allUsers, setAllUsers] = useState<User[]>([]);
const [editingUser, setEditingUser] = useState<User | null>(null);

// Stock data
const [stockData, setStockData] = useState<any[]>([]);
const [isLoadingStock, setIsLoadingStock] = useState(true);
const [locationFilter, setLocationFilter] = useState<string[]>(['all']);
```

### Business Logic Layer

#### Data Processing Functions

**Stock Data Processing:**
```typescript
// Raw materials processing (BB)
const processedStockDataBB = useMemo(() => {
  let filteredData = stockData;

  // Apply role-based filtering
  if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
    const currentUserLocationNames = getCurrentUserLocationNames();
    filteredData = stockData.filter(item => currentUserLocationNames.includes(item.location));
  }

  // Apply location filter
  if (!locationFilter.includes('all') && locationFilter.length > 0) {
    filteredData = filteredData.filter(item => locationFilter.includes(item.location));
  }

  // Filter for raw materials only
  filteredData = filteredData.filter(item => item.product_type === 'RAW MATERIAL');

  // Aggregate by category and location
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

  return Array.from(aggregatedMap.values()).sort((a, b) => {
    if (a.location !== b.location) {
      return a.location.localeCompare(b.location);
    }
    return a.category.localeCompare(b.category);
  });
}, [stockData, userRole, currentUserLocations, locationFilter]);
```

**Finished Goods Processing:**
```typescript
// Similar logic for finished goods (FG)
const processedStockDataFG = useMemo(() => {
  // ... identical filtering logic but for 'FINISHED GOODS'
}, [stockData, userRole, currentUserLocations, locationFilter]);
```

#### Analytics Data Processing

**Sales Data Generation:**
```typescript
const getSalesData = (period: string) => {
  const baseData = [
    { name: "Jakarta", value: 145, category: "Premium" },
    { name: "Surabaya", value: 98, category: "Standar" },
    // ... more locations
  ];

  const multiplier = period === "1" ? 1 : period === "2" ? 1.8 : 2.5;
  let data = baseData.map(item => ({
    ...item,
    value: Math.round(item.value * multiplier)
  }));

  // Apply role-based filtering
  if (userRole === 'SALES_MANAGER_ROLE' || userRole === 'SALES_SUPERVISOR_ROLE') {
    const currentUserLocationNames = getCurrentUserLocationNames();
    data = data.filter(item => currentUserLocationNames.includes(item.name));
  }

  return data;
};
```

### UI Architecture

#### Tab-Based Navigation System

```typescript
<Tabs defaultValue="stocks-bb" className="space-y-4">
  <TabsList className="inline-flex bg-green-100 p-1 rounded-lg min-w-max">
    <TabsTrigger value="stocks-bb">Level Stok BB</TabsTrigger>
    <TabsTrigger value="stocks-fg">Level Stok FG</TabsTrigger>
    <TabsTrigger value="sales">Data Penjualan</TabsTrigger>
    <TabsTrigger value="purchases">Data Pembelian</TabsTrigger>
    {canAccessRestricted && (
      <>
        <TabsTrigger value="users">Management User</TabsTrigger>
        <TabsTrigger value="locations">Management Lokasi</TabsTrigger>
      </>
    )}
  </TabsList>
</Tabs>
```

#### Role-Based Rendering

**Access Control Logic:**
```typescript
const canAccessRestricted = userRole === 'SUPERADMIN_ROLE';

// Conditional rendering based on permissions
{canAccessRestricted && (
  <TabsContent value="users">
    {/* User management interface */}
  </TabsContent>
)}
```

### Event Handling Architecture

#### User Management Operations

**CRUD Operations Pattern:**
```typescript
// Create User
const handleAddUser = () => {
  setEditingUser(null);
  setNewUsername('');
  setNewPassword('');
  setNewUserRole('');
  setSelectedLocations([]);
  setIsUserDialogOpen(true);
};

// Update User
const handleEditUser = (user: User) => {
  setEditingUser(user);
  setSelectedLocations(user.locations || []);
  setIsUserDialogOpen(true);
};

// Save User (Create or Update)
const handleSaveUser = async () => {
  if (!supabaseClient) return;

  try {
    if (editingUser) {
      // Update existing user via Edge Function
      const { data, error } = await supabaseClient.functions.invoke('create-user', {
        body: {
          action: 'update-user',
          clerkId: editingUser.clerk_id,
          role: editingUser.role,
          locations: selectedLocations
        }
      });
    } else {
      // Create new user via Edge Function
      const { data, error } = await supabaseClient.functions.invoke('create-user', {
        body: {
          action: 'create-user',
          username: newUsername,
          password: newPassword,
          role: newUserRole,
          locations: selectedLocations
        }
      });
    }
  } catch (error) {
    // Error handling
  }
};
```

#### Location Management Operations

**Location CRUD Pattern:**
```typescript
// Create Location
const handleAddLocation = () => {
  setEditingLocation({ id: 0, name: '', value: '', is_active: true });
  setIsLocationDialogOpen(true);
};

// Update Location
const handleEditLocation = (location: Location) => {
  setEditingLocation(location);
  setIsLocationDialogOpen(true);
};

// Save Location
const handleSaveLocation = async () => {
  if (editingLocation && supabaseClient) {
    const locData = {
      name: editingLocation.name,
      value: editingLocation.value,
      is_active: editingLocation.is_active,
    };

    // Insert or update based on ID
    if (editingLocation.id === 0) {
      await supabaseClient.from('master_locations').insert(locData);
    } else {
      await supabaseClient.from('master_locations').update(locData).eq('id', editingLocation.id);
    }
  }
};
```

## UI Component Library Architecture

### Component Categories

#### 1. Form Components
- **Input Components**: Text inputs, select dropdowns, checkboxes
- **Validation**: Built-in validation with error states
- **Accessibility**: Proper ARIA labels and keyboard navigation

#### 2. Data Display Components
- **Table Components**: Sortable, filterable data tables
- **Card Components**: Information display cards
- **Badge Components**: Status indicators and labels

#### 3. Navigation Components
- **Tab Components**: Tab-based navigation with state management
- **Dialog Components**: Modal dialogs for user interactions
- **Menu Components**: Context menus and dropdowns

#### 4. Feedback Components
- **Alert Components**: Success, error, and warning messages
- **Loading Components**: Skeleton loaders and spinners
- **Toast Components**: Non-intrusive notifications

### Design System Architecture

#### Color System
```typescript
// Role-based color coding
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
```

#### Typography System
- **Heading Hierarchy**: Consistent heading sizes and weights
- **Body Text**: Readable font sizes with proper line heights
- **Label Text**: Form labels with consistent styling

#### Spacing System
- **Consistent Margins**: Standardized spacing between components
- **Grid System**: Responsive grid layouts for different screen sizes
- **Container Padding**: Consistent internal spacing

### Responsive Design Architecture

#### Breakpoint Strategy
```typescript
// Mobile-first responsive design
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Responsive grid that adapts to screen size */}
</div>
```

#### Mobile-Specific Patterns
- **Card-based Layouts**: Mobile-friendly card interfaces
- **Collapsible Sections**: Space-efficient mobile navigation
- **Touch-friendly Controls**: Appropriately sized touch targets

## Data Visualization Architecture

### Chart Component Integration

#### Recharts Integration
```typescript
// Bar chart for stock levels
<ResponsiveContainer width="100%" height="100%">
  <BarChart data={processedStockData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#dcfce7" />
    <XAxis dataKey="location" tick={{ fontSize: 12 }} stroke="#166534" />
    <YAxis tick={{ fontSize: 12 }} stroke="#166534" />
    <Tooltip contentStyle={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }} />
    <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
      {processedStockData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={getCategoryColor(entry.category, index)} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

#### Color Management System
```typescript
// Dynamic color assignment for categories
const getCategoryColor = (category: string, index: number) => {
  // Check if color already assigned
  if (categoryColorMap.has(category)) {
    return categoryColorMap.get(category);
  }

  // Generate consistent color using hashing algorithm
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    const char = category.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const colorIndex = Math.abs(hash) % categoryColors.length;
  const selectedColor = categoryColors[colorIndex];

  // Ensure color uniqueness
  for (let i = 1; i < categoryColors.length; i++) {
    const checkIndex = (colorIndex + i) % categoryColors.length;
    if (!Array.from(categoryColorMap.values()).includes(categoryColors[checkIndex])) {
      const finalColor = categoryColors[checkIndex];
      categoryColorMap.set(category, finalColor);
      return finalColor;
    }
  }

  categoryColorMap.set(category, selectedColor);
  return selectedColor;
};
```

## Performance Optimization Patterns

### Memoization Strategy
```typescript
// Expensive calculations are memoized
const processedStockData = useMemo(() => {
  // Complex data processing logic
}, [stockData, userRole, currentUserLocations, locationFilter]);

const salesData = useMemo(() => getSalesData(timePeriod), [timePeriod, userRole, currentUserLocations]);
const totalSales = useMemo(() => salesData.reduce((sum, item) => sum + item.value, 0), [salesData]);
```

### Lazy Loading Patterns
- **Component Lazy Loading**: Heavy components load on-demand
- **Data Lazy Loading**: Data fetches based on user interactions
- **Image Lazy Loading**: Images load as they enter viewport

### Memory Management
- **State Cleanup**: Proper state cleanup on component unmount
- **Event Listener Management**: Appropriate event listener handling
- **Memory Leak Prevention**: Careful subscription management

## Accessibility Architecture

### ARIA Implementation
- **Proper Labeling**: All interactive elements have appropriate labels
- **Keyboard Navigation**: Full keyboard accessibility support
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **Focus Management**: Proper focus handling in modal dialogs

### Inclusive Design Patterns
- **Color Contrast**: WCAG compliant color combinations
- **Font Sizes**: Minimum 16px font sizes for readability
- **Touch Targets**: Minimum 44px touch targets for mobile
- **Motion Preferences**: Respects user's motion preferences

## Testing Architecture

### Component Testing Strategy
- **Unit Tests**: Individual component logic testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full user workflow testing
- **Accessibility Tests**: Automated accessibility validation

### Test Data Management
- **Mock Data**: Realistic test data for consistent testing
- **Factory Functions**: Test data generation utilities
- **Snapshot Testing**: UI regression testing

---

*This component architecture document provides an in-depth analysis of the system's component design, state management patterns, and user interface architecture. It serves as a technical reference for developers working on component enhancements and maintenance.*