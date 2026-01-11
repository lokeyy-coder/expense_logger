import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const CumulativeBudgetTracker = ({ isSignedIn }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [chartData, setChartData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);

  const categories = [
    'All',
    'Dating Allowance',
    'Petrol',
    'Gift Allowance',
    'Wellbeing allowance - Andrew',
    'Wellbeing allowance - Emmy',
    'Wellbeing allowance - Together',
    'Car Expenses',
    'Utilities (Water, Gas & Elec)',
    'Groceries',
    'Food & Dining',
    'Household Goods (e.g. Medicine, Cleaning, Small goods)',
    'Others'
  ];

  // Calculate current week number
  useEffect(() => {
    const now = new Date();
    const weekNum = getWeekNumber(now);
    setCurrentWeek(weekNum);
  }, []);

  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    const yearStart = new Date(d.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);
    
    // Calculate days since start of year (0-based)
    const daysSinceYearStart = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
    
    // Get day of week for Jan 1st (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const jan1DayOfWeek = yearStart.getDay();
    
    // Calculate days until the first Monday
    // Week 1 is from Jan 1 until the Sunday before the first Monday
    // Week 2 starts on the first Monday
    let daysToFirstMonday;
    if (jan1DayOfWeek === 1) {
      // Jan 1 is Monday, so first Monday is Jan 1 itself (Week 1 would be 0 days, doesn't exist)
      // Actually, if Jan 1 is Monday, then Week 1 is Mon-Sun (7 days)
      daysToFirstMonday = 7;
    } else if (jan1DayOfWeek === 0) {
      // Jan 1 is Sunday, first Monday is Jan 2 (Week 1 is just 1 day)
      daysToFirstMonday = 1;
    } else {
      // Jan 1 is Tue-Sat, first Monday is some days away
      // Days from Jan 1 to the next Monday
      daysToFirstMonday = 8 - jan1DayOfWeek;
    }
    
    // If we're still in Week 1
    if (daysSinceYearStart < daysToFirstMonday) {
      return 1;
    }
    
    // Calculate week number from the first Monday onwards
    const daysFromFirstMonday = daysSinceYearStart - daysToFirstMonday;
    const weekNumber = Math.floor(daysFromFirstMonday / 7) + 2;
    
    return weekNumber;
  };

  const fetchDataAndGenerateChart = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view cumulative budget data');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Configured_Input!A:O',
      });

      const rows = response.result.values;
      
      if (!rows || rows.length <= 1) {
        setError('No data found in the sheet');
        setLoading(false);
        return;
      }

      const processedData = processCumulativeData(rows, selectedCategory, currentWeek);
      
      if (!processedData) {
        setError('No data available for the selected category');
        setLoading(false);
        return;
      }
      
      setChartData(processedData.chartData);
      setMetrics(processedData.metrics);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data from Google Sheets. Please check your permissions.');
      setLoading(false);
    }
  };

  const processCumulativeData = (rows, category, currentWeekNum) => {
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const weekNumIndex = headers.findIndex(h => h === 'WeekNum');
    const amountIndex = headers.findIndex(h => h === 'Amount');
    const categoryIndex = headers.findIndex(h => h === 'Category');
    const weeklyBudgetIndex = headers.findIndex(h => h === 'Weekly Budget');
    const descriptionIndex = headers.findIndex(h => h === 'Description');
    const dateIndex = headers.findIndex(h => h === 'Date');
    
    if (weekNumIndex === -1 || amountIndex === -1 || categoryIndex === -1) {
      console.error('Required columns not found');
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get weekly budget for selected category
    let weeklyBudget = 0;
    dataRows.forEach(row => {
      const rowCategory = row[categoryIndex];
      const description = row[descriptionIndex] || '';
      const budget = parseFloat(row[weeklyBudgetIndex]) || 0;
      
      if (description.toLowerCase() === 'initialise') {
        if (category === 'All' && budget > 0) {
          weeklyBudget += budget;
        } else if (rowCategory === category && budget > 0) {
          weeklyBudget = budget;
        }
      }
    });

    // Group spending by week
    const spendingByWeek = {};
    let totalSpendToDate = 0;
    
    dataRows.forEach(row => {
      const rowWeekNum = row[weekNumIndex];
      const amount = parseFloat(row[amountIndex]) || 0;
      const rowCategory = row[categoryIndex];
      const description = row[descriptionIndex] || '';
      const dateStr = row[dateIndex];
      
      // Skip initialise rows
      if (description.toLowerCase() === 'initialise') return;
      
      // Parse date and check if it's not in the future
      if (dateStr) {
        const transactionDate = new Date(dateStr);
        if (transactionDate > today) return; // Skip future transactions
      }
      
      // Check category filter
      if (category !== 'All' && rowCategory !== category) return;
      
      // Extract week number
      const weekNumOnly = rowWeekNum?.toString().match(/\d+$/)?.[0];
      if (!weekNumOnly) return;
      
      const weekNumInt = parseInt(weekNumOnly);
      
      if (!spendingByWeek[weekNumInt]) {
        spendingByWeek[weekNumInt] = 0;
      }
      
      spendingByWeek[weekNumInt] += amount;
      totalSpendToDate += amount;
    });

    // Calculate cumulative spending for each week (1-52)
    const cumulativeSpending = [];
    const budgetLine = [];
    const weekLabels = [];
    
    let cumulative = 0;
    for (let week = 1; week <= 52; week++) {
      const weekSpend = spendingByWeek[week] || 0;
      cumulative += weekSpend;
      
      cumulativeSpending.push(cumulative);
      budgetLine.push(weeklyBudget * week);
      weekLabels.push(`W${week}`);
    }

    // Calculate metrics
    const totalBudgetToDate = weeklyBudget * currentWeekNum;
    const totalSpendDelta = totalSpendToDate - totalBudgetToDate;
    const averageWeeklySpend = currentWeekNum > 0 ? totalSpendToDate / currentWeekNum : 0;
    const budgetedAverageWeeklySpend = weeklyBudget;
    const weeklySpendDelta = averageWeeklySpend - budgetedAverageWeeklySpend;

    const chartData = {
      labels: weekLabels,
      datasets: [
        {
          type: 'line',
          label: 'Budgeted Cumulative (Linear)',
          data: budgetLine,
          borderColor: '#2b2b2b',
          backgroundColor: 'rgba(43, 43, 43, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
          order: 1
        },
        {
          type: 'bar',
          label: 'Actual Cumulative Spending',
          data: cumulativeSpending,
          backgroundColor: cumulativeSpending.map((spend, index) => 
            spend > budgetLine[index] ? 'rgba(211, 47, 47, 0.7)' : 'rgba(76, 175, 80, 0.7)'
          ),
          borderColor: cumulativeSpending.map((spend, index) => 
            spend > budgetLine[index] ? '#d32f2f' : '#4caf50'
          ),
          borderWidth: 1,
          order: 2
        }
      ]
    };

    const metrics = {
      totalSpendToDate,
      totalBudgetToDate,
      totalSpendDelta,
      averageWeeklySpend,
      budgetedAverageWeeklySpend,
      weeklySpendDelta,
      currentWeekNum
    };

    return { chartData, metrics };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'Inter',
            size: 12,
            weight: '600'
          },
          padding: 16,
          boxWidth: 12,
          boxHeight: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          family: 'Inter',
          size: 13,
          weight: '700'
        },
        bodyFont: {
          family: 'Inter',
          size: 12
        },
        padding: 12,
        boxPadding: 6,
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 10
          },
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11
          },
          callback: function(value) {
            return '$' + value.toFixed(0);
          }
        }
      }
    }
  };

  return (
    <div className="cumulative-tracker-container">
      <h2 className="tracker-title">CUMULATIVE BUDGET TRACKER</h2>
      
      {/* Category Filter */}
      <div className="tracker-controls">
        <div className="filter-group">
          <label htmlFor="category-filter">CATEGORY:</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-dropdown"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <button 
          onClick={fetchDataAndGenerateChart}
          disabled={loading || !isSignedIn}
          className="refresh-button"
        >
          {loading ? 'LOADING...' : 'LOAD DATA'}
        </button>
      </div>

      {error && <div className="chart-error">{error}</div>}

      {/* Metrics Display */}
      {metrics && !error && (
        <div className="tracker-metrics">
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Total Spend to Date</span>
              <span className="metric-value">${metrics.totalSpendToDate.toFixed(2)}</span>
              <span className={`metric-subtext ${metrics.totalSpendDelta < 0 ? 'positive' : 'negative'}`}>
                {metrics.totalSpendDelta < 0 ? '' : '+'}${metrics.totalSpendDelta.toFixed(2)} vs budget
              </span>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">Total Budget to Date</span>
              <span className="metric-value">${metrics.totalBudgetToDate.toFixed(2)}</span>
              <span className="metric-subtext">Through Week {metrics.currentWeekNum}</span>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">Average Weekly Spend</span>
              <span className="metric-value">${metrics.averageWeeklySpend.toFixed(2)}</span>
              <span className={`metric-subtext ${metrics.weeklySpendDelta < 0 ? 'positive' : 'negative'}`}>
                {metrics.weeklySpendDelta < 0 ? '' : '+'}${metrics.weeklySpendDelta.toFixed(2)} vs budget
              </span>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">Budgeted Weekly Spend</span>
              <span className="metric-value">${metrics.budgetedAverageWeeklySpend.toFixed(2)}</span>
              <span className="metric-subtext">Target per week</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart Display */}
      {chartData && !error && (
        <div className="tracker-chart-wrapper">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {!chartData && !error && !loading && (
        <div className="chart-placeholder">
          Select a category and click "LOAD DATA" to view cumulative spending
        </div>
      )}
    </div>
  );
};

export default CumulativeBudgetTracker;
