import React, { useState, useEffect } from 'react';

const WeeklyInsights = ({ isSignedIn }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState('Current');

  // Generate week numbers 1-52
  const weekOptions = ['Current', ...Array.from({ length: 52 }, (_, i) => `${i + 1}`)];

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

  const fetchInsights = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view insights');
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
        setError('No data found');
        setLoading(false);
        return;
      }

      // Determine which week to analyze
      const weekToAnalyze = selectedWeek === 'Current' ? currentWeek : parseInt(selectedWeek);

      const processedInsights = processWeeklyScorecard(rows, weekToAnalyze);
      setInsights(processedInsights);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError('Failed to fetch insights from Google Sheets');
      setLoading(false);
    }
  };

  const processWeeklyScorecard = (rows, weekNum) => {
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const weekNumIndex = headers.findIndex(h => h === 'WeekNum');
    const amountIndex = headers.findIndex(h => h === 'Amount');
    const categoryIndex = headers.findIndex(h => h === 'Category');
    const weeklyBudgetIndex = headers.findIndex(h => h === 'Weekly Budget');
    const descriptionIndex = headers.findIndex(h => h === 'Description');
    
    if (weekNumIndex === -1 || amountIndex === -1 || categoryIndex === -1) {
      return null;
    }

    // Group spending by week and category
    const spendingByWeekCategory = {};
    const budgets = {};
    
    dataRows.forEach(row => {
      const rowWeekNum = row[weekNumIndex];
      const amount = parseFloat(row[amountIndex]) || 0;
      const category = row[categoryIndex];
      const description = row[descriptionIndex] || '';
      const budget = parseFloat(row[weeklyBudgetIndex]) || 0;
      
      if (!rowWeekNum || !category) return;
      
      // Extract week number (handle formats like "2025-W01" or "1")
      const weekNumOnly = rowWeekNum.toString().match(/\d+$/)?.[0];
      if (!weekNumOnly) return;
      
      const weekNumInt = parseInt(weekNumOnly);
      const key = `${weekNumInt}-${category}`;
      
      // Store budgets from "Initialise" rows
      if (description.toLowerCase() === 'initialise') {
        budgets[category] = budget;
        return;
      }
      
      // Accumulate spending
      if (!spendingByWeekCategory[key]) {
        spendingByWeekCategory[key] = 0;
      }
      spendingByWeekCategory[key] += amount;
    });

    // Get unique categories that have budgets
    const categoriesWithBudgets = Object.keys(budgets);
    
    // Calculate this week and last week totals
    let totalThisWeek = 0;
    let totalLastWeek = 0;
    let totalBudget = 0;
    let categoriesOnTrack = 0;
    let maxPercentUsed = 0;
    
    // Build category details for bar charts
    const categoryDetails = [];
    
    categoriesWithBudgets.forEach(category => {
      const thisWeekKey = `${weekNum}-${category}`;
      const lastWeekKey = `${weekNum - 1}-${category}`;
      
      const thisWeek = spendingByWeekCategory[thisWeekKey] || 0;
      const lastWeek = spendingByWeekCategory[lastWeekKey] || 0;
      const budget = budgets[category] || 0;
      
      totalThisWeek += thisWeek;
      totalLastWeek += lastWeek;
      totalBudget += budget;
      
      // Check if category is on track (under or equal to budget)
      if (budget > 0 && thisWeek <= budget) {
        categoriesOnTrack++;
      }
      
      // Only include categories with budgets > 0
      if (budget > 0) {
        const percentUsed = (thisWeek / budget) * 100;
        maxPercentUsed = Math.max(maxPercentUsed, percentUsed);
        
        categoryDetails.push({
          category,
          spent: thisWeek,
          budget,
          percentUsed
        });
      }
    });
    
    // Sort categories by percent used (descending) so over-budget items appear first
    categoryDetails.sort((a, b) => b.percentUsed - a.percentUsed);
    
    const totalDifference = totalThisWeek - totalLastWeek;
    const totalPercentChange = totalLastWeek > 0 ? (totalDifference / totalLastWeek) * 100 : 0;
    const totalCategories = categoriesWithBudgets.length;

    // Calculate dynamic scale for bar chart (minimum 100%, but extend if needed)
    const chartScale = Math.max(100, Math.ceil(maxPercentUsed / 20) * 20); // Round up to nearest 20%

    return {
      weekNum,
      totalThisWeek,
      totalLastWeek,
      totalBudget,
      totalDifference,
      totalPercentChange,
      categoriesOnTrack,
      totalCategories,
      categoryDetails,
      chartScale
    };
  };

  return (
    <div className="weekly-insights-container">
      <h2 className="insights-title">
        WEEK {selectedWeek === 'Current' ? currentWeek : selectedWeek} SPENDING SCORECARD
      </h2>
      
      {/* Week Filter */}
      <div className="insights-filter">
        <div className="filter-group">
          <label htmlFor="week-filter-select">WEEK:</label>
          <select
            id="week-filter-select"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="filter-dropdown"
          >
            {weekOptions.map(week => (
              <option key={week} value={week}>
                {week === 'Current' ? `Current (Week ${currentWeek})` : `Week ${week}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button 
        onClick={fetchInsights}
        disabled={loading || !isSignedIn}
        className="refresh-button"
        style={{ marginBottom: '30px' }}
      >
        {loading ? 'LOADING...' : 'LOAD SCORECARD'}
      </button>

      {error && <div className="chart-error">{error}</div>}

      {insights && !error && (
        <>
          {/* Top Scorecard - 3 metrics */}
          <div className="scorecard">
            <div className="scorecard-row">
              <div className="scorecard-item">
                <span className="scorecard-label">Total Spent</span>
                <span className="scorecard-value">
                  ${insights.totalThisWeek.toFixed(2)}
                </span>
                <span className="scorecard-subtext">
                  of ${insights.totalBudget.toFixed(2)} budget
                </span>
                <span className="scorecard-percentage">
                  ({((insights.totalThisWeek / insights.totalBudget) * 100).toFixed(0)}%)
                </span>
              </div>
              
              <div className="scorecard-item">
                <span className="scorecard-label">vs Last Week</span>
                <span className={`scorecard-value ${insights.totalDifference > 0 ? 'negative' : 'positive'}`}>
                  {insights.totalDifference > 0 ? '+' : ''}${insights.totalDifference.toFixed(2)}
                </span>
                <span className="scorecard-subtext">
                  {insights.totalPercentChange > 0 ? '+' : ''}{insights.totalPercentChange.toFixed(1)}% change
                </span>
                <span className="scorecard-icon">
                  {insights.totalDifference > 0 ? '↑' : insights.totalDifference < 0 ? '↓' : '→'}
                </span>
              </div>
              
              <div className="scorecard-item">
                <span className="scorecard-label">Categories On Track</span>
                <span className="scorecard-value">
                  {insights.categoriesOnTrack} / {insights.totalCategories}
                </span>
                <span className="scorecard-subtext">
                  categories under budget
                </span>
                <span className={`scorecard-status ${insights.totalBudget >= insights.totalThisWeek ? 'success' : 'warning'}`}>
                  {insights.totalBudget >= insights.totalThisWeek ? '✓ On Track' : '⚠️ Over Budget'}
                </span>
              </div>
            </div>
          </div>

          {/* Category Bar Charts with Dynamic Scale */}
          <div className="category-bars-container">
            <h3 className="category-bars-title">BUDGET USAGE BY CATEGORY</h3>
            <div className="category-bars-legend">
              <span className="legend-text">Scale: 0% - {insights.chartScale}%</span>
            </div>
            <div className="category-bars-list">
              {insights.categoryDetails.map((category, index) => {
                // Scale the bar width relative to chartScale (not 100%)
                const scaledWidth = (category.percentUsed / insights.chartScale) * 100;
                const clampedWidth = Math.min(scaledWidth, 100); // Never exceed track width
                
                // Calculate where 100% marker should be positioned
                const marker100Position = (100 / insights.chartScale) * 100;
                
                const isOverBudget = category.percentUsed > 100;
                const isNearBudget = category.percentUsed > 80 && category.percentUsed <= 100;
                
                return (
                  <div key={index} className="category-bar-item">
                    <div className="category-bar-header">
                      <span className="category-bar-name">{category.category}</span>
                      <span className="category-bar-amounts">
                        ${category.spent.toFixed(2)} / ${category.budget.toFixed(2)}
                      </span>
                    </div>
                    <div className="category-bar-wrapper">
                      <div className="category-bar-track">
                        {/* 100% Budget Marker - No Label */}
                        {insights.chartScale > 100 && (
                          <div 
                            className="budget-marker-line" 
                            style={{ left: `${marker100Position}%` }}
                          >
                          </div>
                        )}
                        
                        <div 
                          className={`category-bar-fill ${isOverBudget ? 'over-budget' : isNearBudget ? 'near-budget' : 'good'}`}
                          style={{ width: `${clampedWidth}%` }}
                        >
                          <span className="category-bar-percent">
                            {category.percentUsed.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!insights && !error && !loading && (
        <div className="chart-placeholder">
          Click "LOAD SCORECARD" to view your weekly spending summary
        </div>
      )}
    </div>
  );
};

export default WeeklyInsights;
