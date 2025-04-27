import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Pie, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import './App.css';

const API_BASE_URL = 'http://localhost:5001';

function App() {
  // Current date information
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // Add 1 to make January = 1
  const currentYear = currentDate.getFullYear();

  // Month/Year Selection
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Assets & Portfolio Data - use a ref for stable monthly assets
  const [monthlyAssets, setMonthlyAssets] = useState({});
  const [currentAssets, setCurrentAssets] = useState([]);
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('asset_name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Track first load to prevent unnecessary API calls
  const [initialized, setInitialized] = useState(false);
  
  // Available years from database
  const [availableYears, setAvailableYears] = useState([]);
  
  // Chart Views
  const [showYearlyView, setShowYearlyView] = useState(false);
  
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
  const selectedMonthKey = useMemo(() => 
    getMonthKey(selectedMonth, selectedYear), 
    [getMonthKey, selectedMonth, selectedYear]
  );

  // Load assets from backend - ensure this is stable between renders
  const loadAssetsFromBackend = useCallback(async () => {
    try {
      // Use the new API format to fetch assets for a specific month/year
      // Convert 1-based month to 0-based month for the API
      const response = await axios.get(`${API_BASE_URL}/portfolio`, {
        params: {
          month: selectedMonth - 1, // Convert 1-based to 0-based for API
          year: selectedYear
        }
      });
      
      // Also fetch the list of available months with data
      const monthsResponse = await axios.get(`${API_BASE_URL}/portfolio/months`);
      console.log('Available months:', monthsResponse.data);
      // Fetch available years
      const yearsResponse = await axios.get(`${API_BASE_URL}/portfolio/years`);
      if (yearsResponse.data && yearsResponse.data.length > 0) {
        setAvailableYears(yearsResponse.data);
      } else {
        // Fallback to default years if API returns no data
        setAvailableYears([currentYear - 1, currentYear, currentYear + 1]);
      }
      
      // Create a new monthlyAssets object to store all data by month
      const updatedMonthlyAssets = { ...monthlyAssets };
      
      // Set current assets directly from the response
      setCurrentAssets(response.data);
      
      // If we have a list of available months, fetch data for each month
      if (monthsResponse.data && monthsResponse.data.length > 0) {
        // Process all months data
        for (const monthData of monthsResponse.data) {
          // Convert 0-based month from API to 1-based month for display
          const month = monthData.month;
          const year = monthData.year;
          const monthKey = getMonthKey(month, year);
          
          // If this month is already in our data, skip it
          if (updatedMonthlyAssets[monthKey] && updatedMonthlyAssets[monthKey].length > 0) {
            continue;
          }
          
          try {
            // Fetch data for this month/year
            const monthlyDataResponse = await axios.get(`${API_BASE_URL}/portfolio`, {
              params: {
                month: monthData.month, // Already 0-based from API
                year: monthData.year
              }
            });
            
            // Store the data in our monthly assets object
            updatedMonthlyAssets[monthKey] = monthlyDataResponse.data;
          } catch (error) {
            console.error(`Error fetching data for ${month}/${year}:`, error);
            updatedMonthlyAssets[monthKey] = [];
          }
        }
        
        // Make sure selected month data is set correctly
        const selectedKey = getMonthKey(selectedMonth, selectedYear);
        if (!updatedMonthlyAssets[selectedKey] || updatedMonthlyAssets[selectedKey].length === 0) {
          updatedMonthlyAssets[selectedKey] = response.data;
        }
      }
      
      // Set all monthly assets at once
      setMonthlyAssets(updatedMonthlyAssets);
      
      // Mark as initialized
      setInitialized(true);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  }, [getMonthKey, selectedMonth, selectedYear, monthlyAssets, currentYear]);
  
  // Initialize data only once
  useEffect(() => {
    if (!initialized) {
      loadAssetsFromBackend();
    }
  }, [initialized, loadAssetsFromBackend]);
  
  // Update currentAssets when selected month changes, but only use existing data
  useEffect(() => {
    if (initialized) {
      const assetsForMonth = monthlyAssets[selectedMonthKey] || [];
      setCurrentAssets(assetsForMonth);
    }
  }, [selectedMonthKey, monthlyAssets, initialized]);
  
  // Calculate total portfolio value for the selected month
  const totalPortfolioValue = useMemo(() => 
    currentAssets.reduce((sum, asset) => sum + asset.asset_value, 0),
    [currentAssets]
  );
  
  // Handle selecting a month/year
  const handleSelectMonth = useCallback(() => {
    // Make a new API call to fetch data for the selected month/year
    const fetchData = async () => {
      try {
        // Call the backend with the new month/year
        const response = await axios.get(`${API_BASE_URL}/portfolio`, {
          params: {
            month: selectedMonth - 1, // Convert 1-based to 0-based for API
            year: selectedYear
          }
        });
        
        // Update the current assets with the response
        setCurrentAssets(response.data);
        
        // Also update the monthly assets cache
        const updatedMonthlyAssets = { ...monthlyAssets };
        const selectedKey = getMonthKey(selectedMonth, selectedYear);
        updatedMonthlyAssets[selectedKey] = response.data;
        setMonthlyAssets(updatedMonthlyAssets);
        
      } catch (error) {
        console.error('Error fetching assets for selected month:', error);
      }
    };
    
    // Call the async function
    fetchData();
    
  }, [getMonthKey, monthlyAssets, selectedMonth, selectedYear]);

  // Add a new asset for the current month
  const addAsset = async (e) => {
    e.preventDefault();
    if (!assetName || !assetValue) {
      console.error('Validation failed: Asset name or value is missing');
      return;
    }

    try {
      // Add month and year to the request
      const response = await axios.post(`${API_BASE_URL}/portfolio`, {
        asset_name: assetName,
        asset_value: parseFloat(assetValue),
        month: selectedMonth - 1, // Convert 1-based to 0-based for API
        year: selectedYear    // Include selected year
      });
      
      // If successful, update local state for the selected month
      if (response.data) {
        // Create a NEW object to ensure React detects the change
        const updatedMonthlyAssets = { ...monthlyAssets };
        
        // If there's no array for this month yet, create one
        const monthKey = getMonthKey(selectedMonth, selectedYear);
        if (!updatedMonthlyAssets[monthKey]) {
          updatedMonthlyAssets[monthKey] = [];
        }
        
        // Add the new asset to the selected month's array
        updatedMonthlyAssets[monthKey] = [
          ...updatedMonthlyAssets[monthKey],
          response.data
        ];
        
        // Update state with the new object
        setMonthlyAssets(updatedMonthlyAssets);
        setCurrentAssets([...updatedMonthlyAssets[monthKey]]);
        
        // Clear form fields
        setAssetName('');
        setAssetValue('');
      }
    } catch (error) {
      console.error('Error adding asset:', error);
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
      // Update in backend, include month and year to ensure proper data model
      await axios.put(`${API_BASE_URL}/portfolio/${editingAsset.id}`, {
        asset_name: editingAsset.asset_name,
        asset_value: parseFloat(editValue),
        month: selectedMonth - 1, // Convert 1-based to 0-based for API
        year: selectedYear
      });
      
      // Create a NEW object for monthly assets
      const updatedMonthlyAssets = { ...monthlyAssets };
      
      // Create a NEW array for the current month's assets
      const assetsForMonth = updatedMonthlyAssets[selectedMonthKey] 
        ? [...updatedMonthlyAssets[selectedMonthKey]] 
        : [];
      
      // Find and update the asset
      const assetIndex = assetsForMonth.findIndex(a => a.id === editingAsset.id);
      if (assetIndex !== -1) {
        // Create a NEW object for the updated asset
        assetsForMonth[assetIndex] = {
          ...assetsForMonth[assetIndex],
          asset_value: parseFloat(editValue),
          month: selectedMonth,
          year: selectedYear
        };
        
        // Update the month's assets with the new array
        updatedMonthlyAssets[selectedMonthKey] = assetsForMonth;
        
        // Update state with new objects
        setMonthlyAssets(updatedMonthlyAssets);
        setCurrentAssets([...assetsForMonth]);
      }
      
      // Reset modal state
      setShowEditModal(false);
      setEditingAsset(null);
      setEditValue('');
    } catch (error) {
      console.error("Error saving edit:", error);
    }
  }, [editingAsset, editValue, monthlyAssets, selectedMonthKey, selectedMonth, selectedYear]);
  
  // Delete asset - wrapped in useCallback
  const deleteAsset = useCallback(async (id) => {
    try {
      // Delete from backend
      await axios.delete(`${API_BASE_URL}/portfolio/${id}`);
      
      // Create NEW objects to ensure React detects changes
      const updatedMonthlyAssets = { ...monthlyAssets };
      const assetsForMonth = updatedMonthlyAssets[selectedMonthKey] || [];
      
      // Filter out the deleted asset
      updatedMonthlyAssets[selectedMonthKey] = assetsForMonth.filter(a => a.id !== id);
      
      // Update state with new objects
      setMonthlyAssets(updatedMonthlyAssets);
      setCurrentAssets([...updatedMonthlyAssets[selectedMonthKey]]);
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  }, [monthlyAssets, selectedMonthKey]);

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
    const sortableAssets = [...assetsWithAllocation];
    
    return sortableAssets.sort((a, b) => {
      let compareA, compareB;
      
      // Get the right values to compare based on field
      if (sortField === 'asset_name') {
        compareA = a.asset_name.toLowerCase();
        compareB = b.asset_name.toLowerCase();
      } else if (sortField === 'asset_value') {
        compareA = a.asset_value;
        compareB = b.asset_value;
      } else if (sortField === 'allocation') {
        compareA = parseFloat(a.allocation);
        compareB = parseFloat(b.allocation);
      }
      
      // Do the comparison based on direction
      if (sortDirection === 'asc') {
        if (compareA < compareB) return -1;
        if (compareA > compareB) return 1;
        return 0;
      } else {
        if (compareA > compareB) return -1;
        if (compareA < compareB) return 1;
        return 0;
      }
    });
  }, [assetsWithAllocation, sortField, sortDirection]);

  // Stable, simplified chart data preparation
  console.log(monthlyAssets);
  const chartData = useMemo(() => {
    // Filter to only months that have data
    const monthsWithData = Object.entries(monthlyAssets)
      .filter(([_, assets]) => assets && assets.length > 0)
      .map(([key, assets]) => ({
        key,
        total: assets.reduce((sum, asset) => sum + asset.asset_value, 0),
        // Parse month and year from key (format: "YYYY-MM")
        month: parseInt(key.split('-')[1]), // This is in 1-based format (1-12)
        year: parseInt(key.split('-')[0])
      }));
    
    console.log('Months with data:', monthsWithData);
    
    // Prepare data for either yearly or monthly view
    const labels = [];
    const values = [];
    
    if (showYearlyView) {
      // For yearly view - sort by year and keep the latest month of each year
      const yearlyData = {};
      monthsWithData.forEach(item => {
        if (!yearlyData[item.year] || yearlyData[item.year].month < item.month) {
          yearlyData[item.year] = item;
        }
      });
      
      // Convert to arrays for chart
      Object.keys(yearlyData).sort().forEach(year => {
        labels.push(year);
        values.push(yearlyData[year].total);
      });
    } else {
      // For monthly view - ensure we have entries for all 12 months
      // Create an array with all 12 months, with zeros for missing data
      const allMonthsData = [];
      for (let i = 1; i <= 12; i++) {  // Use 1-based indexing (1-12) for months
        // Find if we have data for this month
        const monthData = monthsWithData.find(
          item => (item.month === i) && (item.year === selectedYear)
        );
        
        if (monthData) {
          // Use the actual data if we have it
          allMonthsData.push({
            month: i,  // Already 1-based
            year: selectedYear,
            total: monthData.total
          });
        } else {
          // Create placeholder with zero value for missing months
          allMonthsData.push({
            month: i,  // Already 1-based
            year: selectedYear,
            total: 0
          });
        }
      }
      
      // Sort by month and create labels/values
      allMonthsData.sort((a, b) => a.month - b.month);
      
      allMonthsData.forEach(item => {
        // item.month is 1-based (1-12), but we need to use the correct index in monthNames array
        // Since monthNames has an empty string at index 0, we can use item.month directly
        labels.push(monthNames[item.month]);
        values.push(item.total);
      });
    }
    
    return { labels, values };
  }, [monthlyAssets, showYearlyView, monthNames, selectedYear]);
  
  // Simplified and stable monthly progress data
  const monthlyProgressData = useMemo(() => ({
    labels: chartData.labels,
    datasets: [
      {
        label: 'Portfolio Value',
        data: chartData.values,
        borderColor: '#36A2EB',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        fill: true,
      },
    ],
  }), [chartData]);
  
  // Completely simplified chart options - no animations
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `Portfolio Value: ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    }
  }), []);
  
  // Stable pie chart data
  const pieChartData = useMemo(() => ({
    labels: currentAssets.map(asset => asset.asset_name),
    datasets: [
      {
        data: currentAssets.map(asset => asset.asset_value),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ],
      },
    ],
  }), [currentAssets]);
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold text-center mb-8">Portfolio Aggregator</h1>
        
        {/* Month Selector */}
        <div className="bg-white shadow-md rounded p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Select Portfolio Period</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <label className="block text-gray-700 text-sm font-bold mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-gray-700 text-sm font-bold mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                {availableYears.length > 0 ? (
                  availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))
                ) : (
                  // Fallback if availableYears is empty
                  [...Array(3)].map((_, i) => {
                    const year = currentYear - 1 + i;
                    return <option key={year} value={year}>{year}</option>
                  })
                )}
              </select>
            </div>
            <button
              onClick={handleSelectMonth}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Load Portfolio
            </button>
          </div>
        </div>
        
        {/* Portfolio Summary */}
        <div className="bg-white shadow-md rounded p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Portfolio Summary - {monthNames[selectedMonth-1]} {selectedYear}
          </h2>
          <div className="flex flex-wrap justify-between gap-4">
            <div className="bg-gray-100 rounded p-4 shadow-inner w-full md:w-72">
              <h3 className="text-gray-600 text-sm">Total Portfolio Value</h3>
              <div className="text-3xl font-bold">{formatCurrency(totalPortfolioValue)}</div>
            </div>
            <div className="bg-gray-100 rounded p-4 shadow-inner w-full md:w-72">
              <h3 className="text-gray-600 text-sm">Number of Assets</h3>
              <div className="text-3xl font-bold">{currentAssets.length}</div>
            </div>
          </div>
        </div>

        {/* Asset Form */}
        <form onSubmit={addAsset} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-bold mb-4">Add New Asset for {monthNames[selectedMonth]} {selectedYear}</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Asset Name"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                placeholder="Asset Value"
                value={assetValue}
                onChange={(e) => setAssetValue(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Add Asset
            </button>
          </div>
        </form>

        {/* Portfolio Breakdown Table */}
        <h2 className="text-2xl font-bold mb-4">Portfolio Breakdown - {monthNames[selectedMonth]} {selectedYear}</h2>
        <div className="overflow-x-auto bg-white shadow-md rounded mb-8">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-200">
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('asset_name')}
                >
                  Asset Name
                  {sortField === 'asset_name' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('asset_value')}
                >
                  Asset Value
                  {sortField === 'asset_value' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('allocation')}
                >
                  Allocation %
                  {sortField === 'allocation' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAssetsWithAllocation.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{asset.asset_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(asset.asset_value)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{asset.allocation}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleEditClick(asset)}
                      className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Total row */}
              {totalPortfolioValue > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td className="px-6 py-4 whitespace-nowrap">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(totalPortfolioValue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">100%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Portfolio Charts Section */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="w-full md:w-1/2 bg-white shadow-md rounded p-6">
            <h2 className="text-xl font-bold mb-4">Asset Allocation</h2>
            <div className="h-80">
              <Pie data={pieChartData} options={{maintainAspectRatio: false}} />
            </div>
          </div>
          
          <div className="w-full md:w-1/2 bg-white shadow-md rounded p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Portfolio Progress</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowYearlyView(false)} 
                  className={`px-4 py-1 rounded ${!showYearlyView ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setShowYearlyView(true)}
                  className={`px-4 py-1 rounded ${showYearlyView ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Yearly
                </button>
              </div>
            </div>
            <div className="h-80">
              <Line 
                data={monthlyProgressData}
                options={{...chartOptions, maintainAspectRatio: false}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Asset Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-96">
            <h2 className="text-xl font-bold mb-4">Edit {editingAsset?.asset_name}</h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Asset Value
              </label>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
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
