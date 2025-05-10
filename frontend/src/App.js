import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Pie, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import './App.css';

const API_BASE_URL = 'http://localhost:5001';

// Add a custom logger function
const log = (message, level = 'info') => {
  const logLevel = process.env.REACT_APP_LOG_LEVEL || 'info';
  const levels = ['error', 'warn', 'info', 'debug'];
  if (levels.indexOf(level) <= levels.indexOf(logLevel)) {
    console[level](message);
  }
};

function App() {
  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);
  // Add loading state
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  // Add assets state (separate from monthlyAssets for direct manipulation)
  const [assets, setAssets] = useState([]);
  
  // Format currency - wrapped in useCallback to avoid dependency changes
  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }, []);
  
  // Apply dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Current date information
  const currentDate = new Date();
  // eslint-disable-next-line no-unused-vars
  const currentMonth = currentDate.getMonth() + 1; // Add 1 to make January = 1

  // Month/Year Selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // eslint-disable-next-line no-unused-vars
  const [availableMonths, setAvailableMonths] = useState([]);
  
  // Prepopulate the year dropdown with a range of years from 1990 to 2100
  const yearRange = Array.from({ length: 2100 - 1990 + 1 }, (_, i) => 1990 + i);

  // Add this function to fetch available months and years
  const fetchAvailableMonths = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/portfolio/months`);
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Find the most recent available data
        const sortedData = [...response.data].sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
        const latestData = sortedData[0];
        
        // Set the selectedMonth and selectedYear to the latest available data
        setSelectedMonth(latestData.month + 1); // Adding 1 because API months are 0-indexed
        setSelectedYear(latestData.year);
        log(`Setting latest available data: Month ${latestData.month + 1}, Year ${latestData.year}`, 'debug');
      }
    } catch (error) {
      log('Error fetching available months: ' + error, 'error');
    }
  };

  // Add this effect to run once on component mount to initialize with latest data
  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  // Function to load assets from backend - wrapped in useCallback to avoid dependency issues
  const loadAssetsFromBackend = useCallback(async () => {
    try {
      setLoading(true);
      log(`Fetching data for month: ${selectedMonth}, year: ${selectedYear}`, 'debug');
      const response = await axios.get(
        `${API_BASE_URL}/portfolio?month=${selectedMonth}&year=${selectedYear}`
      );
      
      if (response.data && Array.isArray(response.data)) {
        log('Data received: ' + JSON.stringify(response.data), 'debug');
        setAssets(response.data);
        // Set currentAssets to display the data
        setCurrentAssets(response.data);
      } else {
        log('No data found for the selected month and year', 'warn');
        setAssets([]);
        setCurrentAssets([]);
      }
    } catch (error) {
      log('Error loading assets from backend: ' + error, 'error');
      setAssets([]);
      setCurrentAssets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Update this effect to properly depend on loadAssetsFromBackend
  useEffect(() => {
    loadAssetsFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  // Assets & Portfolio Data - use a ref for stable monthly assets
  const [currentAssets, setCurrentAssets] = useState([]);
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('asset_name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Track first load to prevent unnecessary API calls
  // eslint-disable-next-line no-unused-vars
  const [initialized] = useState(false);
  
  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // Month names for labels
  const monthNames = useMemo(() => [
    "", // Add empty string at index 0 
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);
  
  // Generate key for monthly asset storage
  const getMonthKey = useCallback((month, year) => {
    return `${year}-${month}`;
  }, []);
  
  // Current month key
  // eslint-disable-next-line no-unused-vars
  const selectedMonthKey = useMemo(() => 
    getMonthKey(selectedMonth, selectedYear), 
    [getMonthKey, selectedMonth, selectedYear]
  );

  // Calculate total portfolio value for the selected month
  const totalPortfolioValue = useMemo(() => 
    currentAssets.reduce((sum, asset) => sum + asset.asset_value, 0),
    [currentAssets]
  );

  // Update the addAsset function to refresh the Assets section immediately
  const addAsset = async (e) => {
    e.preventDefault();
    if (!assetName || !assetValue) {
      log('Validation failed: Asset name or value is missing', 'warn');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/portfolio`, {
        asset_name: assetName,
        asset_value: parseFloat(assetValue),
        month: selectedMonth, // Convert 1-based to 0-based for API
        year: selectedYear    // Include selected year
      });
      
      if (response.data) {
        // Update the assets and currentAssets states
        const updatedAssets = [...assets, response.data];
        setAssets(updatedAssets);
        setCurrentAssets(updatedAssets);
        
        // Refresh the graph data
        const updatedChartData = await axios.get(`${API_BASE_URL}/portfolio/performance/${selectedYear}`);
        if (updatedChartData.data && Array.isArray(updatedChartData.data)) {
          setChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            values: updatedChartData.data,
          });
        }

        // Clear form fields
        setAssetName('');
        setAssetValue('');
      }
    } catch (error) {
      log('Error adding asset: ' + error, 'error');
    }
  };

  // Update existing asset - wrapped in useCallback to improve stability
  const handleEditClick = useCallback((asset) => {
    setEditingAsset(asset);
    setEditValue(asset.asset_value);
    setShowEditModal(true);
  }, []);
  
  // Save edited asset - wrapped in useCallback
  const handleSaveEdit = useCallback(async () => {
    if (!editingAsset || !editValue) return;

    try {
      const response = await axios.put(`${API_BASE_URL}/portfolio/${editingAsset.id}`, {
        asset_name: editingAsset.asset_name,
        asset_value: parseFloat(editValue),
        month: selectedMonth, // Convert 1-based to 0-based for API
        year: selectedYear
      });

      if (response.data) {
        // Update assets array with the edited asset
        const updatedAssets = assets.map(asset => 
          asset.id === editingAsset.id ? 
          { ...asset, asset_value: parseFloat(editValue) } : 
          asset
        );

        setAssets(updatedAssets);
        setCurrentAssets(updatedAssets);

        // Refresh the graph data
        const updatedChartData = await axios.get(`${API_BASE_URL}/portfolio/performance/${selectedYear}`);
        if (updatedChartData.data && Array.isArray(updatedChartData.data)) {
          setChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            values: updatedChartData.data,
          });
        }

        // Close modal
        setShowEditModal(false);
        setEditingAsset(null);
        setEditValue('');
      }
    } catch (error) {
      log('Error updating asset: ' + error, 'error');
    }
  }, [editingAsset, editValue, selectedMonth, selectedYear, assets]);
  
  // Delete asset - wrapped in useCallback
  const deleteAsset = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/portfolio/${id}`);

      if (response.status === 200) {
        // Remove the deleted asset from the assets array
        const updatedAssets = assets.filter(asset => asset.id !== id);
        setAssets(updatedAssets);
        setCurrentAssets(updatedAssets);

        // Refresh the graph data
        const updatedChartData = await axios.get(`${API_BASE_URL}/portfolio/performance/${selectedYear}`);
        if (updatedChartData.data && Array.isArray(updatedChartData.data)) {
          setChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            values: updatedChartData.data,
          });
        }
      }
    } catch (error) {
      log('Error deleting asset: ' + error, 'error');
    }
  }, [assets, selectedYear]);

  // Calculate percentage allocation for each asset
  const assetsWithAllocation = useMemo(() => 
    currentAssets.map(asset => ({
      ...asset,
      allocation: totalPortfolioValue > 0 ? ((asset.asset_value / totalPortfolioValue) * 100).toFixed(2) : 0
    })),
    [currentAssets, totalPortfolioValue]
  );

  // Sort assets based on the current sort field and direction
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      // If clicking on the same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  // Sort assets based on current sort settings
  const sortedAssetsWithAllocation = useMemo(() => {
    return [...assetsWithAllocation].sort((a, b) => {
      if (sortField === 'asset_name') {
        return sortDirection === 'asc' 
          ? a.asset_name.localeCompare(b.asset_name)
          : b.asset_name.localeCompare(a.asset_name);
      } else if (sortField === 'asset_value') {
        return sortDirection === 'asc'
          ? a.asset_value - b.asset_value
          : b.asset_value - a.asset_value;
      } else if (sortField === 'allocation') {
        return sortDirection === 'asc'
          ? parseFloat(a.allocation) - parseFloat(b.allocation)
          : parseFloat(b.allocation) - parseFloat(a.allocation);
      }
      return 0;
    });
  }, [assetsWithAllocation, sortField, sortDirection]);

  // State for chart data
  const [chartData, setChartData] = useState({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    values: [],
  });

  // Fetch chart data using useEffect
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/portfolio/performance/${selectedYear}`);
        if (response.data && Array.isArray(response.data)) {
          setChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            values: response.data,
          });
        }
      } catch (error) {
        log('Error fetching chart data: ' + error, 'error');
        setChartData({
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          values: [],
        });
      }
    };

    fetchChartData();
  }, [selectedYear]); // Depend on selectedYear to refetch when it changes

  // Simplified and stable monthly progress data with minimalist styling
  const monthlyProgressData = useMemo(() => ({
    labels: chartData.labels,
    datasets: [
      {
        label: 'Portfolio Value',
        data: chartData.values,
        borderColor: darkMode ? '#60A5FA' : '#3B82F6',
        backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBorderWidth: 2,
        pointBackgroundColor: darkMode ? '#60A5FA' : '#3B82F6',
        pointBorderColor: darkMode ? '#1F2937' : 'white',
      },
    ],
  }), [chartData, darkMode]);
  
  // Minimalist pie chart data for asset allocation
  const pieData = useMemo(() => ({
    labels: sortedAssetsWithAllocation.map(asset => asset.asset_name),
    datasets: [
      {
        data: sortedAssetsWithAllocation.map(asset => asset.asset_value),
        backgroundColor: darkMode ? 
          ['#60A5FA', '#93C5FD', '#BFDBFE', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'] : 
          ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#EFF6FF', '#DBEAFE', '#2563EB', '#1D4ED8'],
        borderColor: darkMode ? '#111827' : 'white',
        borderWidth: 1,
      },
    ],
  }), [sortedAssetsWithAllocation, darkMode]);
  
  // Chart options with minimalist styling
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: darkMode ? '#111827' : 'white',
        titleColor: darkMode ? '#F9FAFB' : '#111827',
        bodyColor: darkMode ? '#F9FAFB' : '#111827',
        borderColor: darkMode ? '#1F2937' : '#E5E7EB',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
        displayColors: false,
        callbacks: {
          label: (context) => `${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: darkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)',
          drawBorder: false,
        },
        ticks: {
          color: darkMode ? '#9CA3AF' : '#6B7280',
          padding: 8,
          callback: (value) => formatCurrency(value),
          font: {
            size: 10,
          }
        }
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: darkMode ? '#9CA3AF' : '#6B7280',
          padding: 8,
          font: {
            size: 10,
          }
        }
      }
    },
  }), [darkMode, formatCurrency]);

  // Simplified pie chart options
  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: darkMode ? '#111827' : 'white',
        titleColor: darkMode ? '#F9FAFB' : '#111827',
        bodyColor: darkMode ? '#F9FAFB' : '#111827',
        borderColor: darkMode ? '#1F2937' : '#E5E7EB',
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
        callbacks: {
          label: (context) => {
            const asset = sortedAssetsWithAllocation[context.dataIndex];
            return `${asset.asset_name}: ${formatCurrency(asset.asset_value)} (${asset.allocation}%)`;
          }
        }
      }
    },
    cutout: '65%',
    borderRadius: 2,
  }), [darkMode, formatCurrency, sortedAssetsWithAllocation]);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header Bar with improved spacing and minimalist look */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-2xl font-light tracking-wide">Portfolio Tracker</h1>
          
          {/* Dark Mode Toggle with improved styling */}
          <div className="flex items-center">
            <span className="mr-2 text-sm font-light text-gray-500 dark:text-gray-400">
              {darkMode ? 'Dark' : 'Light'}
            </span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={() => setDarkMode(!darkMode)} 
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        {/* Date selector with minimalist design */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-sm font-light text-gray-500 dark:text-gray-400">
            {monthNames[selectedMonth]} {selectedYear}
          </div>
          
          <div className="flex space-x-2">
            <select 
              className="form-control text-sm py-1 px-3"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ maxWidth: '120px' }}
            >
              {monthNames.slice(1).map((month, index) => (
                <option key={index + 1} value={index + 1}>{month}</option>
              ))}
            </select>
            
            <select 
              className="form-control text-sm py-1 px-3"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ maxWidth: '100px' }}
            >
              {yearRange.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Portfolio Summary Card with minimalist design */}
          <div className={`lg:col-span-1 card p-5 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-light mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">Summary</h2>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Total Value</p>
              <p className="text-3xl font-light">{formatCurrency(totalPortfolioValue)}</p>
            </div>
            
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Asset Allocation</p>
            </div>
            
            {/* Pie Chart with minimalist design */}
            <div className="h-48 chart-container fade-in mb-4">
              {sortedAssetsWithAllocation.length > 0 ? (
                <Pie data={pieData} options={pieOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm font-light">No data available</p>
                </div>
              )}
            </div>
            
            {/* Legend with minimalist design */}
            <div className="mt-3 grid grid-cols-1 gap-2">
              {sortedAssetsWithAllocation.slice(0, 5).map((asset) => (
                <div key={asset.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <span 
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ 
                        backgroundColor: darkMode 
                          ? pieData.datasets[0].backgroundColor[sortedAssetsWithAllocation.indexOf(asset) % pieData.datasets[0].backgroundColor.length] 
                          : pieData.datasets[0].backgroundColor[sortedAssetsWithAllocation.indexOf(asset) % pieData.datasets[0].backgroundColor.length]
                      }}
                    ></span>
                    <span className="text-sm truncate max-w-[140px] font-light">{asset.asset_name}</span>
                  </div>
                  <span className="text-sm font-light">{asset.allocation}%</span>
                </div>
              ))}
              {sortedAssetsWithAllocation.length > 5 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  +{sortedAssetsWithAllocation.length - 5} more assets
                </p>
              )}
            </div>
          </div>
        
          {/* Main Content Area with minimalist design */}
          <div className={`lg:col-span-2 card p-5 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Portfolio Performance Chart with minimalist design */}
            <div className="mb-6">
              <h2 className="text-lg font-light mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">Performance</h2>
              <div className="chart-container h-60 fade-in">
                <Line data={monthlyProgressData} options={chartOptions} />
              </div>
            </div>
            
            {/* Assets Table with minimalist design */}
            <div className="mt-8">
              <h2 className="text-lg font-light mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">Assets</h2>
              
              {/* Add Asset Form with minimalist design */}
              <form onSubmit={addAsset} className="mb-6 grid grid-cols-5 gap-3 items-end">
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Asset Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="e.g., Stocks, Gold"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Value (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={assetValue}
                    onChange={(e) => setAssetValue(e.target.value)}
                    placeholder="e.g., 10000"
                    required
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="submit"
                    className="btn-minimal btn-primary w-full"
                  >
                    Add
                  </button>
                </div>
              </form>
              
              {/* Assets Table with minimalist design */}
              <div className="overflow-x-auto">
                <table className="table-minimal w-full">
                  <thead>
                    <tr>
                      <th 
                        className="text-left cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('asset_name')}
                      >
                        Asset
                        {sortField === 'asset_name' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th 
                        className="text-right cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('asset_value')}
                      >
                        Value
                        {sortField === 'asset_value' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th 
                        className="text-right cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('allocation')}
                      >
                        Allocation
                        {sortField === 'allocation' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssetsWithAllocation.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-8 text-gray-500 dark:text-gray-400 font-light">
                          No assets added yet for {monthNames[selectedMonth]} {selectedYear}
                        </td>
                      </tr>
                    ) : (
                      sortedAssetsWithAllocation.map((asset) => (
                        <tr key={asset.id}>
                          <td className="text-left font-light">
                            <div className="flex items-center">
                              <span 
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ 
                                  backgroundColor: darkMode 
                                    ? pieData.datasets[0].backgroundColor[sortedAssetsWithAllocation.indexOf(asset) % pieData.datasets[0].backgroundColor.length]
                                    : pieData.datasets[0].backgroundColor[sortedAssetsWithAllocation.indexOf(asset) % pieData.datasets[0].backgroundColor.length]
                                }}
                              ></span>
                              {asset.asset_name}
                            </div>
                          </td>
                          <td className="text-right font-light">{formatCurrency(asset.asset_value)}</td>
                          <td className="text-right font-light">{asset.allocation}%</td>
                          <td className="text-right">
                            <div className="flex justify-end space-x-2">
                              <button 
                                onClick={() => handleEditClick(asset)}
                                className="text-xs text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => deleteAsset(asset.id)}
                                className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Edit Modal with minimalist design */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-content p-5">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-light">Edit Asset</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                ✕
              </button>
            </div>
            <div className="mb-5">
              <p className="mb-3 text-sm font-light">{editingAsset?.asset_name}</p>
              <label className="block text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Value (₹)</label>
              <input
                type="number"
                className="form-control"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="e.g., 10000"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowEditModal(false)}
                className="btn-minimal btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-minimal btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
