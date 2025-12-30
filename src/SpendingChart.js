import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
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

const SpendingChart = ({ isSignedIn }) => {
  const [chartData, setChartData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWeek, setSelectedWeek] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [currentWeek, setCurrentWeek] = useState('');

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

  // Generate week numbers 1-52
  const weekNumbers = ['All', ...Array.from({ length: 52 }, (_, i) => `${i + 1}`)];

  // Calculate current date and week number
  React.useEffect(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const weekNum = getWeekNumber(now);
    setCurrentDate(dateStr);
    setCurrentWeek(`Week ${weekNum}`);
  }, []);

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const fetchDataAndGenerateChart = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view spending data');
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

      // Process the data
      const processedData = processSpendingData(rows, selectedCategory, selectedWeek);
      
      if (!processedData || processedData.labels.length === 0) {
        setError('No data available for the selected filters');
        setLoading(false);
        return;
      }
      
      setChartData(processedData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data from Google Sheets. Please check your permissions.');
      setLoading(false);
    }
  };

  const processSpendingData = (rows, category, weekFilter) => {
    // First row is headers
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Find column indices
    const weekNumIndex = headers.findIndex(h => h === 'WeekNum');
    const amountIndex = headers.findIndex(h => h === 'Amount');
    const categoryIndex = headers.findIndex(h => h === 'Category');
    const weeklyBudgetIndex = headers.findIndex(h => h === 'Weekly Budget');
    const descriptionIndex = headers.findIndex(h => h === 'Description');
    
    if (weekNumIndex === -1 || amountIndex === -1 || categoryIndex === -1) {
      console.error('Required columns not found. Headers:', headers);
      return null;
    }
    
    // Get weekly budget for selected category
    let weeklyBudget = 0;
    if (weeklyBudgetIndex !== -1 && descriptionIndex !== -1) {
      dataRows.forEach(row => {
        const description = row[descriptionIndex] || '';
        const expenseCategory = row[categoryIndex];
        const budget = parseFloat(row[weeklyBudgetIndex]) || 0;
        
        if (description.toLowerCase() === 'initialise') {
          if (category === 'All') {
            weeklyBudget += budget;
          } else if (expenseCategory === category) {
            weeklyBudget = budget;
          }
        }
      });
    }
    
    // Group data by week number
    const weeklySpending = {};
    
    dataRows.forEach(row => {
      const weekNum = row[weekNumIndex];
      const amount = parseFloat(row[amountIndex]) || 0;
      const expenseCategory = row[categoryIndex];
      
      // Skip rows without week number
      if (!weekNum) return;
      
      // Filter by category if not "All"
      if (category !== 'All' && expenseCategory !== category) {
        return;
      }
      
      // Filter by week if not "All"
      if (weekFilter !== 'All') {
        // Extract just the week number from formats like "2025-W01" or "1"
        const weekNumOnly = weekNum.toString().match(/\d+$/)?.[0];
        if (weekNumOnly !== weekFilter) {
          return;
        }
      }
      
      // Accumulate spending by week
      if (!weeklySpending[weekNum]) {
        weeklySpending[weekNum] = 0;
      }
      weeklySpending[weekNum] += amount;
    });

    // Sort weeks numerically and prepare chart data
    const sortedWeeks = Object.keys(weeklySpending).sort((a, b) => {
      // Extract year and week number for proper sorting
      const parseWeek = (w) => {
        const match = w.match(/(\d{4})-W(\d+)/);
        if (match) {
          return parseInt(match[1]) * 100 + parseInt(match[2]);
        }
        return parseInt(w) || 0;
      };
      return parseWeek(a) - parseWeek(b);
    });
    
    const amounts = sortedWeeks.map(week => weeklySpending[week]);
    const budgetLine = sortedWeeks.map(() => weeklyBudget);

    return {
      labels: sortedWeeks,
      datasets: [
        {
          type: 'bar',
          label: category === 'All' ? 'Total Spending' : `${category} Spending`,
          data: amounts,
          backgroundColor: 'rgba(43, 43, 43, 0.8)',
          borderColor: 'rgba(43, 43, 43, 1)',
          borderWidth: 1,
        },
        {
          type: 'line',
          label: 'Weekly Budget',
          data: budgetLine,
          borderColor: 'rgba(211, 47, 47, 1)',
          backgroundColor: 'rgba(211, 47, 47, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderDash: [5, 5],
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            family: 'Inter',
            size: 12,
            weight: '600',
          },
          color: '#2b2b2b',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(43, 43, 43, 0.9)',
        titleFont: {
          family: 'Inter',
          size: 13,
          weight: '600',
        },
        bodyFont: {
          family: 'Inter',
          size: 12,
        },
        padding: 12,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11,
          },
          color: '#666',
          maxRotation: 45,
          minRotation: 0,
        },
        title: {
          display: true,
          text: 'Week Number',
          font: {
            family: 'Inter',
            size: 12,
            weight: '600',
          },
          color: '#2b2b2b',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11,
          },
          color: '#666',
          callback: function(value) {
            return '$' + value.toFixed(0);
          }
        },
        title: {
          display: true,
          text: 'Amount ($)',
          font: {
            family: 'Inter',
            size: 12,
            weight: '600',
          },
          color: '#2b2b2b',
        },
      },
    },
  };

  return (
    <div className="spending-chart-container">
      <h2 className="chart-title">EXPENSE TRACKER</h2>
      
      {/* Current Date and Week */}
      <div className="date-info">
        <p className="current-date">{currentDate}</p>
        <p className="current-week">{currentWeek}</p>
      </div>
      
      <div className="chart-controls">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="category-select">CATEGORY:</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-dropdown"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="week-select">WEEK:</label>
            <select
              id="week-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="filter-dropdown"
            >
              {weekNumbers.map(week => (
                <option key={week} value={week}>{week}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button 
          onClick={fetchDataAndGenerateChart}
          disabled={loading || !isSignedIn}
          className="refresh-button"
        >
          {loading ? 'LOADING...' : 'LOAD DATA'}
        </button>
      </div>

      {error && (
        <div className="chart-error">
          {error}
        </div>
      )}

      {chartData && !error && (
        <div className="chart-wrapper">
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}

      {!chartData && !error && !loading && (
        <div className="chart-placeholder">
          Click "LOAD DATA" to view your spending trends
        </div>
      )}
    </div>
  );
};

export default SpendingChart;
